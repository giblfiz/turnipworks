import { arc, curveDefaults, worldDefaults } from './model.js';

export const VERSION = 2;
export const DEFAULT = {
  arcs: {
    closed: arc('primary', 132, -80, 100),
    primary: arc('primary', 194, 200, 68),
    secondary: arc('secondary', 280, 285, 115, { from: 'menu' }),
    menu: arc('menu', 132, 60, 0, { from: 'slot' }),
    conditions: arc('nested', 365, 289, 130, { from: 'menu' }),
    faction: arc('nested', 365, 289, 130, { from: 'menu' }),
    nested: arc('nested', 365, 289, 130, { from: 'menu' }),
  },
  curve: curveDefaults(),
  world: worldDefaults(),
  // WHERE THE RING CENTRES (Harry 2026-10-20: "it would be great if it was roughly the head ... doesn't need to be
  // perfect"): a point this far up the model (% of its height, at the middle of its footprint). Rooms and several pieces
  // keep the middle of what is drawn.
  centre: { pawn: 85, thing: 50 },
  tracks: { style: 'radial', length: 100, angle: 0, radius: 140, x: 0, y: 0, ticks: true, valuePosition: 'end' },
  labelMode: 'over', labelWhen: 'always', fontSize: 11, fontWeight: 600,
  labelColor: '#f6e7cc', labelHalo: 3, labelOffset: 13,
  edgeRule: 'slide', showGhost: true, showMotion: false,
  hover: 1.1, press: 0.94,
  iconSet: 'line (current)', iconAlternates: {},
};

const change = (base, changes) => {
  const s = structuredClone(base);
  for (const [key, value] of Object.entries(changes)) {
    if (key === 'arcs') for (const [name, delta] of Object.entries(value)) Object.assign(s.arcs[name], delta);
    else if (key === 'tracks') Object.assign(s.tracks, value);
    else if (key === 'curve') Object.assign(s.curve, value);
    else if (key === 'world') Object.assign(s.world, value);
    else if (key === 'centre') Object.assign(s.centre, value);
    else s[key] = value;
  }
  return s;
};

export const BUILTINS = {
  'Current game · baseline': change(DEFAULT, { arcs: {
    closed: { radius: 145, size: 67, gap: 12, duration: 200 },
    primary: { radius: 205, size: 67, gap: 12, duration: 200 },
    secondary: { radius: 270, size: 67, gap: 12, duration: 200 },
    menu: { radius: 145, size: 67, duration: 200 },
  }, labelMode: 'hover' }),
  'Mockup 11 · close reading': change(DEFAULT, { arcs: {
    closed: { radius: 140, size: 64 }, primary: { radius: 200, size: 64 },
    secondary: { radius: 290, size: 64 }, menu: { radius: 140, size: 64 },
    conditions: { radius: 370, size: 64 }, faction: { radius: 370, size: 64 }, nested: { radius: 370, size: 64 },
  }, labelMode: 'under', fontSize: 13 }),
  'Tight horseshoe': change(DEFAULT, { arcs: {
    closed: { radius: 120, size: 58, gap: 7 }, primary: { radius: 170, size: 58, gap: 7 },
    secondary: { radius: 230, size: 58, gap: 7 }, menu: { radius: 120, size: 58, gap: 7 },
    conditions: { radius: 310, size: 58, gap: 7 }, faction: { radius: 310, size: 58, gap: 7 }, nested: { radius: 310, size: 58, gap: 7 },
  }, labelMode: 'hover' }),
  'Quiet brass · Fauna': structuredClone(DEFAULT),
};
// Harry 2026-10-19: "maybe the menu is really an oval … maintain an even distance between items … use the 9–3:00 top
// half and get like 8 items … the primary items sit on the normal ellipse, and then slide". 67 px buttons, 12 px gap:
// a 79 px pitch, and the 9-to-3 top half of a 210 × 150 ellipse is 569 px of curve, so it holds 8 buttons.
BUILTINS['Ellipse · one curve'] = change(BUILTINS['Current game · baseline'], {
  curve: { on: true, rx: 210, ry: 150, x: 0, y: -60, size: 67, gap: 12, groupGap: 16, closedAt: 0, secondaryStart: -90, primaryFloor: -160,
    nestOffset: 80, nestStart: -150, nestEnd: 75, duration: 520, stagger: 30, easing: 'ease-in-out', enter: 'from ☰' },
  // Harry 2026-10-20: "I'm still seeing the orbitals moving around to stay on the screen": this preset is the world-
  // sized ring (no edge rule; it may run off screen). The four circle presets above keep world size off.
  world: { on: true },
  showGhost: false,
});

export function normalize(input) {
  const raw = input?.data?.settings ? input.data.settings : input?.settings || input || {};
  const version = input?.data?.version || input?.version || (raw.arcs ? 2 : 1);
  if (version < 2 || !raw.arcs) return migrateV1(raw);
  const s = structuredClone(DEFAULT);
  for (const [k, v] of Object.entries(raw)) if (!['arcs', 'tracks', 'curve', 'world', 'centre'].includes(k)) s[k] = structuredClone(v);
  Object.assign(s.curve, raw.curve || {}); Object.assign(s.world, raw.world || {}); Object.assign(s.centre, raw.centre || {});
  delete s.curve.menuGap; // (☰ has no gap of its own since 2026-10-20: an old saved ring's is dropped)
  for (const [k, v] of Object.entries(raw.arcs || {})) if (s.arcs[k]) Object.assign(s.arcs[k], v);
  Object.assign(s.tracks, raw.tracks || {});
  return s;
}

export function migrateV1(old = {}) {
  const s = structuredClone(DEFAULT);
  const n = (key, fallback) => old[key] == null ? fallback : +old[key];
  const diameter = n('diameter', 67), gap = n('gap', 0), radius = n('radius', 122);
  const primaryR = n('primaryRadius', 205);
  // These maxima and angle formulas reproduce v1 ONCE at migration. v2 has no dependent arc values.
  const secondaryR = Math.max(n('secondaryRadius', 270), primaryR + n('arcSpacing', 65));
  const nestedR = Math.max(n('nestedRadius', 355), secondaryR + n('arcSpacing', 65));
  const put = (key, values) => Object.assign(s.arcs[key], { size: diameter, gap, direction: old.direction || 'clockwise', duration: n('animation', 250), stagger: n('stagger', 0), easing: old.easing || 'ease-out' }, values);
  put('closed', { radius, start: n('arcStart', -80), span: n('arcSpan', 100) });
  put('primary', { radius: primaryR, start: n('primaryStart', 200), span: n('primarySpan', 68) });
  put('secondary', { radius: secondaryR, start: 285 + (n('arcStart', -80) + 80), span: 115 + (n('arcSpan', 100) - 100), from: 'menu' });
  put('menu', { radius, start: n('menuAngle', 60), span: 0 });
  for (const key of ['conditions', 'faction', 'nested']) put(key, { radius: nestedR, start: 289, span: 130 * n('nestedDensity', 1), from: 'menu' });
  Object.assign(s.tracks, { style: old.trackStyle || 'radial', length: n('trackLength', 100), ticks: old.ticks !== false, valuePosition: old.valuePosition || 'end' });
  for (const k of ['labelMode', 'labelWhen', 'fontSize', 'fontWeight', 'labelColor', 'labelHalo', 'labelOffset', 'edgeRule', 'iconSet', 'iconAlternates', 'hover', 'press']) if (old[k] !== undefined) s[k] = structuredClone(old[k]);
  return s;
}

export const envelope = settings => ({ version: VERSION, settings: normalize({ version: VERSION, settings }) });
