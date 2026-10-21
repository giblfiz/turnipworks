# Flats for the Dungeon & prison type (DUN), 2026-10-11

Floors, left-right strips, decals and room icons from `../FLATS.md`, made by the method of
`experiments/2026-10-05-castle-crypt-mansion/flats/` (its tools copied here and re-pointed; nothing writes into the old
folder or into the main tree). Free route only: `codex exec` image generation (ChatGPT login), ONE request at a time,
20 s apart. No paid image model was used.

**41 Codex requests** (`requests.log`): 38 first rolls + 1 re-roll that produced images, and 2 that were refused for
quota. **38 images accepted, 0 rejected, 8 left out by instruction** (see the end).
Two sittings: requests 1 to 34 until the quota stop at 19:02; requests 35 to 41 (`gen-4.log`) after the allowance was
restored, limited by the type agent to seven named images.
Vision reads are Gemini's (gemini-2.5-pro; blind description first; the files are passed under neutral names, `gv.sh`),
saved in `raw/gemini/`. Seams, boxes and key residue are measured (`raw/checks/*.txt`, `seamless.log`, `strips.log`).
Provenance: text prompts (all in `gen.py`, and one file per request in `raw/prompts/*.gen.txt`) plus our own images only
(the house style reference, the icon set's anchor `type-TAV`, our own `floor-flagstone-damp`, our own finished base
tile for a variant). No third-party image, nothing from Dungeon Alchemist.

## What exists

| folder | files | format | how build_data.py should read it |
|---|---|---|---|
| `seamless/` | `floor-cut-rock.png`, `--v2`, `--v3`; `floor-water-flooded.png`, `--v2`; `floor-flagstone-dungeon.png`, `--v2` (7) | 1024 px RGB PNG, opaque, tiles on all four edges | as the `ccm/flats/seamless` glob: `obj--var`, `"opaque": True` (flats.py: no keying, no crop) |
| `decals/` strips | `chasm-strip--s1.jpg`, `sewer-channel-strip--s1.jpg`, `pit-open.jpg`, `chasm-strip-wide.jpg` (4) | 1024 px JPEG (the wide one 1024 x 2048), OPAQUE, painted edge to edge, **no chroma margin** | as the `ccm/flats/decals` glob, unchanged (not opaque-flagged). See "The strips" below |
| `decals/` cropped plates | `rune-tile--s1..s4.jpg`, `floor-mosaic--s1.jpg` (5) | 1024 px JPEG, chroma-blue plate | the same glob; flats.py keys and crops them, no feathering (names are not `decal-*`) |
| `decals/` feathered decals | `decal-glyph-warding--s1.jpg`, `decal-cracks--s1.jpg`, `decal-rubble-scatter--s1.jpg`, `decal-straw-scatter--s1.jpg`, `decal-slime--s1.jpg`, `decal-web-floor--s1.jpg`, `decal-claw-marks--s1.jpg`, `decal-drag-marks--s1.jpg` (8) | 1024 px JPEG, chroma-blue plate | the same glob; flats.py keys, de-spills and feathers them (`decal-*`) |
| `icons/` | `room-dun-cell-block`, `-guard-room`, `-interrogation`, `-vault`, `-sewer`, `-corridor`, `-trap-corridor`, `-puzzle-hall`, `-chasm`, `-den`, `-shrine`, `-flooded`, `-collapsed`, `-dead-end` `.png` (14) | 128 px RGBA PNG | copy to `engine/client/data/icons/` (`build.js` looks up `room-<roomKey>.png`) |

`type-DUN.png` already exists in `engine/client/data/icons/` (main tree): none was made and none is copied here.
Not in git: the images (ignored) and `raw/*.log` (the Codex session logs: they echo the local agent instructions, so they
stay on the box). `inputs/` holds the floors as painted, `raw/strips-in/` the strips as painted, `raw/` the icon plates, check sheets,
Gemini reads, the first roll of the flooded floor (`raw/roll1/`) and untouched plates (`raw/plates-before-clean/`).

    python3 gen.py name,name,...        # one Codex request per name; `gen.py list`, `gen.py show NAME` prints the prompt
    ./run_queue.sh LOG name name ...    # the same in order; a base floor is finished at once (its variants need it)
    python3 finish.py sku,...           # inputs/*.jpg -> seamless/*.png (bases before variants); prints seam numbers
    python3 finish_strips.py sku,...    # raw/strips-in/*.png -> decals/*.jpg: X-only seam, key guard, box, 3x1 sheets
    python3 clean_plates.py shadow|nearest|rim sku-prefix   # enclosed chroma-blue filled (straw)
    python3 breach.py sku               # enclosed chroma-blue that must stay see-through (painted rings): one gap cut
    python3 post.py [names]             # raw/room-*.png (green or magenta key) -> icons/*.png
    python3 check.py sku,...            # 3x3 sheets / plates keyed with the tuner's own prep/flats.py + numbers
    ./qa_floor.sh SKU ; ./qa_decal.sh SKU ; ./qa_icons.sh NAME... ; python3 family.py base,...   # Gemini reads

