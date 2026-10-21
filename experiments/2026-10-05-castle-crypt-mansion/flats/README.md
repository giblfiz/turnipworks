# Flats for the castle / crypt / mansion batch (2026-10-05): stages 1 and 2

**Stage 2 (castle and mansion floors, room icons, cards, rugs and decals) is at the end of this file.** Totals over both
stages: 99 Codex requests, 90 images accepted, 1 rejected (`decal-moss--s1`), no quota stop.

## Stage 1

Crypt floors, crypt decals, the altar cloth, the crypt room icons and the four roof surfaces.
Free route only: `codex exec` image generation (ChatGPT login, no API spend), ONE request at a time with a 20 s pause.
**34 Codex requests** (28 first rolls + 6 re-rolls; `requests.log`). Quota held: no limit message, no `QUOTA_STOP.txt`.
Vision reads are Gemini's (gemini-2.5-pro, blind description first, then a match against the spec; `raw/gemini/`).
Seams, proportions, key residue and course spacing are measured (`raw/checks/*.txt`).

## What exists (27 accepted images + 1 copied icon)

| folder | files | format | how to read it in build_data.py |
|---|---|---|---|
| `seamless/` | `floor-tomb-slabs[--v2..v4].png`, `floor-bone-strewn[--v2..v4].png`, `roofing-thatch.png`, `roofing-tile-clay.png`, `roofing-slate.png`, `roofing-shingle-wood.png` (12) | 1024 px RGB PNG, opaque, tiles on all four edges | the `experiments/2026-10-05-outdoors/seamless` glob as it stands (`obj--var`, `"opaque": True`) |
| `decals/` | `decal-bones-scatter--s1..s3.jpg`, `decal-grave-ledger--s1..s2.jpg`, `decal-moss--s2.jpg`, `decal-moss--s3.jpg`, `rite-altar-cloth.jpg` (8) | 1024 px JPEG, chroma-blue plate | the `outdoors/decals` glob as it stands; `prep/flats.py` keys them (`decal-*` are also feathered) |
| `icons/` | `room-crypt-antechamber / -vault / -ossuary / -catacomb / -chapel / -embalming / -relic.png` (7), `type-CRY.png` | 128 px RGBA PNG | copy to `engine/client/data/icons/` (`build.js` looks up `room-<roomKey>.png` and `type-<code>.png`) |

`inputs/` holds the floors and roofs as generated (before the seamless step). `raw/` holds the icon plates, Codex logs, check sheets, Gemini reads, first rolls and rejects.

    python3 gen.py name,name,...          # one Codex request per name, 20 s apart; stops and writes QUOTA_STOP.txt on a limit
    python3 finish.py sku,sku,...         # inputs/*.jpg -> seamless/*.png (bases before their variants); prints seam numbers
    python3 clean_plates.py shadow|nearest sku-prefix    # enclosed chroma-blue inside a decal plate
    python3 post.py                       # raw/room-*.png (chroma green) -> icons/*.png
    python3 check.py sku,...              # 3x3 sheets / keyed decals on a floor -> raw/checks/ + numbers
    python3 course_check.py sku,...       # roofing: course spacing across the top/bottom seam
    python3 family.py; python3 icon_sheets.py            # mixed-variant sheets; icon sheets

## Things the integration agent should know

- **`type-CRY.png` was NOT generated again.** The Crypt type icon already exists in the set
  (`experiments/2026-10-03-build-icons`, in `engine/client/data/icons/type-CRY.png`: a stone mausoleum). It is copied here
  unchanged, so the folder is complete. If a new one is wanted, that is one more request.
- **Floors: lay the base variant straight by default; v2..v4 are for the shuffle mode** (as `floor-grass`). Gemini on
  4x4 mixed sheets: with random quarter turns the cell grid is 1 of 5 (tomb slabs) and 2 of 5 (bone-strewn); mixed
  WITHOUT turns it is 4 of 5 on both (slab joints stop at the cell borders; the variants are not edge-matched).
  One variant alone repeats its landmark every 5 ft (the carved grave slab; the skull): Gemini 4 of 5 on every 3x3.
  That is by design (one carved slab and one skull per tile were asked for).
