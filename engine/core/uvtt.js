// UNIVERSAL VTT EXPORT (Harry 2026-10-24: "Universal VTT export"; docs/UI.md "Universal VTT export"). The pure half: the
// map's box, its walls, doors, windows and lights, in the format's grid units. No DOM, no three.js: the client
// (client/uvtt.js) renders the picture and calls this; engine/test/uvtt.test.mjs runs it on its own.
//
// THE FORMAT (.dd2vtt / .uvtt, Dungeondraft's "Universal VTT"; read from the importers' own code, 2026-10-24, sources in
// docs/UI.md): one JSON object
//   format              0.3 (MapTool accepts only 0.2 and 0.3)
//   resolution          { map_origin {x,y}, map_size {x,y}, pixels_per_grid } in grid squares; origin (0,0) here
//                       (MapTool forgets to take the origin off its lights)
//   line_of_sight       polylines [[{x,y}, ...], ...] in grid squares from the image's top-left; consecutive points are
//                       joined, nothing is closed for you; a door or window is a GAP in them (Dungeondraft's own files)
//   objects_line_of_sight  the same for free-standing things (Foundry's importer ignores it on a single map)
//   portals             { position, bounds [a, b], rotation (radians), closed, freestanding }: Foundry and Fantasy Grounds
//                       read closed: true as a door, false as a window (sight passes, light is cut near it)
//   environment         { baked_lighting, ambient_light 'AARRGGBB' }
//   lights              { position, range (grid squares), intensity, color 'AARRGGBB', shadows }
//   image               base64 PNG
// One grid square is one 5-ft cell of ours, so a cell's corner (gx, gz) is the point (gx - x0, gz - z0): the map's y is
// our z (z grows down the map, as the picture is drawn: north up).
import { keyLevel } from './footprint.js';
import { roomY } from './height.js';

export const UVTT_FORMAT = 0.3;
export const PPG_CHOICES = [70, 100, 140, 200];
export const PPG_DEFAULT = 100;
export const UVTT_WARN_BYTES = 20 * 1024 * 1024; // a file past this gets a warning (some importers and browsers struggle)
export const MAX_SIDE_PX = 16384, MAX_PIXELS = 150e6; // the browser's canvas limits (the picture is one canvas)
const CELL = 5;
const r3 = (v) => Math.round(v * 1000) / 1000;
const pt = (x, y) => ({ x: r3(x), y: r3(y) });

// THE MAP'S BOX, in whole cells: every room the export shows (any level, so each storey's file lines up with the others),
// grown by `margin` cells. extra: [[x, z] ft ...] (things standing outside every room). null when there is nothing.
export function mapBox(rooms, { margin = 1, extra = [] } = {}) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const r of rooms) { const c = r.recipe || r; x0 = Math.min(x0, c.x); z0 = Math.min(z0, c.z); x1 = Math.max(x1, c.x + c.w); z1 = Math.max(z1, c.z + c.d); }
  for (const [x, z] of extra) { x0 = Math.min(x0, Math.floor(x / CELL)); z0 = Math.min(z0, Math.floor(z / CELL)); x1 = Math.max(x1, Math.ceil(x / CELL)); z1 = Math.max(z1, Math.ceil(z / CELL)); }
  if (!Number.isFinite(x0)) return null;
  return { x0: x0 - margin, z0: z0 - margin, x1: x1 + margin, z1: z1 + margin, w: x1 - x0 + 2 * margin, d: z1 - z0 + 2 * margin };
}

// one edge's cell-corner end points (grid squares, our frame): 'h' runs along x on the line z = gz, 'v' along z
const ends = (e, n = 1) => e.dir === 'h' ? [[e.gx, e.gz], [e.gx + n, e.gz]] : [[e.gx, e.gz], [e.gx, e.gz + n]];
const edgeDir = (e) => e.dir || e.key?.[0];
const parse = (key) => { const [d, x, z] = key.split('@')[0].split(':'); return { dir: d, gx: +x, gz: +z }; };