## The strips: how to list them so they are not feathered and fill the tile

Read from `tools/spawn-tuner/prep/flats.py` (main tree, not edited): a job that is not `opaque` is keyed with
`key_blue` (only blue connected to the plate border is background), then **only skus starting with `decal-` or
`rug-hay-scatter` are feathered** (`soften_decal`), then every plate is cropped to the box of what was not keyed.
So for the strips:

1. **Leave them in `decals/` under their names as they are** (`chasm-strip--s1`, `chasm-strip-wide`,
   `sewer-channel-strip--s1`, `pit-open`): the stem before `--` is the catalog role and does not start with `decal-`, so no feather is applied.
2. **They carry no chroma margin**: they are painted edge to edge and `finish_strips.py` lowers the blue of any pixel
   that could pass the key test (it found none). Measured with flats.py's own functions (`raw/checks/tuner-boxes.txt`):
   keyed 0.0%, **box (0, 0, 1024, 1024) = the full plate, webp 512 x 512, 100% opaque** for the three square ones, and
   **box (0, 0, 1024, 2048), webp 256 x 512, 100% opaque for `chasm-strip-wide`**. So the plane is the full plate: lay
   each square one as exactly 5 ft x 5 ft (60 x 60 in) and the wide one as 5 ft along the run x 10 ft across it
   (60 x 120 in), and a row has no gaps.
3. Do not list `chasm-strip-wide` with `"opaque": True`: that branch of flats.py resizes to 512 x 512 and would squash
   it. For the three square ones the opaque flag gives the same 512 x 512 image, so it is harmless but not needed.
   Do NOT rename them to `decal-*` (the 10% border fade would open a gap at every tile joint).
4. **Orientation**: the band runs along image X; the lips / kerbs are at image top and bottom. Repeat along X only
   and do not turn single tiles by 90 degrees inside a run (turn the whole run). `pit-open` has no direction.
5. `chasm-strip-wide` was painted at 1024 x 2048 as asked (nothing stretched). A wide chasm must use it: two
   `chasm-strip` rows cannot be stacked (each has both lips).

## Catalog roles (role = file stem before `--`) and sizes as painted

| file | role | catalog line | size as painted |
|---|---|---|---|
| `floor-cut-rock` (+v2, v3) | `floor-cut-rock` | (floor) | 5 x 5 ft tile; chisel scores run diagonally |
| `floor-water-flooded` (+v2) | `floor-water-flooded` | (floor) | 5 x 5 ft tile |
| `floor-flagstone-dungeon` (+v2) | `floor-flagstone-dungeon` | (floor) | 5 x 5 ft tile; base has ONE iron ring bolt mid-tile, v2 none |
| `chasm-strip--s1` | `chasm-strip` | **NEW line needed** | 5 x 5 ft, full plate; lips about 10% (6 in) top and bottom |
| `chasm-strip-wide` | `chasm-strip-wide` | **NEW line needed** | 5 ft along the run x 10 ft across, full plate; lips top and bottom only |
| `sewer-channel-strip--s1` | `sewer-channel-strip` | **NEW line needed** | 5 x 5 ft, full plate; kerbs about 10% top and bottom, water 4 ft |
| `pit-open` | `pit-open` | **NEW line needed** | 5 x 5 ft, full plate; stone rim all round |
| `rune-tile--s1..s4` | `rune-tile` | exists | 4.5 x 4.5 ft; keyed box 846, 874, 824, 858 px square of 1024 (aspect 1.00) |
| `floor-mosaic--s1` | `floor-mosaic` | exists | 9 ft round; keyed box 965 x 948 px (aspect 1.02) |
| `decal-glyph-warding--s1` | `decal-glyph-warding` | exists | 2 ft across; box 857 x 849 |
| `decal-cracks--s1` | `decal-cracks` | exists | about 4 ft; box 860 x 894 |
| `decal-rubble-scatter--s1` | `decal-rubble-scatter` (FLATS.md: role `rubble-small-scatter`) | see note | about 3 ft; box 870 x 830 |
| `decal-straw-scatter--s1` | `decal-straw-scatter` (FLATS.md: role `straw-scatter`) | see note | about 4 ft; box 916 x 879 |
| `decal-slime--s1` | `decal-slime` (FLATS.md: role `slime-mold-floor`) | see note | about 3 ft; box 874 x 796 |
| `decal-web-floor--s1` | `decal-web-floor` (FLATS.md: role `giant-web`) | **NEW line needed** | 5 ft; box 928 x 908 |
| `decal-claw-marks--s1` | `decal-claw-marks` | (not in my list of existing lines: check) | about 4 ft, diagonal; box 896 x 872 |
| `decal-drag-marks--s1` | `decal-drag-marks` | **NEW line needed** | 4.5 ft wide x 5 ft long, tracks run along image Y; box 803 x 931 |

