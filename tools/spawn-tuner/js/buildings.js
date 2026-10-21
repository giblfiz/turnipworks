// WHOLE BUILDINGS (docs/BUILDINGS.md; Harry 2026-10-11: "the same way we have some complicated drawing rules for rooms,
// we are going to need some complicated drawing rules for buildings").
// A dragged footprint + a building type + a seed -> a PLAN: rooms (type, cells, level), which rooms have a door
// between them and where, the entrance, and the stairs. Pure data, no imports, deterministic from the seed: the game
// (engine/client) turns a plan into room.spawn / object.place commands, the gallery (buildings/) draws it, the tests
// sweep it. The per-room layout program furnishes each room afterwards, as it always has.
//
// "Realistic vs gamist" is THREE dials, and every type has a default on each (BUILDING_TYPES):
//   loops    circulation: 0 a TREE (a hall or hub as spine, rooms as leaves) .. 1 LOOPS (several routes, real choices)
//   pacing   what decides which rooms touch: 0 FUNCTION (kitchen on the common room) .. 1 PACING (depth from the door)
//   carved   the envelope: 0 PACKED (rooms share walls and fill the rectangle) .. 1 CARVED (rooms in rock, corridors between)
// Two solvers: packed() and carved(). Both work in a canonical frame, cells (u, v), with the STREET at v = D; the plan
// is turned into the world at the end (opts.front: which side of the dragged rectangle is the street; 'S' unless told).
//
//   generate({ code, rect: {x, z, w, d}, seed, storeys?, front?, dials?, types?, roles?, outbuildings?, flavor? }) -> plan
//   check(plan) -> [{ rule, ok, detail }]          BUILDING_TYPES, programmeFor(code, types, roles)
export const CELL = 5, STOREY = 10, MAX_SIDE = 16;

// ---------------------------------------------------------------- the per-type table ----------------------------
// A NEW TYPE IS ONE ENTRY HERE. With no entry a type still builds: programmeFor() derives one from its rooms' roles.
//   dials    the defaults of the three dials            storeys  { def, min, max } and why
//   down     extra levels go DOWN (a dungeon) instead of up
//   hub      the room people arrive in and that other rooms open off    hall  the type's hallway room
//   rooms    the programme, in priority order. Per room:
//     w [min, preferred, max]  its length along the hall or hub wall, in cells (the strip's depth is the other side)
//     floor 'g' ground, 'u' upper, 'c' cellar (under `under`), or several ('gu')
//     zone  'back' behind the hub (service), 'side' beside the hub at the street (public), 'wing' along a corridor
//     touch 'hub' must open off the hub; another room's key: opens off THAT room (a storeroom off its kitchen)
//     near  should share a wall with this room, and gets a door to it when it does (the kitchen and the dining room)
//     need  always present        from  only when the footprint has at least this many cells
//     fill  repeats to fill what is left      cap   wants the end of the corridor (a room across the end)
//     priv  private: never a thoroughfare, never an extra door       one   exactly one door (a strong room)
//     alt   the name of the second and later rooms of this type (the type's own label names the first)
//     ends  entered at a short wall (a chapel, a throne room)        set   a set-piece room for the carved solver, size [wmin, wmax, dmin, dmax]
//   out      what stands outside the envelope: { key, side: 'back' | 'front', depth, from, with: [{ key, size }] }
export const BUILDING_TYPES = {
  TAV: { label: 'Inn', full: 42, dials: { loops: 0, pacing: 0, carved: 0 }, storeys: { def: 2, min: 1, max: 3, why: 'drink and food below, beds above: the inn everyone pictures' },
    hub: { key: 'common', w: [5, 8, 14], d: [4, 6, 9], share: 0.4 }, hall: 'hallway', spare: 'storeroom', small: 'storeroom',
    rooms: [
      { key: 'kitchen', floor: 'g', zone: 'back', touch: 'hub', w: [3, 4, 7], need: true, yard: true },
      { key: 'storeroom', floor: 'g', zone: 'back', touch: 'kitchen', w: [2, 3, 4], from: 60 },
      { key: 'privy', floor: 'g', zone: 'back', w: [2, 2, 2], priv: true, need: true },
      { key: 'desk', floor: 'g', zone: 'side', touch: 'hub', w: [3, 3, 4], from: 80 },
      { key: 'fine', floor: 'u', cap: true, w: [4, 5, 6], priv: true, from: 70 },
      { key: 'privy', floor: 'u', w: [2, 2, 2], priv: true, from: 110 },
      { key: 'guest', floor: 'gu', fill: true, w: [3, 3, 4], priv: true },
      { key: 'cellar', floor: 'c', under: 'kitchen' },
    ],
    out: [{ key: 'yard', side: 'back', depth: 5, from: 48, with: [{ key: 'stable', size: [6, 4], from: 70 }] }] },
  NOB: { label: 'Mansion', full: 110, dials: { loops: 0.2, pacing: 0, carved: 0 }, storeys: { def: 2, min: 1, max: 3, why: 'reception rooms below, the family above; a loop or two for the servants' },
    hub: { key: 'mansion-hall', w: [5, 6, 8], d: [5, 6, 8], share: 0.2, centred: true }, hall: 'mansion-corridor', spare: 'mansion-drawing', small: 'mansion-drawing',
    rooms: [
      { key: 'mansion-dining', floor: 'g', zone: 'side', touch: 'hub', w: [4, 6, 8], need: true },
      { key: 'mansion-drawing', floor: 'g', zone: 'side', w: [4, 5, 7], need: true, yard: true },
      { key: 'mansion-kitchen', floor: 'g', zone: 'back', near: 'mansion-dining', w: [4, 5, 7], need: true, yard: true },
      { key: 'mansion-library', floor: 'g', zone: 'back', w: [3, 4, 6], from: 70 },
      { key: 'mansion-ballroom', floor: 'g', zone: 'wing', w: [6, 8, 12], from: 220 },
      { key: 'mansion-conservatory', floor: 'g', zone: 'back', w: [4, 5, 6], from: 150, yard: true },
      { key: 'mansion-bedroom', floor: 'u', fill: true, w: [4, 5, 6], priv: true, alt: 'Bedroom' }, // (one master bedroom; the rest are "Bedroom")
      { key: 'mansion-library', floor: 'u', w: [4, 4, 6], from: 130 },
      { key: 'mansion-cellar', floor: 'c', under: 'mansion-kitchen' },
    ],
    out: [{ key: 'mansion-garden', side: 'back', depth: 6, from: 60 }] },
  CAS: { label: 'Castle', full: 120, dials: { loops: 0.45, pacing: 0.3, carved: 0 }, storeys: { def: 2, min: 1, max: 3, why: 'a keep is tall: hall, kitchen and garrison below, the throne and the chapel above, the dungeon under it' },
    hub: { key: 'great-hall', w: [5, 6, 8], d: [7, 10, 14], share: 0.34, deep: true }, hall: 'castle-passage', spare: 'barracks', small: 'armoury',
    rooms: [
      { key: 'castle-kitchen', floor: 'g', zone: 'back', touch: 'hub', w: [4, 5, 7], need: true },
      { key: 'barracks', floor: 'g', zone: 'wing', w: [4, 6, 8], need: true },
      { key: 'armoury', floor: 'gu', zone: 'wing', w: [3, 4, 5], need: true },
      { key: 'throne-room', floor: 'u', cap: true, ends: true, w: [5, 7, 9], from: 60 },
      { key: 'chapel', floor: 'ug', zone: 'wing', ends: true, w: [4, 4, 5], from: 70 },
      { key: 'barracks', floor: 'u', fill: true, w: [5, 6, 8] },
      { key: 'dungeon', floor: 'c', under: 'hub' },
    ],
    out: [{ key: 'courtyard', side: 'front', depth: 7, from: 60, with: [{ key: 'gatehouse', size: [3, 5], gate: true }] }] },
  CRY: { label: 'Crypt', full: 120, dials: { loops: 0.3, pacing: 0, carved: 1 }, storeys: { def: 1, min: 1, max: 3, why: 'one level of dungeon; more levels go DOWN' }, down: true, corridor: 2,
    hub: { key: 'crypt-antechamber', w: [4, 4, 6], d: [3, 3, 5], share: 0.12 }, hall: 'crypt-passage', spare: 'crypt-vault',
    rooms: [
      { key: 'crypt-vault', set: [4, 7, 4, 6], w: [4, 5, 7], weight: 3 },
      { key: 'crypt-ossuary', set: [4, 5, 4, 5], w: [4, 4, 5], weight: 2 },
      { key: 'crypt-chapel', set: [4, 4, 6, 8], w: [4, 4, 5], ends: true, weight: 1, max: 1 },
      { key: 'crypt-embalming', set: [4, 5, 4, 5], w: [4, 4, 5], weight: 1, max: 1 },
      { key: 'crypt-catacomb', set: [7, 10, 3, 3], w: [7, 8, 10], weight: 1, max: 2 },
      { key: 'crypt-relic', set: [3, 3, 3, 3], w: [3, 3, 3], one: true, priv: true, reward: true, weight: 1, max: 1 },
    ] },
  // type:min (2026-10-12). A mine is mostly tunnel: carved, looping, levels going DOWN the shaft. The shaft head is the room you
  // arrive in on every level (the ladder core stands in it); min-tunnel is the corridor; the stores sit near the shaft, the
  // faces, the fall and the water at the dead ends, the crystal seam at the deepest one (reward: the carved solver's pacing
  // rule moves it there). Depth hints per room: walls.js MIN_DEPTH. The pithead yard and the smelter house are the surface:
  // drawn beside the way down, not laid by the carved solver (it has no outside).
  MIN: { label: 'Mine', full: 120, dials: { loops: 0.4, pacing: 0.5, carved: 1 }, storeys: { def: 2, min: 1, max: 3, why: 'a mine is levels down a shaft: two to start, the ladder way through every shaft head' }, down: true, corridor: 2,
    hub: { key: 'min-shaft-head', w: [4, 5, 6], d: [4, 5, 6], share: 0.12 }, hall: 'min-tunnel', spare: 'min-face',
    rooms: [
      { key: 'min-face', set: [3, 4, 3, 4], w: [3, 4, 4], ends: true, weight: 3 },
      { key: 'min-sorting', set: [5, 7, 4, 6], w: [5, 6, 7], weight: 2, max: 1 },
      { key: 'min-junction', set: [4, 4, 4, 4], w: [4, 4, 4], weight: 1, max: 2 },
      { key: 'min-mess', set: [5, 6, 4, 4], w: [5, 6, 6], weight: 1, max: 1 },
      { key: 'min-tool-store', set: [3, 4, 3, 3], w: [3, 4, 4], weight: 1, max: 1 },
      { key: 'min-collapsed', set: [4, 6, 3, 3], w: [4, 5, 6], ends: true, weight: 1, max: 2 },
      { key: 'min-flooded', set: [5, 6, 3, 4], w: [5, 6, 6], ends: true, weight: 1, max: 1 },
      { key: 'min-powder-store', set: [3, 3, 3, 3], w: [3, 3, 3], one: true, priv: true, weight: 1, max: 1 },
      { key: 'min-seam', set: [4, 5, 4, 5], w: [4, 5, 5], one: true, priv: true, reward: true, weight: 1, max: 1 },
    ] },
  // smithy & workshop (type:smi): the FORGE is the hub and stands open to the street (a smithy's wide door; the stair core and the doors to the
  // other rooms take its back wall, so the forge itself goes on a side wall); the shop front is beside it at the street (as the inn's front desk
  // is: the shop skeleton needs its back wall for the counter); the store opens off the forge; the other workshops behind and in the wing as the
  // plot grows; the smith lives above. The yard (shoeing stocks, hitching rail) is at the back
  SMI: { label: 'Smithy & workshop', full: 60, dials: { loops: 0, pacing: 0, carved: 0 }, storeys: { def: 2, min: 1, max: 2, why: 'the works below, the smith and his household above' },
    hub: { key: 'smi-forge', w: [4, 5, 7], d: [4, 4, 6], share: 0.3 }, hall: 'smi-passage', spare: 'smi-stock', small: 'smi-stock',
    rooms: [
      { key: 'smi-shopfront', floor: 'g', zone: 'side', touch: 'hub', w: [4, 4, 5], from: 50, one: true },
      { key: 'smi-stock', floor: 'g', zone: 'back', touch: 'hub', w: [2, 3, 4], need: true, one: true },
      { key: 'smi-armoury', floor: 'g', zone: 'back', w: [4, 5, 6], from: 70, yard: true },
      { key: 'smi-carpenter', floor: 'g', zone: 'back', w: [4, 5, 6], from: 100, yard: true },
      { key: 'smi-potter', floor: 'g', zone: 'wing', w: [4, 5, 6], from: 140, yard: true },
      { key: 'smi-quarters', floor: 'u', fill: true, w: [3, 4, 5], priv: true },
    ],
    out: [{ key: 'smi-yard', side: 'back', depth: 5, from: 40 }] },
  // type:lai (2026-10-12). A lair is CARVED, one level, and it loops (a den's second door is its bolt hole). You arrive in the
  // warren (the tribe that keeps the way in); cave passages are the corridor; dens, larder and pit hang off them; the trophy
  // cave and the hatchery lie deep; the dragon's hoard is the reward, moved to the deepest dead end by the pacing rule, one
  // door. The cave mouth is the ground outside: drawn before the entrance, not laid by the carved solver (it has no outside).
  LAI: { label: 'Monster lair', full: 120, dials: { loops: 0.45, pacing: 0.8, carved: 1 }, storeys: { def: 1, min: 1, max: 2, why: 'a lair is one level of cave; a second goes down' }, down: true, corridor: 2,
    hub: { key: 'lair-warren', w: [5, 6, 8], d: [4, 5, 7], share: 0.12 }, hall: 'lair-passage', spare: 'lair-beast',
    rooms: [
      { key: 'lair-beast', set: [4, 6, 4, 6], w: [4, 5, 6], weight: 2, max: 2 },
      { key: 'lair-spider', set: [5, 6, 5, 6], w: [5, 6, 6], weight: 2, max: 1 },
      { key: 'lair-larder', set: [3, 4, 3, 4], w: [3, 4, 4], weight: 1, max: 1 },
      { key: 'lair-pit', set: [4, 5, 4, 5], w: [4, 5, 5], ends: true, weight: 1, max: 1 },
      { key: 'lair-trophy', set: [5, 7, 3, 3], w: [5, 6, 7], weight: 1, max: 1 },
      { key: 'lair-hatchery', set: [4, 5, 4, 5], w: [4, 5, 5], one: true, priv: true, weight: 1, max: 1 },
      { key: 'lair-dragon', set: [6, 8, 5, 7], w: [6, 7, 8], one: true, priv: true, reward: true, weight: 1, max: 1 },
    ] }, // type:lai end
  // TYPES ARRIVING (their rooms land on other branches today): the dials and storeys are decided here; until a type
  // gets a `rooms` programme of its own, programmeFor() builds one from its rooms' roles.
  ARC: { label: "Wizard's tower", dials: { loops: 0, pacing: 0.3, carved: 0 }, storeys: { def: 3, min: 1, max: 3, why: 'a tower is its storeys: one or two rooms a floor round the stair (the dog-leg core stops at three; a spiral core is the hook for more)' } },
  CLT: { label: 'Cult sanctum', dials: { loops: 0.3, pacing: 0.6, carved: 1 }, storeys: { def: 1, min: 1, max: 3, why: 'a hidden place: one level, more go down' }, down: true },
  TEM: { label: 'Temple', dials: { loops: 0.15, pacing: 0, carved: 0 }, storeys: { def: 1, min: 1, max: 2, why: 'one great room and its side rooms; the nave is tall, not stacked' } },
  DUN: { label: 'Dungeon', dials: { loops: 0.35, pacing: 0.6, carved: 1 }, storeys: { def: 2, min: 1, max: 3, why: 'a dungeon is levels: two to start, going down' }, down: true },
  // type:hut (2026-10-12): the farmhouse. Tree-shaped, laid out by function, packed tight: the kitchen is the room everything opens
  // off; a bedroom beside it, the dairy behind it (with the yard door), from 70 cells the byre under the same roof (a longhouse);
  // ONE storey under the thatch, a second only as the sleeping loft; the root cellar under the kitchen. Everything else is an
  // outbuilding or a plot and stands apart in the farmyard behind (walls.js HUT_USES says which): the barn across the yard, or
  // the byre where the house is small. The one-room cottage is a building by itself (draw it with the room tool).
  HUT: { label: 'Farmstead', full: 40, dials: { loops: 0, pacing: 0, carved: 0 }, storeys: { def: 1, min: 1, max: 2, why: 'one floor under the thatch; a second storey is the sleeping loft. The outbuildings stand apart in the yard' },
    hub: { key: 'hut-kitchen', w: [4, 5, 10], d: [3, 4, 8], share: 0.45 }, hall: 'hut-passage', spare: 'hut-bedroom', small: 'hut-dairy',
    rooms: [
      { key: 'hut-dairy', floor: 'g', zone: 'back', touch: 'hub', w: [3, 3, 4], from: 45, yard: true },
      { key: 'hut-byre', floor: 'g', zone: 'wing', w: [4, 5, 7], from: 90 },
      { key: 'hut-granary', floor: 'g', zone: 'wing', w: [3, 4, 5], from: 130 },
      { key: 'hut-loft', floor: 'u', fill: true, w: [3, 4, 5], priv: true },
      { key: 'hut-bedroom', floor: 'g', fill: true, w: [3, 3, 4], priv: true, need: true, alt: 'Bedroom' },
      { key: 'hut-cellar', floor: 'c', under: 'hut-kitchen' },
    ],
    out: [{ key: 'hut-farmyard', side: 'back', depth: 6, from: 30, with: [{ key: 'hut-barn', size: [6, 5], from: 80 }, { key: 'hut-byre', size: [5, 4], from: 40 }] }] },
  MKT: { label: 'Market & village', dials: { loops: 0.25, pacing: 0, carved: 0 }, storeys: { def: 1, min: 1, max: 2, why: 'stalls and small houses: low (a settlement of many buildings is the level above this one)' } },
};
// THE SMALLEST A ROOM CAN BE and still get its key piece (bed, hearth, counter), as [short side, long side] pairs in
// cells; measured by furnishing every type at every size from 1x1 to 6x6 (engine/test/buildings.test.mjs names any
// room that still loses its key piece). Anything not listed: 2 x 2.
export const MIN_FIT = { 'hut-kitchen': [[3, 3]], 'hut-cottage': [[3, 3]], 'hut-byre': [[3, 4]], 'hut-barn': [[4, 4]], 'hut-granary': [[3, 3]], 'hut-dairy': [[2, 3]], 'hut-loft': [[2, 3]], kitchen: [[3, 3]], 'castle-kitchen': [[3, 3]], 'mansion-kitchen': [[3, 3]], 'mansion-bedroom': [[2, 4], [3, 3]], desk: [[2, 3]], chapel: [[2, 3]], barracks: [[3, 4]], stable: [[3, 3]] };
export const fitsMin = (key, w, d) => (MIN_FIT[key] || [[2, 2]]).some(([a, b]) => Math.min(w, d) >= a && Math.max(w, d) >= b);
const needW = (key, dep) => { for (let w = 1; w <= MAX_SIDE; w++) if (fitsMin(key, w, dep)) return w; return Infinity; }; // the least length along a strip of this depth
const PRIVATE_RE = /(guest|fine|bed|privy|cell$|relic|vault|treasury|study|sanctum-inner|quarters)/, HALL_RE = /(hallway|passage|corridor|catacomb)/;