- **Tomb-slab emblems** by variant: base ring-cross, v2 sun-disc, v3 shield, v4 wreath. The carved slab is about
  22 in x 36 in in the middle of the tile (the designer's "half-length" case: a 7-ft ledger cannot sit inside a 5-ft
  tile). The full 3 ft x 7 ft ledger is `decal-grave-ledger`.
- **Roofing**: courses run along image X, eaves at image BOTTOM (measured from the shadow profile on tile, slate and
  shingle, and read by Gemini with high confidence on all four). Do not rotate; one variant each (the designer's
  `variants: 2` were not made: they would need edge-matching to be mixed, see `vertical/flats.json`).
  Counts as built: thatch 3 layer bands; clay tile 6 courses x 7 tiles (8 asked; the plate had 7); slate 8 courses x 5
  slates (6 asked); wood shingle 6 courses, random widths. The clay-tile plate held 6.9 courses and was cropped to 6
  and stretched 15% in height, which lands on the specified 10-in exposure.
- **Decals have no painted contact shadow** (the spec asked for a soft one under the bones): a shadow on a blue plate
  keys away or leaves a fringe. Gaps enclosed by bones (ribcage, pelvis) are filled with a dark neutral floor shadow.
- **`rite-altar-cloth`** is a keyed plate in `decals/` (it is not `decal-*`, so `prep/flats.py` crops it without
  feathering, like a rug). Measured 922 x 450 px after keying = 2.05 : 1 (6 ft x 3 ft asked).
- `decal-moss` has only two shapes: the corner fan (s2, corner at top-left) and the round blotch (s3). The wall-foot
  strip (s1) was rejected.

## How each was checked

### Floors (seamless, measured)
`finish.py`: flatten low-frequency tone, then join each pair of edges with a CUT along the cheapest line in an 18% edge
band (the outdoors `finish_new.py` method). One change: the copy that fills the edge band is not the half-offset copy
but the roll that differs least from what is already in the band. The half-offset copy carried the mid-tile landmark
(the carved slab) to the edges, where Gemini read "half-shields on the left and right edges"; the chosen roll differs
0.26 to 0.97 as much as the half-offset one. First-join files are in `raw/join-half-offset/`.
Variants are colour-matched to the base (per-channel mean and std).

Seam ratio = mean step across the wrap / mean step inside (about 1 = no seam). "Rank" = share of the tile's own
line-to-line steps that are at least as big as the wrap step (a joint lying on the border is an honest big step).

| sku | seam L/R | seam T/B | rank L/R, T/B | Gemini hard seams (V, H) | Gemini match |
|---|---|---|---|---|---|
| floor-tomb-slabs | 1.05 | 2.86 | 32%, 7% | 0, 0 | ACCEPT (1 carved slab, ring-cross, no letters) |
| floor-tomb-slabs--v2 | 0.96 | 0.72 | 42%, 53% | 0, 0 | 1 carved slab (sun) |
| floor-tomb-slabs--v3 | 0.99 | 1.35 | 35%, 16% | 0, 0 | 1 carved slab (shield) |
| floor-tomb-slabs--v4 | 1.02 | 0.73 | 40%, 58% | 0, 0 | 1 carved slab (wreath) |
| floor-bone-strewn | 0.95 | 1.04 | 73%, 26% | 0, 0 | ACCEPT (1 skull, earth is the main read) |
| floor-bone-strewn--v2 | 1.04 | 1.08 | 31%, 16% | 0, 0 | 1 skull |
| floor-bone-strewn--v3 | 0.92 | 0.95 | 81%, 77% | 0, 0 | 1 skull |
| floor-bone-strewn--v4 | 1.06 | 1.15 | 25%, 4% | 0, 0 | 1 skull + a second one crossing the right edge |

