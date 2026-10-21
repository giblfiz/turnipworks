// Spawn-in / spawn-out choreography. Scheduling is pure (node-testable); applying a pose touches Object3D fields only.
//
// A schedule gives every item a start delay:
//   delay = layerIndex * layerGap  +  wave(item) * waveGap  +  jitter
// wave(): a front sweeps from a corner, an edge, the door or the centre across the room (Harry 2026-09-30:
// "a wave of things coming in from one corner to the other bit by bit, but with more than one tile at a time").
// Items are banded by distance along the sweep; each band lands together.  mode 'continuous' instead delays by
// distance / expansion rate, and 'all' drops the sweep (everything in a layer lands at once).

// walls-near = the walls between the camera and the room (Harry 2026-09-30: they should come in after everything else)
export const LAYERS = ['floor', 'walls', 'openings', 'anchor', 'furnish', 'store', 'floor-dress', 'dress', 'light', 'walls-near'];

export const EASES = {
  linear: t => t,
  inOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  backOut: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  elasticOut: (t, s = 1) => {
    if (t <= 0 || t >= 1) return t <= 0 ? 0 : 1;
    const p = 0.3 / Math.max(0.3, s);
    return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) * Math.max(0.3, s) + 1;
  },
  bounceOut: t => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

export const DEFAULT_MOTION = { dur: 420, ease: 'backOut', overshoot: 1.7, startScale: 0.01, grow: 'uniform', spin: 0, spinAxis: 'y', drop: 0, fade: false, squash: 0 };

// Fauna's first defaults (2026-09-30), kept loadable as the built-in "fauna-default-v1"
export function faunaDefaultPreset() {
  const choreo = { nearWallsLast: true, layerGap: 260, layerMode: 'sequential', sweep: 'NW', mode: 'waves', band: 5, waveGap: 110, rate: 45, jitter: 50, perWave: 0, reverse: false };
  return {
    name: 'fauna-default-v1',
    speed: 1,
    in: {
      choreo,
      objects: { ...DEFAULT_MOTION },
      floor: { ...DEFAULT_MOTION, dur: 320, startScale: 0.3, spin: 180, spinAxis: 'x', overshoot: 1.2 },
      walls: { ...DEFAULT_MOTION, dur: 380, startScale: 0, grow: 'y', overshoot: 0.8 },
    },
    out: {
      mirror: true,
      choreo: { ...choreo, layerGap: 120, waveGap: 60, reverse: true },
      objects: { ...DEFAULT_MOTION, dur: 260, ease: 'outCubic' },
      floor: { ...DEFAULT_MOTION, dur: 240, ease: 'outCubic', spin: 180, spinAxis: 'x' },
      walls: { ...DEFAULT_MOTION, dur: 260, ease: 'outCubic', grow: 'y', startScale: 0 },
    },
  };
}

// Harry's first tuning (sent 2026-09-30 21:38): "harry-v1", the default until his fast Out arrived.
// Fields his preset predates (choreo.nearWallsLast) keep their defaults.
export function harryV1Preset() {
  return {
    name: 'harry-v1',
    speed: 1,
    in: {
      choreo: { nearWallsLast: true, ...{'layerGap': 350, 'layerMode': 'sequential', 'sweep': 'N', 'mode': 'waves', 'band': 4, 'waveGap': 140, 'rate': 45, 'jitter': 95, 'perWave': 0, 'reverse': false} },
      objects: {'dur': 690, 'ease': 'backOut', 'overshoot': 1.05, 'startScale': 0.01, 'grow': 'uniform', 'spin': -480, 'spinAxis': 'x', 'drop': 0, 'fade': true, 'squash': 0.5},
      floor: {'dur': 530, 'ease': 'backOut', 'overshoot': 1.2, 'startScale': 0.18, 'grow': 'uniform', 'spin': 240, 'spinAxis': 'y', 'drop': 0, 'fade': false, 'squash': 0},
      walls: {'dur': 1150, 'ease': 'backOut', 'overshoot': 2.35, 'startScale': 0.05, 'grow': 'uniform', 'spin': 0, 'spinAxis': 'y', 'drop': 0, 'fade': false, 'squash': 0.14},
    },
    out: {
      mirror: true,
      choreo: { nearWallsLast: true, ...{'layerGap': 120, 'layerMode': 'sequential', 'sweep': 'NW', 'mode': 'waves', 'band': 5, 'waveGap': 60, 'rate': 45, 'jitter': 50, 'perWave': 0, 'reverse': true} },
      objects: {'dur': 260, 'ease': 'outCubic', 'overshoot': 1.7, 'startScale': 0.01, 'grow': 'uniform', 'spin': 0, 'spinAxis': 'y', 'drop': 0, 'fade': false, 'squash': 0},
      floor: {'dur': 240, 'ease': 'outCubic', 'overshoot': 1.7, 'startScale': 0.01, 'grow': 'uniform', 'spin': 180, 'spinAxis': 'x', 'drop': 0, 'fade': false, 'squash': 0},
      walls: {'dur': 260, 'ease': 'outCubic', 'overshoot': 1.7, 'startScale': 0, 'grow': 'y', 'spin': 0, 'spinAxis': 'y', 'drop': 0, 'fade': false, 'squash': 0},
    },
  };
}