// The programme a type builds from: its table entry, else one derived from the rooms it has.
//   types  [{ key, cells: [w, d], outdoor? }] the rooms the Build menu lists under the type     roles  walls.js ROLES
export function programmeFor(code, types = [], roles = {}) {
  const T = BUILDING_TYPES[code] || {}, have = new Set(types.map(t => t.key)), cellsOf = Object.fromEntries(types.map(t => [t.key, t.cells || [3, 3]]));
  const roleOf = (k) => roles[k]?.role || 'terminal';
  const P = { code, label: T.label || code, dials: { loops: 0.15, pacing: 0, carved: 0, ...T.dials }, storeys: { def: 1, min: 1, max: 3, why: '', ...T.storeys }, down: !!T.down, corridor: T.corridor || 2, derived: !T.rooms, cellsOf };
  const ok = (k) => !types.length || have.has(k);
  if (T.rooms) {
    P.hub = ok(T.hub.key) ? T.hub : null; P.hall = ok(T.hall) ? T.hall : null; P.spare = ok(T.spare) ? T.spare : null; P.small = T.small && ok(T.small) ? T.small : null;
    P.rooms = T.rooms.filter(r => ok(r.key)); P.out = (T.out || []).filter(o => ok(o.key)).map(o => ({ ...o, with: (o.with || []).filter(x => ok(x.key)) }));
  } else {
    const ind = types.filter(t => !t.outdoor && roleOf(t.key) !== 'outdoor');
    const hubT = ind.find(t => roleOf(t.key) === 'hub') || [...ind].filter(t => !HALL_RE.test(t.key)).sort((a, b) => b.cells[0] * b.cells[1] - a.cells[0] * a.cells[1])[0];
    const hallT = ind.find(t => roleOf(t.key) === 'passage' && HALL_RE.test(t.key)) || ind.find(t => roleOf(t.key) === 'passage' && t !== hubT);
    const span = (n) => [Math.max(2, n - 1), n, Math.min(MAX_SIDE, n + 2)];
    P.hub = hubT ? { key: hubT.key, w: span(Math.max(hubT.cells[0], 4)), d: span(Math.max(hubT.cells[1], 4)), share: 0.35 } : null;
    P.hall = hallT?.key || null;
    const leaves = ind.filter(t => t !== hubT && t !== hallT);
    P.rooms = leaves.map((t, i) => { const [w, d] = t.cells, uses = Object.keys(roles).find(k => (roles[k].uses || []).includes(t.key) && have.has(k));
      return { key: t.key, floor: 'gu', zone: roleOf(t.key) === 'uses' ? 'back' : 'wing', w: span(Math.min(w, d) < 3 ? Math.max(w, d) : Math.min(w, d)), ...(uses && { touch: uses }), ...(roleOf(t.key) === 'uses' && { touch: 'hub' }),
        priv: PRIVATE_RE.test(t.key), need: i < 3, set: [Math.max(3, w - 1), Math.min(MAX_SIDE, w + 1), Math.max(3, d - 1), Math.min(MAX_SIDE, d + 1)], weight: 1, ...(i === leaves.length - 1 && { fill: true }) }; });
    P.spare = leaves[0]?.key || null;
    P.out = types.filter(t => t.outdoor || roleOf(t.key) === 'outdoor').slice(0, 1).map(t => ({ key: t.key, side: 'back', depth: 5, from: 48 }));
  }
  P.spare = P.spare || P.rooms.find(r => !r.one)?.key || P.hub?.key || null;
  return P;
}

// ---------------------------------------------------------------- small tools -----------------------------------
export function rng(seed) { // mulberry32
  let a = (seed >>> 0) || 1;
  const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1)); f.pick = (xs) => xs[Math.floor(f() * xs.length)]; f.chance = (p) => f() < p;
  f.shuffle = (xs) => { const o = [...xs]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };
  return f;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const K = (u, v) => `${u}:${v}`;
