// DARKNESS IN FOG OF WAR (Harry 2026-10-20: "pawns that have player vision need a dark vision radius ... and light
// sources should throw light. Again, this is just spots that get turned off in Fog of War."). Pure data, no DOM: the
// relay's checks, the client's fog (client/fog.js) and its worker (client/darksight.js) all read it from here.
//
// The rule (docs/NETCODE.md "Darkness"): in an area whose `darkness` play rule is on (area setting, else the campaign
// default; off unless set), a cell is SEEN only if a viewing pawn has line of sight to it AND it is within that pawn's
// darkvision, or lit by a lit light (or a light a pawn carries) whose own line of sight reaches it within its radius.
// The outer `hint` ft of every darkvision and light radius (R - hint .. R, still in line of sight) is explored, never
// visible (Harry 2026-10-20: "take that 2ft remembered in instead of out"): nothing past R is ever revealed.

export const DARKVISION_DEFAULT = 30;  // ft; a pawn with player vision that has no `darkvision` of its own
export const DARKVISION_MAX = 120;
export const CARRIED_LIGHT_MAX = 120;
export const LIGHT_RADIUS_MAX = 200;
export const DARK_HINT_DEFAULT = 2;    // ft; the Fog of war look's "Remembered edge of the light" (fogwar.js `dark.hint`)
export const DARK_HINT_MAX = 6;

// THE LIGHT TABLE: the one place a light's reach is set, by kind. D&D's bright + dim total, the radius a player can see
// by. It is the DEFAULT: the Fog of war look can override it (fogwar params `reach`, `bright`, `dark.scale`, `dark.dim`;
// tuner panel "Darkness ▸ Light reach", Harry 2026-10-21) and lightTable() below reads the look. The tuner's sliders start
// from a copy of these numbers (tools/spawn-tuner/js/fx/lightreach.js; test/darkness.test.mjs keeps the two equal).
export const LIGHT_KINDS = ['candle', 'lamp', 'lantern', 'torch', 'fire', 'chandelier', 'oven', 'glow'];
export const LIGHT_RADII = {
  candle: 10,      // candles, candelabra, candle stubs, rushlights, candle sconces
  lamp: 45,        // oil lamps, wall lamps, a sanctuary lamp, a miner's lamp rack (D&D's lamp, 15 + 30; 2026-10-21, was 60)
  torch: 40,       // torches, cressets, torch sconces
  lantern: 60,     // lanterns, lamp posts and lamp poles
  fire: 40,        // hearths, fireplaces, braziers, fire pits, campfires, forges
  chandelier: 40,
  oven: 10,        // ovens, kilns, smelters, furnaces: a fire behind a stoke hole (not in Harry's table; Fauna's guess)
  glow: 20,        // glowing crystals, glowworms, fungus, magic (catalog `aff: lit` with no flame)
};
// "Count dim light" off: bright light only. D&D 5e PHB (and SRD) where it has the thing: candle 5, lamp 15, hooded lantern
// 30, torch 20. The rest are GUESSES at half the total (no PHB entry): fire 20, chandelier 20, oven 5, glow 10.
export const LIGHT_BRIGHT = { candle: 5, lamp: 15, torch: 20, lantern: 30, fire: 20, chandelier: 20, oven: 5, glow: 10 };
export const LIGHT_REACH_MAX = 120;              // ft, a slider's top
export const LIGHT_SCALE_MIN = 0.25, LIGHT_SCALE_MAX = 1.5;
// the fire FX's own types (tuner fx/fire.js fireType) -> a row of the table
const FIRE_TO_LIGHT = { hearth: 'fire', brazier: 'fire', oven: 'oven', torch: 'torch', lantern: 'lantern', candle: 'candle', candelabra: 'candle', stubs: 'candle', chandelier: 'chandelier' };
// An oil LAMP is not a lantern (Harry 2026-10-21: "a tiny one-candle lamp is doing like 40 foot circle"): every catalog id
// with "lamp" in it, except the street lights (lamp-post-*, lamp-pole), which are lanterns on a post. The fire FX still
// draws a lamp's flame as a lantern's; only its reach differs. Today: oil-lamp, lamp-oil-brass, lamp-wall-bracket,
// lamp-wall-shelf, rite-sanctuary-lamp, mine-lamp-rack.
const isLamp = cat => /lamp/.test(cat) && !/lamp-?post|lamp-?pole/.test(cat);