Note: FLATS.md gives the roles `rubble-small-scatter`, `straw-scatter`, `slime-mold-floor` and `giant-web`, while
the type agent's rule is "role = stem before `--`". The files keep the FLATS.md names; the type agent maps them.
No catalog line was added here.
Scale each plane from the plate's own aspect; do not stretch to the catalog box.

## How each was checked

### Floors (finish.py as in the old batch: tone flattened, edges joined by a cut; variants colour-matched to the base)

| sku | seam L/R | seam T/B | rank L/R, T/B | Gemini hard seams (V, H) | blind read |
|---|---|---|---|---|---|
| floor-cut-rock | 1.28 | 1.18 | 4%, 8% | 0, 0 | "Rough Stone Floor": matte earthy brown, short diagonal tool marks, thin cracks; quiet, props read on it |
| floor-cut-rock--v2 | 1.15 | 1.14 | 14%, 8% | 0, 0 | "Cracked Stone Floor" (one long diagonal crack) |
| floor-cut-rock--v3 | 1.42 | 0.94 | 1%, 70% | 1, 2 ("very faint brightness shifts"), TILING PASS | "rough-hewn dark stone or wood floor" |
| floor-water-flooded (2nd roll) | 0.78 | 1.17 | 66%, 28% | blind 2, 2 (ripples "bisected"); tiling read 0, 0, PASS ("all elements continue correctly") | **"Murky Pond Water"**: dark olive water, scum, ripple rings, two leaves |
| floor-water-flooded--v2 | 1.17 | 0.87 | 26%, 62% | 0, 0, PASS | "murky pond or swamp water surface" |

| floor-flagstone-dungeon | 0.96 | 1.02 | 34%, 24% | 0, 0 | "Stone Block Floor": dark grey rough rectangular blocks, very dark joints, one rusty ring pull on a central square block; quiet, "the ring pull is a strong focal point" |
| floor-flagstone-dungeon--v2 | 0.87 | 0.75 | 53%, 67% | 0, 0, PASS | "dark, rough-hewn stone block or flagstone floor"; no ring |

- No slabs, no joints on the cut rock (none seen in any read). Mean colour 96, 85, 76: a warm grey-brown, not a cool
  grey; say so if it should be cooler (a tone shift in finish.py, no new request).
- **The flooded floor reads as WATER on the second roll.** The first roll (`raw/roll1/`) read as "Wet Stone Pavement
  ... a thin layer of water": the flagstones were too clear. The second prompt makes the water nearly opaque; the cost
  is that the pale flagstones under the water are now only faint (no read mentions them).
- Repetition of one variant alone in a 3x3: 4 of 5 on all (the crack; the ripple rings and the leaf), as in the old batch.
- **Lay mode** (Gemini on 4x4 mixed sheets, grid visibility 0 to 5): cut rock **1 with random quarter turns**, 3
  unturned: shuffle mode with turns. Flooded 3 with turns ("ripples change direction"), 4 unturned (leaves and rings
  repeat): shuffle with turns; a third variant without leaves would help most.
  **Flagstones: 4 with turns** (joints meet at right angles at the borders), **1 unturned: mix base and v2 WITHOUT
  turns.** The ring bolt repeats every 5 ft on the base alone (repetition 5 of 5): use v2 as the main tile and the
  base as the occasional one. Mean colour 72, 67, 64 (a dark neutral grey, darker and cooler than the cut rock).

### Strips (finish_strips.py: tone flattened along X only, left and right edges joined by finish.py's cut with the copy
rolled along X only; rows are never moved or blended, so the lips and kerbs stay as painted)

