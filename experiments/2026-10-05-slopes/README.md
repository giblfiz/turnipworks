# Slopes pilot (2026-10-05, Fauna, Claude Opus 5.5)

**The one question:** does a hill assembled from generated slope props on flat grass read as natural rolling terrain at
table distance, or as props dumped on a lawn?

**Answer: with this first kit, props on a lawn.** Recognisable as a hill, a plateau and a cliff, and usable for play, but
not one landform. Look for yourself: https://implausible.enterprises/projects/turnip-works/slopes-pilot/
(scenes A-D and the kit; table view by default; toggles for pawns, detected flat zones, grid, fit, colour match, sun
shadows, night look).

## What was made

Ten plates by the free Codex image route (`gen.py`, the game's own grass tile as the colour reference), all through
`src/plate_gate_batch.py` (blind describe, match, BiRefNet matte). 13 images for 10 accepted plates: the inside corner
needed 3 tries, the scree 2. Meshes on fal.

| what | cost |
|---|---|
| 10 meshes on fal TRELLIS.2 (`fal/`) | $3.00 |
| outcrop again on TRELLIS.2 with three other settings (`fal-noremesh/`, `fal-dense/`, `fal-pad/`): none fixed it | $0.90 |
| 4 bulky pieces again on fal TRELLIS v1 (`fal-trellis1/`) | $0.08 |
| **total** (fal balance $10.35 -> $6.37) | **$3.98** of the $6 cap |

RunPod and Hunyuan were not used. Plates and Gemini gates: no spend beyond the gate's flash tokens.

## What the generator could and could not do

Measurements: `measure.md` (table), `kit.json` (everything), made by `measure.py`.

- **Fine:** the 5-ft bank (a clean plane: 35.6 degrees, 0.01 ft off flat), both corners, the path ramp (18 degrees),
  the mound, the scree (shape fine; its grass came out speckled).
- **Proportions are not obeyed.** Every wedge came out stubbier and steeper than asked: the "30 degree" banks are 36 to
  44 degrees, the bank asked 17 ft deep came 10 to 13. Feet in a prompt do nothing; the plate decides. Free stretch in
  the scene fixes it.
- **No feather edge.** Banks end in a 0.9 ft lip (after fitting, about 0.6 ft); corners and the mound thin out to
  0.1 ft. Sinking a piece by its measured lip hides it.
- **TRELLIS.2 fails on bulky blocks.** The tall bank, both stepped pieces and the rock outcrop (the four whose
  silhouette fills about half the frame or more) came back with few faces and with 29 to 69 % of the visible surface
  never painted (black holes, mostly the vertical faces). Turning remesh off, 300k faces and padding the input did not
  help. TRELLIS v1 ($0.02) painted them, but only the two faces the plate showed, and much darker; the three-ledge piece
  it flattened, so that one stays as a known-bad example in the kit view.
- **Undersides** are hollow shells on most pieces (flat on the ground only for the two banks). It does not show.
- **Cut faces do not butt.** The "clean vertical side cuts" lean and the corner's profile is fatter than the bank's, so
  two pieces placed edge to edge leave a V-shaped gap. This is the main reason the scenes read as assembled.
- **Colour drifts.** With the grass tile attached as reference the painted grass is still darker and more saturated:
  ground RGB [100,123,39], pieces [75-85, 97-129, 13-21], TRELLIS v1 pieces [16-36, 82-106, 0-1]. The viewer shifts
  grass-green texels by the measured difference ("Match grass colour"). Rendered straight down in the same light,
  level grass on a piece is then within about 5 to 13 % of the ground (`colour_check.json`); as generated it is far off.

## Can flat standing zones be computed? Yes.

`measure.py` builds a 0.25 ft height map of each mesh's top and finds where a base can stand: every cell under the base
within 15 degrees of level, and the surface under it rising or falling no more than a 15-degree tilt would. Run on the
piece at the size it is used. Result (5-ft bases / 2.5-ft bases, with heights):

- two-shelf stepped piece: 2 / 12, at 5.5 ft and 10 ft: one 5-ft base per shelf, exactly the "step up like stairs" idea
- three-ledge piece: 0 / 6 (the plate drew the ledges 3 ft deep, not 5)
- outcrop: 1 / 8 on its top; mound: 1 / 4 on its crown; banks: 0 / 0-3 (only the strip along the top edge)
- corners, scree: none; ramp: 2 small ones at the top

No hand marking needed; it also says when a piece has no usable ledge.

## A level pawn base on a slope

A level 5-ft base centred on the surface of a 35-degree bank is buried 1.75 ft on the uphill side and hangs 1.75 ft
in the air on the downhill side (1.4 ft at 30 degrees; half that for a 2.5-ft base). It is plainly visible. On a
detected ledge the base sits flat. So pawns belong on flat zones; a pawn on a plain slope needs its own answer.

## Gemini (gemini-2.5-pro; blind first, then questions; `gemini/final-*.txt`, shots in `shots/final/`)

| scene | blind read | one landform? table / low (0-10) | verdict | accept at a glance |
|---|---|---|---|---|
| A hill (terrace + banks + corners + mound) | "a large, irregularly shaped green hill or mound ... several large, deep, dark cracks ... a separate object placed on top of the gridded plane" | 4 / 2 | mostly continuous with visible seams | mostly |
| B plateau | "a large, raised plateau with a flat, grassy top ... irregular, blocky outline" | 2 / 5 | separate objects | yes (as game terrain) |
| C cliff | "a large, raised structure ... several distinct, blocky sections" | 2 / 3 | separate objects | yes (as game terrain) |
| D hill from piled mounds | "a lumpy, organic structure composed of several interconnected, rounded green mounds" | 3 / 4 | mostly continuous with visible seams | yes |

Seams: glaring at every bank-to-corner join and where the ramp meets the hill; a hard line all round where a piece meets
the ground; dark creases where mounds intersect. Colour: Gemini says no match in all four (brightness and texture scale;
the pieces' grass is blurrier than the ground tile). The measured level-surface colour is close after matching, so most
of what Gemini sees is slope shading and the different texture grain, not hue.

## What I would try next (not done)

1. Stop asking for butt-jointed modular wedges. The pieces that blend are the ones with no cut faces (mound, the
   corner seen from outside). Design pieces to be overlapped and half-buried.
2. Blend at the contact line in the renderer (fade the piece's colour into the ground's over the last foot), and put
   the game's own grass texture on the props' grass by world position, so grain and colour cannot differ.
3. Contact shadows make every crease black in the house look; soften them for terrain.
4. The flat terrace is the least natural thing in B and C: straight edges and square corners.

## Files

`build_spec.py` -> `assets.json`; `gen.py` plates; `fal_variant.py`, `fal_alt.py` the extra mesh runs; `chosen.json` +
`select.py` pick the mesh per piece into `web-models/`; `measure.py` -> `kit.json`; `glb_info.py`, `surf_unpainted.py`
texture health; `viewer/` the page; `deploy.sh [dir]` builds it (live by default); `shoot.py` headless shots;
`colour_check.py`. Binaries (plates, meshes, shots) are git-ignored and stay on the build box.
Mesh measuring needs `~/.local/share/tw-trimesh-venv` (trimesh, scipy, shapely, pillow).