// Harry's second tuning (sent 2026-10-01 16:56): same In, a fast scattered Out (own settings, merged layers, 70 ms pops).
// The tool default since then: "harry-v2".
const HARRY_V2 = {"name": "harry-v2", "speed": 1, "in": {"choreo": {"nearWallsLast": true, "layerGap": 350, "layerMode": "sequential", "sweep": "N", "mode": "waves", "band": 4, "waveGap": 140, "rate": 45, "jitter": 95, "perWave": 0, "reverse": false}, "objects": {"dur": 690, "ease": "backOut", "overshoot": 1.05, "startScale": 0.01, "grow": "uniform", "spin": -480, "spinAxis": "x", "drop": 0, "fade": true, "squash": 0.5}, "floor": {"dur": 530, "ease": "backOut", "overshoot": 1.2, "startScale": 0.18, "grow": "uniform", "spin": 240, "spinAxis": "y", "drop": 0, "fade": false, "squash": 0}, "walls": {"dur": 1150, "ease": "backOut", "overshoot": 2.35, "startScale": 0.05, "grow": "uniform", "spin": 0, "spinAxis": "y", "drop": 0, "fade": false, "squash": 0.14}}, "out": {"mirror": false, "choreo": {"nearWallsLast": false, "layerGap": 130, "layerMode": "merged", "sweep": "NW", "mode": "waves", "band": 7, "waveGap": 20, "rate": 45, "jitter": 130, "perWave": 0, "reverse": false}, "objects": {"dur": 70, "ease": "outCubic", "overshoot": 0.8, "startScale": 0.01, "grow": "uniform", "spin": 0, "spinAxis": "y", "drop": 0, "fade": false, "squash": 0}, "floor": {"dur": 240, "ease": "outCubic", "overshoot": 1.7, "startScale": 0.01, "grow": "uniform", "spin": 180, "spinAxis": "x", "drop": 0, "fade": false, "squash": 0}, "walls": {"dur": 260, "ease": "outCubic", "overshoot": 1.7, "startScale": 0, "grow": "y", "spin": 0, "spinAxis": "y", "drop": 0, "fade": false, "squash": 0}}};
export function defaultPreset() { return JSON.parse(JSON.stringify(HARRY_V2)); }

export const BUILTIN_PRESETS = { 'harry-v2': defaultPreset, 'harry-v1': harryV1Preset, 'fauna-default-v1': faunaDefaultPreset };

export function motionFor(side, layer) {
  if (layer === 'floor') return side.floor;
  if (layer === 'walls' || layer === 'openings' || layer === 'walls-near') return side.walls;
  return side.objects;
}