| sku | seam L/R before -> after (rank) | Gemini on the 3 x 1 row and the row between floor rows |
|---|---|---|
| chasm-strip--s1 | 1.59 -> 1.01 (42%) | blind: "a deep chasm or canyon ... impassable"; "much lower than the floor ... a powerful illusion of depth. It does not read as a flat stripe"; seams 2 of 5 (soft: some rock shapes restart, no line); lips "crisp ... line up perfectly from one tile to the next"; repetition 4 (a pale jutting rock on the top lip) |
| sewer-channel-strip--s1 | 2.08 -> 1.12 (16%) | blind: "a channel of murky, greenish-brown water flowing between stone curbs ... a sewer, canal, or moat"; lower than the floor (shadow lines under the kerbs); seams 2 of 5 (pale ripples restart); kerb edges "crisp and perfectly straight ... line up seamlessly"; repetition 5 (the one drifting stick, which the spec asked for) |
| chasm-strip-wide | 4.26 -> 1.26 (16%) | blind: "a chasm, pit, or deep crevasse ... a dangerous, impassable gap"; "significantly lower than the floor ... a black, bottomless void. It does not look like a flat stripe"; seams 0 of 5; edges crisp, "line up perfectly from one tile to the next"; repetition 4 (three sharp rocks on the top lip) |
| pit-open | none (laid alone) | blind: "a square stone-lined pit, shaft, or well ... a hole in the floor"; "very deep, at least 20-30 feet. It does not read as a flat painted square"; fills its square to the edge on all four sides, square to the tile |

The chasm reads as a DROP on the first roll. One odd line: Gemini called the chasm "photo-like realistic game art"
(the sewer and the pit "hand-painted"); it is the same painter and the same prompt frame, and it was kept.

### Keyed plates (check.py: the tuner's own key and feather; on white and laid on `floor-flagstone-damp` at scale)

| sku | key-blue residue | blind read |
|---|---|---|
| rune-tile--s1 | 0.000% | square cracked dark stone slab, recessed golden-brown rune; "a stylized 'F' or the rune Fehu" |
| rune-tile--s2 | 0.000% | the same, rune "Othala"; reads as a runic tile set into the floor |
| rune-tile--s3 | 0.000% | vertical zigzag crossed by a bar, "similar to Jera, not an exact match" |
| rune-tile--s4 | 0.000% | "clearly runic in style", no historical match |
| floor-mosaic--s1 | 0.000% | round mosaic star chart: eight-pointed star, concentric circles, two rings of stars joined by lines, red key-pattern border, four damaged patches; no letters |
| decal-glyph-warding--s1 | 75.2% -> 0.001% after `breach.py` | rusty red-brown double ring with triangles, dots and bars between the rings; "a ritual circle, a magical glyph"; "somewhat faint against the dark floor, but it remains visible" |
| decal-cracks--s1 | 0.000% | one diagonal main crack with ten or more branches, pale chipped edge; sits on the floor believably |
| decal-rubble-scatter--s1 | 0.000% | 19 grey-brown stones on a pale tan dust patch; "a patch of rubble"; soft shading under the stones |
| decal-straw-scatter--s1 | 1.009% -> 0.002% after `clean_plates.py shadow` | one round pile of straw, dark gaps between stalks; "a pile of hay or straw"; the dark rim "acts as a soft contact shadow" |

| decal-slime--s1 | 0.000% | "a splat of green slime": one lobed puddle, two droplets, five bubbles; "a large puddle of slime or acid"; bright yellow-green with strong gloss highlights |
| decal-web-floor--s1 | 0.000% | "an eight-pointed, star-shaped spiderweb" of fibrous strands "like straw or rope", four insects caught in it; beige and cream; "a large, unusual spiderweb or a decorative straw weaving" |
| decal-claw-marks--s1 | 0.000% | "three parallel, diagonal gouges or claw marks"; "deep, violent claw marks torn into the stone floor" |
| decal-drag-marks--s1 | 0.004% -> 0.000% after `clean_plates.py nearest` | **blind read WRONG: "a waterfall or a curtain of mist"** (vertical streaks in a fluffy border). Narrow read with six choices: "(c) the scrape track left by something very heavy", second "a patch of pale sand or dust"; "very clear, straight parallel scratch lines"; in front of a block a player "probably" understands it. Kept on that; see below |

- **`decal-drag-marks--s1` is the weak one.** Alone it does not read as a drag track; next to the sliding block it
  probably does. It has a dust ridge on all four sides (the prompt asked for the two sides and the far end), so it
  reads as a framed patch. It was not re-rolled (the seven-image allowance had no spare request). If it looks wrong
  in the room, re-roll it with "no dust at the near end, scratches running off the near edge".
- The slime is brighter and glossier than the quiet dungeon palette (the prompt asked for dull green, little gloss).
  It is very visible; tone it down in the look pass if it shouts.
