// A PAWN'S SIZE (Harry 2026-11-06: "doing resizing for pawns (which should also change their footprint)"). docs/PAWNS.md
// "A pawn's size". Pure functions: the relay (what it accepts), the client (the ring, the bar, the drawing, the
// footprint) and the tests run the same code.
//
//   STORED     `size` on a pawn (token.size) and on a player's pawn definition (pawn.define size): how many 5-ft squares a
//              side its base covers. The D&D categories, and a free number past them:
//                tiny 0.5 (2.5 ft) · small 1 and medium 1 (5 ft) · large 2 (10 ft) · huge 3 (15 ft) · gargantuan 4 (20 ft)
//                · 5 to 8 (25 to 40 ft), the free override for anything bigger
//              Absent = 1 (as it always was: every way a pawn is made writes its figure's own size, 2 for a large figure).
//   WHERE      The definition holds the DEFAULT (what the pawn is when it comes on from the bench); the pawn on the table
//              may differ (Enlarge, Reduce, a GM's "make it huge"): resizing a pawn on the table never changes its
//              definition. Changing a pawn's figure keeps a size that was chosen for it, else takes the new figure's.
//   WHAT READS IT   the base (its disc is 80% of the footprint across), the FIGURE (drawn bigger or smaller by the same
//              ratio: figureK), the squares it takes (occupancy, placing, the pawn tool's lit squares), the movement
//              rings and a drag (a base wider than a square does not pass a gap narrower than itself: clearanceOf), the
//              rules (rulers, templates, reach: core/measure.js pawnRadius), the turn and target rings, picking (the
//              base's own pick pad), the eye height (the drawn figure's height).
export const SIZES = [
  { key: 'tiny', squares: 0.5, words: ['tiny'] },
  { key: 'small', squares: 1, words: ['small'] },
  { key: 'medium', squares: 1, words: ['medium', 'normal', 'regular', 'human sized', 'human-sized', 'man sized', 'man-sized'] },
  { key: 'large', squares: 2, words: ['large', 'big'] },
  { key: 'huge', squares: 3, words: ['huge'] },
  { key: 'gargantuan', squares: 4, words: ['gargantuan', 'colossal', 'enormous'] },
];
export const SIZE_MIN = 0.5, SIZE_MAX = 8; // squares a side: 2.5 ft to 40 ft
export const SIZE_STEPS = [0.5, 1, 2, 3, 4, 5, 6, 7, 8]; // what "bigger" / "smaller" step through
export const isSize = (v) => v === 0.5 || (Number.isInteger(v) && v >= 1 && v <= SIZE_MAX);
export const sizeProblem = (v) => v == null || isSize(v) ? null : `size: squares a side: 0.5 (tiny), 1 (small or medium), 2 (large), 3 (huge), 4 (gargantuan), or a whole number up to ${SIZE_MAX} (${SIZE_MAX * 5} ft)`;
// the squares a side a pawn stands on, from its own data
export const squaresOf = (e) => isSize(e?.size) ? e.size : 1;
// the value to STORE for a size: undefined = no field (1, or not a size)
export const storedSize = (size) => isSize(size) && size !== 1 ? size : undefined;
// apply a size to an entity (a pawn, a definition, a cast entry) in place: the field set, or taken away
export function putSize(e, size) { const v = storedSize(size); if (v === undefined) delete e.size; else e.size = v; return e; }
// the field to copy onto a new pawn from another (a definition, a cast entry, a pasted or imported pawn): {} or { size }
export const sizeField = (src) => { const v = storedSize(src?.size); return v === undefined ? {} : { size: v }; };
export const feetOf = (squares) => squares * 5;
// its category's word, for what is said ("large", "huge"); past gargantuan, its feet ("25 ft")
export const sizeWord = (squares) => squares === 0.5 ? 'tiny' : squares === 1 ? 'medium' : squares === 2 ? 'large' : squares === 3 ? 'huge' : squares === 4 ? 'gargantuan' : `${feetOf(squares)} ft`;
export const sizeLabel = (squares) => squares > 4 ? `${feetOf(squares)} ft` : `${sizeWord(squares)} (${feetOf(squares)} ft)`;
// one step bigger or smaller
export const sizeStep = (squares, d) => { const i = SIZE_STEPS.indexOf(isSize(squares) ? squares : 1); return SIZE_STEPS[Math.max(0, Math.min(SIZE_STEPS.length - 1, i + d))]; };