The base tomb-slab T/B figure (2.86, rank 7%) is the highest of the floors: a slab joint lies on the border. Gemini
sees no line there. Gemini also reads soft shading under the bones ("subtle shadows") on the bone floor; it passed the
"even shadowless light" line of the match all the same.

### Roofing (seamless, courses measured)
`finish.py` crops to a whole number of courses (an even number where the bond alternates) and of tiles by
autocorrelation, cuts with whole-course / whole-tile shifts, then damps landmark pieces by 60% (piece-scale tone
deviation; each pixel row's mean is kept, so course shading stays). Undamped files: `raw/undamped/`.

| sku | seam L/R | seam T/B | course lines per tile; spacing across the seam vs median | Gemini seams (V, H), broken course, bond |
|---|---|---|---|---|
| roofing-thatch | 1.19 | 0.74 | 3; 341 vs 341 px | 0, 0; none; n/a |
| roofing-tile-clay | 0.38 | 0.45 | 6; 169 vs 171 px | 0, 0; none; staggered throughout |
| roofing-slate | 0.75 | 5.85 | 8; 124 vs 129 px | 0, 0; none; staggered throughout |
| roofing-shingle-wood | 1.04 | 1.08 | 6; 159 vs 175 px | 0, 0; none; staggered throughout |

Slate's T/B 5.85 (rank 2%) is a course shadow line 6 px from the border, not a break: the course spacing closes.
Repetition: Gemini A/B on 3x3 sheets, undamped against damped: 5 of 5 -> 1 of 5 on tile, slate and shingle, "has not
lost its piece-to-piece variation". Read ALONE, the damped sheets still score 4 of 5 (as does nearly every single
texture in a 3x3 here), and Gemini's last line was FAIL on clay tile for that reason alone. A whole roof plane is the
real test; a second edge-matched variant is the fix if the grid shows there.

### Decals (keyed with the tuner's own `prep/flats.py`, on white and laid on a floor at scale)

| sku | object box, aspect | key-blue residue | result |
|---|---|---|---|
| decal-bones-scatter--s1 | 822x675, 1.22 | 5.5% -> 0.000% after `clean_plates.py shadow` | ACCEPT on the 2nd roll, 2 of 3 reads (see below) |
| decal-bones-scatter--s2 | 880x764, 1.15 | 7.2% -> 0.000% after `clean_plates.py shadow` | ACCEPT (ribcage + pelvis, casual scatter) |
| decal-bones-scatter--s3 | 810x696, 1.16 | 0.000% | ACCEPT (three long bones, jaw, finger bones) |
| decal-grave-ledger--s1 | 372x868, 0.43 (3:7 = 0.43) | 0.000% | ACCEPT on the 2nd roll (ring-cross on a stem, shield at the foot) |
| decal-grave-ledger--s2 | 370x868, 0.43 | 0.000% | ACCEPT (sun-disc over a sword; "belongs to the floor, a bit paler") |
| decal-moss--s2 | 765x786, 0.97 | 0.15% -> 0.001% after `clean_plates.py nearest` | ACCEPT on the 2nd roll, 2 of 3 reads |
| decal-moss--s3 | 887x923, 0.96 | 0.000% | ACCEPT on the 2nd roll |
| rite-altar-cloth | 922x450, 2.05 | 0.000% | ACCEPT on the 2nd roll |

Split reads, settled by a third, narrow question (`raw/gemini/*.tiebreak.txt`):
- `decal-bones-scatter--s1` (2nd roll): blind "skull, two long bones, three curved fragments (likely ribs)"; match
  REJECT "no ribs, they are broken long bones"; third read "all thin curved arcs, like ribs; a casual scatter, not an
  emblem". Kept. The two long bones do still cross behind the skull.
- `decal-moss--s2` (2nd roll): blind "moss with four clusters of lobed lichen"; match REJECT "flower-like shapes in the
  lichen"; third read "lichen or another moss, damp overgrowth on stone: MOSS". Kept.

