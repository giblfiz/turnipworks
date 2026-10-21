// The scenes of the caves pilot, as plain data. A cave is a list of rectangles of 5-ft grid cells [i, j, w, d]
// (x east, z south); the wall is worked out from their outline by cave.js. `open` edges have no wall (a tunnel's far
// end); an arch is the tunnel-mouth piece, standing across a cell boundary at (x, z) feet, its front facing `face`.
export const POOL = {
  walls: ['cave-wall-plain-a', 'cave-wall-plain-b', 'cave-wall-ledge', 'cave-wall-crack', 'cave-wall-overhang'],
  column: 'cave-corner-column', rubble: 'cave-rubble-low', arch: 'cave-wall-arch',
};
const RECT = { rects: [[0, 0, 6, 4], [6, 1, 2, 1]], open: ['7,1,E'], arches: [{ x: 30, z: 7.5, face: 'W' }] };
export const SCENES = {
  rect: { button: 'A · Rectangle', title: 'A. One cave room, 30 x 20 ft, one tunnel mouth',
    note: 'A plain rectangle of 6 x 4 grid squares. The wall is a row of generated rock chunks placed by rule along its outline, each overlapping the next and pushed outward so the floor stays clear to the grid line. The tunnel mouth on the east side leads into a short passage walled the same way.',
    ...RECT, focus: [16, 3, 10], tableDist: 78, lowDist: 40, lowYaw: -28,
    lights: [[8, 4.5, 6], [22, 4.5, 14]], pawns: [[2.5, 2.5], [27.5, 2.5], [2.5, 17.5], [27.5, 17.5], [12.5, 2.5], [17.5, 17.5], [2.5, 12.5], [32.5, 7.5], [17.5, 12.5]] },
  ell: { button: 'B · L-shape', title: 'B. An L-shaped cave, 30 x 15 ft with a 15 x 15 ft leg',
    note: 'Two rectangles joined into an L, so there is one corner of rock that juts into the room. That corner gets a column set back into the rock, which rounds the corner off.',
    rects: [[0, 0, 6, 3], [0, 3, 3, 3], [6, 1, 2, 1]], open: ['7,1,E'], arches: [{ x: 30, z: 7.5, face: 'W' }], focus: [15, 3, 14], tableDist: 88, lowDist: 46, lowYaw: 35,
    lights: [[7, 4.5, 21], [21, 4.5, 7]], pawns: [[2.5, 2.5], [27.5, 12.5], [2.5, 27.5], [12.5, 27.5], [17.5, 12.5], [12.5, 17.5], [27.5, 2.5], [7.5, 12.5]] },
  two: { button: 'C · Two caves', title: 'C. Two caves joined by a short tunnel',
    note: 'A 25 x 20 ft cave and a 20 x 15 ft cave joined by a tunnel one grid square (5 ft) wide and 15 ft long, walled by the same rule. A tunnel mouth stands at each end of it.',
    rects: [[0, 0, 5, 4], [5, 1, 3, 1], [8, 0, 4, 3]], arches: [{ x: 25, z: 7.5, face: 'W' }, { x: 40, z: 7.5, face: 'E' }], focus: [30, 3, 9], tableDist: 108, lowDist: 52, lowYaw: -20,
    lights: [[9, 4.5, 12], [50, 4.5, 6], [32.5, 4.5, 7.5]], pawns: [[2.5, 2.5], [22.5, 17.5], [27.5, 7.5], [32.5, 7.5], [37.5, 7.5], [42.5, 2.5], [57.5, 12.5], [12.5, 12.5], [47.5, 7.5]] },
  field: { button: 'D · Same room, straight walls', title: 'D. For comparison: the same 30 x 20 ft room with the game\'s straight fieldstone walls',
    note: 'The same rectangle and lights, walled the way the game walls a room today: one straight fieldstone wall piece on every grid edge, a post at each corner, a gap for the door. Same floor. Nothing is overlapped or pushed out.',
    ...RECT, kitWalls: true, focus: [16, 3, 10], tableDist: 78, lowDist: 40, lowYaw: -28,
    lights: [[8, 4.5, 6], [22, 4.5, 14]], pawns: [[2.5, 2.5], [27.5, 2.5], [2.5, 17.5], [27.5, 17.5], [12.5, 2.5], [17.5, 17.5], [2.5, 12.5], [32.5, 7.5], [17.5, 12.5]] },
  kit: { button: 'The pieces', title: 'The eight generated pieces, front and back',
    note: 'Front row: each piece as it faces the room. Back row: the same piece turned round (the back is never seen in a cave). The white figure is 6 ft tall. Sizes are as measured from the mesh.',
    kitView: true, focus: [0, 4, 6], tableDist: 120, lowDist: 85, lowYaw: 0 },
};
