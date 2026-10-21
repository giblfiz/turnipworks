// THE DICE KNOBS (2026-10-19): defaults, the Spawn Tuner's dials, built-in presets, and what the physics reads.
// Pure (no three.js): node tests read the same defaults the game plays. Runtime: dice.js; physics: dicephys.js.
import { PHYS_DEFAULTS } from './dicephys.js';

export const DICE_DEFAULTS = {
  name: 'dice-default',
  look: { size: 2, round: 0.16, segments: 2, colorMode: 'seat', color: '#9b2d20', numberColor: '#f4e6c4', edgeWear: 0.55, paint: 'heroic' },
  throw: { height: 3, angle: 29, strength: 25, scatter: 0.35, spin: 24, realMM: 16, timeScale: 0.65, startSpeed: 1, easeIn: 0, endSpeed: 1, easeOut: 0 },
  physics: { bounce: 0.32, tableBounce: 0.8, friction: 0.6, damping: 0.2, angDamping: 0.8, calm: 4 },
  reject: { tries: 20, cocked: 3, reach: 12, settle: 3 },
  timing: { result: 'settle', linger: 6, fade: 1.2 },
  tag: { style: 'pill', size: 1, delay: 0, fadeIn: 0 },
};
export const DICE_SCHEMA = [
  ['Look', 'look', [
    { k: 'size', label: 'Die size (ft)', type: 'range', min: 0.8, max: 4, step: 0.1 },
    { k: 'round', label: 'Edge rounding (of the inradius)', type: 'range', min: 0.02, max: 0.4, step: 0.01 },
    { k: 'segments', label: 'Rounding segments', type: 'range', min: 1, max: 5, step: 1 },
    { k: 'colorMode', label: 'Body colour', type: 'select', options: [['seat', "roller's seat colour"], ['fixed', 'fixed colour']] },
    { k: 'color', label: 'Fixed body colour', type: 'color' },
    { k: 'numberColor', label: 'Number colour', type: 'color' },
    { k: 'edgeWear', label: 'Edge wear', type: 'range', min: 0, max: 1, step: 0.05 },
    { k: 'paint', label: 'Paint style', type: 'select', options: [['heroic', 'heroic hand-painted'], ['gilded', 'gilded edges (numbers: the number colour)'], ['flat', 'flat colour']] },
  ]],
  ['Throw', 'throw', [
    { k: 'height', label: 'Throw height: the hand above the floor (ft)', type: 'range', min: 0.5, max: 20, step: 0.1 },
    { k: 'angle', label: 'Throw angle (deg up from level; − = down)', type: 'range', min: -45, max: 80, step: 1 },
    { k: 'strength', label: 'Throw speed (die lengths / s)', type: 'range', min: 2, max: 100, step: 1 },
    { k: 'scatter', label: 'Sideways scatter', type: 'range', min: 0, max: 1.5, step: 0.05 },
    { k: 'spin', label: 'Spin (rad / s)', type: 'range', min: 0, max: 80, step: 1 },
    { k: 'realMM', label: 'Moves like a real die of (mm): gravity', type: 'range', min: 8, max: 120, step: 1 },
    { k: 'timeScale', label: 'Playback speed (1 = real time)', type: 'range', min: 0.1, max: 2, step: 0.05 },
    { k: 'startSpeed', label: 'Ease in: speed at the start (× playback)', type: 'range', min: 0.1, max: 4, step: 0.05 },
    { k: 'easeIn', label: 'Ease in over the first (s of the throw)', type: 'range', min: 0, max: 3, step: 0.05 },
    { k: 'endSpeed', label: 'Ease out: speed at the end (× playback)', type: 'range', min: 0.1, max: 4, step: 0.05 },
    { k: 'easeOut', label: 'Ease out over the last (s of the throw)', type: 'range', min: 0, max: 3, step: 0.05 },
  ]],
  ['Physics', 'physics', [
    { k: 'bounce', label: 'Bounciness of the dice (restitution)', type: 'range', min: 0, max: 0.98, step: 0.01 },
    { k: 'tableBounce', label: 'Table bounce (floor, walls, props: × the dice)', type: 'range', min: 0, max: 1.25, step: 0.05 },
    { k: 'friction', label: 'Friction', type: 'range', min: 0.05, max: 1.5, step: 0.05 },
    { k: 'damping', label: 'Air drag', type: 'range', min: 0, max: 3, step: 0.05 },
    { k: 'angDamping', label: 'Rolling damping', type: 'range', min: 0, max: 6, step: 0.1 },
    { k: 'calm', label: 'Calm down after landing (drag that climbs over 1 s from first touch; 0 = off)', type: 'range', min: 0, max: 12, step: 0.5 },
  ]],
  ['Never cocked, never strange', 'reject', [
    { k: 'tries', label: 'Throws tried before the gentler ones', type: 'range', min: 1, max: 60, step: 1 },
    { k: 'cocked', label: 'Cocked if the top is off level by (deg)', type: 'range', min: 0.5, max: 15, step: 0.5 },
    { k: 'reach', label: 'Reach: furthest from the thrower (ft)', type: 'range', min: 4, max: 100, step: 1 },
    { k: 'settle', label: 'Must settle within (s)', type: 'range', min: 1, max: 15, step: 0.1 },
  ]],
  ['Timing', 'timing', [
    { k: 'result', label: 'Chat result', type: 'select', options: [['settle', 'when the dice settle'], ['now', 'at once']] },
    { k: 'linger', label: 'Linger after settling (s)', type: 'range', min: 0.5, max: 30, step: 0.5 },
    { k: 'fade', label: 'Fade out (s)', type: 'range', min: 0.1, max: 5, step: 0.1 },
  ]],
  ['Number tag', 'tag', [
    { k: 'style', label: 'Tag over each die', type: 'select', options: [['pill', 'dark pill (like the height labels)'], ['plain', 'plain number'], ['off', 'none']] },
    { k: 'size', label: 'Tag size', type: 'range', min: 0.5, max: 2, step: 0.05 },
    { k: 'delay', label: 'Tag appears after settling (s)', type: 'range', min: 0, max: 5, step: 0.05 },
    { k: 'fadeIn', label: 'Tag fades in over (s)', type: 'range', min: 0, max: 3, step: 0.05 },
  ]],
];
const clone = (o) => JSON.parse(JSON.stringify(o));
export const DICE_BUILTINS = {
  'dice-default': () => clone(DICE_DEFAULTS),
  'dice-ivory': () => ({ ...clone(DICE_DEFAULTS), name: 'dice-ivory', look: { ...DICE_DEFAULTS.look, colorMode: 'fixed', color: '#e9dfc6', numberColor: '#2a1a10', edgeWear: 0.35, paint: 'heroic' } }),
  'dice-gilded': () => ({ ...clone(DICE_DEFAULTS), name: 'dice-gilded', look: { ...DICE_DEFAULTS.look, paint: 'gilded', edgeWear: 0.8, numberColor: '#f3d27a' } }),
  'dice-big-slow': () => ({ ...clone(DICE_DEFAULTS), name: 'dice-big-slow', look: { ...DICE_DEFAULTS.look, size: 2.6 }, throw: { ...DICE_DEFAULTS.throw, realMM: 30, timeScale: 0.7 } }),
};
export function normDice(p) {
  const o = clone(DICE_DEFAULTS);
  for (const k of Object.keys(o)) if (p?.[k] && typeof p[k] === 'object') Object.assign(o[k], p[k]);
  if (p?.name) o.name = p.name;
  // an older preset: 'lift' (up per unit forward) becomes the angle, the speed the full speed it implied
  const t = p?.throw;
  if (t && t.lift != null && t.angle == null) { o.throw.angle = +(Math.atan(+t.lift) * 180 / Math.PI).toFixed(1); if (t.strength != null) o.throw.strength = +(+t.strength * Math.hypot(1, +t.lift)).toFixed(1); }
  delete o.throw.lift;
  // numbers stay numbers (a dial once stored its slider's text, saved in the browser: "round.toFixed is not a function")
  for (const k of Object.keys(DICE_DEFAULTS)) if (typeof DICE_DEFAULTS[k] === 'object')
    for (const [kk, dv] of Object.entries(DICE_DEFAULTS[k])) if (typeof dv === 'number') { const v = +o[k][kk]; o[k][kk] = Number.isFinite(v) ? v : dv; }
  return o;
}
// the knobs the physics reads (dicephys PHYS_DEFAULTS' names)
export const physOf = (P) => ({ ...PHYS_DEFAULTS, ...P.throw, ...P.physics, ...P.reject, size: P.look.size, round: P.look.round });