// WALLS, DOORS AND WINDOWS OF ONE LEVEL, exactly as the world draws them (world.js buildShell):
//   edges        the world's edge map (core/roomgen edges + the 'edge' overrides applied: world.js applyEdgeOverrides)
//   level        the floor height (ft) of the storey exported; an edge's level is its key's '@y' (0 without one)
//   hidden       Set of hidden room ids; an edge every side of which is a hidden room is left out unless includeHidden
//                (the GM's shell makes a wall shared with a hidden room the visible room's own wall: world.js)
//   stacks       wall keys at this level that a TALL room below carries up (plain wall, no openings: world.js TALL ROOMS)
//   moved        wall pieces turned into things ({ fromEdge, x, z, rot, dims }): a wall where the thing now stands
// -> { walls: [[{x,y},{x,y}], ...] (merged straight runs), portals: [...], counts }
export function wallsAndPortals({ edges, level = 0, hidden = new Set(), includeHidden = false, stacks = [], moved = [], box }) {
  const ox = box.x0, oz = box.z0;
  const H = new Map(), V = new Map(); // line -> Set of cell indices along it that carry wall
  const addUnit = (dir, gx, gz) => { if (dir === 'h') (H.get(gz) || H.set(gz, new Set()).get(gz)).add(gx); else (V.get(gx) || V.set(gx, new Set()).get(gx)).add(gz); };
  const portals = [], counts = { wall: 0, door: 0, window: 0, open: 0, hidden: 0, stack: 0, moved: 0, levelEdges: 0 };
  const seen = new Set();
  for (const e of edges.values ? edges.values() : edges) {
    if (keyLevel(e.key) !== level) continue;
    counts.levelEdges++; seen.add(e.key);
    if (!includeHidden && hidden.size && (e.sides || [e.owner]).filter(Boolean).every(s => hidden.has(s.room))) { counts.hidden++; continue; }
    if (e.open) { counts.open++; continue; } // deleted (or moved away: `moved` below): no generated piece here
    const dir = edgeDir(e);
    if (e.kind === 'wall') { addUnit(dir, e.gx, e.gz); counts.wall++; continue; }
    if (e.kind === 'door-span') continue; // the rest of a wide door: the door's own portal covers it
    if (e.kind === 'door' || e.kind === 'window') {
      const n = e.kind === 'door' ? (e.span || 1) : 1, [[ax, az], [bx, bz]] = ends({ ...e, dir }, n);
      const a = pt(ax - ox, az - oz), b = pt(bx - ox, bz - oz);
      portals.push({ position: pt((a.x + b.x) / 2, (a.y + b.y) / 2), bounds: [a, b], rotation: dir === 'h' ? 0 : r3(Math.PI / 2), closed: e.kind === 'door', freestanding: false });
      counts[e.kind]++;
      continue;
    }
    addUnit(dir, e.gx, e.gz); counts.wall++; // (anything else the wall engine builds stands like a wall)
  }
  for (const k of stacks) { if (seen.has(k) || keyLevel(k) !== level) continue; const p = parse(k); addUnit(p.dir, p.gx, p.gz); counts.stack++; seen.add(k); }
  // a wall piece someone turned into a thing (and maybe moved or turned): a 5-ft wall along its own x, where it stands now
  const free = [];
  for (const m of moved) {
    if (m.fromEdge && keyLevel(m.fromEdge) !== level) continue;
    const len = Number.isFinite(m.dims?.[0]) && m.dims[0] > 0.5 && m.dims[0] < 30 ? m.dims[0] : CELL, rot = m.rot || 0;
    const ax = Math.cos(rot), az = -Math.sin(rot), hx = ax * len / 2, hz = az * len / 2;
    free.push([pt((m.x - hx) / CELL - ox, (m.z - hz) / CELL - oz), pt((m.x + hx) / CELL - ox, (m.z + hz) / CELL - oz)]);
    counts.moved++;
  }
  // straight runs: contiguous unit edges on one grid line become one segment
  const walls = [];
  const runs = (set) => { const s = [...set].sort((a, b) => a - b), out = []; for (const i of s) { const r = out.at(-1); if (r && r[1] === i) r[1] = i + 1; else out.push([i, i + 1]); } return out; };
  for (const [gz, set] of [...H].sort((a, b) => a[0] - b[0])) for (const [a, b] of runs(set)) walls.push([pt(a - ox, gz - oz), pt(b - ox, gz - oz)]);
  for (const [gx, set] of [...V].sort((a, b) => a[0] - b[0])) for (const [a, b] of runs(set)) walls.push([pt(gx - ox, a - oz), pt(gx - ox, b - oz)]);
  return { walls: walls.concat(free), portals, counts };
}

// colours by kind of light, AARRGGBB (Foundry drops the AA; Fantasy Grounds keeps it): flame light warm, a glow cool
export const LIGHT_COLORS = { candle: 'ffffc98a', lamp: 'ffffd59c', lantern: 'ffffd59c', torch: 'ffffb062', fire: 'ffffa357', chandelier: 'ffffd08f', oven: 'ffff9447', glow: 'ffa8d8ff' };
// lights: [{ x, z (ft), radius (ft), kind }] -> the format's lights (range in grid squares; Foundry: dim = range,
// bright = half of it)
export function uvttLights(lights, box) {
  return lights.map(l => ({ position: pt(l.x / CELL - box.x0, l.z / CELL - box.z0), range: r3(l.radius / CELL), intensity: 1, color: LIGHT_COLORS[l.kind] || 'ffffd59c', shadows: true }));
}

// the rooms an export of `level` frames: every room shown (any level), and those standing on this level
export function roomsFor(entities, { includeHidden = false } = {}) {
  return Object.values(entities || {}).filter(e => e.kind === 'room' && e.recipe && (includeHidden || !e.hidden));
}
export const roomsAt = (rooms, level) => rooms.filter(r => roomY(r.recipe) === level);

// the whole file but the picture (the client fills `image`)
export function uvttDocument({ box, ppg, walls, portals, lights, objects = [], software = 'Turnip Works', creator = '' }) {
  return {
    format: UVTT_FORMAT,
    resolution: { map_origin: { x: 0, y: 0 }, map_size: { x: box.w, y: box.d }, pixels_per_grid: ppg },
    line_of_sight: walls,
    objects_line_of_sight: objects,
    portals,
    environment: { baked_lighting: true, ambient_light: 'ffffffff' },
    lights,
    software, creator,
    image: '',
  };
}

// would a picture of this box at this ppg fit in one canvas? -> null or why not (in words)
export function sizeProblem(box, ppg) {
  const W = box.w * ppg, H = box.d * ppg;
  if (W > MAX_SIDE_PX || H > MAX_SIDE_PX || W * H > MAX_PIXELS) return `At ${ppg} px a square the picture would be ${W} × ${H} px, more than a browser can draw at once: pick fewer pixels a square`;
  return null;
}
