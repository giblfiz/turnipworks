// The five scenes of the banks demo, as plain data. Feet; x east, z south, y up. Everything is on the 5-ft grid.
// terraces: flat rectangles at a height (later ones win where they overlap). The banks between them are NOT here:
//   terrain.js works them out. cliffs: rectangles; a height change inside one is a rock face instead of a grass bank.
// ramps: a graded path from a = [x, z, height] to b, w feet wide. paths: flat rectangles painted as trodden earth.
// pawns / figures: [x, z] on a terrace (their height is read off the ground). slope: where the "pawn base on slopes"
//   pair stands. props: hand-placed pieces (everything else is scattered by seed in main.js). keepOut: no scatter here.
export const DOMAIN = { x0: -90, z0: -90, n: 360, cs: 0.5 };   // the computed ground: 180 x 180 ft at 0.5 ft

// a run of 5-ft kit pieces (wall, hedge, fence) from [x0, z0] to [x1, z1]
const run = (id, x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 5), out = []; for (let i = 0; i < n; i++) out.push({ id, x: x0 + (x1 - x0) * (i + 0.5) / n, z: z0 + (z1 - z0) * (i + 0.5) / n, rot: Math.atan2(-(z1 - z0), x1 - x0) * 180 / Math.PI }); return out; };
const temple = () => {   // an open colonnade of the library's stone pillars on a flagstone floor, with the raised hearth as an altar
  const out = [{ id: 'floor', tex: 'floor-flagstone-large', rect: [-15, -45, 15, -25] }, { id: 'hearth-raised-square--s1', x: 0, z: -40 }];
  for (let x = -12.5; x <= 12.5; x += 5) for (const z of [-27.5, -42.5]) out.push({ id: 'pillar-square--s1', x, z });
  for (const z of [-32.5, -37.5]) for (const x of [-12.5, 12.5]) out.push({ id: 'pillar-square--s1', x, z });
  return out;
};