- The web is beige-cream and rope-like, not the pale grey-white sheet asked for; it still reads as a web.
- **Two of the four runes are real Elder Futhark letters** (s1 Fehu, s2 Othala), although the prompt asked for
  invented signs. Kept as dungeon runes. Othala is a sign that some real-world extremist groups have used; if that
  is unwanted, drop s2 or re-roll it.
- **The warding circle's inside was enclosed blue** (flats.py keys only blue connected to the border; 75% of the
  visible decal was blue). The floor must show inside a painted ring, so it is not filled: `breach.py` cuts ONE 14-px
  gap through the rings (it reads as a worn break in the paint) and the whole inside keys away. `--s2` (a star in a
  ring, many enclosed cells) will need the same step, one gap per cell.
- The straw is a round, fairly thick pile, not the thin loose scatter asked for; its colour is yellow-beige.
- Rune tiles have a narrow chipped edge: 99.1% to 99.9% of the cropped box is opaque.

### Icons (the prompt, the anchor and the post step of `2026-10-03-build-icons`; green key, magenta for sewer and flooded)

Key colour left: 0.00% of visible pixels on all 14; corners transparent; 20 to 30 KB (`raw/checks/icons-measured.txt`).
Gemini, blind, against a sheet of twelve existing icons, each shown large and at 56 px: **set match 5 of 5 on all 14**,
no keying faults, no text. Blind guesses:
cell-block "a corner section of a prison with a large barred gate; a cell block entrance or holding pen" ·
guard-room "a guard's station: helmet, large keys, a stool, a table, a torch" ·
interrogation "a torture chamber, a rack as the central object, a brazier with pokers" (at 56 px PARTLY: the rack
reads only as "a complex dungeon contraption") ·
vault "a treasure vault: a heavy round vault door swung open, a chest overflowing with gold" ·
sewer "a sewer drain or outlet: a round barred grate in a stone arch with murky water flowing out" ·
corridor "a stone archway with stairs leading into darkness, lit by two torches" ·
trap-corridor "a section of dungeon floor with a spike trap" ·
puzzle-hall "a statue of a hooded figure in front of FOUR floor tiles with rune-like symbols; a puzzle room" (three
asked; at 56 px PARTLY: the symbols are lost, the statue and tiles stay) ·
chasm "a simple stone bridge with rope handrails crossing a chasm" ·
den "a large nest with three speckled eggs next to a rock with claw marks; a monster's lair" ·
shrine "a small stone wall shrine with a candle and an offering bowl" (narrow read: "a simple, rounded idol in a
meditative pose sits inside the niche"; it also has ivy on it) ·
flooded "a flooded area with a broken stone wall and a floating barrel; a sewer, flooded cellar or cistern" (narrow
read: the pillar is "a square stone pillar attached to a broken wall", not free-standing) ·
collapsed "a pile of rubble from a collapsed building with a broken column and wooden beams" ·
dead-end "a stone archway that has been blocked by a rockfall or cave-in".

## Rejected and re-rolled

| image | first roll | second roll |
|---|---|---|
| floor-water-flooded | read as "Wet Stone Pavement" with a thin film of water (`raw/roll1/`) | accepted: "Murky Pond Water" |

Nothing was rejected outright.

## Quota, and what is not made (8 images)

Request 33 (19:02, `decal-slime--s1`) was refused: "You've hit your usage limit ... try again at Oct 17th, 2026
10:04 PM" (`QUOTA_STOP.resolved-2026-10-11.txt`; the mesh-plate queue was stopped by the same message at the same
minute). One probe at 19:19 was refused the same way and probing was stopped on the coordinator's word. At 19:31 the
allowance was restored (a reset on Harry's side) and the type agent asked for exactly seven images, which were made
(requests 35 to 41, no refusal). Left out by that instruction:

`decal-scorch--s1`, `decal-glyph-warding--s2`, `decal-cracks--s2`, `decal-rubble-scatter--s2`,
`decal-straw-scatter--s2`, `decal-slime--s2`, `chasm-strip--s2`, `sewer-channel-strip--s2`.

Their prompts are in `gen.py` (`python3 gen.py show NAME`). To make them later:

    ./run_queue.sh gen-5.log decal-scorch--s1 decal-glyph-warding--s2 decal-cracks--s2 decal-rubble-scatter--s2 \
      decal-straw-scatter--s2 decal-slime--s2 chasm-strip--s2 sewer-channel-strip--s2
    python3 finish_strips.py chasm-strip--s2,sewer-channel-strip--s2
    python3 breach.py decal-glyph-warding--s2 ; ./qa_decal.sh <each decal>

So the flame jet has no soot decal, and every strip and decal has one shape only.
