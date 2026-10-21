# Caves pilot (2026-10-05, Fauna, Claude Opus 5.5)

Follows the slopes pilot (`../2026-10-05-slopes/`) and uses its viewer scaffolding. Harry and Fauna agreed (docs/VERTICAL.md)
that a cave is an underground room on the 5-ft grid, and that its wall is a row of generated rock props that OVERLAP,
not a kit of pieces butted edge to edge.

**The one question:** does a cave room walled with overlapping generated rock chunks read as a natural cave at table
distance, or as a box lined with boulders?

**Answer from the instruments (Harry's eye decides): a plain rectangle still reads as a box lined with boulders. An
L-shape or two joined caves mostly lose the grid outline, but the wall still reads as separate boulders, not one rock
face.** Look for yourself: https://implausible.enterprises/projects/turnip-works/caves-pilot/
(four scenes and the kit; table distance by default; four sliders; two verdict buttons). Nothing here is in the game.

## What was made

Eight plates by the free Codex image route (`gen.py`; the first accepted plate is the colour reference for the other
seven), all through `src/plate_gate_batch.py` (blind describe, match, BiRefNet matte). 10 images for 8 accepted plates:
the crack piece and the second plain piece needed a second try each. One cave floor texture by the yard floors' free
route (`floor.py`: Codex image, tone flattened, edges joined with a cut).

| what | cost |
|---|---|
| route test, one chunk on three fal models: TRELLIS.2 $0.30, TRELLIS v1 $0.02, Hunyuan 3D v3.1 pro $0.375 | $0.695 |
| the other seven chunks on fal TRELLIS.2 | $2.10 |
| the tunnel-mouth piece a second time (the first paid result was lost to a network time-out while polling; `mesh_fal.py` now saves the request id and retries) | $0.30 |
| **total** (fal balance $5.4675 -> $2.3725; `spend.log`) | **$3.095** of the $6 cap |

No RunPod. Plates, floor and Gemini gates: no spend beyond flash and pro vision tokens.

## Which route paints bulky rock

One chunk (the first plain wall piece, whose silhouette fills 62 % of the plate) on each route, measured by `measure.py`:

| route | surface a player can see left unpainted | size at 10 ft tall | triangles | notes |
|---|---|---|---|---|
| fal TRELLIS.2 ($0.30) | 0.0 % | 10.0 x 4.3 ft | 48 k, 2.4 MB | used for all eight |
| fal TRELLIS v1 ($0.02) | 18.5 % (front 28 %) | 10.6 x 6.1 ft | 54 k | much darker; no bottom rim |
| fal Hunyuan 3D v3.1 pro ($0.375) | 0.0 % | 9.5 x 7.1 ft | 500 k, 30 MB | the only one with a flat back; far too heavy without a reduction step |

TRELLIS.2 painted every one of the eight (worst piece: 0.7 % of the seen surface unpainted). The slope pilot's
unpainted bulky blocks did not happen here; the difference I can name is that these plates show the front, one side
and the top evenly lit, and rock has no large flat faces.

## The pieces, measured (`kit.json`)

| piece | size w x d x h (ft) | notes |
|---|---|---|
| plain wall A | 10.0 x 4.3 x 10 | the reference; fine |
| plain wall B | 11.8 x 7.2 x 10 | usable; yellower and brighter than the rest (mean colour 121,102,52 against the set's 100,84,54) and a wavy layered texture: Gemini picks it out as the odd one |
| ledge | 10.0 x 6.4 x 10 | fine; the ledge is there (the foot stands 3 ft further forward than the top) |
| crack / niche | 8.3 x 5.6 x 10 | fine; the niche does not go through |
| overhang | 8.8 x 10.1 x 10 | **weak**: asked to lean 2 ft into the room, came out a lump whose top overhangs 0.8 ft, and sideways; turned so that side faces the room |
| low rubble | 6.4 x 6.3 x 4 | fine |
| corner column | 4.6 x 4.8 x 10 | came out 7 ft across; narrowed to 64 % in plan |
| tunnel mouth | 11.4 x 5.8 x 10 | **weak**: the opening goes through but is 2.75 ft wide and 6 ft high (asked 4 x 7); the rule stretches it 1.96 x wide and 1.13 x tall to get a 5.4 x 6.8 ft opening |

Every piece is wider and deeper than asked (asked 5 to 8 ft wide, 3 to 4 deep): feet in a prompt do nothing, as in
the slope pilot. Depth does not matter here (the back is inside the rock). None has a base slab; all stand on the
ground along 98 to 100 % of their width (the tunnel mouth 80 %: the rest is its opening). They are open shells with
no bottom face on four of the eight; it does not show. Backs are painted but flatter (Gemini). Which side is the front
was settled by measurement (the flatter broad face is the back) and checked with a blind Gemini read of four turned
views against the plate (`yaw_shots.py`, `gemini/yaw-*.txt`); two were overruled (`yaw.json`).

So: **8 of 8 usable, 2 of them only after stretching or turning** (tunnel mouth, overhang), 1 off-colour (plain B).

## The placement rule (`viewer/cave.js`, checked by `node test_cave.mjs`)

Input: the room as rectangles of grid squares. No hand placement.

1. Walk the outline. Every straight stretch gets a row of chunks: a seeded pick, each overlapping the one before by
   the overlap asked for (a short stretch gets one chunk squeezed or stretched to fit, never two on top of each other).
2. Every chunk is pushed OUTWARD until its foremost point below head height stands `push` feet outside the grid line
   (the measured reach of that piece, allowing for its turn). The room never gets smaller than its grid squares.
3. The line the chunks stand on wanders: a smooth seeded curve moves it up to `wander` feet further out (bays about
   12 ft across, plus one long outward bow per wall), and each chunk turns to follow it, plus a random turn.
4. A column in every corner: touching the corner point of a room corner; set back into the rock at a corner that juts
   into the room, which rounds it off.
5. Low rubble at about half the joins. 6. The tunnel mouth stands just behind the line where a tunnel starts.
7. Solid rock: behind the chunks a rock face follows the same wandering line 1.5 ft further out (so a gap between two
   chunks shows rock, not a black slot), and a flat rock top at 8.4 ft covers everything outside it. The chunks reach
   about 9.6 ft, so they stand up out of the flat top as a lumpy rim. The "Solid rock above" switch turns both off.

**Pawns:** measured on the built scene by testing every chunk vertex below 6.5 ft against the room's squares (the
page shows it live). At the defaults, rock stands 0.00 ft inside the grid line in all three cave scenes, and a 5-ft
round base touches rock in 0 of 17, 0 of 20 and 0 of 25 edge squares. The exception is the tunnel mouth: its own
square (one per mouth) is where a 5-ft base touches the mouth's legs. Pushing the "Pushed out" slider below zero
shows the rock coming into the room and the count going red.

## Gemini (gemini-2.5-pro; blind first, then questions; one image per call; `gemini/`, shots in `shots/`)

Final settings (overlap 30 %, pushed out 0.3 ft, random turn 20 degrees, wander 6 ft, seed 1), table distance, three
reads each. "Continuous rock" 0 = separate objects, 10 = one rock wall. "Outline visible" 0 = cannot tell what grid
shape it was drawn on, 10 = plainly a box (lower is better).

| scene | blind read | continuous rock | outline visible | verdict |
|---|---|---|---|---|
| A rectangle 30 x 20 ft | "a small, cleared area ... partially enclosed on three sides by a low, rough-hewn wall made of jagged, reddish-brown rocks"; second guess "a stylized cave or clearing" | 2, 3, 2 | 8, 9, 8 | a box lined with boulders (3 of 3) |
| B L-shape | "a dimly lit, circular area ... enclosed by a low, rough wall"; "rocky, cave-like setting" | 2, 2, 2 | 0, 7, 0 | a room walled with boulders (3 of 3) |
| C two caves and a tunnel | "two connected, roughly oval-shaped enclosures"; "a dungeon, cave system, or ancient ruins" | 1, 2, 1 | 8, 1, 8 | box (2), room walled with boulders (1) |
| D the same rectangle, straight fieldstone walls | "a walled area ... a dungeon or a maze" | 2, 1, 1 | 10, 10, 10 | box (2), a built room (1) |

- **The rock chunks do not beat the straight walls on "continuous rock"** (both 1 to 3). Gemini names the reason every
  time: dark vertical seams between pieces, "separate, ill-fitting digital assets". More overlap did not change it
  (30 % and 50 % both scored 2), nor did softer contact shadows or a rock face close behind the chunks.
- **Where gaps and seams are:** the far wall a third of the way along (two differently textured pieces side by
  side), both far corners (where a column meets the two walls), the joins on the near wall seen from behind.
- **Do the pieces match:** each other, mostly yes; plain wall B is picked out when it lands next to a greyer piece.
  The floor does not match: brighter and yellower than the walls, finer grain ("sandy floor inside a rock formation",
  "plausible together"). The floor tile tiles with no visible seam (0 of 5) but its repeat shows (4 of 5).
- At a glance: "would mostly accept it as a cave" in most reads of A to C; "the lack of a ceiling and the low walls
  make it feel more like an open-air rock formation".

### What hides the rectangle (`matrix.sh`, scene A, two reads per setting; `gemini/m1-*`, `m3-*`, `m4*`)

| setting | outline visible |
|---|---|
| overlap 30 %, no turn, no wander | 8, 9 |
| overlap 50 % | 9, 9 |
| pushed out 2 ft | 9, 8 |
| random turn 25 degrees | 9, 9 |
| wander 4 ft | 8, 8 |
| wander 8 ft | 8, 7 |
| wander 8 ft + turn 20, seed 1 | 0, 2, 0, 0 |
| wander 8 ft + turn 20, seed 2 | 8, 8 |
| wander 6 ft + turn 20, seeds 1 and 2 | 8, 8, 9, 9 |

Overlap and push-out do nothing for the outline. Turn alone does nothing. A deep wander with turn can erase the
rectangle, but only in some arrangements: it is luck, not a setting. **The shape of the room does more than any
slider:** the L-shape with wander 4 to 8 ft and turn 20 scored 0 in 8 of 10 reads, the two joined caves 0 or 1 in 7
of 10. The flat rock top cuts both ways: it makes the scene read as "a pit cut into the ground" instead of "floating
in a void", but its cut edge is itself an outline (L-shape without it: 0, 1).

The cost of wander: the floor runs up to 6 ft beyond the room's grid squares, so a cave needs that much solid rock
round it, and looks larger than the squares pawns can use.

## Honest answer

Does it read as a natural cave at table distance? **Rectangle: no (about 85 % sure). L-shapes and joined caves:
partly: the grid shape mostly goes, the "one rock face" does not (about 70 % sure).** Overlap did what it was meant
to do mechanically (no gaps to the outside, nothing butted, pawns keep every edge square), but it does not make
separate chunks look like one wall, and it does not hide a rectangle.

**Weakest part:** the joins. Eight pieces with eight different surface patterns, each lit as its own object, stood in
a row. Second weakest: the view. From the table camera the near walls are seen from behind and above, so half the
room's outline is drawn by the rock top and the chunks' backs, not by their painted fronts.

## What I would try next (not done)

1. Draw caves as irregular footprints (L, T, offset rooms) by default and let the corner squares be cut diagonally
   (a round 5-ft base leaves about 1 ft of each corner square free): corners are what Gemini names first.
2. One rock material for everything: paint the chunks, the rock face and the floor from one texture by world position
   (as the banks demo did for grass), so a join has no change of pattern to show.
3. Fewer, longer wall pieces (15 to 20 ft, generated as one mass) with small chunks only as dressing in front.
4. A tunnel-mouth plate with the opening drawn 5 ft wide on a narrower piece; an overhang plate drawn from the side.
5. Floor variants, and a floor made from the wall plate's rock rather than from a prompt.

## Files

`build_spec.py` -> `assets.json`; `gen.py` plates (gate manifest: `gate-manifest.json`); `floor.py` the floor tile;
`mesh_fal.py ROUTE ids` meshes and `spend.log`; `measure.py [--kit]` -> `kit.json` (`yaw.json` overrules a front);
`yaw_shots.py` four turned views per piece; `viewer/` the page (`cave.js` the rule, `scenes.js` the rooms, `main.js`);
`test_cave.mjs`; `deploy.sh [dir]` builds it (live by default, version-stamped); `shoot.py` headless shots and the
page's own measurements; `judge.sh` and `matrix.sh` the Gemini rounds; `live_check.py [--post]`; `read_verdicts.py`.
Write-back: kind `caves_pilot` on the ratings server (`server/ratings_server.py`, tw-ratings restarted); two records
in `reviews/tuner/caves_pilot.jsonl` are marked TEST. Binaries (plates, meshes, shots, textures) are git-ignored and
stay on the build box. Mesh measuring needs `~/.local/share/tw-trimesh-venv`.