// WHAT A PERSON TYPES: "large", "size huge", "make it huge", "tiny", "15 ft", "size 3", "3 squares", "3x3", "bigger",
// "smaller", "enlarge", "reduce". -> { squares } | { step: +1 | -1 } | null
export function parseSize(text) {
  let t = String(text ?? '').toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(?:make (?:it|them|this|these|him|her) |set (?:the )?size(?: to)? |resize(?: (?:it|them))?(?: to)? |size |change (?:the )?size(?: to)? )/, '').replace(/^(?:a |an |to )/, '').replace(/ (?:size|sized|creature|pawn|base)$/, '').trim();
  if (/^(?:bigger|grow|larger|enlarge|size up|up)$/.test(t)) return { step: 1 };
  if (/^(?:smaller|shrink|reduce|size down|down)$/.test(t)) return { step: -1 };
  for (const s of SIZES) if (s.words.includes(t)) return { squares: s.squares };
  let m;
  if ((m = t.match(/^(\d+(?:\.\d+)?) ?(?:ft|feet|foot|')$/))) { const sq = +m[1] / 5; return isSize(sq) ? { squares: sq } : null; }
  if ((m = t.match(/^(\d+(?:\.5)?)(?: ?(?:squares?|sq|cells?))?$/)) || (m = t.match(/^(\d+) ?[x×] ?(\d+)$/)) ) { if (m[2] && m[2] !== m[1]) return null; const sq = +m[1]; return isSize(sq) ? { squares: sq } : null; }
  return null;
}

// THE FIGURE, DRAWN BIGGER OR SMALLER (Harry: size "scales the figure AND its base AND its footprint"). A figure is made
// at its creature's own size (a medium fighter on 1 square, a young dragon on 2): drawn on another size it is scaled by
// the ratio of the squares. One exception: a figure that is a TINY creature already (a hawk, an imp, a pixie: made at most
// TINY_FT tall, standing on 1 square because 1 was the smallest base there was) is not shrunk again when made tiny.
//   fig: the figure's list row ({ size, h }); null (the plain stand-in) counts as a medium figure
export const TINY_FT = 2.5;
export const nativeOf = (fig) => { const s = isSize(fig?.size) ? fig.size : 1; return s === 1 && fig?.h > 0 && fig.h <= TINY_FT ? 0.5 : s; };
export function figureK(squares, fig) {
  const s = isSize(squares) ? squares : 1, made = isSize(fig?.size) ? fig.size : 1;
  return s >= made ? s / made : s / Math.min(made, Math.max(s, nativeOf(fig)));
}

// A BASE WIDER THAN A SQUARE IN A NARROW PLACE: how far the pawn's middle must keep from every wall (feet). A pawn of one
// square or less: 0 (it goes wherever it always went, through any 5-ft door). Larger: its disc's radius (the disc is
// BASE_SHARE of the footprint across: 4 ft of a large pawn's 10), so a large pawn passes a 10-ft opening and not a 5-ft
// door, a huge one 15 ft and not 10. The movement rings (core/walk.js `clear`) and a drag (client/input.js) use this.
export const BASE_SHARE = 0.8;
export const clearanceOf = (squares) => squares > 1 ? squares * 5 * BASE_SHARE / 2 : 0;
// the shortest distance from (x, z) to a wall segment [ax, az, bx, bz]
export function segDistance(x, z, [ax, az, bx, bz]) {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0;
  return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
}
// does a pawn of `squares` fit with its middle at (x, z) among these walls? -> null (it fits) | the nearest wall's distance
export function crampedAt(x, z, squares, segments) {
  const c = clearanceOf(squares); if (!c) return null;
  let near = Infinity; for (const s of segments) { const d = segDistance(x, z, s); if (d < near) near = d; }
  return near < c - 1e-6 ? near : null;
}