const rectCells = (r) => { const o = []; for (let v = r.v; v < r.v + r.d; v++) for (let u = r.u; u < r.u + r.w; u++) o.push([u, v]); return o; };
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// a strip of length L cut into rooms. items: [{ key, w: [min, pref, max], need }] in order; fill repeats.
// -> [{ item, w }] summing to L exactly, or [] when not even one room fits
// items are taken in the order given while they fit (most important first); `arrange` then puts the chosen in strip order
let SMALL = null; // the type's room that fits anywhere (set per plan): what a strip too shallow for its fill becomes
function cutStrip(L, items0, fill00, R, arrange = null, dep = 9) {
  const fill0 = fill00 && needW(fill00.key, dep) <= Math.min(L, MAX_SIDE) ? fill00 : (SMALL || fill00);
  // (in a strip of this depth each room has a least length: a kitchen 10 ft deep must be 20 ft long)
  const fitted = (it) => { if (it.ends) return it.w[0] <= dep && fitsMin(it.key, it.w[0], dep) ? { ...it, w: [it.w[0], Math.min(it.w[1], dep), Math.min(it.w[2], dep)], src: it } : null; // entered at a SHORT wall: no longer along the corridor than it is deep
    const m = Math.max(it.w[0], needW(it.key, dep)); return m === it.w[0] ? it : m > MAX_SIDE ? null : { ...it, w: [m, Math.max(it.w[1], m), Math.max(it.w[2], m)], src: it }; };
  const items = items0.map(fitted).filter(Boolean), fill = fill0 && fitted(fill0);
  let list = [], smin = 0;
  for (const it of items) { if (it.touch && it.touch !== 'hub' && !list.some(x => x.it.key === it.touch)) continue; // a room that opens off another goes only where that other is
    if (smin + it.w[0] <= L) { list.push({ it, w: it.w[1] }); smin += it.w[0]; } }
  if (arrange) { const o = arrange(list.map(x => x.it)); list = o.map(it => list.find(x => x.it === it)); }
  const sum = () => list.reduce((s, x) => s + x.w, 0);
  for (let g = 0; sum() > L && g < 200; g++) { const c = list.filter(x => x.w > x.it.w[0]); if (!c.length) break; c.sort((a, b) => (b.w - b.it.w[0]) - (a.w - a.it.w[0]))[0].w--; }
  if (fill) while (L - sum() >= fill.w[1] || (!list.length && L >= fill.w[0])) list.push({ it: fill, w: Math.min(fill.w[1], L - sum()) });
  for (let g = 0; sum() < L && g < 400; g++) { // spread what is left: fills first, then the rest, each up to its max
    const c = list.filter(x => x.w < x.it.w[2]); if (!c.length) break;
    c.sort((a, b) => (a.it === fill ? 0 : 1) - (b.it === fill ? 0 : 1) || (a.w - a.it.w[1]) - (b.w - b.it.w[1]))[0].w++;
  }
  if (!list.length) return [];
  if (sum() < L) { // everyone is at its largest: one more of the fill if it fits, else the last room simply grows
    const left = L - sum();
    if (fill && left >= fill.w[0]) list.push({ it: fill, w: left }); else [...list].sort((a, b) => b.it.w[2] - a.it.w[2])[0].w += left;
  }
  return list.map(x => ({ it: x.it === fill ? fill0 : (x.it.src || x.it), w: x.w }));
}

// ---------------------------------------------------------------- the plan under construction -------------------
function newPlan(W, D) {
  const P = { W, D, rooms: [], stairs: [], notes: [], blocked: new Map() };
  P.add = (type, L, rect, extra = {}) => { const r = { id: `r${P.rooms.length}`, type, L, rect: rect || null, cells: rect ? rectCells(rect) : extra.cells, links: new Map(), entry: null, role: 'leaf', ...extra }; r.set = new Set(r.cells.map(c => K(...c))); P.rooms.push(r); return r; };
  P.at = (L, u, v) => P.rooms.find(r => r.L === L && r.set.has(K(u, v)));
  P.block = (L, cells) => { if (!P.blocked.has(L)) P.blocked.set(L, new Set()); for (const c of cells) P.blocked.get(L).add(K(...c)); };
  P.isBlocked = (L, u, v) => !!P.blocked.get(L)?.has(K(u, v));
  // the unit wall segments two rooms share: [{ a: [u, v] (a's cell), b: [u, v] }]
  P.shared = (a, b) => { const out = []; if (a.L !== b.L) return out; for (const [u, v] of a.cells) for (const [du, dv] of N4) if (b.set.has(K(u + du, v + dv))) out.push({ a: [u, v], b: [u + du, v + dv] }); return out; };
  // a door between two rooms that share a wall: mid-run, never onto a stair, its foot or its landing. false when none fits
  P.link = (a, b, R, why = '') => {
    if (!a || !b || a === b) return false; if (a.links.has(b.id)) return true;
    const run = P.shared(a, b).filter(s => !P.isBlocked(a.L, ...s.a) && !P.isBlocked(a.L, ...s.b)); if (!run.length) return false;
    run.sort((p, q) => (p.a[0] + p.b[0]) - (q.a[0] + q.b[0]) || (p.a[1] + p.b[1]) - (q.a[1] + q.b[1]));
    const lines = new Map(); for (const s of run) { const k = s.a[0] === s.b[0] ? `h${Math.max(s.a[1], s.b[1])}` : `v${Math.max(s.a[0], s.b[0])}`; if (!lines.has(k)) lines.set(k, []); lines.get(k).push(s); }
    const best = [...lines.values()].sort((p, q) => q.length - p.length)[0]; // the longest straight stretch of the shared wall
    const mid = (best.length - 1) / 2, j = best.length > 3 && R ? clamp(Math.round(mid + (R() - 0.5) * (best.length - 2)), 0, best.length - 1) : Math.floor(mid + (R ? R() * 0.99 : 0));
    const s = best[clamp(j, 0, best.length - 1)];
    a.links.set(b.id, { a: s.a, b: s.b, why }); b.links.set(a.id, { a: s.b, b: s.a, why }); return true;
  };
  return P;
}