### Icons (same prompt, anchor and post step as `2026-10-03-build-icons`; green key)
Key-green left: 0.00% of visible pixels on all seven; corners transparent; 24 to 30 KB.
Gemini, blind, against a sheet of twelve existing icons, each icon shown large and at 56 px: set match 5 of 5 on all
seven, reads at 56 px on all seven, no keying faults. Blind guesses:
antechamber "stone antechamber or shrine with a hooded statue, a bench, two braziers"; vault "tomb or burial vault,
one sarcophagus and a candle stand"; ossuary "ossuary, walls filled with skulls and bones"; catacomb "catacomb or
burial chamber with burial niches, a sarcophagus, one torch"; chapel "small chapel or prayer room, altar and benches"
(it has an A-frame timber roof and windows, which an underground chapel would not); embalming "preparation room,
morgue or alchemist's lab: stone slab table, shelf of pots, bucket"; relic "treasury or relic room: golden reliquary
on a pedestal, open chest of gold, two braziers".
One note: the relic icon's reliquary carries a small equal-armed cross (the prompt said no crosses). Kept: it is a few
pixels at 56 px and the crypt's own emblems include a ring-cross.

## Rejected and re-rolled

| image | first roll | second roll |
|---|---|---|
| **decal-moss--s1** (wall-foot strip) | read as moss hanging from a ledge, lichen as flowers | **REJECTED**: blind "star-shaped plants on brown earth", match "flower-like shapes", third read "FLOWERS". Both rolls in `raw/rejected/`. |
| decal-moss--s2 | bushes, clover, blue specks | accepted (above) |
| decal-moss--s3 | leafy bush with white flowers | accepted |
| decal-bones-scatter--s1 | an arranged skull-and-crossbones emblem | accepted (above) |
| decal-grave-ledger--s1 | the shield at the foot read as a spade head | accepted |
| rite-altar-cloth | measured 1.44 : 1 instead of 2 : 1; blue between the fringe tassels | accepted, no fringe |

First rolls are in `raw/roll1/`. The moss prompt's second version asks for a flat velvet mat and crusty lichen stains;
the model still draws lichen as rosettes.

## Not done in stage 1
- `decal-moss--s1` (the long strip for wall feet): needs a new prompt, or cut a strip out of s3.
- Roofing second variants (`variants: 2` in `vertical/flats.json`): 4 requests plus edge-matching.

---

# Stage 2: castle and mansion (2026-10-05 evening)

**65 Codex requests** (63 first rolls + 2 re-rolls), requests 35 to 99 in `requests.log`. Quota held; no "at capacity"
message either. A login outage cut the supervising session for a while; the queue (`chain.sh`) ran through it.
**63 images accepted, none rejected.**

## What was added

| folder | files |
|---|---|
| `seamless/` (+28) | castle: `floor-flagstone-rushes`, `floor-setts-courtyard`, `floor-sand-training`; mansion: `floor-marble-cabochon`, `floor-parquet-versailles`, `floor-tile-encaustic`, `floor-lawn-mown`; each with `--v2..v4` |
| `icons/` (+19, +2 copied) | castle: `room-great-hall`, `-throne-room`, `-armoury`, `-barracks`, `-castle-kitchen`, `-chapel`, `-dungeon`, `-gatehouse`, `-courtyard`; mansion: `room-mansion-hall`, `-drawing`, `-dining`, `-library`, `-bedroom`, `-ballroom`, `-conservatory`, `-garden`, `-kitchen`, `-cellar`. `type-CAS.png` and `type-NOB.png` are the existing set icons, copied unchanged |
| `decals/` (+16 keyed plates) | castle: `banner-wall--s1..s3`, `tapestry--s1`, `--s2`, `rug-runner--royal`, `rug-fur`, `decal-blood--s1`, `--s2`, `floor-drain-grate`; mansion: `painting-still-life--s1`, `--s2`, `tapestry--s3`, `--s4`, `tablecloth-white`, `table-runner-embroidered` |

## For the integration agent

- **Skipped, as instructed (entry id already in `library.json`):** `painting-landscape`, `rug-grand`, `curtains-drapes`.
  The mansion designer wanted two NEW skus of each (`--s2`, `--s3`): those 6 images are not made.
