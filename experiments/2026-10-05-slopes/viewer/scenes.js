// The three test scenes of the slopes pilot, as plain data. Feet; x east, z south, y up. A terrace ("slab") is a flat
// box with the game's grass on top. A piece is a generated slope prop in its canonical frame (uphill = -Z; a corner's
// high corner at -X,-Z), turned by rot degrees about the vertical and stretched by scale (free scale, like any prop).
const BANK10 = { id: 'slope-bank-10', w: 10, d: 17, h: 10 }, BANK5 = { id: 'slope-bank-5', w: 10, d: 9, h: 5 };
const CORNER = { id: 'slope-corner-out', w: 9, d: 9, h: 5 }, CORNER_IN = { id: 'slope-corner-in', w: 9, d: 9, h: 5 };
const RAMP = { id: 'slope-ramp-path', w: 10, d: 19, h: 5 }, LEDGES3 = { id: 'slope-ledges', w: 10, d: 15, h: 10 }, LEDGES = { id: 'slope-ledges-2', w: 10, d: 18, h: 10 };
const MOUND = { id: 'slope-mound', w: 20, d: 20, h: 4 }, OUTCROP = { id: 'slope-outcrop', w: 10, d: 10, h: 10 }, SCREE = { id: 'slope-scree', w: 10, d: 6, h: 4 };

// neighbours overlap by this much, the way a person butting props together would push them: hides the hairline between cut faces
const OVERLAP = 1.04, TUCK = 0.6, CORNER_TUCK = 0.5;   // TUCK: feet a bank is pushed in under the terrace edge

// one wedge against a terrace edge. side: which side of the terrace it is on (S = the slope runs down to the south)
// a..b: the stretch of the edge it covers; edge: the edge's fixed coordinate; depth/rise: how far out / how high
function wedge(P, side, a, b, edge, y, { depth = P.d, rise = P.h, ...more } = {}) {
  const w = b - a, c = (a + b) / 2, dd = depth + TUCK, s = [w * OVERLAP / P.w, (rise + 0.1) / P.h, dd / P.d];
  const at = { S: [c, edge - TUCK + dd / 2, 0], N: [c, edge + TUCK - dd / 2, 180], E: [edge - TUCK + dd / 2, c, 90], W: [edge + TUCK - dd / 2, c, -90] }[side];
  return { id: P.id, x: at[0], z: at[1], y, rot: at[2], scale: s, ...more };
}
// a row of n equal wedges along an edge; swap = { index: piece or options }
function side(P, sd, a, b, edge, y, n, opt = {}, swap = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const sw = swap[i] || {}; if (sw.skip) continue;
    const o = { ...opt, ...(sw.opt || {}) }, PP = sw.P || P;
    // every other piece a hair taller, so the overlapping strips of two neighbours never lie in exactly the same plane
    out.push(wedge(PP, sd, a + (b - a) * i / n, a + (b - a) * (i + 1) / n, edge, y, { ...o, rise: (o.rise ?? PP.h) + (i % 2) * 0.12 }));
  }
  return out;
}
// outside corner at terrace corner (x, z); quad: which way it spreads (SE, SW, NW, NE); r = how far out, rise = how high
function corner(x, z, quad, y, r, rise, P = CORNER) {
  const q = { SE: [1, 1, 0], SW: [-1, 1, -90], NW: [-1, -1, 180], NE: [1, -1, 90] }[quad];
  const t = r * CORNER_TUCK, R = r + t;   // pushed in under the terrace corner: the corner piece is fatter than the banks' ends
  return { id: P.id, x: x + q[0] * (R / 2 - t), z: z + q[1] * (R / 2 - t), y, rot: q[2], scale: [R / P.w, rise * 1.04 / P.h, R / P.d] };
}

// depths that keep the banks near the proportions the generator gave them (about 35 degrees)
const D5 = { depth: 10 }, D10 = { depth: 18 }, DH = { depth: 13 };