// ---------------------------------------------------------------- PACKED ----------------------------------------
// The rectangle is filled, wall to wall. Ground floor: the hub at the street, service rooms in a strip behind it, a
// public room beside it, and (when the rectangle is wider than a hub) a wing: a corridor with rooms on both sides.
// The stair core goes in FIRST, in the hub against its back wall; every upper floor is a corridor laid over the core's
// cells with rooms off it. The hallway is what is left after the rooms are placed.
function packed(W, D, G, S, R, dials, opts) {
  const P = newPlan(W, D), A = W * D, hub = G.hub, hallT = G.hall || hub?.key;
  SMALL = G.small ? { key: G.small, w: [2, 3, MAX_SIDE], priv: PRIVATE_RE.test(G.small) } : null;
  const want = (floor) => G.rooms.filter(r => (r.floor || 'g').includes(floor) && (!r.from || A >= r.from));
  if (!hub) { P.notes.push('no hub room in this type: one room'); P.add(G.spare || G.rooms[0]?.key, 0, { u: 0, v: 0, w: W, d: D }, { role: 'hub' }); return P; }
  // ---- the ground floor's shape: the hub's width, depth and place along the street
  const gRooms = want('g'), back = gRooms.filter(r => r.zone === 'back' && !r.fill), side = gRooms.filter(r => r.zone === 'side'), wingR = gRooms.filter(r => r.zone === 'wing' && !r.fill);
  const gFill = gRooms.find(r => r.fill) || null, upFill = want('u').find(r => r.fill) || null;
  const fillG = S === 1 ? (gFill || upFill) : gFill; // a one-storey building takes the upper floor's rooms on the ground
  let hd = clamp(Math.round(D * (hub.deep ? 0.8 : 0.58)), hub.d[0], Math.min(hub.d[2], D));
  if (back.length && D - hd < 2 && D - 2 >= Math.min(3, hub.d[0]) && !hub.deep) hd = D - 2; // (a small house still gets its kitchen: the hub gives up depth down to 15 ft)
  if (D - hd === 1) hd = D - 2 >= Math.min(3, hub.d[0]) ? D - 2 : D;
  if (hd > D) hd = D;
  // the strip behind the hub is deep enough for what must go in it (a kitchen needs 15 ft)
  const needDeep = Math.max(2, ...back.filter(r => r.need).map(r => Math.min(...(MIN_FIT[r.key] || [[2, 2]]).map(p => p[0]))));
  if (!hub.deep && D - hd >= 2 && D - hd < needDeep && D - needDeep >= 3) hd = D - needDeep;
  const sd = D - hd;
  const target = clamp(A * hub.share, hub.w[0] * hub.d[0], hub.w[2] * hub.d[2]);
  let bestShape = null;
  for (let hw = Math.min(hub.w[0], W); hw <= Math.min(hub.w[2], W, MAX_SIDE); hw++) for (const place of ['left', 'right', 'centre']) {
    const rest = W - hw, l = place === 'left' ? 0 : place === 'right' ? rest : Math.floor(rest / 2), r = rest - l;
    const kind = (n) => n === 0 ? 'none' : n >= 5 ? 'wing' : n >= 2 && D <= 9 && side.length ? 'side' : n >= 2 && D <= 9 ? 'col' : null;
    const kl = kind(l), kr = kind(r); if (!kl || !kr) continue;
    const wings = (kl === 'wing') + (kr === 'wing'), sides = (kl === 'side') + (kr === 'side');
    let sc = -Math.abs(hw * hd - target) / target * 3;
    sc += Math.min(sides, side.length) * 1.2 + (wings && (wingR.length || (S === 1 && fillG) || W > hub.w[2]) ? 1.5 : wings ? -0.8 : 0) - (kl === 'col') - (kr === 'col');
    if (S === 1 && fillG && !wings) sc -= 2;
    if (sd >= 2 && back.length && hw < back.reduce((s, x) => s + x.w[0], 0)) sc -= 1.5; // the service strip behind the hub is too short for its rooms
    if (hub.centred) sc += place === 'centre' && l && r ? 1 : -0.5; else if (place === 'centre') sc -= 0.4;
    sc += R() * 0.6;
    if (!bestShape || sc > bestShape.sc) bestShape = { sc, hw, l, r, kl, kr };
  }
  if (!bestShape) { const hw = Math.min(W, hub.w[2]); bestShape = { hw, l: 0, r: W - hw, kl: 'none', kr: W - hw ? 'col' : 'none' }; }
  const { hw, l: lw, r: rw, kl, kr } = bestShape, hu = lw, v0 = D - hd; // the hub: u in [hu, hu+hw), v in [v0, D)
  const H = P.add(hub.key, 0, { u: hu, v: v0, w: hw, d: hd }, { role: 'hub', zone: 'public' });
  // the street door: mid-wall, two cells wide when the hub is wide enough
  const span = hw >= 6 ? 2 : 1, e0 = hu + clamp(Math.floor((hw - span) / 2) + (hw > span + 2 ? R.int(-1, 1) : 0), 0, hw - span);
  H.entry = { cells: Array.from({ length: span }, (_, i) => [e0 + i, D - 1]), dir: [0, 1] };
  // ---- THE STAIR CORE, first (Harry: "stairs usually belong to either hallways or common rooms, and often there is
  // only one or two stairways for the whole building"). A line of four cells along the hub's back wall: landing, two
  // squares of flight, foot. A third storey doubles it into a dog-leg (a second lane for the flight that comes back).
  const flights = S - 1, lanes = flights > 1 ? 2 : 1;
  let core = null;
  const makeCore = (row, c0, inward) => {
    core = { axis: 'u', row, c0, lanes, line: [c0, c0 + 1, c0 + 2, c0 + 3], inward, flights: [] };
    for (let f = 0; f < flights; f++) {
      const lane = f % 2, v = row + lane, dir = (f % 2 === 0 ? -1 : 1) * inward; // the first flight climbs toward the outer wall, the next one back
      const ln = dir > 0 ? core.line : [...core.line].reverse();
      core.flights.push({ L: f, foot: [ln[0], v], steps: [[ln[1], v], [ln[2], v]], top: [ln[3], v] });
    }
    for (const f of core.flights) { P.block(f.L, [f.foot, ...f.steps]); P.block(f.L + 1, f.steps); } // (a door may open onto the landing at the top, never onto the flight, its foot or the hole)
  };
  // a LONG hall (the castle's, entered at its end) keeps its floor: the stair goes in the corridor beside it, which also
  // puts the upper corridor through the middle of the building
  const inWing = !!hub.deep && flights > 0 && (kl === 'wing' || kr === 'wing');
  const hubCore = () => { if (hw >= 5 && hd >= lanes + 2) { const atLeft = kl === 'wing' ? false : kr === 'wing' ? true : R.chance(0.5); makeCore(v0, atLeft ? hu : hu + hw - 4, atLeft ? 1 : -1); } else P.notes.push('the hub is too small for a stair: upper storeys left out'); }; // away from the wing's corridor
  if (flights > 0 && !inWing) hubCore();
  let levels = core ? S : 1;
  // ---- rooms behind the hub (the service strip), and beside it
  const placed = new Map(); // key -> the ground-floor room of that type (the first)
  const note = (r) => { if (!placed.has(r.type)) placed.set(r.type, r); return r; };
  const linkLater = []; // [room, item]: rooms whose door goes to another room than their circulation
  const mk = (it, L, rect, circ, zone) => { const r = note(P.add(it.key, L, rect, { role: 'leaf', priv: !!it.priv, one: !!it.one, zone, item: it, circ })); linkLater.push(r); return r; };
  // the ground floor's rooms wait in a POOL; every strip takes what fits from it, most important first, so a room a
  // strip had no space for is still there for the next strip
  const usedG = new Set(), spareIt = G.spare ? { key: G.spare, w: [2, 3, MAX_SIDE], priv: PRIVATE_RE.test(G.spare) } : null;
  const needFirst = (xs) => [...xs].sort((p, q) => (q.need ? 1 : 0) - (p.need ? 1 : 0));
  const avail = (...zones) => needFirst(zones.flatMap(z => gRooms.filter(r => !r.fill && !usedG.has(r) && (typeof z === 'function' ? z(r) : r.zone === z))).filter((r, i, a) => a.indexOf(r) === i));
  const strip = (L, rect, along, items, fill, circ, zone, { fromEnd = false, arrange = null, used = usedG } = {}) => {
    const len = along === 'u' ? rect.w : rect.d; if (len < 2 || (along === 'u' ? rect.d : rect.w) < 2) return [];
    const cut = cutStrip(len, items, fill, R, arrange, along === 'u' ? rect.d : rect.w); let at = 0; const out = [];
    for (const c of cut) if (c.it !== fill) used.add(c.it);
    for (const c of (fromEnd ? [...cut].reverse() : cut)) { out.push(mk(c.it, L, along === 'u' ? { u: rect.u + at, v: rect.v, w: c.w, d: rect.d } : { u: rect.u, v: rect.v + at, w: rect.w, d: c.w }, circ, zone)); at += c.w; }
    return out;
  };
  // a room that opens off another (a storeroom off its kitchen) stands right beside it; those go at the START of the
  // strip, which is laid from the stair core's end: the room behind the stair is then one that needs no door to the hub
  const beside = (xs) => { const dep = xs.filter(x => x.touch && x.touch !== 'hub' && xs.some(h => h.key === x.touch)), out = [];
    for (const d of dep) { out.push(d); const h = xs.find(x => x.key === d.touch); if (!out.includes(h)) out.push(h); }
    return [...out, ...xs.filter(x => !out.includes(x))]; };
  const withDeps = (xs) => { const out = []; for (const x of xs) { if (out.includes(x) || (x.touch && x.touch !== 'hub' && xs.some(h => h.key === x.touch))) continue; out.push(x); for (const d of xs) if (d.touch === x.key && !out.includes(d)) out.push(d); } return out; }; // each room followed by the rooms that open off it
  if (sd >= 8) { // a deep plot: a corridor runs back from the hub, rooms on both sides (the first of each side touches the hub)
    hallBlock(0, { u: hu, v: 0, w: hw, d: sd }, 'v', 'hi', H, fillG || spareIt, null, { okAt: (y) => [0, 1].some(k => !P.isBlocked(0, hu + y + k, v0)), cands: () => [...new Set([...avail(r => r.touch === 'hub').slice(0, 1), ...avail(r => r.touch !== 'hub' && r.zone === 'back', r => r.touch !== 'hub')])] });
  } else if (sd >= 2) { // the strip behind the hub: every room in it touches the hub's back wall
    const rooms = strip(0, { u: hu, v: 0, w: hw, d: sd }, 'u', avail('back'), fillG || spareIt, H, 'back', { fromEnd: core ? core.c0 !== hu : R.chance(0.5), arrange: beside });
    if (!rooms.length) P.add(G.spare || hub.key, 0, { u: hu, v: 0, w: hw, d: sd }, { role: 'leaf', circ: H, zone: 'back' });
  }
  const sideCol = (u, w, kind) => { // beside the hub
    if (kind === 'side' || kind === 'col') { const it = avail('side', r => r.touch === 'hub', 'back', 'wing').find(x => x.w[0] <= w && fitsMin(x.key, w, D)) || [fillG, spareIt, SMALL].find(x => x && fitsMin(x.key, w, D)) || SMALL || spareIt; usedG.add(it); mk(it, 0, { u, v: 0, w, d: D }, H, 'side'); }
    if (kind === 'wing') hallBlock(0, { u, v: 0, w, d: D }, 'u', u < hu ? 'hi' : 'lo', H, fillG || spareIt, null, {
      // the strip at the street: ONE room that must open off the hub (it is the only one that touches it), then the wing's own rooms
      cands: (where) => where === 'front' ? [...new Set([...avail(r => r.touch === 'hub', 'side').slice(0, 1), ...avail('wing', 'side', r => !r.touch)])] : avail(r => r.zone === 'back' && r.touch !== 'hub', 'wing', r => r.zone === 'side' && r.touch !== 'hub') });
  };
  // ---- a corridor with rooms on both sides (the wing on the ground; every upper floor)
  //   rect   the block      axis  the way the corridor runs      end  which end of the corridor meets `from` ('lo' | 'hi' | null)
  //   lane   { row, lanes, wide }: the corridor must lie over these rows (the stair core), null = where it balances best
  function hallBlock(L, rect, axis, end, from, fill, lane, { cap = null, cands, used = usedG, okAt = null } = {}) {
    // work in a local frame where the corridor runs along x: local (x, y) -> canonical
    const LW = axis === 'u' ? rect.w : rect.d, LD = axis === 'u' ? rect.d : rect.w;
    const toRect = (x, y, w, d) => axis === 'u' ? { u: rect.u + x, v: rect.v + y, w, d } : { u: rect.u + y, v: rect.v + x, w: d, d: w };
    let cw = lane?.wide || 2, y0;
    if (lane) { // over the core's lane(s): of the rows that allows, the one that leaves the better pair of strips
      const sc = (y) => { const a = y, b = LD - y - cw; return y < 0 || b < 0 ? -9 : (a >= 2 ? 1 : 0) + (b >= 2 ? 1 : 0) - (a === 1 ? 0.5 : 0) - (b === 1 ? 0.5 : 0) - Math.abs(a - b) * 0.05; };
      const opts2 = lane.lanes === 1 && cw === 2 ? [lane.row, lane.row - 1] : [Math.min(lane.row, LD - cw)];
      y0 = opts2.sort((p, q) => sc(q) - sc(p))[0]; }
    else if (from && axis === 'u' && from.rect) { const lo = from.rect.v - rect.v, hi = lo + from.rect.d - cw; y0 = clamp(Math.round((LD - cw) / 2), lo, hi); } // the corridor must meet the hub's side wall
    else { // in the middle, or as near it as leaves a free square of the wall it must open through (the stair may stand there)
      const mid = Math.round((LD - cw) / 2), ys = Array.from({ length: LD - cw + 1 }, (_, k) => k).sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid));
      y0 = (okAt && ys.find(y => okAt(y) && y !== 1 && LD - y - cw !== 1)) ?? (okAt && ys.find(okAt)) ?? mid; }
    y0 = clamp(y0, 0, LD - cw);
    let a = y0, b = LD - y0 - cw; // the strips' depths, before and after the corridor
    if (a === 1) { y0 = 0; cw += 1; a = 0; } if (b === 1) { cw += 1; b = 0; } // a one-cell strip is no room: the corridor takes it
    // a room across the far end of the corridor (the fine room; the throne room at the end of the passage)
    let x0 = 0, x1 = LW, capRoom = null;
    if (cap && LW >= cap.w[0] + 4 && LD <= MAX_SIDE && (!cap.ends || LD <= 9)) {
      const cwid = clamp(cap.ends ? Math.max(cap.w[1], LD + 1) : cap.w[1], cap.w[0], Math.min(cap.w[2] + (cap.ends ? 4 : 0), LW - 4));
      // (never over the stair: the corridor must keep the core's four cells and one more to step off onto)
      const loRoom = lane?.span ? lane.span[0] - 1 : LW, hiRoom = lane?.span ? LW - lane.span[1] - 1 : LW;
      const atLo = end === 'hi' ? true : end === 'lo' ? false : lane?.span ? loRoom >= hiRoom : R.chance(0.5);
      if ((atLo ? loRoom : hiRoom) >= cwid && fitsMin(cap.key, cwid, LD) && (!cap.ends || cwid >= LD)) { capRoom = mk(cap, L, atLo ? toRect(0, 0, cwid, LD) : toRect(LW - cwid, 0, cwid, LD), null, 'cap'); if (atLo) x0 = cwid; else x1 = LW - cwid; }
    }
    // the corridor itself: what is left between the strips (cut in two when it is longer than a room may be)
    const halls = []; const hl = x1 - x0, n = Math.ceil(hl / MAX_SIDE);
    const cutAt = (i) => { let x = x0 + Math.round(hl * i / n); if (lane?.span && i > 0 && i < n && x > lane.span[0] - 1 && x < lane.span[1] + 1) x = x - (lane.span[0] - 1) <= lane.span[1] + 1 - x && lane.span[0] - 1 > x0 ? lane.span[0] - 1 : lane.span[1] + 1; return x; }; // (never through the stair)
    for (let i = 0; i < n; i++) { const s = cutAt(i), e = cutAt(i + 1); halls.push(P.add(hallT, L, toRect(s, y0, e - s, cw), { role: 'hall', zone: 'hall' })); }
    for (let i = 1; i < halls.length; i++) P.link(halls[i - 1], halls[i], R, 'the corridor goes on');
    if (from && !P.link(end === 'hi' ? halls[halls.length - 1] : halls[0], from, R, 'the corridor meets the hub')) P.notes.push('a corridor could not open into the hub');
    if (capRoom) { capRoom.circ = x0 > 0 ? halls[0] : halls[halls.length - 1]; }
    const hallAt = (x) => halls.find(h => { const r = h.rect, lo = axis === 'u' ? r.u - rect.u : r.v - rect.v, len = axis === 'u' ? r.w : r.d; return x >= lo && x < lo + len; }) || halls[0];
    // the two strips. A strip deeper than seven cells becomes cross corridors with rooms off them (a comb)
    let capLeft = cap && !capRoom ? cap : null; // the room that wanted the corridor's end and did not get it: an ordinary room off the corridor
    const doStrip = (y, depth, where) => {
      if (depth < 2) return;
      if (depth <= 7) {
        const cut = cutStrip(hl, capLeft ? [capLeft, ...cands(where)] : cands(where), fill, R, withDeps, depth); let at = x0;
        for (const c of cut) if (c.it !== fill) { used.add(c.it); if (c.it === capLeft) capLeft = null; }
        const seq = end === 'hi' ? [...cut].reverse() : cut; // the first room of the strip sits at the hub's end
        for (const c of seq) { mk(c.it, L, toRect(at, y, c.w, depth), hallAt(at + Math.floor(c.w / 2)), 'wing'); at += c.w; }
        return;
      }
      // the comb: bays of [rooms | cross corridor | rooms], the cross corridor running from the main one to the far wall
      const nb = Math.max(1, Math.round(hl / 10)); let at = x0;
      let colW = 9; const col = (len, n) => { const cut = cutStrip(len, cands(where).filter(x => x.touch !== 'hub').slice(0, n), fill, R, withDeps, len === depth || len === Math.min(depth, MAX_SIDE) ? colW : depth); for (const c of cut) if (c.it !== fill) used.add(c.it); return cut; };
      for (let i = 0; i < nb; i++) {
        const bw = Math.round(hl * (i + 1) / nb) - Math.round(hl * i / nb), colA = Math.floor((bw - 2) / 2), colB = bw - 2 - colA;
        if (colA < 2) { let x = at; for (const c of col(bw, 1)) { mk(c.it, L, toRect(x, y, c.w, Math.min(depth, MAX_SIDE)), hallAt(x), 'wing'); x += c.w; } at += bw; continue; }
        const xc = P.add(hallT, L, toRect(at + colA, y, 2, Math.min(depth, MAX_SIDE)), { role: 'hall', zone: 'hall' });
        P.link(xc, hallAt(at + colA), R, 'a side corridor');
        for (const [cx, cwid] of [[at, colA], [at + colA + 2, colB]]) {
          colW = cwid; const cut = col(Math.min(depth, MAX_SIDE), 2); let yy = y;
          const seq = y < y0 ? [...cut].reverse() : cut;
          for (const c of seq) { mk(c.it, L, toRect(cx, yy, cwid, c.w), xc, 'wing'); yy += c.w; }
        }
        at += bw;
      }
    };
    // (strip `a` is the low side: on the ground that is the BACK of the house; `b` is the side at the street)
    if (b >= 2) doStrip(y0 + cw, b, 'front'); if (a >= 2) doStrip(0, a, 'back');
    return halls;
  }
  sideCol(0, lw, kl); sideCol(hu + hw, rw, kr);
  if (inWing) {
    const hall = P.rooms.find(r => r.L === 0 && r.role === 'hall' && r.rect && r.rect.w >= 6 && r.rect.d >= 2 && r.links.has(H.id));
    if (hall) { const right = hall.rect.u >= hu + hw; makeCore(hall.rect.v, right ? hall.rect.u + 1 : hall.rect.u + hall.rect.w - 5, right ? -1 : 1); } // its foot at the hub's end of the corridor, one square in
    else hubCore();
    levels = core ? S : 1;
    // doors made before the stair was there move off it
    for (const r of [...P.rooms]) for (const [id, l] of [...r.links]) if (P.isBlocked(r.L, ...l.a) || P.isBlocked(r.L, ...l.b)) { const o = P.rooms.find(x => x.id === id); r.links.delete(id); o.links.delete(r.id); if (!P.link(r, o, R, l.why)) P.notes.push(`${r.type} and ${o.type}: the stair took their door`); }
  }
  // ---- upper floors: a corridor over the core, rooms off it
  const upper = want('u');
  for (let L = 1; L < levels; L++) {
    const arriving = core.flights.some(f => f.L === L - 1), leaving = core.flights.some(f => f.L === L);
    const lane = { row: core.row, lanes: core.lanes, wide: core.lanes === 2 && arriving && leaving ? 3 : 2, span: [core.c0, core.c0 + 4] };
    const capIt = upper.find(r => r.cap) || null, fillU = upper.find(r => r.fill) || spareIt, usedU = new Set();
    const rest = () => upper.filter(r => !r.cap && !r.fill && !usedU.has(r) && (L === 1 || !r.need));
    // (the cap is the room across the far end of the corridor, away from the stair)
    hallBlock(L, { u: 0, v: 0, w: W, d: D }, 'u', null, null, fillU, lane, { cap: L === 1 || !capIt?.ends ? capIt : null, cands: rest, used: usedU });
  }
  for (const it of gRooms) if (it.need && !it.fill && !usedG.has(it) && !P.rooms.some(r => r.type === it.key)) P.notes.push(`no room for the ${it.key}`);
  // ---- doors: every room to its circulation, or to the room it belongs to
  const byType = (L, key) => P.rooms.filter(r => r.L === L && r.type === key);
  const circOf = (r) => r.circ || P.rooms.filter(x => x.L === r.L && (x.role === 'hall' || x.role === 'hub')).sort((p, q) => P.shared(r, q).length - P.shared(r, p).length)[0];
  for (const r of linkLater) {
    const it = r.item || {}; let done = false;
    if (it.touch && it.touch !== 'hub') for (const host of byType(r.L, it.touch)) if (!done && P.shared(r, host).length) done = P.link(r, host, R, `${it.key} opens off the ${it.touch}`);
    if (!done && it.touch === 'hub' && r.L === 0) done = P.link(r, H, R, `${it.key} opens off the ${hub.key}`);
    if (!done) { const c = circOf(r); if (c && P.shared(r, c).length) done = P.link(r, c, R, 'off the ' + (c.role === 'hub' ? hub.key : 'hallway')); }
    if (!done) { // no wall on its circulation (a corner): any circulation room it touches, else a neighbour that is not private
      const cands = P.rooms.filter(x => x.L === r.L && x !== r && P.shared(r, x).length).sort((p, q) => rank(p) - rank(q) || P.shared(r, q).length - P.shared(r, p).length);
      for (const c of cands) if (!done && !(c.priv && r.priv) && !c.one) { done = P.link(r, c, R, 'reached through its neighbour'); if (done && c.priv) P.notes.push(`${r.type} is reached through ${c.type}`); }
    }
    if (!done) { // no wall it could have a door in (it lies wholly behind the stair): it becomes part of the room beside it
      const n = P.rooms.find(x => x !== r && x.L === r.L && x.rect && r.rect && x.role === 'leaf' && !x.one && linkLater.includes(x) && ((x.rect.v === r.rect.v && x.rect.d === r.rect.d && (x.rect.u + x.rect.w === r.rect.u || r.rect.u + r.rect.w === x.rect.u)) || (x.rect.u === r.rect.u && x.rect.w === r.rect.w && (x.rect.v + x.rect.d === r.rect.v || r.rect.v + r.rect.d === x.rect.v))));
      if (n) { const a = n.rect, b = r.rect; n.rect = { u: Math.min(a.u, b.u), v: Math.min(a.v, b.v), w: a.u === b.u ? a.w : a.w + b.w, d: a.u === b.u ? a.d + b.d : a.d }; n.cells = rectCells(n.rect); n.set = new Set(n.cells.map(c => K(...c))); P.rooms.splice(P.rooms.indexOf(r), 1); r.gone = true; if (placed.get(r.type) === r) placed.delete(r.type); }
      else P.notes.push(`${r.type} got no door`);
    }
  }
  function rank(x) { return x.role === 'hall' ? 0 : x.role === 'hub' ? 1 : x.priv ? 9 : 3; }
  // `near` pairs get a door where they share a wall (the kitchen and the dining room: the servants' way)
  for (const r of linkLater) { if (r.gone) continue; const it = r.item || {}; if (it.near) for (const o of byType(r.L, it.near)) if (P.shared(r, o).length && !o.priv && !r.priv) P.link(r, o, R, `${it.key} serves the ${it.near}`); }
  // ---- LOOPS: extra doors between rooms that share a wall, never into a private room or a strong room
  const cand = [];
  for (let i = 0; i < P.rooms.length; i++) for (let j = i + 1; j < P.rooms.length; j++) { const a = P.rooms[i], b = P.rooms[j];
    if (a.L !== b.L || a.priv || b.priv || a.one || b.one || a.links.has(b.id) || a.role === 'out' || b.role === 'out') continue;
    if (P.shared(a, b).length >= 2) cand.push([a, b]); }
  const nLoop = Math.round(dials.loops * Math.min(cand.length, Math.max(2, P.rooms.length / 2)));
  for (const [a, b] of R.shuffle(cand).slice(0, nLoop)) P.link(a, b, R, 'a second way round');
  // ---- the cellar: under the room named, by its own short stair (a ladder where no flight fits)
  for (const it of want('c')) {
    if (!levels) break;
    const host = (it.under === 'hub' ? H : placed.get(it.under)) || H, hr = host.rect; if (!hr) continue;
    const cr = { u: hr.u, v: hr.v, w: Math.min(hr.w, MAX_SIDE), d: Math.min(hr.d, MAX_SIDE) };
    const C = P.add(it.key, -1, cr, { role: 'leaf', zone: 'cellar', priv: false, under: host.id });
    const st = stairLine(P, C, host, R);
    if (st) { P.stairs.push({ ...st, L: -1, core: 'cellar', from: C.id, to: host.id }); P.block(-1, [st.foot, ...st.steps]); P.block(0, [...st.steps, st.top]); }
    else { P.rooms.pop(); P.notes.push(`no room for a stair down to the ${it.key}: left out`); }
  }
  // the core's flights as stairs (each belongs to the room its foot stands in)
  if (core) for (const f of core.flights) { const lo = P.at(f.L, ...f.steps[0]), up = P.at(f.L + 1, ...f.top); P.stairs.push({ kind: 'straight', L: f.L, foot: f.foot, steps: f.steps, top: f.top, core: 'main', from: lo?.id, to: up?.id }); }
  // ---- outside the envelope: the yard and the stable at the back, the court and its gate at the front
  if (opts.outbuildings !== false) for (const o of G.out || []) {
    if (o.from && A < o.from) continue;
    const dpt = clamp(o.depth, 3, MAX_SIDE), front = o.side === 'front', extras = (o.with || []).filter(x => !x.from || A >= x.from);
    const yw = Math.min(W, MAX_SIDE), yu = Math.floor((W - yw) / 2), yv = front ? D : -dpt;
    let yr = { u: yu, v: yv, w: yw, d: dpt };
    const ex = extras[0]; let exRoom = null;
    if (ex && !ex.gate && yw - ex.size[0] >= 4) { // a stable at one end of the yard, across the yard from the house
      const atLeft = R.chance(0.5), sw = ex.size[0], sdp = Math.min(ex.size[1], dpt);
      exRoom = P.add(ex.key, 0, { u: atLeft ? yu : yu + yw - sw, v: front ? D + dpt - sdp : -dpt, w: sw, d: sdp }, { role: 'out', zone: 'out', outside: true, free: true });
      yr = null; // the yard is the rest: an L round the stable (or a plain rectangle when the stable is as deep as the yard)
      const cells = rectCells({ u: yu, v: yv, w: yw, d: dpt }).filter(c => !exRoom.set.has(K(...c)));
      P.add(o.key, 0, null, { cells, role: 'yard', zone: 'out', outside: true });
    } else {
      P.add(o.key, 0, yr, { role: 'yard', zone: 'out', outside: true });
      if (ex?.gate && yw >= ex.size[0] + 2) { const gu = yu + Math.floor((yw - ex.size[0]) / 2); exRoom = P.add(ex.key, 0, { u: gu, v: front ? D + dpt : -dpt - ex.size[1], w: ex.size[0], d: ex.size[1] }, { role: 'out', zone: 'out', outside: true, free: true }); }
    }
    const yard = P.rooms.find(r => r.role === 'yard' && r.type === o.key);
    // doors onto it: the kitchen's back door, a corridor's end, the room that wants the garden; the hub when the court is in front
    for (const r of P.rooms) { if (r.L !== 0 || r.outside || !P.shared(r, yard).length) continue;
      const wants = front ? r === H : (r.role === 'hall' || r.item?.yard || r.role === 'hub');
      if (wants && !r.priv) { if (front && r === H) continue; P.link(r, yard, R, 'a door onto the ' + o.key); } }
    yard.free = yard.links.size === 0; void exRoom;
  }
  P.core = core; P.hubId = H.id; P.levels = levels;
  return P;
}
// a line of cells for a stair between a lower room and the room above it: [top landing, step, step, foot] all inside
// both rooms, against the lower room's wall, off every door. A ladder ([top, rung, foot]) where no flight fits.
function stairLine(P, lower, upper, R) {
  const inBoth = (u, v) => lower.set.has(K(u, v)) && upper.set.has(K(u, v)) && !P.isBlocked(upper.L, u, v) && !P.isBlocked(lower.L, u, v);
  const doorCells = new Set(); for (const r of [lower, upper]) for (const l of r.links.values()) doorCells.add(`${r.L}|${K(...l.a)}`);
  if (upper.entry) for (const c of upper.entry.cells) doorCells.add(`${upper.L}|${K(...c)}`);
  for (const n of [2, 1]) {
    const opts = [];
    for (const [u, v] of lower.cells) for (const [du, dv] of N4) {
      const line = Array.from({ length: n + 2 }, (_, k) => [u + du * k, v + dv * k]); // foot, steps.., top
      if (!line.every(c => inBoth(...c))) continue;
      if (line.some(c => doorCells.has(`${lower.L}|${K(...c)}`) || doorCells.has(`${upper.L}|${K(...c)}`))) continue;
      const wall = line.every(([a, b]) => !lower.set.has(K(a - dv, b + du)) || !lower.set.has(K(a + dv, b - du))) ? 1 : 0;
      const endWall = !lower.set.has(K(line[n + 1][0] + du, line[n + 1][1] + dv)) ? 1 : 0;
      opts.push({ sc: wall * 4 + endWall * 2 + R() * 0.5, line });
    }
    if (opts.length) { const b = opts.sort((p, q) => q.sc - p.sc)[0].line; return { kind: n === 2 ? 'straight' : 'ladder', foot: b[0], steps: b.slice(1, n + 1), top: b[n + 1] }; }
  }
  return null;
}