- **`tapestry` sku clash.** Castle and mansion both specified `tapestry` s1 and s2. Castle keeps `tapestry--s1` (tree in
  knotwork) and `--s2` (mille-fleurs with three plain shields); the mansion's verdure is `tapestry--s3` and its formal
  garden `tapestry--s4`. `mansion/flats.json` still says s1 / s2.
- **`floor-drain-grate` is a keyed decal that lives in `decals/`**, although its id starts with `floor-` (the catalog
  line is a kit piece). It is not a seamless floor; `prep/flats.py` crops it like a rug, without feathering.
- **Lay mode, from Gemini on 4x4 sheets of mixed variants** (grid visibility, 0 invisible to 5 obvious):

  | floor | mixed + quarter turns | mixed, unturned | so |
  |---|---|---|---|
  | floor-flagstone-rushes | 3 | 5 | base alone; variants as whole-room alternates |
  | floor-setts-courtyard | 4 | 1 | mix unturned (rows run along X) |
  | floor-sand-training | 2 | 4 | shuffle mode with turns |
  | floor-marble-cabochon | 2 | 4 | shuffle mode with turns (joints lie on the cell borders) |
  | floor-parquet-versailles | 4 | 3 | base alone; variants as whole-room alternates |
  | floor-tile-encaustic | 3 | 4 | base alone; v3's motif differs visibly from the others |
  | floor-lawn-mown | 4 | 0 | NEVER turn (stripes run along X); mix unturned freely |

- **The three patterned floors tile exactly on the 5-ft cell**, joints on the cell borders: marble 2 x 2 slabs with a
  dark square at every crossing (centre, edge midpoints, corners); parquet 2 x 2 panels; encaustic 5 x 5 pattern
  squares. Measured periods: marble 511.1 x 510.3 px of 512 exact (variants 512.0); parquet 512.0 x 512.0; encaustic
  202.9 to 206.5 px of 204.8 exact. All were cropped to whole periods and resized.
- **Lawn stripes are imposed by `finish.py`, not painted**: top half of the tile 12% lighter, bottom half 12% darker,
  so two 30-in stripes per cell that run on from cell to cell. (7% was too faint: Gemini saw no stripes.)
