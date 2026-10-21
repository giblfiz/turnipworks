// Rooms from recipes, through the Spawn Tuner's v2 layout engine (solver2 + walls), injected rather than imported
// so the relay and the browser can load the SAME pinned copy (see relay/server.js TUNER_DIR and deploy.sh).
//
// A room's recipe is (type, rect in 5-ft cells, seed, wallSeed, engine, engineVersion). Its layout depends on the
// rooms already in the area (shared walls and doors), so a room is always solved against the rooms that existed
// before it, in creation `order`. The creator sends the solved layout and its hash; every other client re-solves
// and compares (cross-engine determinism drift guard), but always DRAWS the creator's layout.
import { effectiveFaction, planFactionChange } from './factions.js';
import { factionPieceName } from './faction-catalog.js';
import { layoutHash, fnv1a, hex8 } from './hash.js';
import { cellsOf, rectsOf, hasCell, isShaped, levelSuffix } from './footprint.js';
import { stairBlocks, planStair, stairOffer as offerStair, stairCore as coreStairs, stairPieceArgs, STAIR_KINDS, STAIR_ROLES } from './stairs.js';

// Fixed solver options for the engine (the tuner's defaults). Part of the engine version.
export const SOLVER_OPTS = { minStars: 3, hideMasking: true, scaleVariety: 0.15, sizeRule: 'auto' };
export const TUNER_FILES = ['solver.js', 'solver2.js', 'walls.js'];
export const TUNER_DATA = ['library.json', 'rooms.json', 'orient.json'];

// Version = hash of the solver sources and data, ignoring deploy cache-busting stamps (?v=…).
export function engineVersionOf(texts) {
  return 'v2-' + hex8(fnv1a(texts.map(t => t.replace(/\?v=[0-9a-z]+/g, '')).join('\u0000') + JSON.stringify(SOLVER_OPTS)));
}

// Live ratings (Harry 2026-10-04): the ratings server's latest model ratings, applied over library.json's (which only
// change on a tuner data rebuild) BEFORE anything filters with skuUsable, keyed exactly as tools/spawn-tuner/build_data.py
// keys them: "<src>/<sku>/model". Returns how many SKUs changed. Placed things of an excluded SKU stay where they are;
// only new placements, library items and re-rolls skip it.
export function applyRatings(lib, ratings) {
  if (!ratings || typeof ratings !== 'object') return 0;
  let n = 0;
  for (const o of Object.values(lib.objects)) for (const k of o.skus) {
    const r = ratings[`${k.src}/${k.sku}/model`]; if (!r) continue;
    const m = { stars: r.stars ?? null, note: String(r.note || '').trim(), masking: (r.tags || []).includes('masking') };
    if (k.model?.stars !== m.stars || !!k.model?.masking !== m.masking) n++;
    k.model = m;
  }
  return n;
}
// the part of the ratings that changes what the engine does (for the engine version)
export const ratingsDigest = (lib) => Object.values(lib.objects).flatMap(o => o.skus.filter(k => k.model).map(k => `${k.sku}:${k.model.stars ?? ''}:${k.model.masking ? 1 : 0}`)).sort().join(',');