// ---------------------------------------------------------------- CARVED ----------------------------------------
// The footprint is rock. Big rooms are scattered in it with space between; a spanning tree joins them (so every room is
// reached); then a share of the links that were left out is put back (dials.loops: 0.3 = three extra links for every
// ten rooms) so there are ROUTES; every link is a corridor routed through the rock with bends. Corridors may end on
// another corridor (a T: a choice in the passage itself). Pacing is NOT modelled unless dials.pacing >= 0.5 (then the
// reward room is the deepest dead end); every room carries its depth from the entrance either way.
function carved(W, D, G, S, R, dials, opts) {
  const P = newPlan(W, D), small = Math.min(W, D) < 12, cw = small ? 1 : (G.corridor || 2), gap = 2;
  const seen = new Set(), sets = G.rooms.filter(r => (r.set || r.w) && !seen.has(r.key) && seen.add(r.key)).map(r => ({ ...r, set: r.set || [Math.max(3, r.w[0]), Math.max(3, Math.min(r.w[2], 8)), 3, 5] })); // (a packed type carved: its rooms as set pieces, one entry per room type)
  const hallT = G.hall || G.hub?.key || sets[0]?.key, WIND = 6;
  const entT = G.hub || { key: sets[0]?.key, w: [3, 4, 5], d: [3, 3, 4] };
  let arrive = null; // the cells the stair from the level above occupies on this level
  for (let i = 0; i < S; i++) {
    const L = G.down ? -i : i; const rooms = [], occ = new Set(); // occ: cells of this level's rooms and corridors
    const fits = (r, g) => { if (r.u < 0 || r.v < 0 || r.u + r.w > W || r.v + r.d > D) return false; for (let v = r.v - g; v < r.v + r.d + g; v++) for (let u = r.u - g; u < r.u + r.w + g; u++) if (occ.has(K(u, v))) return false; return true; };
    const put = (type, rect, extra) => { const r = P.add(type, L, rect, { role: 'leaf', ...extra }); for (const c of r.cells) occ.add(K(...c)); rooms.push(r); return r; };
    // the entrance: at the street on the first level; where the stair arrives on the others
    let ent;
    if (!arrive) { const w = clamp(entT.w[1], 2, W), d = clamp(entT.d ? entT.d[1] : 3, 2, D); ent = put(entT.key, { u: R.int(0, W - w), v: D - d, w, d }, { role: 'hub', zone: 'public' }); const sp = w >= 4 ? 1 : 1, e0 = ent.rect.u + Math.floor((w - sp) / 2); ent.entry = { cells: [[e0, D - 1]], dir: [0, 1] }; }
    else { // a landing room round the foot of the stair: the stair room's rectangle, one cell deeper where there is room
      const r = { ...arrive.rect }; if (r.w >= r.d) { if (r.v + r.d < D) r.d++; else if (r.v > 0) { r.v--; r.d++; } } else { if (r.u + r.w < W) r.w++; else if (r.u > 0) { r.u--; r.w++; } }
      ent = put(entT.key || hallT, r, { role: 'hub', zone: 'public', landing: true }); // (the antechamber of this level)
      const st = arrive.st, lower = G.down ? ent : arrive.well, upper = G.down ? arrive.well : ent;
      P.block(L, G.down ? [st.foot, ...st.steps] : [...st.steps, st.top]);
      P.stairs.push({ ...st, L: lower.L, core: 'main', from: lower.id, to: upper.id }); }
    // the way down: a small stair room, joined like any other (the next level is laid out round where it arrives)
    let well = null;
    if (i < S - 1) for (let t = 0; t < 60 && !well; t++) { const horiz = R.chance(0.5), r = horiz ? { u: R.int(0, W - 5), v: R.int(0, D - 2), w: 5, d: 2 } : { u: R.int(0, W - 2), v: R.int(0, D - 5), w: 2, d: 5 }; if (r.u >= 0 && r.v >= 0 && fits(r, gap)) well = put(hallT, r, { role: 'hall', zone: 'hall', well: true }); }
    if (i < S - 1 && !well) P.notes.push(`level ${i + 1}: no room for a stair down; deeper levels left out`);
    arrive = null;
    if (well) { // the flight: four cells of one lane; the fifth cell and the second lane stay open to walk past
      const r = well.rect, horiz = r.w > r.d, flip = R.chance(0.5), ln = Array.from({ length: 4 }, (_, k) => horiz ? [r.u + (flip ? 4 - k : k), r.v] : [r.u, r.v + (flip ? 4 - k : k)]);
      const st = G.down ? { kind: 'straight', top: ln[0], steps: [ln[1], ln[2]], foot: ln[3] } : { kind: 'straight', foot: ln[0], steps: [ln[1], ln[2]], top: ln[3] };
      P.block(L, G.down ? [st.top, ...st.steps] : [st.foot, ...st.steps]); arrive = { rect: r, st, well }; }
    // scatter the set pieces: best of several tries each, as far from the others as it can get
    const target = clamp(Math.round(W * D / (cw === 2 ? 40 : 26)), 2, 14), bag = [];
    const counts = new Map();
    for (let n = 0; n < target * 2; n++) { const pool = sets.filter(s => (counts.get(s.key) || 0) < (s.max || 99) && !(s.reward && i < S - 1)); if (!pool.length) break; const tot = pool.reduce((s, x) => s + (x.weight || 1), 0); let t = R() * tot, pick = pool[0]; for (const x of pool) { t -= (x.weight || 1); if (t <= 0) { pick = x; break; } } counts.set(pick.key, (counts.get(pick.key) || 0) + 1); bag.push(pick); }
    const rewardIt = sets.find(s => s.reward); if (rewardIt && i === S - 1 && !bag.includes(rewardIt)) bag.splice(Math.min(1, bag.length), 0, rewardIt);
    let nPlaced = 0;
    for (const it of bag) {
      if (nPlaced >= target) break;
      let best = null;
      for (let t = 0; t < 60; t++) {
        const lim = small ? Math.max(3, Math.floor(Math.max(W, D) / 2.5)) : MAX_SIDE; let w = Math.min(lim, R.int(it.set[0], it.set[1])), d = Math.min(lim, R.int(it.set[2], it.set[3])); if (R.chance(0.5) && !it.ends) [w, d] = [d, w];
        w = Math.min(w, W, MAX_SIDE); d = Math.min(d, D, MAX_SIDE); if (w < 2 || d < 2) continue;
        const r = { u: R.int(0, W - w), v: R.int(0, D - d), w, d }; if (!fits(r, gap)) continue;
        const cx = r.u + w / 2, cz = r.v + d / 2; let near = Infinity; for (const o of rooms) { const or = o.rect; near = Math.min(near, Math.abs(cx - (or.u + or.w / 2)) + Math.abs(cz - (or.v + or.d / 2))); }
        const sc = Math.min(near, 14) + R() * 3; if (!best || sc > best.sc) best = { sc, r };
      }
      if (best) { put(it.key, best.r, { priv: !!it.priv, one: !!it.one, item: it }); nPlaced++; }
    }
    // ---- which rooms are joined: a spanning tree by distance, then some of the links left out
    const cen = (r) => [r.rect.u + r.rect.w / 2, r.rect.v + r.rect.d / 2], dist = (a, b) => { const p = cen(a), q = cen(b); return Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]); };
    const inTree = new Set([ent]), tree = [], pairs = [];
    while (inTree.size < rooms.length) { let b = null; for (const a of inTree) for (const o of rooms) if (!inTree.has(o)) { const dd = dist(a, o) + (a.one || a.priv ? 500 : 0); /* never onward through a strong room or a private one, while any other way exists */ if (!b || dd < b.dd) b = { dd, a, o }; } inTree.add(b.o); tree.push([b.a, b.o]); }
    for (let x = 0; x < rooms.length; x++) for (let y = x + 1; y < rooms.length; y++) { const a = rooms[x], b = rooms[y]; if (a.one || b.one || a.priv || b.priv || tree.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) continue; pairs.push([a, b, dist(a, b)]); }
    pairs.sort((p, q) => p[2] - q[2]);
    const entDeg = tree.filter(([p, q]) => p === ent || q === ent).length;
    const extra = []; const wantExtra = Math.max(rooms.length >= 3 && dials.loops > 0 ? 1 : 0, Math.round(dials.loops * rooms.length));
    // a real choice at the door: the entrance room gets a second way on if the tree gave it only one
    if (entDeg < 2 && dials.loops > 0) { const p = pairs.find(([a, b]) => a === ent || b === ent); if (p) extra.push(p); }
    const hops = (a, b, edges) => { const adj = new Map(); for (const [p, q] of edges) { (adj.get(p) || adj.set(p, []).get(p)).push(q); (adj.get(q) || adj.set(q, []).get(q)).push(p); } const seen = new Map([[a, 0]]), q = [a]; while (q.length) { const x = q.shift(); if (x === b) return seen.get(x); for (const n of adj.get(x) || []) if (!seen.has(n)) { seen.set(n, seen.get(x) + 1); q.push(n); } } return 99; };
    const cap = wantExtra + (entDeg < 2 ? 1 : 0);
    for (const p of pairs) { if (extra.length >= cap) break; if (extra.includes(p)) continue; if (hops(p[0], p[1], [...tree, ...extra]) >= 3) extra.push(p); } // only links that really shorten a way round
    if (dials.loops > 0.4) for (const p of pairs) { if (extra.length >= cap) break; if (!extra.includes(p) && hops(p[0], p[1], [...tree, ...extra]) >= 2) extra.push(p); } // turned up high: neighbours' neighbours too
    // ---- route each link as a corridor through the rock
    const noise = new Map(), nz = (u, v) => { const k = K(u, v); if (!noise.has(k)) noise.set(k, R() * 3.4); return noise.get(k); };
    const corridors = [];
    const roomAt = (u, v) => rooms.find(r => r.set.has(K(u, v))), corAt = (u, v) => corridors.find(r => r.set.has(K(u, v)));
    const blockCells = (u, v) => { const o = []; for (let b = 0; b < cw; b++) for (let a = 0; a < cw; a++) o.push([u + a, v + b]); return o; };
    const route = (A, B, joinOk) => {
      // anchors: the top-left cell of a cw x cw block. free = in the footprint and in no room or corridor
      const free = (u, v) => u >= 0 && v >= 0 && u + cw <= W && v + cw <= D && blockCells(u, v).every(([a, b]) => !occ.has(K(a, b)));
      const touches = (u, v, room) => { let n = 0; for (const [a, b] of blockCells(u, v)) for (const [du, dv] of N4) if (room.set.has(K(a + du, b + dv))) n++; return n; }; // wall segments the block shares with the room
      const others = (u, v) => { let n = 0; for (const [a, b] of blockCells(u, v)) for (const [du, dv] of N4) { const k = K(a + du, b + dv); if (occ.has(k) && !A.set.has(k) && !B.set.has(k)) n++; } return n; };
      const open = [], g = new Map(), prev = new Map();
      for (let v = A.rect.v - cw; v <= A.rect.v + A.rect.d; v++) for (let u = A.rect.u - cw; u <= A.rect.u + A.rect.w; u++) if (free(u, v) && touches(u, v, A) >= cw && !doorBlocked(A, u, v)) { g.set(K(u, v), 1 + others(u, v) * 3 + R() * WIND); open.push([u, v]); } // (a passage leaves a room anywhere along its walls, not only where the next room is nearest: that is what makes it bend)
      const isGoal = (u, v) => (touches(u, v, B) >= cw && !doorBlocked(B, u, v)) ? B : (joinOk ? corridors.find(c => c !== A && touches(u, v, c) >= cw && !c.links.has(A.id)) || null : null);
      function doorBlocked(room, u, v) { return blockCells(u, v).every(([a, b]) => N4.every(([du, dv]) => !room.set.has(K(a + du, b + dv)) || P.isBlocked(L, a + du, b + dv))); }
      let end = null, endRoom = null, endCost = Infinity; const arrive = new Map(), an = (u, v) => { const k = K(u, v); if (!arrive.has(k)) arrive.set(k, R() * WIND); return arrive.get(k); };
      for (let guard = 0; guard < 20000 && open.length; guard++) {
        let bi = 0; for (let k = 1; k < open.length; k++) if (g.get(K(...open[k])) < g.get(K(...open[bi]))) bi = k;
        const [u, v] = open.splice(bi, 1)[0], gc = g.get(K(u, v)); const goal = isGoal(u, v);
        if (gc >= endCost) break;
        if (goal) { const c = gc + an(u, v); if (c < endCost) { endCost = c; end = [u, v]; endRoom = goal; } continue; } // (and it arrives anywhere along the far room's walls)
        for (const [du, dv] of N4) { const nu = u + du, nv = v + dv; if (!free(nu, nv)) continue; const p = prev.get(K(u, v)), turn = p && (p[0] - u !== -du || p[1] - v !== -dv) ? 0.3 : 0;
          const c = gc + 1 + nz(nu, nv) + others(nu, nv) * 2.5 + turn; if (c < (g.get(K(nu, nv)) ?? Infinity)) { g.set(K(nu, nv), c); prev.set(K(nu, nv), [u, v]); if (!open.some(o => o[0] === nu && o[1] === nv)) open.push([nu, nv]); } }
      }
      if (!end) return null;
      const path = []; for (let p = end; p; p = prev.get(K(...p))) path.unshift(p);
      return { path, endRoom };
    };
    const lay = (A, B, joinOk, why) => {
      const r = route(A, B, joinOk) || (joinOk ? null : route(A, B, true)); if (!r) return false;
      // the corridor's cells; cut in pieces when it is longer than a room may be
      const pieces = []; let cur = null;
      for (const [u, v] of r.path) { const cs = blockCells(u, v).filter(c => !occ.has(K(...c)));
        const box = cur && { u0: Math.min(cur.u0, u), v0: Math.min(cur.v0, v), u1: Math.max(cur.u1, u + cw), v1: Math.max(cur.v1, v + cw) };
        if (!cur || box.u1 - box.u0 > MAX_SIDE || box.v1 - box.v0 > MAX_SIDE) { cur = { cells: [], u0: u, v0: v, u1: u + cw, v1: v + cw }; pieces.push(cur); } else Object.assign(cur, box);
        for (const c of cs) { cur.cells.push(c); occ.add(K(...c)); } }
      const made = pieces.filter(p => p.cells.length).map(p => { const c = P.add(hallT, L, null, { cells: p.cells, role: 'hall', zone: 'hall' }); corridors.push(c); return c; });
      if (!made.length) return false;
      P.link(A, made[0], R, why); for (let k = 1; k < made.length; k++) P.link(made[k - 1], made[k], R, 'the passage goes on');
      P.link(made[made.length - 1], r.endRoom, R, r.endRoom === B ? why : 'the passages meet');
      return true;
    };
    void roomAt; void corAt;
    for (const [a, b] of tree) if (!lay(b, a, false, 'a passage')) P.notes.push(`no way through the rock from ${a.type} to ${b.type}`); // (from the NEW room toward the tree: if it ends on a passage, the new room is still joined)
    let laid = 0; for (const [a, b] of extra) if (lay(a, b, true, 'a second way round')) laid++;
    // a loop that found no way through the rock: try the other pairs, nearest first, until one does
    if (wantExtra > 0 && laid === 0) for (const p of pairs) { if (extra.includes(p)) continue; if (lay(p[0], p[1], true, 'a second way round')) break; }
    // ---- nothing left stranded: a room the corridors did not reach gets one more try, to anything that is reached
    for (let guard = 0; guard < 4; guard++) {
      const here = P.rooms.filter(r => r.L === L), seen = new Set([ent.id]), q = [ent];
      while (q.length) { const x = q.shift(); for (const id of x.links.keys()) if (!seen.has(id)) { seen.add(id); q.push(here.find(r => r.id === id)); } }
      const lost = rooms.filter(r => !seen.has(r.id)); if (!lost.length) break;
      const a = lost[0], near = rooms.filter(r => seen.has(r.id) && !r.one && !r.priv).sort((p, q2) => dist(a, p) - dist(a, q2));
      let ok = false; for (const b2 of near.slice(0, 4)) if (!ok) ok = lay(a, b2, false, 'a passage');
      if (!ok) { P.notes.push(`${a.type} could not be reached: left out`); for (const c of a.cells) occ.delete(K(...c)); P.rooms.splice(P.rooms.indexOf(a), 1); rooms.splice(rooms.indexOf(a), 1); for (const o of P.rooms) o.links.delete(a.id); }
    }
    if (i < S - 1 && !well) break;
  }
  if (!G.down) P.notes.push('carved levels going UP are stacked without support checks');
  P.hubId = P.rooms[0]?.id; P.levels = S; P.cw = cw;
  // a strong room keeps exactly one door; with pacing on, the reward is the DEEPEST dead end
  return P;
}

