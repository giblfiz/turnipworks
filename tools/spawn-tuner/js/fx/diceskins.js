// DICE SKINS (2026-10-29): the faces a game's die wears (engine/core/gamedice.js SKINS names them). The SHAPE is
// always the plain die's (dicegeo: d6, d10, d12), so the physics, the recording and the numbering's symmetry turn are
// unchanged; a skin only changes what is painted: the body colour, the ink, and what sits on each face (its number,
// a symbol, two symbols, or nothing). Neutral ids only: no game's name in an asset or here.
//
// The symbols are OUR OWN generated art (Codex image_gen, experiments/2026-10-29-gamedice/art: never a published
// game's glyphs), small PNGs in assets/dice/. They load on first use; the face atlas is drawn at once with whatever
// has loaded and redrawn when the rest arrives (a die thrown before then shows its symbols a moment later).
//
//   skinOf(id) -> { look: {...overrides}, face(value) -> null (draw the number) | { blank } | { text } | { img: [names] } }
//   value: the die's own value for that face (d10: 1..10, 10 on the face printed 0; d6 1..6; d12 1..12)

// L5R-style faces by value (the same tables as core/gamedice.js RING_FACES / SKILL_FACES; s success, o opportunity,
// t strife, e explosive success)
const RING = [null, '', 'ot', 'o', 'st', 's', 'et'];
const SKILL = [null, '', '', 'o', 'o', 'o', 's', 's', 'st', 'st', 'so', 'et', 'e'];
const SYM = { s: 'sym-success', o: 'sym-opportunity', t: 'sym-strife', e: 'sym-explosive' };
const symbols = (f) => f === '' ? { blank: true } : { img: [...f].map(c => SYM[c]) };

export const DICE_SKINS = {
  // a Hunger die: deep crimson with gilded wear, dark numbers, its own marks on the 1 (claw slashes) and the 10 (fangs)
  'pool-d10-hunger': { look: { color: '#a3161a', numberColor: '#f4e6c4', paint: 'gilded', edgeWear: 0.75, fixed: true },
    face: (v) => v === 10 ? { img: ['hunger-ten'] } : v === 1 ? { img: ['hunger-one'] } : null },
  // the duality pair: Hope warm gold with dark ink, Fear deep violet with pale ink
  'duality-d12-hope': { look: { color: '#d8a62c', numberColor: '#24160a', paint: 'heroic', edgeWear: 0.5, fixed: true }, face: () => null },
  'duality-d12-fear': { look: { color: '#3b2357', numberColor: '#f7f0ff', paint: 'heroic', edgeWear: 0.5, fixed: true }, face: () => null },
  // a Fudge die: the roller's colour, + / - / blank
  'fudge-d6': { look: {}, face: (v) => v >= 5 ? { text: '+' } : v <= 2 ? { text: '−' } : { blank: true } },
  // ring dice dark, skill dice ivory, symbol faces
  'ring-d6': { look: { color: '#26232a', numberColor: '#f4e6c4', paint: 'heroic', edgeWear: 0.6, fixed: true }, face: (v) => symbols(RING[v] ?? '') },
  // (tint: on the light body the cream symbols read only by their outline: Gemini r3, "tan-on-ivory"; they are printed as
  // a solid dark silhouette of the same art instead)
  'skill-d12': { look: { color: '#e6dcc2', numberColor: '#2a1a10', paint: 'heroic', edgeWear: 0.4, fixed: true }, tint: '#2a1a10', face: (v) => symbols(SKILL[v] ?? '') },
};
export const skinOf = (id) => (id && DICE_SKINS[id]) || null;
// the look a skinned die is drawn with: the skin's colours over the house look (a fixed-colour skin ignores the seat)
export function skinLook(look, id) {
  const s = skinOf(id); if (!s) return look;
  const { fixed, ...o } = s.look; // (fixed: the skin's own body colour, whatever the seat's; else the look's, the seat's)
  return { ...look, ...o };
}
export const SKIN_IMAGES = [...new Set(['hunger-ten', 'hunger-one', ...Object.values(SYM)])];
