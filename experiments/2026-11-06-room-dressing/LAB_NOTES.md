# Room dressing lane — LAB NOTES (2026-11-06)

Bugs from docs/KNOWN_BUGS.md (2026-11-04): Mine "a wheelbarrow floats", Monster lair "a skeleton pokes through a wall".
Both were Gemini blind reads of the /assets pack stills (`engine/client/site/library/h/{mine,monster-lair}-20261104-*.webp`,
shots `site-hero-min` = min-sorting 7x5 seed 6104, `site-hero-lai` = lair-dragon 8x7 seed 6201). The stills were not touched.

## 22:07 Reproduce the roll
- `probe.mjs` solves a room through engine/core/roomgen.js exactly as `spawnRoom` does. The Mine room has TWO wheelbarrows,
  both `against-wall`, y 0, no parent (E wall x 32.1 rot -90, W wall x 2.9 rot +90). No stacking rule involved.
- `capture.py --probe` on this checkout (ports 23401/23402) gives the same 22 things at the same places (probe.json): the
  still is the current roll; no dressing code or data changed since 11-04 (git log).
- `survey.mjs`: over 882 rooms (every type x 3 sizes x 2 seeds) the only floor things off y 0 without a parent are on a
  dais or in a nest (high seat, altar, throne, idol, high table, clutch), and every parented thing sits at its parent's dims top.

## 22:10 Gemini, wide still (blind1, labels + 10x10 grid)
- Mine: "wheelbarrow c6-c7,r2-r3 floating, 98". By the neighbours it lists (barrel by the other one; the crate) that is the
  E-wall wheelbarrow. Lair: "giant horned skull, front-left wall, horn tip penetrates, 95" (= dragon-skull, W wall) and
  "horned humanoid skeleton, front wall, pelvis and legs clip, 90" (= adventurer-remains, S wall).

## 22:14 The mesh and the drawn scene, measured
- `glbbox.py` / `contacts.py`: wheelbarrow.glb (and every LOD) has its lowest point AT its origin (min y 0.000); it stands
  on a wheel (x 0, z -0.38) and two legs (x +-0.18, z +0.17): a tripod on the ground.
- `meshorigins.py`: of 1727 library meshes, 14 have their bottom or centre off the origin by >2% of the longest side
  (linen-chest +3.9%, feed-bag, statue-rotating--s2 ...). The wheelbarrow and the lair props are not among them.
- `measure.py` (a real game page, local relay 23403/23404, house look via tw_sandbox): every drawn thing's THREE.Box3.
  Both wheelbarrows: drawn bottom -0.00, on the floor (floor tiles' top 0.02). Lair: the dragon-skull's drawn box starts at
  x 0.67, the W wall's inner face is 0.50 (wall pieces reach exactly 0.50 into the room, corners 0.75): 0.17 ft clear.
  adventurer-remains is 1.44 ft off the S face. Nothing crosses a wall face; nothing floats.
- `clash.py`: every other mesh's vertices inside each lair prop's drawn box: only floor-tile corners (y 0.02). No wall
  geometry inside the skull's or the remains' box.

## 22:18-22:33 Gemini, close-ups (blind2, blind3; low camera, four sides, neutral file names)
- Wheelbarrows (8 views): "wheel yes, legs yes, no gap, upright, 98" wherever the view was not blocked by a wall. None floats.
- Lair: remains, 4 views: "no wall contact, rests on floor, 95". Dragon skull: 2 of 4 views "horn tips pass into the wall,
  95", 2 "0.1-0.2 object lengths from the wall". Measured: the horns end 0.17 ft (2 in) short of the rock face, and no wall
  vertex is inside the skull's box. A horn 2 in off a rough rock face reads as touching it from a low camera.
- Same result as the crypt lane's lesson (wiki room-types-crypt, lesson 2): Gemini's "floating" and "clipping" calls from a
  wide view were wrong each time they were measured.

## 22:35 The rule test: tools/spawn-tuner/test/resting.test.mjs
- Over every room type x 3 sizes x 4 seeds (1764 rooms, 32044 placed meshes, 1191 GLBs): REST (a standing mesh's drawn
  bottom, y + scale x the GLB's real lowest point, is on the floor or not above what it stands on by > 0.12 ft) and REACH
  (its drawn footprint, the GLB's x/z bounds turned by rot + the yaw it is drawn at, stays inside the inner faces by 2 in).
- Self-tests bite: the Mine still's wheelbarrow lifted 0.4 ft, pushed 0.4 ft into its wall, and a common room's candle
  0.4 ft over its parent are each caught (mutation check: with REST/REACH disabled exactly those 3 self-tests fail).
- First run found REAL small floats, all data: (a) table-feast--fine's catalog bounds height 0.250 vs its GLB 0.234, so at
  11.8x everything put on it (plates, goblets, candelabra, epergne) sits 0.19 ft over the drawn top; (b) linen-chest 0.13 ft
  and statue-rotating--s2 0.16 ft: GLB bottoms above their origins. Listed as DEBT in the test (each may float up to its
  measured amount, no more). Cause in common: build_data.py takes `bounds` from prep/blender_runtime.py, not from the
  shipped GLB, and nothing grounds a mesh by its own lowest point. Not fixed here (a library rebuild; Fauna's call).
- First-run noise removed: wall/ceiling-placed things (coat pegs, corbels, wall mangers, hanging carcasses) are up by design.

## 22:50 Fog of war "a little janky while the view rotates" (Nick 2026-11-01)
- `fogspin.py`: player tab, three rooms, pawn in A, camera yawing 2 deg a frame. The fog of war's own state is steady: no
  setState / mask upload, no cross-fade, no cut or level change, no worker message, while only the camera moves.
- But the atmosphere's fluid window (`fx/atmos.js` fitWindow, centred on the AABB of the visible ground) moved on 127 of 180
  frames: the visible ground swings round the focus as the view turns. The fields are re-read into a moved window only in
  `step()`, and at Medium/Low the fluid steps every other frame (graphics.js softHalf -> setViewEvery(2); the move governor's
  'fog-half' shed too). On the frames between, the volume, fogwar's roll/flow seams and the probes read the OLD fields
  through the NEW window.
- `engine/test/browser_fogspin.py` measures it: flow frozen (speed 0, breath 0), the bank read at 75 fixed world points
  across its edge (the A|B wall) after every drawn frame. Old code: jumps of 1.03 on 81/119 frames (every frame the window
  moved, and the frame after). Fix: `regrid()` (the re-read, lifted out of step) runs the frame the window moves, step or
  no step. New: 0/119, worst change 0. Control (camera still) 0 both ways.
- Not changed: the window still pans while the view turns (its centre is the visible ground's box, not the focus). Panning
  is now lossless except the strip at the window's edge, which starts at its bank; making the window turn-invariant would
  need a bigger window (or a lower resolution) and was left alone.