export function makeRoomGen({ solver, solver2, walls, lib, types, orient, version, newId = defaultId }) {
  const T = Object.fromEntries(types.map(t => [t.key, t]));
  const typeKeys = new Set(Object.keys(T));
  const skuRec = new Map(Object.values(lib.objects).flatMap(o => o.skus.map(s => [s.sku, { ...s, cat: o.id }])));

  // tuner room objects for the rooms in an area, oldest first, with sticky exterior doors chosen as they were created.
  // STOREYS (2026-10-05): walls are worked out one HEIGHT at a time. Each room carries y (its floor height, feet); a
  // room's neighbours, shared walls and doors are the rooms at the same y. A room off its building's base (an upper
  // storey, a cellar) is `sealed`: no door to the outside (you arrive by a stair); below ground there are no windows.
  function roomsOf(entities, extra = null) {
    const recs = Object.values(entities).filter(e => e.kind === 'room').sort((a, b) => a.order - b.order)
      .map(e => ({ id: e.id, order: e.order, building: e.building, ...e.recipe }));
    if (extra) { const i = recs.findIndex(r => r.id === extra.id); if (i >= 0) recs[i] = { ...recs[i], ...extra }; else recs.push(extra); }
    const rooms = [];
    for (const rc of recs) {
      const flavor = effectiveFaction(entities, { id: rc.id, kind: 'room', building: rc.building, recipe: rc }, lib, types);
      const r = { id: rc.id, type: rc.type, x: rc.x, z: rc.z, w: rc.w, d: rc.d, seed: rc.seed, wallSeed: rc.wallSeed, created: rc.order, wallFamily: rc.wallFamily || 'auto', floor: rc.floor || 'auto', turn: rc.turn || 0,
        ...(rc.building && { building: rc.building }), ...(flavor && { flavor }), // (types:flavor: every religious room of one building takes the same flavor)
        ...(rc.outline && { cells: cellsOf(rc), outline: rc.outline }) }; // a room that is not its whole rectangle: the cells it stands on (walls.js perimeter, look.js floors)
      const y = rc.y || 0;
      if (y) r.y = y;
      if (rc.tall > 1) r.tall = rc.tall; // a tall room (a great hall): ONE room spanning several storeys, on the ground too
      if (y !== (entities[rc.building]?.base || 0) || y < 0) r.sealed = true;
      r.family = walls.familyFor(r, T[r.type]?.family);
      rooms.push(r);
      // A PLANNED ROOM (a generated building, tuner js/buildings.js): its doors are the plan's. recipe.plan holds them
      // relative to the room's own corner, so the building can be dragged: { b, links: { room: [dir, dx, dz] }, entry: [dir, dx, dz, span] }
      const pl = rc.plan && typeof rc.plan === 'object' ? rc.plan : null, moved = !!rc.turn, abs = (e) => Array.isArray(e) && !moved ? `${e[0]}:${rc.x + e[1]}:${rc.z + e[2]}` : '';
      if (pl) r.plan = { b: pl.b, links: Object.fromEntries(Object.entries(pl.links || {}).map(([id, e]) => [id, abs(e)])) };
      r.extDoor = r.sealed ? null : pl ? planEntry(r, pl.entry, abs) : walls.chooseExteriorDoor(r, y || rooms.some(o => o.y) ? rooms.filter(o => (o.y || 0) === y) : rooms);
    }
    return rooms;
  }
  // a planned room's street door: the plan's segment(s) on its own wall, in the shape chooseExteriorDoor returns; none planned = none
  function planEntry(r, entry, abs) {
    if (!Array.isArray(entry)) return null;
    const per = walls.perimeter(r), k0 = abs(entry), first = per.find(e => e.key === k0); if (!first) return null;
    const keys = []; for (let i = 0; i < (entry[3] || 1); i++) { const e = per.find(p => p.side === first.side && p.index === first.index + i && p.line === first.line); if (e) keys.push(e.key); }
    return { side: first.side, index: first.index, span: keys.length, key: keys[0], keys };
  }
  // the wall map of the rooms at ONE height (keys without the level suffix, exactly as the tuner's wall engine makes them)
  const levelRooms = (rooms, y) => rooms.some(r => r.y) ? rooms.filter(r => (r.y || 0) === y) : rooms;
  function levelEdges(rooms, y) {
    const here = levelRooms(rooms, y), sealed = here.filter(r => r.sealed);
    return walls.computeEdges(here, { engine: 'v2', ...(sealed.length && { sealed: new Set(sealed.map(r => r.id)) }), ...(y < 0 && { noWindows: true }) });
  }

  // Solve a room (args as in room.spawn / room.reroll) against the area's other rooms. `pinned` are the room's pinned
  // object entities: the solver keeps them as fixed placements and lays the rest around them.
  // Returns { hash, summary, objects } where objects are ready-to-dispatch object entities (fresh ids).
  //
  // A SHAPED ROOM (not its whole rectangle: an L, a U; core/footprint.js) is furnished as RECTANGLES, with the tuner's
  // rectangular solver untouched (Harry 2026-10-05, from furnishing a geodesic dome: "treat the largest rectangle that
  // fits inside as the room"). The largest rectangle inside it is solved as the room it is: its key purpose, its zones.
  // The rest (an L's leg) is solved as more of the same room without a second key purpose (`annex`). Where two
  // rectangles meet, each is told of a JOIN: an opening as wide as the meeting, kept clear like a doorway, so the room
  // stays one walkable space. Every real door and window goes to the rectangle whose wall it is in. So nothing can land
  // in the notch, wall things stand against every real wall (both walls of an inside corner included), and each
  // rectangle keeps its doors reachable.
  function solve(entities, a, order, pinned = []) {
    const old = entities[a.id];
    const recipe = { flavor: a.flavor ?? old?.recipe.flavor, id: a.id, type: a.type, x: a.x ?? old?.recipe.x, z: a.z ?? old?.recipe.z, w: a.w ?? old?.recipe.w, d: a.d ?? old?.recipe.d, seed: a.seed,
      wallSeed: a.wallSeed ?? old?.recipe.wallSeed ?? a.seed * 7 + 1, wallFamily: a.wallFamily ?? old?.recipe.wallFamily, floor: a.floor ?? old?.recipe.floor, turn: a.turn ?? old?.recipe.turn,
      outline: a.x !== undefined || a.outline ? a.outline : old?.recipe.outline, order, plan: a.plan ?? old?.recipe.plan, // a re-roll keeps the room's shape; a spawn states its own
      y: a.x !== undefined ? a.y || 0 : old?.recipe.y || 0, tall: a.x !== undefined ? a.tall : old?.recipe.tall, building: a.building ?? old?.building }; // and its height
    const Y = recipe.y || 0; // the room's floor height: it is solved against the rooms at the same height, then lifted there
    // STAIRS touching the room (core/stairs.js) are ground the layout must keep clear: the stair and its landing on the
    // floor it stands on, the hole and the top landing on the floor it comes up through. They go in as fixed placements.
    pinned = [...pinned, ...stairBlocks(entities, { id: a.id, recipe })];
    const rooms = roomsOf(entities, recipe);
    const E = levelEdges(rooms, Y);
    const r = rooms.find(x => x.id === a.id);
    const lock = (o) => ({ id: o.cat, uid: o.id, sku: o.sku, kind: o.flat ? 'flat' : 'mesh', place: o.place, layer: o.layer, x: o.x, y: (o.y || 0) - Y, z: o.z, rot: o.rot, dims: o.dims, parent: o.parent || undefined });
    const roomTypeOf = (id) => rooms.find(x => x.id === id)?.type;
    const parts = isShaped(recipe) ? shapedParts(recipe, r, E.openings.get(r.id), pinned) : [{ room: r, openings: E.openings.get(r.id), pinned }];
    const placements = [], objects = []; let first = null;
    parts.forEach((part, k) => {
      const L = solver2.solveRoom2({ lib, type: T[recipe.type], room: part.room, openings: part.openings, locked: part.pinned.map(lock), opts: { orient, ...SOLVER_OPTS }, roomTypeOf, ...(k > 0 && { annex: true }) });
      first ||= L;
      let fresh = L.placements.filter(p => !p.locked);
      if (parts.length > 1) { // a shaped room's last word: whatever would poke out past the room's outline is left out (with what stands on it)
        const gone = new Set(fresh.filter(p => !p.parent && !onFloor(recipe, p)).map(p => p.uid));
        for (let grew = true; grew;) { grew = false; for (const p of fresh) if (p.parent && gone.has(p.parent) && !gone.has(p.uid)) { gone.add(p.uid); grew = true; } }
        if (gone.size) fresh = fresh.filter(p => !gone.has(p.uid));
      }
      for (const p of fresh) placements.push({ id: p.id, sku: p.sku, x: p.x, y: p.y, z: p.z, rot: p.rot, dims: p.dims });
      const idOf = new Map(fresh.map(p => [p.uid, newId('obj')]));
      for (const p of fresh) objects.push({
        id: idOf.get(p.uid), name: p.id.startsWith('flavor-') ? factionPieceName(lib, p.id, p.sku) : p.id.replace(/-/g, ' '), cat: p.id, sku: p.sku, url: p.url, flat: p.kind === 'flat', place: p.place, layer: p.layer,
        x: p.x, y: Y ? (p.y || 0) + Y : p.y, z: p.z, rot: p.rot, yaw: p.yaw || 0, s: p.s || undefined, dims: p.dims, parent: p.parent ? (idOf.get(p.parent) || p.parent) : undefined, rule: p.rule || undefined, orient: p.orient || undefined,
      });
    });
    if (parts.length > 1) first = { ...first, openings: first.openings.filter(o => o.why !== 'open to the rest of the room') }; // a join is not a door: keep it out of the summary's door list
    const summary = solver2.summarize2(first, id => T[rooms.find(x => x.id === id)?.type]?.label || id).split('\n').slice(0, 3).join(' ') + (parts.length > 1 ? ` Shaped room: furnished as ${parts.length} rectangles (the largest is the room; the rest has no second ${first.checks?.purpose?.what && first.checks.purpose.what !== '—' ? first.checks.purpose.what : 'key piece'}).` : '');
    return { hash: layoutHash(placements), summary, objects, family: r.family, parts: parts.length, fail: first?.purposeFail || null };
  }
  // is the whole of a placement's footprint on the room's floor? (walls are a foot thick, centred on the grid line: half a
  // foot of slack; a thin thing is judged along its middle)
  function onFloor(recipe, p) {
    const c = Math.abs(Math.cos(p.rot || 0)), sn = Math.abs(Math.sin(p.rot || 0)), hw = (c * p.dims[0] + sn * p.dims[2]) / 2, hd = (sn * p.dims[0] + c * p.dims[2]) / 2;
    const ix = Math.max(0, hw - 0.55), iz = Math.max(0, hd - 0.55);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([a, b]) => hasCell(recipe, Math.floor((p.x + a * ix) / 5), Math.floor((p.z + b * iz) / 5)));
  }
  // a shaped room as the solver's rectangles: each with its own doors and windows, and its JOINS to the others
  const SIDE_CELL = { N: [0, 0], S: [0, -1], W: [0, 0], E: [-1, 0] }; // the room's cell behind a wall segment, from the segment's key
  function shapedParts(recipe, r, openings, pinned) {
    const rects = rectsOf(recipe), at = (gx, gz) => rects.findIndex(q => gx >= recipe.x + q.i && gx < recipe.x + q.i + q.w && gz >= recipe.z + q.j && gz < recipe.z + q.j + q.d);
    const outdoor = !!walls.isOutdoor?.(recipe.type);
    const parts = rects.map((q, k) => ({ rect: q, room: { ...r, x: recipe.x + q.i, z: recipe.z + q.j, w: q.w, d: q.d, cells: undefined, outline: undefined, seed: k ? (fnv1a(`${recipe.seed}|part${k}`) % 1e6) : recipe.seed }, openings: [], pinned: [] }));
    const local = (part, side, gx, gz) => side === 'N' || side === 'S' ? gx - part.room.x : gz - part.room.z;
    const cellOfKey = (key, side) => { const [, xs, zs] = key.split(':'); return [+xs + SIDE_CELL[side][0], +zs + SIDE_CELL[side][1]]; };
    // real openings: to the rectangle whose wall they are in (a wide door's parts go with it, one by one)
    for (const o of openings || []) {
      if (!o.key || !SIDE_CELL[o.side]) continue;
      const [gx, gz] = cellOfKey(o.key, o.side), k = at(gx, gz); if (k < 0) continue;
      const moved = { ...o, index: local(parts[k], o.side, gx, gz) };
      if (o.open) moved.open = o.open.map(s => { if (!s.key) return null; const [sx, sz] = cellOfKey(s.key, s.side); return at(sx, sz) === k ? { side: s.side, index: local(parts[k], s.side, sx, sz) } : null; }).filter(Boolean);
      parts[k].openings.push(moved);
    }
    // joins: along each side of each rectangle, the runs of cells whose neighbour across that side is another of the
    // room's rectangles. Indoors a join reads as a doorway as wide as the run; outdoors it is just open ground.
    const NB = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };
    parts.forEach((part, k) => {
      const { x, z, w, d } = part.room;
      for (const side of ['N', 'S', 'W', 'E']) {
        const n = side === 'N' || side === 'S' ? w : d; let run = null;
        const flush = () => { if (!run) return; for (let t = 0; t < run.n; t++) part.openings.push({ side, index: run.i0 + t, kind: outdoor ? 'join' : 'door', to: r.id, key: `join:${k}:${side}:${run.i0}`, span: run.n, part: t > 0, why: 'open to the rest of the room', join: true }); run = null; };
        for (let t = 0; t < n; t++) {
          const gx = side === 'N' || side === 'S' ? x + t : side === 'W' ? x : x + w - 1, gz = side === 'W' || side === 'E' ? z + t : side === 'N' ? z : z + d - 1;
          const q = at(gx + NB[side][0], gz + NB[side][1]);
          if (q >= 0 && q !== k && hasCell(recipe, gx + NB[side][0], gz + NB[side][1])) { if (run && run.q === q) run.n++; else { flush(); run = { i0: t, n: 1, q }; } } else flush();
        }
        flush();
      }
    });
    for (const o of pinned) { const k = at(Math.floor(o.x / 5), Math.floor(o.z / 5)); (parts[k < 0 ? 0 : k]).pinned.push(o); }
    return parts;
  }
  const pinnedOf = (entities, roomId) => Object.values(entities).filter(e => e.kind === 'object' && e.room === roomId && e.pinned);

  // Walls, doors and windows for everything in an area (pure function of the rooms).
  // With rooms at several heights: one wall map per height, merged. Off the ground every key carries its level suffix
  // ('h:3:4@10', core/footprint.js), and every edge and corner its y; at y = 0 nothing differs from before storeys.
  function edges(entities) {
    const rooms = roomsOf(entities);
    const ys = [...new Set(rooms.map(r => r.y || 0))].sort((a, b) => a - b);
    if (ys.length <= 1 && !ys[0]) return { rooms, ...walls.computeEdges(rooms, { engine: 'v2' }) };
    const out = { rooms, edges: new Map(), corners: [], openings: new Map(), open: new Map() };
    for (const y of ys) {
      const E = levelEdges(rooms, y), sfx = levelSuffix(y), k = (key) => key + sfx;
      for (const e of E.edges.values()) { if (sfx) { e.key = k(e.key); if (e.spanKeys) e.spanKeys = e.spanKeys.map(k); if (e.spanOf) e.spanOf = k(e.spanOf); } e.y = y; out.edges.set(e.key, e); }
      for (const c of E.corners) out.corners.push({ ...c, y });
      for (const [id, list] of E.openings) out.openings.set(id, sfx ? list.map(o => ({ ...o, ...(o.key && { key: k(o.key) }), flatKey: o.key })) : list);
      for (const [id, list] of E.open) out.open.set(id, sfx ? list.map(o => ({ ...o, key: k(o.key) })) : list);
    }
    return out;
  }

  // THE STAIR A ROOM NEEDS (core/stairs.js planStair), as object.place args without an id: clear of every doorway, and
  // the catalog's stair for the lower room's wall family (stone in a stone building). null + .why when there is none.
  // `entities` must hold the room (for a room about to be made: a stub { id, kind:'room', recipe, building, order }).
  // (2026-10-11) what comes back is an ordinary placed stair: a catalog piece at its own size, its front its foot.
  const doorsOf = (entities) => { const doors = []; try { for (const e of edges(entities).edges.values()) if (e.kind === 'door') { const t = walls.edgeTransform(e); doors.push({ x: t.x, z: t.z, y: e.y || 0 }); } } catch { /* a stub the wall engine cannot place: plan without doors */ } return doors; };
  const familyOf = (entities, id) => { try { return roomsOf(entities).find(r => r.id === id)?.family || ''; } catch { return ''; } };
  const pieced = (entities, P) => P && { ...P, args: { ...P.args, ...stairPieceArgs(lib, sizeOf, P.kind, familyOf(entities, P.from), P.args.rise || 10) } };
  function stairFor(entities, room, opts = {}) { // opts.loose: rooms whose furniture does not count (the caller lays them again)
    const P = planStair(entities, room, { doors: doorsOf(entities), ...opts });
    stairFor.why = P ? '' : planStair.why;
    return pieced(entities, P);
  }
  // THE STAIR WORTH OFFERING for a room drawn by hand (core/stairs.js stairOffer): null when nothing lines up
  const stairOffer = (entities, room) => pieced(entities, offerStair(entities, room, { doors: doorsOf(entities) }));
  // A STAIR CORE THROUGH SEVERAL STOREYS, for the building generator (core/stairs.js stairCore):
  //   stairCore({ at: { gx, gz, q }, levels: [0, 10, 20], kind: 'straight' | 'ladder', side: 1 | -1, family, room })
  //   -> { stairs: [object.place args without ids], keep: [{ y, cells }] }
  function stairCore(spec) {
    const C = coreStairs(spec);
    return { ...C, stairs: C.stairs.map(({ kind, rise, ...a }) => ({ ...a, ...(rise !== 10 && { rise }), ...stairPieceArgs(lib, sizeOf, kind, spec.family || '', rise) })) };
  }
  // the catalog piece an old `place: 'stair'` object becomes (core/migrate.js migrateStairs): its own sku where the
  // library still has it, else the piece of its kind
  function stairPieceOf(kind, sku, rise = 10) {
    const cat = sku && Object.keys(STAIR_ROLES).find(id => lib.objects[id]?.skus.some(k => k.sku === sku && k.url)), Z = cat && sizeOf(cat, sku);
    if (!Z) return stairPieceArgs(lib, sizeOf, kind, /stone/.test(sku || '') ? 'dressed-stone' : '', rise);
    const f = rise / (STAIR_ROLES[cat].rise || 10);
    return { cat, sku: Z.sku, url: Z.url, place: Z.place || 'kit', yaw: Z.yaw || 0, ...(Z.s && { s: [Z.s[0], Z.s[1] * f, Z.s[2]] }), dims: [Z.dims[0], Z.dims[1] * f, Z.dims[2]] };
  }

  // catalog sizing for something placed by hand: the solver's own rule (largest dimension to largest dimension, known
  // front from the orientation sweep), at nominal scale
  const sizer = { lib, opts: { orient, ...SOLVER_OPTS, scaleVariety: 0 }, r: () => 1 };
  function sizeOf(catId, skuName) {
    const o = lib.objects[catId]; if (!o) return null;
    const sku = (skuName && o.skus.find(k => k.sku === skuName)) || o.skus.find(k => (k.kind === 'flat' || k.bounds) && solver.skuUsable(k, SOLVER_OPTS)) || o.skus.find(k => k.bounds || k.kind === 'flat');
    if (!sku) return null;
    const dm = solver.Ctx.prototype.dims.call(sizer, catId, sku);
    return { sku: sku.sku, url: sku.url, flat: sku.kind === 'flat', place: o.place, s: dm.s, yaw: dm.yaw || 0, dims: [dm.w, dm.h, dm.d] };
  }
  // which floor material a room shows (the tuner's rule: the type's list, seeded by wallSeed, unless set)
  function floorFor(rc) {
    if (rc.floor && rc.floor !== 'auto') return rc.floor;
    const list = (T[rc.type]?.floors || []).filter(f => lib.objects[f]);
    if (!list.length) return 'floor-tile';
    const h = walls.hash(rc.wallSeed, 'floor');
    return h % 2 === 0 ? list[0] : list[h % list.length];
  }
  const floors = Object.keys(lib.objects).filter(k => k.startsWith('floor-') && lib.objects[k].skus.some(s => s.kind === 'flat'));

  return { factionChange: (entities, id, flavor) => planFactionChange(entities, id, flavor, lib, types), isOutdoor: (type) => !!walls.isOutdoor?.(type), types: typeKeys, typeList: types.map(t => ({ key: t.key, label: t.label, cells: t.cells, family: t.family, ...(t.group && { group: t.group }) })), factionOf: (entities, e) => effectiveFaction(entities, e, lib, types), skuUsable: (k) => solver.skuUsable(k, SOLVER_OPTS), version, solve, pinnedOf, edges, roomsOf, stairFor, stairOffer, stairCore, stairPieceOf, sizeOf, floorFor, floors, families: walls.WALL_FAMILIES, skuRec, lib, orient };
}
let _n = 0;
function defaultId(p) { return `${p}_${Date.now().toString(36)}${(++_n).toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, p.length + 1 + 20); }