// What kind of light a catalog object is: its fire type first (what the game draws burning and can light / put out),
// else a catalog `aff: lit` piece with no flame by its name, else none (null = not a light).
export function lightKind(cat = '', fireType = null, aff = []) {
  if (fireType) { const k = FIRE_TO_LIGHT[fireType] || 'fire'; return k === 'lantern' && isLamp(cat) ? 'lamp' : k; }
  if (!Array.isArray(aff) || !aff.includes('lit')) return null;
  if (/rushlight|candle|footlight/.test(cat)) return 'candle';
  if (/torch|cresset/.test(cat)) return 'torch';
  if (isLamp(cat)) return 'lamp';
  if (/lantern|lamp/.test(cat)) return 'lantern';
  if (/furnace|kiln|boiler|heater|brew|athanor|smelt|oven/.test(cat)) return 'oven';
  if (/fire|hearth|brazier|beacon|effigy|forge/.test(cat)) return 'fire';
  return 'glow';
}
const num = (v, max) => Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : null;
// The table in force: the Fog of war look's (`params` = its params, a saved look, or nothing) over the defaults above.
//   dark.dim  true (default): `reach`, bright + dim;  false: `bright`, bright light only
//   dark.scale  0.25 .. 1.5 (default 1), every row times it;  a row the look lacks (an old saved look) = this file's
// No look at all = LIGHT_RADII exactly. Rounded to 0.01 ft, so the worker's light cache keys stay short and stable.
export function lightTable(params) {
  const d = params?.dark || {}, dim = d.dim !== false, rows = dim ? params?.reach : params?.bright, base = dim ? LIGHT_RADII : LIGHT_BRIGHT;
  const scale = Number.isFinite(d.scale) ? Math.max(LIGHT_SCALE_MIN, Math.min(LIGHT_SCALE_MAX, d.scale)) : 1, out = {};
  for (const k of LIGHT_KINDS) out[k] = Math.round((num(rows?.[k], LIGHT_REACH_MAX) ?? base[k]) * scale * 100) / 100;
  return out;
}
// a light's radius: the GM's own number on the object (`lightRadius`, never scaled), else its kind's row of the table
export const lightRadiusOf = (obj, kind, table = LIGHT_RADII) => num(obj?.lightRadius, LIGHT_RADIUS_MAX) ?? (table[kind] || 0);
export const darkvisionOf = pawn => num(pawn?.darkvision, DARKVISION_MAX) ?? DARKVISION_DEFAULT;
export const carriedLightOf = pawn => num(pawn?.lightCarried, CARRIED_LIGHT_MAX) ?? 0;
export const hintOf = params => num(params?.dark?.hint, DARK_HINT_MAX) ?? DARK_HINT_DEFAULT;

// The command checks: a darkvision / carried light / light radius in feet, or null (= back to the default).
export const feetProblem = (v, max, what) => v == null ? null : !Number.isFinite(v) || v < 0 || v > max ? `${what} is 0 to ${max} ft (or none for the default)` : null;
export const pawnDarkProblem = a => feetProblem(a.darkvision, DARKVISION_MAX, 'darkvision') || feetProblem(a.lightCarried, CARRIED_LIGHT_MAX, 'a carried light');
// apply: null removes the field (the default again), a number sets it
export function withDarkFields(e, a, keys = ['darkvision', 'lightCarried']) {
  const n = { ...e };
  for (const k of keys) if (a[k] !== undefined) { if (a[k] === null) delete n[k]; else n[k] = a[k]; }
  return n;
}

// Is this area dark? Its own On/Off, else the campaign default (the same shape as fog of war: core/state.js RULE_KEYS).
export function darknessFor(campaign, areaId) {
  const a = campaign?.areas?.find?.(x => x.id === areaId) || campaign?.areas?.[areaId];
  return typeof a?.settings?.darkness === 'boolean' ? a.settings.darkness : campaign?.defaults?.darkness === true;
}
