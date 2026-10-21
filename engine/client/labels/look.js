// THE LABEL LOOK (Label Lab, 2026-10-20; Harry: "I want to play with their size, scaling and position a little").
// The numbers surfaces/labels.js lays the room and building labels out with. TODAY is exactly the look the game had before
// the lab (the 24 px room pill at 10.2 ft, the 13 px building tag 4 ft above it, the crowd rules' 2 / 4 px, 450 ms ...):
// with no house value (GET /tuner/house -> labels null) labels.js takes no settings at all and draws exactly that.
// STARTER is where a new Label lab starts when there is no house value and no draft: today's look with the building tag
// clearly bigger than its rooms (Harry 2026-10-20: 1.35x) and the room cap (never wider than 75 % of the room on screen,
// hidden below 9 px text: "so when you zoom out a bunch you don't end up with a label jumble").
// A slider's far end can mean "never" (NEVER_FT, NO_CAP): see the limits below.
export const NEVER_FT = 1000, NO_CAP = 101;
export const TODAY = Object.freeze({
  size: { px: 24, world: false, ft: 2, minPx: 12, maxPx: 36, building: 13 / 24, capPct: NO_CAP, hidePx: 0 },
  place: { ft: 10.2, buildingFt: 4, side: 0, fwd: 0 },
  look: { opacity: 82, pad: 1, round: 12 },
  when: { fadeFt: NEVER_FT, roomsFt: NEVER_FT, underRoof: true },
  crowd: { stepY: 5, stepX: 6, arriveX: 4, arriveY: 3, leave: 2, edgeIn: 40, edgeOut: 90, dwell: 450, pawn: 6 },
});
export const STARTER = { size: { building: 1.35, capPct: 75, hidePx: 9 } };
// [min, max, step]
export const LIMITS = {
  'size.px': [8, 60, 1], 'size.ft': [0.3, 8, 0.05], 'size.minPx': [6, 40, 1], 'size.maxPx': [12, 80, 1], 'size.building': [0.4, 2.5, 0.01],
  'size.capPct': [20, NO_CAP, 1], 'size.hidePx': [0, 20, 0.5],
  'place.ft': [0, 40, 0.1], 'place.buildingFt': [0, 30, 0.5], 'place.side': [-20, 20, 0.5], 'place.fwd': [-20, 20, 0.5],
  'look.opacity': [20, 100, 1], 'look.pad': [0, 3, 0.05], 'look.round': [0, 30, 1],
  'when.fadeFt': [40, NEVER_FT, 5], 'when.roomsFt': [40, NEVER_FT, 5],
  'crowd.stepY': [0, 40, 1], 'crowd.stepX': [0, 40, 1], 'crowd.arriveX': [0, 20, 1], 'crowd.arriveY': [0, 20, 1], 'crowd.leave': [-10, 10, 1],
  'crowd.edgeIn': [0, 200, 5], 'crowd.edgeOut': [0, 300, 5], 'crowd.dwell': [0, 2000, 10], 'crowd.pawn': [0, 40, 1],
};
const GROUPS = ['size', 'place', 'look', 'when', 'crowd'];
// any record (a house value, a draft, pasted JSON, a partial override) -> a full look, TODAY filling every gap
export function normalize(raw) {
  const src = raw?.settings || raw || {}, out = {};
  for (const g of GROUPS) { out[g] = { ...TODAY[g] }; for (const [k, v] of Object.entries(src[g] || {})) if (k in TODAY[g] && typeof v === typeof TODAY[g][k] && (typeof v !== 'number' || Number.isFinite(v))) out[g][k] = v; }
  return out;
}
export const starter = () => normalize({ ...structuredClone(TODAY), size: { ...TODAY.size, ...STARTER.size } });
export const envelope = (s) => ({ version: 1, settings: normalize(s) });
export const sameAsToday = (s) => JSON.stringify(normalize(s)) === JSON.stringify(normalize(TODAY));

// The text size of one label, in px. In order (the smallest result wins): the size (px, or ft x px-per-ft at the label
// clamped to the comfort band), the building's ratio, then the cap: never wider than capPct of the room's (building's)
// own width on screen. `perPx` is the label's width per px of text (measured), `spanPx` the room's width on screen.
export function textPx(S, { kind, pxPerFt = 0, perPx = 0, spanPx = 0 }) {
  const z = S.size;
  let base = z.world ? Math.min(z.maxPx, Math.max(z.minPx, z.ft * pxPerFt)) : z.px, why = z.world ? (z.ft * pxPerFt < z.minPx ? 'smallest' : z.ft * pxPerFt > z.maxPx ? 'largest' : 'world') : 'size';
  if (kind === 'building') base *= z.building;
  if (z.capPct < NO_CAP && perPx > 0 && spanPx > 0) { const cap = z.capPct / 100 * spanPx / perPx; if (cap < base) { base = cap; why = 'cap'; } }
  return { px: base, why };
}
// How much a label shows at camera distance d (ft): 1 nearer than fadeFt, 0 at 1.3 x fadeFt, linear between.
export function fadeAt(S, d) { const F = S.when.fadeFt; if (!(F < NEVER_FT)) return 1; return Math.max(0, Math.min(1, (1.3 * F - d) / (0.3 * F))); }