// Sweep coordinate of an item (feet). rect = {x0,z0,x1,z1} of the room(s) being animated, door = [x,z] or null.
export function sweepDistance(sweep, x, z, rect, door) {
  const { x0, z0, x1, z1 } = rect;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const dirs = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0], NW: [1, 1], NE: [-1, 1], SW: [1, -1], SE: [-1, -1] };
  if (sweep === 'center') return Math.hypot(x - cx, z - cz);
  if (sweep === 'door' && door) return Math.hypot(x - door[0], z - door[1]);
  const d = dirs[sweep] || dirs.NW;
  // origin = the corner/edge the front starts from; the front moves along d
  const ox = d[0] > 0 ? x0 : d[0] < 0 ? x1 : cx, oz = d[1] > 0 ? z0 : d[1] < 0 ? z1 : cz;
  const len = Math.hypot(d[0], d[1]);
  return ((x - ox) * d[0] + (z - oz) * d[1]) / len;
}

// items: [{x, z, layer, key}] -> delays (ms) aligned with items, plus total duration (ms) given the motions
export function schedule(items, side, rect, door, rng = Math.random) {
  const c = side.choreo;
  const layerIdx = new Map(LAYERS.map((l, i) => [l, i]));
  const present = [...new Set(items.map(it => it.layer))].sort((a, b) => (layerIdx.get(a) ?? 99) - (layerIdx.get(b) ?? 99));
  const rank = new Map(present.map((l, i) => [l, i]));
  const dist = items.map(it => c.sweep === 'random' ? rng() * 40 : sweepDistance(c.sweep, it.x, it.z, rect, door));
  const delays = new Array(items.length).fill(0);
  // waves are computed per layer so every layer gets its own front
  const groups = new Map();
  items.forEach((it, i) => { const k = c.layerMode === 'merged' ? '_' : it.layer; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
  for (const [k, idx] of groups) {
    const base = k === '_' ? 0 : rank.get(k) * c.layerGap;
    const minD = Math.min(...idx.map(i => dist[i]));
    let waveOf;
    if (c.mode === 'all') waveOf = () => 0;
    else if (c.mode === 'continuous') waveOf = null;
    else {
      const band = Math.max(0.5, c.band);
      const raw = new Map(idx.map(i => [i, Math.floor((dist[i] - minD) / band)]));
      if (c.perWave > 0) { // cap a wave's size; overflow spills into later waves, preserving sweep order
        const order = [...idx].sort((a, b) => raw.get(a) - raw.get(b) || dist[a] - dist[b]);
        let w = -1, n = 0, last = null;
        for (const i of order) {
          const r = raw.get(i);
          if (r !== last) { w = Math.max(w + 1, r); n = 0; last = r; } else if (n >= c.perWave) { w++; n = 0; }
          raw.set(i, w); n++;
        }
      }
      waveOf = i => raw.get(i);
    }
    const waves = idx.map(i => waveOf ? waveOf(i) : 0);
    const maxW = Math.max(0, ...waves);
    idx.forEach((i, j) => {
      const along = waveOf ? (c.reverse ? maxW - waves[j] : waves[j]) * c.waveGap
        : ((c.reverse ? -1 : 1) * (dist[i] - minD) + (c.reverse ? Math.max(...idx.map(q => dist[q])) - minD : 0)) / Math.max(1, c.rate) * 1000;
      delays[i] = base + along + rng() * c.jitter;
    });
  }
  if (c.reverse && c.layerMode !== 'merged') { // out: last layer leaves first
    const maxRank = present.length - 1;
    items.forEach((it, i) => { delays[i] += (maxRank - 2 * rank.get(it.layer)) * c.layerGap; });
  }
  // walls-near is a hard "after": the camera-side walls start once everything else has started (in), and on the
  // way out everything else waits until they've gone (out = reverse), so the fourth wall never hides the show.
  const near = items.map((it, i) => it.layer === 'walls-near' ? i : -1).filter(i => i >= 0);
  const rest = items.map((it, i) => it.layer !== 'walls-near' ? i : -1).filter(i => i >= 0);
  if (near.length && rest.length) {
    const gap = Math.max(60, c.layerGap * 0.5);
    if (!c.reverse) {
      const shift = Math.max(...rest.map(i => delays[i])) + gap - Math.min(...near.map(i => delays[i]));
      if (shift > 0) near.forEach(i => { delays[i] += shift; });
    } else {
      const nearEnd = Math.max(...near.map(i => delays[i] + motionFor(side, 'walls-near').dur));
      const shift = nearEnd + gap - Math.min(...rest.map(i => delays[i]));
      if (shift > 0) rest.forEach(i => { delays[i] += shift; });
      const n0 = Math.min(...near.map(i => delays[i])); near.forEach(i => { delays[i] -= n0; });
    }
  }
  let total = 0;
  items.forEach((it, i) => { total = Math.max(total, delays[i] + motionFor(side, it.layer).dur); });
  return { delays, total };
}

// Pose at progress p (0..1 of the motion's duration). Returns multipliers relative to the rest pose.
export function pose(m, p) {
  const t = Math.min(1, Math.max(0, p));
  const ease = EASES[m.ease] || EASES.backOut;
  const e = ease(t, m.overshoot);
  const k = m.startScale + (1 - m.startScale) * e;
  let sx = 1, sy = 1, sz = 1;
  if (m.grow === 'y') sy = k; else if (m.grow === 'xz') { sx = k; sz = k; } else { sx = sy = sz = k; }
  if (m.squash > 0 && t > 0.6) {
    const q = m.squash * Math.sin(Math.PI * (t - 0.6) / 0.4);
    sy *= 1 - q; sx *= 1 + q / 2; sz *= 1 + q / 2;
  }
  const ang = (m.spin * Math.PI / 180) * (1 - e);
  return { sx, sy, sz, dy: m.drop * (1 - e), ang, axis: m.spinAxis, opacity: m.fade ? Math.min(1, t * 1.6) : 1 };
}

// ---------------------------------------------------------------------------------------------------------------
// FLY-AWAY (Harry 2026-10-06): "Instead of just disappearing, levels above the cut should fly up into the sky
// offscreen in a (very) short animation ... a 'not all at once' thing, sort of like the way stuff builds, but faster."
// The same two pure pieces as the spawn above: a SCHEDULE (who leaves when) and a POSE (where a piece is at progress
// u). u runs 0 (at rest) to 1 (away); coming back is the same curve run backwards. fx/cutfly.js steps it.
//   time  { dur: ms one piece takes, stagger: ms between the first piece leaving and the last, back: speed of the return (x) }
//   order { by: 'click' (outward from a point) | 'piece' (a sweep across) | 'room' (room after room) | 'random', jitter: 0..1 }
//   move  { rise: ft, ease, fade: bool, fadeFrom: 0..1 of the flight after which it fades }
EASES.inQuad = t => t * t;
EASES.inCubic = t => t * t * t;
EASES.inQuart = t => t * t * t * t;
EASES.inOutQuad = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const FLY_DEFAULTS = { name: 'fly-quick', on: true, time: { dur: 200, stagger: 150, back: 1 }, order: { by: 'click', jitter: 0.25 }, move: { rise: 70, ease: 'inCubic', fade: false, fadeFrom: 0.55 } };
export const FLY_SCHEMA = [
  ['Timing', 'time', [
    { k: 'dur', label: 'One piece takes', unit: 'ms', type: 'range', min: 40, max: 1500, step: 10 },
    { k: 'stagger', label: 'First piece to last piece (0 = all at once)', unit: 'ms', type: 'range', min: 0, max: 2500, step: 10 },
    { k: 'back', label: 'Coming back, speed', unit: 'x', type: 'range', min: 0.5, max: 3, step: 0.05 },
  ]],
  ['Order', 'order', [
    { k: 'by', label: 'Who leaves first', type: 'select', options: [['click', 'outward from the click'], ['piece', 'piece by piece, a sweep across'], ['room', 'room by room'], ['random', 'random']] },
    { k: 'jitter', label: 'Scatter (0 = strict order)', type: 'range', min: 0, max: 1, step: 0.05 },
  ]],
  ['Move', 'move', [
    { k: 'rise', label: 'Rise height', unit: 'ft', type: 'range', min: 10, max: 200, step: 5 },
    { k: 'ease', label: 'Easing', type: 'select', options: [['inCubic', 'speeds up (cubic)'], ['inQuad', 'speeds up (gentle)'], ['inQuart', 'speeds up (hard)'], ['inOutCubic', 'eases both ends'], ['inOutQuad', 'eases both ends (gentle)'], ['linear', 'even']] },
    { k: 'fade', label: 'Fade as it goes', type: 'check' },
    { k: 'fadeFrom', label: 'Fade starts at (share of the flight)', type: 'range', min: 0, max: 0.95, step: 0.05 },
  ]],
];
const flyMk = (name, time, order, move) => () => ({ name, on: true, time: { ...FLY_DEFAULTS.time, ...time }, order: { ...FLY_DEFAULTS.order, ...order }, move: { ...FLY_DEFAULTS.move, ...move } });
export const FLY_BUILTINS = {
  quick: flyMk('fly-quick', {}, {}, {}),                                                                                   // the default: 350 ms end to end
  showy: flyMk('fly-showy', { dur: 520, stagger: 900, back: 1.2 }, { by: 'room', jitter: 0.15 }, { rise: 90, ease: 'inOutCubic', fade: true }),
  sweep: flyMk('fly-sweep', { dur: 220, stagger: 260 }, { by: 'piece', jitter: 0.1 }, {}),
  instant: flyMk('fly-instant', { dur: 40, stagger: 0 }, { by: 'random', jitter: 0 }, { rise: 10 }),
};
Object.defineProperty(FLY_BUILTINS, 'night', { value: FLY_BUILTINS.quick, enumerable: false }); // the panel's "Defaults" button (fx/index.js)
export const flyTotal = (P, dir = 1) => (P.time.stagger + P.time.dur) / (dir < 0 ? Math.max(0.1, P.time.back || 1) : 1);

// items: [{ x, z, room }] -> { delays (ms, aligned with items; the first to go has 0, the last has `stagger`), total }
// origin: [x, z] for order 'click' (the centre of the items when absent)
export function flySchedule(items, P, origin = null, rng = Math.random) {
  const n = items.length, delays = new Array(n).fill(0); if (!n) return { delays, total: 0 };
  const cx = items.reduce((s, it) => s + it.x, 0) / n, cz = items.reduce((s, it) => s + it.z, 0) / n, o = origin || [cx, cz];
  const by = P.order.by, jit = Math.max(0, Math.min(1, P.order.jitter || 0));
  let key;
  if (by === 'random') key = items.map(() => rng());
  else if (by === 'piece') key = items.map(it => it.x + it.z);
  else if (by === 'room') { // rooms in order of their distance from the origin; every piece of a room shares its turn
    const rooms = new Map(); items.forEach(it => { const r = rooms.get(it.room) || { x: 0, z: 0, n: 0 }; r.x += it.x; r.z += it.z; r.n++; rooms.set(it.room, r); });
    const order = [...rooms].map(([id, r]) => [id, Math.hypot(r.x / r.n - o[0], r.z / r.n - o[1])]).sort((a, b) => a[1] - b[1] || String(a[0]).localeCompare(String(b[0])));
    const rank = new Map(order.map(([id], i) => [id, i])); key = items.map(it => rank.get(it.room));
  } else key = items.map(it => Math.hypot(it.x - o[0], it.z - o[1]));
  const lo = Math.min(...key), span = Math.max(...key) - lo;
  // one room (or one spot): nothing to order by, so the scatter does all of it: never "all at once" unless stagger is 0
  const u = key.map(k => span > 1e-9 ? (k - lo) / span : rng());
  const v = u.map(x => x * (1 - jit) + rng() * jit), vlo = Math.min(...v), vspan = Math.max(...v) - vlo;
  for (let i = 0; i < n; i++) delays[i] = n > 1 && vspan > 1e-9 ? (v[i] - vlo) / vspan * P.time.stagger : 0;
  return { delays, total: P.time.stagger + P.time.dur };
}
// where a piece is at progress u (0 at rest .. 1 away): how far up (ft) and how solid
export function flyPose(P, u) {
  const t = Math.min(1, Math.max(0, u)), e = (EASES[P.move.ease] || EASES.inCubic)(t), f = Math.min(0.99, Math.max(0, P.move.fadeFrom ?? 0.55));
  return { dy: P.move.rise * e, opacity: P.move.fade && t > f ? 1 - (t - f) / (1 - f) : 1 };
}