// ---------------------------------------------------------------- generate --------------------------------------
export function generate(opts) {
  const { code, rect, seed = 1, front = 'S' } = opts;
  const G = programmeFor(code, opts.types || [], opts.roles || {});
  const dials = { ...G.dials, ...(opts.dials || {}) };
  const S = clamp(opts.storeys || G.storeys.def, 1, Math.max(G.storeys.max, 1));
  const sideways = front === 'E' || front === 'W', W = sideways ? rect.d : rect.w, D = sideways ? rect.w : rect.d;
  const R = rng((seed >>> 0) * 2654435761 + 97);
  const solver = dials.carved >= 0.5 ? 'carved' : 'packed';
  const P = solver === 'carved' ? carved(W, D, G, S, R, dials, opts) : packed(W, D, G, S, R, dials, opts);
  // depth from the street door, through doors and stairs
  const byId = new Map(P.rooms.map(r => [r.id, r])), adj = new Map(P.rooms.map(r => [r.id, new Set(r.links.keys())]));
  for (const s of P.stairs) if (s.from && s.to) { adj.get(s.from)?.add(s.to); adj.get(s.to)?.add(s.from); }
  const ent = P.rooms.find(r => r.entry) || P.rooms[0], depth = new Map(ent ? [[ent.id, 0]] : []);
  for (const q = ent ? [ent.id] : []; q.length;) { const id = q.shift(); for (const n of adj.get(id) || []) if (!depth.has(n)) { depth.set(n, depth.get(id) + 1); q.push(n); } }
  // carved + pacing: the reward room goes to the deepest dead end (types swap between two rooms of the same level)
  if (solver === 'carved') {
    const leaves = P.rooms.filter(r => r.role === 'leaf' && r.links.size === 1), reward = P.rooms.find(r => r.item?.reward);
    const swap = (a, b) => { [a.type, b.type] = [b.type, a.type]; [a.item, b.item] = [b.item, a.item]; [a.one, b.one] = [b.one, a.one]; [a.priv, b.priv] = [b.priv, a.priv]; };
    if (reward && reward.links.size !== 1) { const t = leaves.filter(r => r.L === reward.L).sort((p, q) => (depth.get(q.id) || 0) - (depth.get(p.id) || 0))[0]; if (t) swap(reward, t); else { reward.type = G.spare; reward.one = false; reward.priv = false; reward.item = null; } }
    const rw = P.rooms.find(r => r.item?.reward);
    if (rw && dials.pacing >= 0.5) { const t = leaves.filter(r => r.L === rw.L).sort((p, q) => (depth.get(q.id) || 0) - (depth.get(p.id) || 0))[0]; if (t && t !== rw && (depth.get(t.id) || 0) > (depth.get(rw.id) || 0)) swap(rw, t); }
  }
  // ---- into the world: the street side of the dragged rectangle
  const X0 = rect.x, Z0 = rect.z;
  const T = front === 'S' ? (u, v) => [X0 + u, Z0 + v] : front === 'N' ? (u, v) => [X0 + W - 1 - u, Z0 + D - 1 - v] : front === 'E' ? (u, v) => [X0 + v, Z0 + W - 1 - u] : (u, v) => [X0 + D - 1 - v, Z0 + u];
  const edgeKey = (a, b) => a[0] === b[0] ? ['h', a[0], Math.max(a[1], b[1])] : ['v', Math.max(a[0], b[0]), a[1]];
  const sgn = G.down ? -1 : 1; void sgn;
  const rooms = P.rooms.map(r => {
    const cells = r.cells.map(c => T(...c)), xs = cells.map(c => c[0]), zs = cells.map(c => c[1]);
    const x = Math.min(...xs), z = Math.min(...zs), w = Math.max(...xs) - x + 1, d = Math.max(...zs) - z + 1;
    const links = {}; for (const [id, l] of r.links) links[id] = edgeKey(T(...l.a), T(...l.b));
    let entry = null;
    if (r.entry) { const out = r.entry.cells.map(c => { const a = T(...c), b = T(c[0] + r.entry.dir[0], c[1] + r.entry.dir[1]); return edgeKey(a, b); }).sort((p, q) => p[1] - q[1] || p[2] - q[2]); entry = [...out[0], out.length]; }
    return { id: r.id, type: r.type, level: r.L, y: r.L * STOREY, x, z, w, d, shaped: cells.length !== w * d, cells, role: r.role, zone: r.zone || '', priv: !!r.priv, one: !!r.one, outside: !!r.outside, free: !!r.free, depth: depth.get(r.id) ?? null, links, entry,
      ...(r.well && { well: true }), ...(r.landing && { landing: true }), ...(r.under && { under: r.under }), ...(r.item?.reward && { reward: true }), ...(r.item?.ends && { ends: true }) };
  });
  { const seenAlt = new Map(), big = (r) => r.w * r.d; // the largest keeps the type's label
    for (const r of [...P.rooms].filter(x => x.item?.alt).sort((a, b) => b.cells.length - a.cells.length || a.L - b.L)) { const n = seenAlt.get(r.type) || 0; seenAlt.set(r.type, n + 1); if (n) rooms.find(x => x.id === r.id).name = r.item.alt; } void big; }
  const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const stairs = P.stairs.map((s, i) => {
    const foot = T(...s.foot), top = T(...s.top), steps = s.steps.map(c => T(...c)), n = steps.length;
    const dx = Math.sign(top[0] - foot[0]), dz = Math.sign(top[1] - foot[1]), q = DIRS.findIndex(d => d[0] === dx && d[1] === dz);
    const cx = steps.reduce((t, c) => t + c[0] + 0.5, 0) / n * CELL, cz = steps.reduce((t, c) => t + c[1] + 0.5, 0) / n * CELL;
    return { id: `s${i}`, kind: s.kind, core: s.core, level: s.L, y: s.L * STOREY, rise: STOREY, x: cx, z: cz, rot: q * Math.PI / 2, foot, top, cells: steps, from: s.from, to: s.to };
  });
  const plan = { v: 1, code, label: G.label, solver, seed, rect: { ...rect }, front, storeys: S, levels: [...new Set(rooms.map(r => r.level))].sort((a, b) => a - b), dials, down: !!G.down, derived: !!G.derived,
    ...(opts.flavor && { flavor: opts.flavor }), hub: P.hubId, entrance: ent?.id || null, corridor: P.cw || 2, rooms, stairs, notes: P.notes };
  plan.checks = check(plan);
  return plan;
}