export const SCENES = {
  hill: {
    button: 'A · Hill', title: 'A. A free-standing hill, 40 ft across, about 9 ft high',
    note: 'Under the pieces is a 14 ft square terrace 5 ft up. One straight bank on each side, four outside corners (stretched to a 13 ft radius so the hill is round, not square), the path ramp laid over the south bank, and the rounded mound as the cap. Ringed pawns have a level 5 ft base; two stand on the plain bank on the east side.',
    focus: [0, 4, 0], tableDist: 95, lowDist: 58, lowYaw: 30,
    slabs: [{ rect: [-7, -7, 7, 7], h: 5 }],
    pieces: [
      ...side(BANK5, 'S', -7, 7, 7, 0, 1, DH), ...side(BANK5, 'N', -7, 7, -7, 0, 1, DH),
      ...side(BANK5, 'E', -7, 7, 7, 0, 1, { ...DH, slopePawn: 'pair' }), ...side(BANK5, 'W', -7, 7, -7, 0, 1, DH),
      corner(7, 7, 'SE', 0, 13, 5), corner(-7, 7, 'SW', 0, 13, 5), corner(-7, -7, 'NW', 0, 13, 5), corner(7, -7, 'NE', 0, 13, 5),
      wedge(RAMP, 'S', -5, 5, 4, 0, { depth: 19, rise: 5.2 }),
      { id: MOUND.id, x: 0, z: 0, y: 3.0, rot: 20, scale: [1.2, 1.5, 1.2], pawnZones: true },
    ],
    pawns: [{ x: -27.5, z: 22.5 }], figures: [{ x: 24, z: 16 }],
  },
  plateau: {
    button: 'B · Plateau', title: 'B. A raised plateau, 10 ft up, with banks and corners wrapped round it',
    note: 'A flat 30 x 30 ft grass terrace 10 ft up with an 18 x 12 ft wing (so there is one inside corner). Tall banks on the straight edges, outside corners stretched to the 10 ft rise, the inside corner in the angle, the path ramp up the south side (stretched to climb 10 ft) and the two-shelf stepped piece on the west side, with pawns on the flat zones the measuring script found on it.',
    focus: [6, 5, 2], tableDist: 135, lowDist: 80, lowYaw: -35,
    slabs: [{ rect: [-15, -15, 15, 15], h: 10 }, { rect: [15, -15, 33, -3], h: 10 }],
    pieces: [
      ...side(BANK10, 'S', -15, 15, 15, 0, 3, D10, { 1: { P: RAMP, opt: { depth: 37, rise: 10 } } }),
      ...side(BANK10, 'W', -15, 15, -15, 0, 3, D10, { 1: { P: LEDGES, opt: { depth: 18, pawnZones: true } }, 2: { opt: { slopePawn: true } } }),
      ...side(BANK10, 'N', -15, 15, -15, 0, 3, D10), ...side(BANK10, 'N', 15, 33, -15, 0, 2, D10),
      ...side(BANK10, 'E', -15, -3, 33, 0, 1, D10),
      corner(-15, 15, 'SW', 0, 18, 10), corner(-15, -15, 'NW', 0, 18, 10), corner(33, -15, 'NE', 0, 18, 10), corner(33, -3, 'SE', 0, 18, 10), corner(15, 15, 'SE', 0, 18, 10),
      { id: CORNER_IN.id, x: 24, z: 6, y: 0, rot: 0, scale: [2, 2, 2] },
    ],
    pawns: [{ x: -2.5, z: -2.5, y: 10 }, { x: 7.5, z: 2.5, y: 10 }, { x: -2.5, z: 62.5 }], figures: [{ x: 9, z: 44 }],
  },
  cliff: {
    button: 'C · Cliff', title: 'C. A cliff edge: rock chunks and scree on the north side of a plateau',
    note: 'A 30 x 25 ft terrace 10 ft up. Its north edge is five copies of the one rock outcrop standing side by side, turned or mirrored so a painted rock face looks outward (the two end ones a little lower), with copies of the scree apron at their feet. The other three sides are grassy banks.',
    focus: [0, 5, -6], tableDist: 120, lowDist: 66, lowYaw: 205,
    slabs: [{ rect: [-15, -10, 15, 15], h: 10 }],
    pieces: [
      // the generator only painted the two rock faces the picture showed (the piece's south and east); the other two came
      // out blank, so each copy is turned or mirrored to put a painted face outward
      { id: OUTCROP.id, x: -10, z: -15.4, y: 0, rot: 180, pawnZones: [2.5] }, { id: OUTCROP.id, x: 0, z: -15, y: 0, rot: 90, scale: [1.04, 1.02, 1.04] }, { id: OUTCROP.id, x: 10, z: -15.6, y: 0, rot: 180, scale: [-1, 1, 1] },
      { id: OUTCROP.id, x: -20.5, z: -14.6, y: 0, rot: 270, scale: [-1.0, 0.78, 1.1] }, { id: OUTCROP.id, x: 20.5, z: -14.8, y: 0, rot: 90, scale: [1.0, 0.7, 1.1] },
      wedge(SCREE, 'N', -16, -6, -20, 0, { depth: 8 }), wedge(SCREE, 'N', -5, 5, -20, 0, { depth: 10, rise: 5 }), wedge(SCREE, 'N', 6, 16, -20, 0, { depth: 8 }),
      wedge(SCREE, 'N', -27, -17, -19.5, 0, { depth: 9, rise: 3.5 }), wedge(SCREE, 'N', 17, 27, -19.5, 0, { depth: 9, rise: 4.5 }),
      ...side(BANK10, 'S', -15, 15, 15, 0, 3, D10), ...side(BANK10, 'W', -10, 15, -15, 0, 2, D10), ...side(BANK10, 'E', -10, 15, 15, 0, 2, D10, { 0: { opt: { slopePawn: true } } }),
      corner(-15, 15, 'SW', 0, 18, 10), corner(15, 15, 'SE', 0, 18, 10),
    ],
    pawns: [{ x: 2.5, z: 2.5, y: 10 }, { x: -2.5, z: -37.5 }], figures: [{ x: 8, z: -33 }],
  },
  blobs: {
    button: 'D · Hill, piled', title: 'D. The same size of hill, built the other way: rounded pieces piled and overlapped',
    note: 'No terrace and no butt joints. One big copy of the mound (38 x 34 ft) as the body, a second copy sunk into its top, three smaller copies as shoulders, the path ramp pushed into the south flank and one scree apron as a rock patch. Every piece is the same two or three meshes, turned and stretched. The pawns on the flanks were set down with their centre on the surface, base level.',
    focus: [0, 4, 0], tableDist: 95, lowDist: 58, lowYaw: 30,
    pieces: [
      { id: MOUND.id, x: 0, z: 0, y: -0.6, rot: 15, scale: [1.9, 1.6, 1.7] },
      { id: MOUND.id, x: -3, z: -2, y: 3.1, rot: 140, scale: [1.05, 1.25, 1.0], pawnZones: true },
      { id: MOUND.id, x: 14, z: 7, y: -0.45, rot: 70, scale: [1.1, 0.9, 0.8] },
      { id: MOUND.id, x: -14, z: 9, y: -0.45, rot: 200, scale: [0.9, 0.8, 0.9] },
      { id: MOUND.id, x: 5, z: -14, y: -0.4, rot: 290, scale: [0.75, 0.7, 0.85] },
      { id: RAMP.id, x: 2, z: 14.5, y: -0.2, rot: 8, scale: [0.85, 1.0, 0.9] },
      { id: SCREE.id, x: -13, z: -9, y: 0.4, rot: 130, scale: [1.0, 1.0, 1.3] },
    ],
    pawns: [{ x: 9, z: -3, drop: true }, { x: -9, z: 5, drop: true, r: 1.25 }, { x: 14, z: 7, drop: true }, { x: -27.5, z: 22.5 }], figures: [{ x: 24, z: 16 }],
  },
  kit: {
    button: 'The kit', title: 'The ten generated pieces, each at its designed size',
    note: 'Left to right, back row: 5 ft bank, 10 ft bank, outside corner, inside corner, path ramp. Front row: three-ledge slope (the generator left holes in it), two-shelf slope, mound, rock outcrop, scree. Turn on "Detected flat zones" to see where a 5 ft base (blue) or a 2.5 ft base (yellow) fits, as computed from the mesh.',
    focus: [0, 3, 4], tableDist: 120, lowDist: 75, lowYaw: 10,
    pieces: [
      { id: BANK5.id, x: -44, z: -14 }, { id: BANK10.id, x: -26, z: -14 }, { id: CORNER.id, x: -8, z: -14 }, { id: CORNER_IN.id, x: 8, z: -14 }, { id: RAMP.id, x: 26, z: -14 },
      { id: LEDGES3.id, x: -48, z: 16, pawnZones: true }, { id: LEDGES.id, x: -30, z: 18, pawnZones: true }, { id: MOUND.id, x: -6, z: 18, pawnZones: true }, { id: OUTCROP.id, x: 16, z: 16, scale: [-1, 1, 1], pawnZones: true }, { id: SCREE.id, x: 34, z: 16 },
    ],
    figures: [{ x: 44, z: 16 }, { x: -52, z: -14 }],
  },
};