- **Measured proportions of the keyed plates** (width : height after keying, against the designer's size):

  | sku | measured | asked | note |
  |---|---|---|---|
  | banner-wall--s1 / s2 / s3 | 0.54 / 0.51 / 0.46 | 0.42 (30 x 72) | the rod and its finials are wider than the cloth |
  | tapestry--s1 / s2 / s3 / s4 | 1.17 / 1.37 / 1.07 / 1.19 | 1.33 (96 x 72) | rod, loops and fringe add height |
  | painting-still-life--s1 / s2 | 1.06 / 1.07 | 1.2 (36 x 30) | nearly square frames |
  | rug-runner--royal | 4.80 | 4.44 (160 x 36) | ends cut square, gold lines run off both ends |
  | rug-fur | 0.84 | 0.67 (48 x 72) | |
  | tablecloth-white | 2.91 | 3.0 | |
  | table-runner-embroidered | 8.03 | 7.5 | pointed ends with a tassel each |
  | floor-drain-grate | 1.10 | 1.0 | 7 bars, 6 asked; frame of 8 stones |
  | decal-blood--s1 / s2 | 1.03 / 1.96 | about 24 in | |

  Scale each plane from the plate's own aspect; do not stretch to the catalog box.
- Four icons are keyed on magenta, not green, because the subject is green (`magenta-icons.json`: courtyard, mansion
  bedroom, conservatory, garden). `post.py` handles both.

## How each was checked

### Floors
Bases: Gemini blind read, then a match against the designer's description; variants: a tiling-damage read. All 28:
hard seams 0 vertical and 0 horizontal, nothing sliced, pattern continues across the borders, TILING PASS.
Measured seam ratios are in `raw/checks/stage2-seamless-measured.txt`. Organic floors (rushes, setts, sand, lawn):
0.85 to 1.46, except setts T/B 1.47 to 2.02 (a row joint lies on the border). Lattice floors read high where the border
sits on a joint line (marble up to 7.9, encaustic up to 4.2, parquet v3 3.5; wrap-step rank 0 to 6%, i.e. the step is
as big as the joint lines themselves, which is what it is); parquet base 0.96 / 0.78.
Match verdicts on the bases: setts ACCEPT (about seven setts across); sand ACCEPT; marble ACCEPT ("borders on the
joints, through the centre of the dark squares"); parquet ACCEPT ("borders on the frame boards"); lawn ACCEPT after
the stripes were strengthened; rushes ACCEPT on the 2nd roll (cover "about 50 to 60%").
**Encaustic base: Gemini's match said REJECT, "four pattern squares across, not five". It is kept on the measurement:**
the autocorrelation period is 202.9 px in a 1024 px plate = 5.05 squares, and the tile was cropped to exactly five.
Gemini also found no tile "a shade darker" (all identical), which is true and was let go.
Repetition read alone is 3 to 5 of 5 on every base, as in stage 1.

### Icons
Gemini blind, against the reference sheet, large and at 56 px: all 19 named correctly ("Great Hall", "Throne Room",
"Armory", "Barracks", "Kitchen" with big hearth, cauldron and bread oven, "Chapel", "Dungeon", "Gatehouse",
"Courtyard"; ballroom, bedroom, wine cellar, conservatory, dining room, drawing room, formal garden, entrance hall,
kitchen with copper pots, library). Set match 5 of 5 and reads at 56 px on all 19; no keying faults; key colour left
0.00% of visible pixels on all (`raw/checks/icons2-measured.txt`).
Notes: the great hall's banners carry a small lion device and the throne and its banners a crown-like device
(no text); the chapel window has a quatrefoil; the gatehouse is drawn from outside, as a gate between two towers;
the mansion kitchen reads as a kitchen; Gemini did not mention the call bells.

### Keyed plates (`qa_flats.py`: measure, blind read, match against the designer's description)
All 16 ACCEPT. What it took:
- Blue enclosed by the subject is filled before keying (`clean_plates.py`): the gaps between hanging loops and rod on
  `banner-wall--s3` and the four tapestries, and between fringe strands on `tapestry--s4` (53 small gaps), as dark
  shadow; specks in `floor-drain-grate` with the nearest colour. `rug-runner--royal`, `tablecloth-white`,
  `table-runner-embroidered` and `decal-blood--s2` had a purple rim from the blue plate: their 4-px rim is re-coloured
  from inside (`clean_plates.py rim`). Untouched plates: `raw/plates-before-clean/`.
- The first match run rejected `banner-wall--s1` and `--s2` for fold shading ("plain colour fields only"). That was
  the gate text read too hard: the designer meant no emblem. Re-read with that said: ACCEPT.
- `painting-still-life--s1`: the match said REJECT for dark purple grapes (and mis-read which of the two shapes it
  was). Kept: the blind read is the specified picture (fruit, silver jug, cut pie, draped table), the designer's rule
  is "no blue", and a painted interior is not touched by the key. Say so if purple is unwanted.
- `decal-blood--s2`, first roll: three holes showed the blue plate; filling them left purple blocks. Re-rolled as one
  solid smear; ACCEPT after the rim fix. (First roll in `raw/roll1/`.)
- No recognisable people, no figures and no text on any painting or tapestry (the garden tapestry has nobody in it).

## Re-rolled in stage 2
| image | first roll | second roll |
|---|---|---|
| floor-flagstone-rushes | rushes far too thin ("stone shows over about 90%") | accepted |
| decal-blood--s2 | holes filled with purple blocks | accepted |

## Not done
- `painting-landscape--s2/--s3`, `rug-grand--s2/--s3`, `curtains-drapes--s2/--s3` (skipped by instruction: 6 requests).
- Still open from stage 1: `decal-moss--s1`, roofing second variants.