export const SCENES = {
  plateau: {
    button: 'A · Plateau', title: 'A. One plateau, 30 x 30 ft, 10 ft up',
    note: 'The same plateau as scene B of the slopes pilot. The data is one square terrace at 10 ft; the bank all round it is worked out, not placed.',
    focus: [0, 5, 0], tableDist: 135, lowDist: 80, lowYaw: -35, seed: 3,
    terraces: [{ rect: [-15, -15, 15, 15], h: 10 }],
    pawns: [[-2.5, -2.5], [7.5, 2.5], [-12.5, 42.5]], figures: [[9, 40]],
    slope: { x: 23.5, z: 2, along: [0, 1] },
    props: [{ id: 'rock-table', x: -42.5, z: 17.5, rot: 20, sink: 0.4, scale: [1, 1.7, 1], pawn: true }],
  },
  hill: {
    button: 'B · Two-tier hill', title: 'B. A hill in tiers: 5 ft, 10 ft and a small summit at 15 ft',
    note: 'Three terraces, each a few rectangles joined. Where a shelf is narrower than the bank is long, the two banks run together into one longer slope.',
    focus: [-3, 6, 0], tableDist: 165, lowDist: 100, lowYaw: 30, seed: 8,
    terraces: [
      { rect: [-40, -30, 30, 30], h: 5 }, { rect: [30, -15, 40, 10], h: 5 }, { rect: [-25, 30, 10, 40], h: 5 }, { rect: [-45, -10, -40, 10], h: 5 },
      { rect: [-25, -20, 15, 15], h: 10 }, { rect: [15, -10, 20, 5], h: 10 },
      { rect: [-10, -10, 0, 0], h: 15 },
    ],
    pawns: [[-5, -5], [12.5, 7.5], [-22.5, 12.5], [37.5, 2.5], [-12.5, 32.5], [-2.5, 62.5]], figures: [[9, 56], [27.5, 22.5]],
    slope: { x: -2, z: 44.5, along: [1, 0] },
    props: [...run('fence-post-rail', 30, 12.5, 40, 12.5), ...run('fence-post-rail', 40, 12.5, 40, -12.5)],
    keepOut: [[28, -16, 42, 14]],
  },
  cliff: {
    button: 'C · Cliff edge', title: 'C. A plateau with a rock face on its south side',
    note: 'The same 10 ft height change shown two ways: grass banks on three sides, a rock face on the south (toward the table view). The face is the same computed ground stood up steep and painted with a generated rock texture, with generated boulders, scree and cliff chunks pushed into its foot.',
    focus: [0, 5, 2], tableDist: 120, lowDist: 66, lowYaw: 28, seed: 12,
    terraces: [{ rect: [-15, -15, 15, 10], h: 10 }],
    cliffs: [[-70, 8.5, 70, 70]],
    pawns: [[2.5, -2.5], [-7.5, 2.5], [-12.5, 32.5]], figures: [[9, 30]],
    slope: { x: 23.5, z: -4, along: [0, 1] },
  },
  hollow: {
    button: 'D · Sunken hollow', title: 'D. A hollow 10 ft deep, with a path ramp down the west end',
    note: 'The same rule upside down: the data is a terrace at minus 10 ft, and the banks run down into it from the lawn. The ramp is one more piece of data (a graded path from the lawn to the floor); its side banks are worked out too.',
    focus: [0, -4, 0], tableDist: 150, lowDist: 85, lowYaw: 35, seed: 21,
    terraces: [{ rect: [-45, -30, 45, 30], h: -10 }, { rect: [-25, 30, 10, 50], h: -10 }, { rect: [15, -50, 45, -30], h: -10 }],
    ramps: [{ a: [-76, 0, 0], b: [-42, 0, -10], w: 10 }],
    pawns: [[-2.5, 2.5], [12.5, -2.5], [22.5, 42.5], [-52.5, 0, 'drop']], figures: [[20, 3], [-32, 41]],
    slope: { x: 4, z: -21.5, along: [1, 0] },
  },
  temple: {
    button: 'E · Temple on a hill', title: 'E. Three terraces climbing to a temple',
    note: 'Three terraces at 5, 10 and 15 ft stepping up to the north. Stand-ins from the library: stone stairs set into each bank, pillars and a flagstone floor for the temple, a dry-stone wall along the lowest terrace. The stairs and temple are placed by hand here; the banks are not.',
    focus: [0, 7, -5], tableDist: 175, lowDist: 105, lowYaw: 22, seed: 30,
    terraces: [{ rect: [-30, 10, 30, 40], h: 5 }, { rect: [-25, -20, 25, 10], h: 10 }, { rect: [-20, -50, 20, -15], h: 15 }],
    paths: [[-2, 40, 2, 75], [-2, 19, 2, 40], [-2, -6, 2, 10], [-2, -25, 2, -15]],
    pawns: [[-12.5, 27.5], [12.5, 2.5], [-7.5, -22.5], [12.5, 57.5]], figures: [[17.5, 32.5], [-12, 63]],
    slope: { x: 35.5, z: 25, along: [0, 1] },
    stairs: [{ x: 0, zTop: 40, rise: 5, base: 0 }, { x: 0, zTop: 10, rise: 5, base: 5 }, { x: 0, zTop: -15, rise: 5, base: 10 }],
    props: [...temple(), ...run('wall-drystone', -30, 39, -5, 39), ...run('wall-drystone', 5, 39, 30, 39), { id: 'wall-drystone-pier', x: -4, z: 39 }, { id: 'wall-drystone-pier', x: 4, z: 39 },
      ...run('hedge-straight--low', -25, 9, -5, 9), ...run('hedge-straight--low', 5, 9, 25, 9)],
    keepOut: [[-17, -47, 17, -14], [-5, -25, 5, 80], [-32, 36, 32, 42], [-27, 6, 27, 12]],
  },
};