// ---------------------------------------------------------------- the rules, as checks ---------------------------
// Each rule a plan must keep, checked on the finished plan (world cells), independently of how it was made.
export function check(plan) {
  const out = [], rooms = plan.rooms, byId = new Map(rooms.map(r => [r.id, r])), set = new Map(rooms.map(r => [r.id, new Set(r.cells.map(c => K(...c)))]));
  const add = (rule, ok, detail = '') => out.push({ rule, ok: !!ok, detail });
  const adj = new Map(rooms.map(r => [r.id, new Set(Object.keys(r.links))]));
  const stairAdj = new Map(rooms.map(r => [r.id, new Set()]));
  for (const s of plan.stairs) if (byId.has(s.from) && byId.has(s.to)) { stairAdj.get(s.from).add(s.to); stairAdj.get(s.to).add(s.from); }
  const circ = (r) => r.role === 'hub' || r.role === 'hall';
  // BFS from the entrance; `through(r)` says whether you may walk THROUGH r to reach further rooms
  const reach = (through) => { const seen = new Set(plan.entrance ? [plan.entrance] : []), q = [...seen]; while (q.length) { const id = q.shift(); if (id !== plan.entrance && !through(byId.get(id))) continue; for (const n of [...adj.get(id), ...stairAdj.get(id)]) if (!seen.has(n)) { seen.add(n); q.push(n); } } return seen; };
  const inside = rooms.filter(r => !r.free);
  // 1. every room reachable
  const all = reach(() => true), lost = inside.filter(r => !all.has(r.id));
  add('every room reachable', !lost.length, lost.map(r => `${r.type}@${r.level}`).join(', '));
  // 2. doors are real: each link is mutual and lies on a wall the two rooms share
  let badDoor = 0;
  for (const r of rooms) for (const [id, e] of Object.entries(r.links)) { const o = byId.get(id); if (!o || !o.links[r.id] || o.level !== r.level) { badDoor++; continue; }
    const [dir, gx, gz] = e, c1 = dir === 'h' ? [gx, gz - 1] : [gx - 1, gz], c2 = [gx, gz], A = set.get(r.id), B = set.get(id);
    if (!((A.has(K(...c1)) && B.has(K(...c2))) || (A.has(K(...c2)) && B.has(K(...c1))))) badDoor++; }
  add('every door is on a wall both rooms share', !badDoor, badDoor ? `${badDoor} bad` : '');
  // 3. no overlaps on a level; packed plans leave no dead space inside the envelope
  const R = plan.rect; let overlap = 0, dead = 0;
  for (const L of plan.levels) { const seen = new Set(); for (const r of rooms.filter(x => x.level === L)) for (const c of r.cells) { const k = K(...c); if (seen.has(k)) overlap++; seen.add(k); }
    if (plan.solver === 'packed' && L >= 0) for (let z = R.z; z < R.z + R.d; z++) for (let x = R.x; x < R.x + R.w; x++) if (!seen.has(K(x, z))) dead++; }
  add('no two rooms overlap', !overlap, overlap ? `${overlap} cells` : '');
  if (plan.solver === 'packed') add('packed: no dead space', !dead, dead ? `${dead} cells (${dead * 25} sq ft)` : '');
  // 4. sizes: nothing under 2 cells a side (corridors: 1), nothing over 16
  const small = rooms.filter(r => (Math.min(r.w, r.d) < (r.role === 'hall' ? 1 : 2) && !r.shaped) || r.w > MAX_SIDE || r.d > MAX_SIDE);
  add('no room below its minimum size (or above 80 ft)', !small.length, small.map(r => `${r.type} ${r.w}x${r.d}`).join(', '));
  // 5. a private room is never a thoroughfare; a strong room has one door
  const through = rooms.filter(r => r.priv && (adj.get(r.id).size + stairAdj.get(r.id).size) > 1);
  add('no bedroom is a thoroughfare', !through.length, through.map(r => `${r.type}@${r.level} has ${adj.get(r.id).size} doors`).join(', '));
  const strong = rooms.filter(r => r.one && adj.get(r.id).size !== 1);
  if (rooms.some(r => r.one)) add('a strong room has exactly one door', !strong.length, strong.map(r => r.type).join(', '));
  // 6. everything reachable without crossing a private room (the privy above all)
  const pub = reach((r) => !r.priv), cut = inside.filter(r => !pub.has(r.id));
  add('every room (the privy too) is reached without crossing a private room', !cut.length, cut.map(r => `${r.type}@${r.level}`).join(', '));
  // 7. the entrance is on the street side
  const ent = byId.get(plan.entrance), e = ent?.entry; let street = false;
  if (e) { const [dir, gx, gz] = e; street = plan.front === 'S' ? dir === 'h' && gz === R.z + R.d : plan.front === 'N' ? dir === 'h' && gz === R.z : plan.front === 'E' ? dir === 'v' && gx === R.x + R.w : dir === 'v' && gx === R.x; }
  add('the entrance is on the street side', street, e ? '' : 'no entrance');
  // 8. stairs: one or two cores; aligned through the storeys; each end in circulation space; each on floor at both ends
  const main = plan.stairs.filter(s => s.core === 'main'), cellar = plan.stairs.filter(s => s.core !== 'main');
  if (plan.storeys > 1) {
    const want = plan.levels.filter(L => plan.down ? L < 0 : L > 0).length;
    add('a stair reaches every storey', main.length >= want, `${main.length} flights for ${want} storeys above the first`);
    if (plan.solver === 'packed' && main.length) {
      const xs = main.flatMap(s => [s.foot[0], s.top[0], ...s.cells.map(c => c[0])]), zs = main.flatMap(s => [s.foot[1], s.top[1], ...s.cells.map(c => c[1])]);
      const wx = Math.max(...xs) - Math.min(...xs) + 1, wz = Math.max(...zs) - Math.min(...zs) + 1;
      add('the stair core is aligned through the storeys', Math.min(wx, wz) <= 2 && Math.max(wx, wz) <= 4, `core ${wx}x${wz} cells`);
    }
  }
  add('one or two stairways (a cellar has its own short one)', main.length ? new Set(main.map(s => plan.solver === 'packed' ? 'core' : s.level)).size <= Math.max(2, plan.storeys - 1) && cellar.length <= 1 : cellar.length <= 1, `${main.length} flights, ${cellar.length} to a cellar`);
  let offCirc = 0, offFloor = 0;
  for (const s of plan.stairs) { const lo = byId.get(s.from), up = byId.get(s.to); if (!lo || !up) { offFloor++; continue; }
    const lower = lo.level < up.level ? lo : up, upper = lo.level < up.level ? up : lo, LS = set.get(lower.id), US = set.get(upper.id);
    if (![s.foot, ...s.cells].every(c => LS.has(K(...c))) || ![...s.cells, s.top].every(c => US.has(K(...c)))) offFloor++;
    if (s.core === 'main' && !(circ(lower) && circ(upper))) offCirc++; }
  if (plan.stairs.length) { add('every stair stands on floor at both ends', !offFloor, offFloor ? `${offFloor}` : ''); add('the stair core arrives in circulation space (hub or hallway)', !offCirc, offCirc ? `${offCirc} flights` : ''); }
  // 9. no door opens onto a stair, its foot or its landing
  let onStair = 0; const blocked = new Map();
  for (const s of plan.stairs) { const lo = byId.get(s.from), up = byId.get(s.to); if (!lo || !up) continue; const a = Math.min(lo.level, up.level), b = Math.max(lo.level, up.level);
    for (const c of [s.foot, ...s.cells]) blocked.set(`${a}|${K(...c)}`, 1); for (const c of s.cells) blocked.set(`${b}|${K(...c)}`, 1); }
  for (const r of rooms) for (const eKey of [...Object.values(r.links), ...(r.entry ? [r.entry] : [])]) { const [dir, gx, gz] = eKey; for (const c of [dir === 'h' ? [gx, gz - 1] : [gx - 1, gz], [gx, gz]]) if (blocked.has(`${r.level}|${K(...c)}`)) onStair++; }
  add('no door opens onto a stair, its foot or its hole', !onStair, onStair ? `${onStair / 2}` : '');
  // 10. function: what the type's table says must touch, does
  const T = BUILDING_TYPES[plan.code];
  if (T?.rooms && plan.solver === 'packed') { const miss = [];
    for (const it of T.rooms) { if (!it.touch) continue; for (const r of rooms.filter(x => x.type === it.key && x.level === 0)) { const host = it.touch === 'hub' ? byId.get(plan.hub) : rooms.find(x => x.type === it.touch && x.level === 0 && r.links[x.id]); if (it.touch === 'hub' ? !r.links[plan.hub] : !host) { if (it.touch !== 'hub' && !rooms.some(x => x.type === it.touch && x.level === 0)) continue; miss.push(`${it.key} off ${it.touch === 'hub' ? T.hub.key : it.touch}`); } } }
    const needed = T.rooms.filter(it => it.need && (it.floor || 'g').includes('g') && !it.set).filter(it => !rooms.some(r => r.type === it.key));
    add('required adjacencies present', !miss.length, miss.join(', '));
    if (R.w * R.d >= (T.full || 0)) add('the rooms the type needs are all there', !needed.length, needed.map(n => n.key).join(', ')); }
  // 11. carved: loops, and a real choice near the door
  if (plan.solver === 'carved' && R.w * R.d >= (T?.full || 80)) { const top = rooms.filter(r => r.level === plan.levels[plan.down ? plan.levels.length - 1 : 0]), ids = new Set(top.map(r => r.id));
    let edges = 0; for (const r of top) for (const id of Object.keys(r.links)) if (ids.has(id)) edges++; edges /= 2;
    const loops = edges - top.length + 1, wantLoops = plan.dials.loops > 0 && top.filter(r => r.role !== 'hall').length >= 3 ? 1 : 0;
    add(`carved: at least ${wantLoops} loop${wantLoops === 1 ? '' : 's'} on the first level`, loops >= wantLoops, `${loops} loop${loops === 1 ? '' : 's'}`);
    const near = top.filter(r => r.depth != null && r.depth <= 2), choice = near.some(r => Object.keys(r.links).length + (r.entry ? 1 : 0) >= 3);
    add('carved: a binary choice within two rooms of the door', choice || plan.dials.loops === 0, choice ? '' : 'no room near the door has two ways on');
    const sets = top.filter(r => r.role === 'leaf').length; add('carved: at least two big rooms', sets >= 2, `${sets}`); }
  return out;
}
export const failures = (plan) => (plan.checks || check(plan)).filter(c => !c.ok);
