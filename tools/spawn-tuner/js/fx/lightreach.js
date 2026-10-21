// LIGHT REACH (Harry 2026-10-21: "a tiny one-candle lamp is doing like 40 foot circle"): the Fog of war look's per-kind
// reach of a light in a DARK area of the game, in feet. Pure data, no three.js: fogwar.js takes its defaults from here,
// the panel's dark preview reads its table, and a node test imports it.
// A COPY of the game's light table (engine/core/darkness.js LIGHT_RADII / LIGHT_BRIGHT / lightTable, the authority the
// relay and the game use when a look has no `reach`): engine/test/darkness.test.mjs keeps the two equal.
export const LIGHT_KINDS = ['candle', 'lamp', 'lantern', 'torch', 'fire', 'chandelier', 'oven', 'glow'];
// bright + dim (D&D's total: the reach a player can see by), "Count dim light" on
export const REACH_DEFAULTS = { candle: 10, lamp: 45, lantern: 60, torch: 40, fire: 40, chandelier: 40, oven: 10, glow: 20 };
// bright only, "Count dim light" off: PHB candle 5, lamp 15, hooded lantern 30, torch 20; fire, chandelier, oven, glow are guesses
export const BRIGHT_DEFAULTS = { candle: 5, lamp: 15, lantern: 30, torch: 20, fire: 20, chandelier: 20, oven: 5, glow: 10 };
export const KIND_LABELS = { candle: 'Candles, sconces, rushlights', lamp: 'Oil lamps, wall lamps', lantern: 'Lanterns, lamp posts', torch: 'Torches, cressets', fire: 'Hearths, braziers, fire pits', chandelier: 'Chandeliers', oven: 'Ovens, kilns, furnaces', glow: 'Glowing things (no flame)' };
// the colour of each kind, in the game's "Show light reach" view and the tuner's dark preview
export const KIND_COLORS = { candle: '#ffd36b', lamp: '#ff9a3c', lantern: '#ff5f8f', torch: '#ff4a2a', fire: '#c86bff', chandelier: '#4fd1ff', oven: '#8aff6b', glow: '#6b8bff' };
const num = (v, max) => Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : null;
// the table in force for a look's params (same rule as engine/core/darkness.js lightTable)
export function reachTable(params) {
  const d = params?.dark || {}, dim = d.dim !== false, rows = dim ? params?.reach : params?.bright, base = dim ? REACH_DEFAULTS : BRIGHT_DEFAULTS;
  const scale = Number.isFinite(d.scale) ? Math.max(0.25, Math.min(1.5, d.scale)) : 1, out = {};
  for (const k of LIGHT_KINDS) out[k] = Math.round((num(rows?.[k], 120) ?? base[k]) * scale * 100) / 100;
  return out;
}
