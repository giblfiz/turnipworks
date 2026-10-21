# Banks demo (2026-10-05, Fauna, Claude Opus 5.5)

Follow-up to the slopes pilot (`../2026-10-05-slopes/`). Harry: "let's see a demo of your banks. I'm game."

**The one question:** does a COMPUTED bank between flat terraces, covered in the same grass as the ground and dressed
with generated rocks and plants, read as natural land at table distance, clearly better than the pilot?

**Page:** https://implausible.enterprises/projects/turnip-works/banks-demo/ (five scenes, six sliders, three views,
two verdict buttons). Harry judges it himself there. Nothing here is in the game.

**Short answer from the instruments (Harry's eye is the deciding read):** better than the pilot at table distance, not
better at a low angle, and still obviously computer-made to a critical eye. Gemini's "one landform" score at table
distance went from 2 to 4 (pilot) to 4 to 8 (here, median 6); at the low view it stayed at 2 to 4. Asked what gives it
away, Gemini says 8 out of 10 artificial every time: the slope is too even, the grass is a flat picture with no relief,
and the pieces sit on the ground rather than in it. The grass itself is no longer the problem: on a bare bank Gemini
rates the match between slope and lawn 10 out of 10, with no seam and no stretching.

## What was built

- `viewer/terrain.js`: the ground as a height field worked out from flat terraces. The data is only terraces
  (rectangles on the 5-ft grid, at a height that is a multiple of 5 ft), a list of places where an edge is a rock face,
  and ramps. For every point: `height = the highest, over each terrace level v, of v - tan(angle) x distance to that
  level`. Because the distance is the true distance to the outline, outside corners come out round with no extra work,
  and stacked terraces whose shelf is narrower than the bank is long simply run together into one slope. The upper
  terrace keeps its whole footprint; the bank lies on the lower one. A hollow is the same rule with a terrace at
  minus 10 ft. One mesh, 0.5 ft resolution over 180 x 180 ft, rebuilt in about 0.2 s when a slider moves.
  `node test_terrain.mjs` checks the numbers (angle, run, round corner, flat tops, hollow, ramp).
- This is not voxels (no blocks) and not sculpted terrain (nobody shapes the surface): the only thing drawn is flat
  terraces. The page says so.
- `viewer/main.js`: the pilot's scaffolding (the game's lighting module, grass tile, 5-ft grid, 6-ft figure, pawn
  stand-ins, the pilot's colour match for its pieces) with the computed ground, seeded dressing, the controls and the
  write-back. `viewer/scenes.js`: the five scenes as plain data.
- Scenes: A one plateau 30 x 30 ft, 10 ft up (the pilot's scene B); B a hill in tiers (5, 10 and a 15 ft summit,
  each a union of rectangles); C the same plateau with a rock face on the south side; D a hollow 10 ft deep with a
  path ramp; E three terraces climbing to a temple (library pillars, flagstone floor, raised hearth as altar, library
  stone stairs set into each bank, dry-stone wall and hedges along the rims).
- Write-back: kind `banks_demo` on the ratings server (`server/ratings_server.py`, tw-ratings restarted), read with
  `python3 read_verdicts.py`. One test record from the live check is in the file, marked as a test.

    ./deploy.sh [dir]                                         # build the page (live by default), version-stamped
    browser-venv/bin/python shoot.py BASE OUT [scenes] [query] [views]
    ./judge.sh shots/r3 r3                                    # Gemini: blind, the pilot's questions, the adversarial question
    browser-venv/bin/python live_check.py [BASE] [shot.png] [--post]

## The grass on the bank

The grass is laid from straight above, one tile per 5-ft cell, by position, on lawn, terrace and bank alike, in one
material. The same texel grid runs across every join, so there is nothing to seam, and colour cannot drift because it
is the same texture in the same light. Laid from above, a texture stretches down a slope by 1 / cos(angle): 1.15 times
at 30 degrees, 1.41 at 45, 2.0 at 60. At the default 30 degrees that is not visible (Gemini on the bare bank: "does
not look distorted or stretched anywhere", match 10 of 10, `gemini/r3-texture.txt`). For steep ground the material
also lays each texture from the two sides and mixes the three by which way the ground faces (triplanar), which only
takes over from about 40 degrees; and the "Earth on steep parts" slider lets bare earth show through, patchily, from
a chosen angle. With the grid ON, Gemini does keep calling the slope "stretched": what it is looking at is the grid's
squares, which are 5 ft from above and therefore longer down the slope. That is what a top-down grid has to do.

## Rock faces

Per edge, the same height change can be a grass bank or a rock face (scene C; the "Rock faces" menu turns every edge
or none). I used BOTH things the brief offered: the face is the same computed ground stood up at 76 degrees, broken
into buttresses by noise, painted with a generated rock texture (`tex/ground-rock-face.webp`: layered rock seen
side-on, free Codex route; `ground-rock.webp` on what little faces upward), and generated rock pieces are pushed into
its foot: the pilot's scree and a new boulder. The pilot's cliff chunk is NOT used: small, it read as "square blocks
of turf", and beside the face Gemini called it a "square-cornered block". Gemini on the face: "painted-on ... a smooth,
curved surface with a rock texture applied to it". A height field cannot overhang or crack; that is its limit.

## Pieces used

- From the pilot: scree (fine), mound (not used in the end), cliff chunk (dropped, above).
- Library (outdoors-02 and inn): five small trees, four bushes, low hedge, dry-stone wall and pier, post-and-rail
  fence, log seat, square pillar, stone stairs, raised hearth, flagstone floor, packed-earth path.
- New for this demo, plates by the free Codex route through the project's gates, meshes on fal TRELLIS.2:
  `rock-boulder` (fully painted, used everywhere), `rock-table` (fully painted, flat top over 66 % of its footprint;
  came out 1.9 ft tall instead of 4, stretched 1.7 times; the pawn in scene A stands on it), `rock-cluster` (51 % of
  its visible surface unpainted: rejected, not used).
- Textures, free: `ground-rock-face`, `ground-rock`, `ground-earth-bank` (came out terracotta; pulled toward brown
  in the material).

**Spend: $0.90 on fal** (three meshes at $0.30; one of them wasted). No RunPod. Cap was $3.

## Default settings, and why

| control | default | why |
|---|---|---|
| Bank angle | 30 degrees | The pilot's target; 10 ft takes 17 ft of run. Steeper saves ground but 45+ starts to look built. |
| Edge softness | 1.2 ft (rounded over about 3 ft) | At 1.5 with nothing else Gemini said "bathtub", "pudding"; at 0.7 "unnaturally sharp, hard edge between the flat top and the slopes". The bank is pushed out by the same amount so the terrace stays level to its edge and pawns on edge cells do not tip. |
| Corner rounding | 2.5 ft | Takes the square off the plateau's top edge without eating a 10 ft summit. |
| Surface roughness | 0.6 | The foot of the bank wanders up to 2.6 ft, the angle varies by a quarter, small lumps. Gemini's main complaint is evenness ("perfectly uniform", "symmetrical"), so this sits above the middle. Terraces stay flat. |
| Rocks and plants | 50 % | The one thing Gemini praises ("doing a lot of heavy lifting to make the scene look less like a sterile 3D primitive"). |
| Earth on steep parts | 0.35 | Shows nothing at 30 degrees; earth appears from about 45, so it comes in when the angle slider goes up. |
| Sun | the house rig (37 degrees up) | Kept so the numbers compare with the pilot. A "Higher sun" box (62 degrees) is there because the far slope goes nearly black under the house sun; it did not change Gemini's scores (round 4). |
| Sun shadows | off | As the pilot. See the hollow below. |

## Gemini (gemini-2.5-pro; blind first, then the pilot's own questions, then "what gives it away")

Final settings, house light, round 3 (`shots/r3`, `gemini/r3-*.txt`). Scores are "one continuous landform", 0 to 10,
table view / low view. The range column is every round I ran on that scene (four rounds while tuning, so it also
shows how much Gemini's number moves on its own: about 2 points either way).

| scene | blind read | table / low | range over rounds (table; low) | verdict | accept at a glance | pilot, nearest scene |
|---|---|---|---|---|---|---|
| A plateau | "a large, smooth, rounded hill or plateau rising from the center of the plane. The grid lines visibly wrap around its curved surface" | 6 / 3 | 6 to 8; 3 to 4 | mostly continuous with visible seams | mostly | plateau 2 / 5, "separate objects" |
| B tiered hill | "a large, gently sloping, irregularly shaped hill" | 6 / 3 | 4 to 7; 2 to 3 | mostly continuous with visible seams | mostly | hill 4 / 2; piled hill 3 / 4 |
| C cliff | "a raised hill or plateau with a gentle slope on most sides and a steep, sheer cliff face on one side" | 8 / 4 | 4 to 8; 2 to 4 | mostly continuous with visible seams | yes | cliff 2 / 3, "separate objects" |
| D hollow | "rolling, grassy terrain with smooth hills and a large, bowl-shaped depression or hollow in the center" | 4 / 2 | 2 to 6; 2 to 7 | mostly continuous with visible seams | mostly | none |
| E temple | "the central hill"; pawns "midway up the hill", a structure "at the top of the hill" | 6 / 3 | 4 to 7; 1 to 3 | mostly continuous with visible seams | mostly | none |

Read this with two cautions. First, the pilot's questions ask about "pieces" and "seams", and Gemini obliges: it
reports seams "between the straight slope and the rounded corner piece" on ground that is one mesh with no pieces.
What it is pointing at is real, though: the line where the bank meets the lawn, and the line of the terrace's
shoulder. Both are changes of shading, strongest at a low angle. Second, the bare plateau (no grid, pawns or
dressing) scored 4 / 6, with "an extremely dark, hard-edged shadow" named as the seam: that is the side of the bank
facing away from the house sun.

The hollow: without cast shadows a pit and a mound look alike from above, and in two rounds Gemini judged the hollow
as a raised rim. With "Sun shadows" on, the same scene went from 4 to 8 at table distance (`gemini/r2s-hollow.*`).
One sample, but it fits: sunken ground needs shadows to read.

**What still gives it away** (the adversarial question, 8 of 10 artificial on every scene, 9 on the temple with the
higher sun), in Gemini's order:
1. The shape is too even: one smooth slope at one angle all the way round, "like a soft brush in a terrain editor".
2. No small relief: "the grass is a flat picture", earth patches and the path are "painted on", nothing is worn in.
3. The grid drapes over it "with mathematical perfection".
4. Scatter sits on the ground, not in it: no disturbed earth or build-up round a rock.
5. The grass tile repeats visibly on the lawn at this size.
6. The rock face is a painted smooth surface, not rock geometry.

## Pawn base on slopes (a separate idea, behind one toggle)

Two yellow figures on the bank itself (25 degrees there). Gemini blind (`gemini/r3-slopepawn.blind.txt`): the one on
the level 5-ft disc "stands on a base shaped like a semi-circle ... looks like it has been cut in half" (the uphill
half is inside the hill); the one with no disc has "a translucent, yellow, oval-shaped ring on the ground" and "looks
like it is sunken into the ground rather than standing on top of it" (its feet are set 0.12 ft into the surface, and
a capsule has no feet). Told what the two are (`r3-slopepawn.judge.txt`): disc "clipping into and buried by the
grassy hill ... the downhill side is hanging in the air"; ring "conforms to the contour of the ground", "far more
believable", still reads clearly as the piece's space. BETTER: the ring. No humanoid mini exists in the library, so
the figure is a capsule.

## What I would try next (not done)

1. Break the evenness at the source: let a terrace edge carry two or three bank profiles (gentle, steep, stepped)
   chosen by seed along its length, and add shallow gullies down the bank.
2. Give the ground small relief: a normal map generated with each ground texture, so grass and earth catch the light.
3. Seat the scatter: darken and lift the ground a little round each rock (a painted skirt in the ground material).
4. Sun shadows on by default outdoors, and a higher sun.
5. Use two or three grass tile variants on large lawns (the library has v2 to v4).

## Files

`viewer/` the page; `deploy.sh`; `shoot.py`, `judge.sh`, `live_check.py`; `test_terrain.mjs`; `read_verdicts.py`;
`gen_rock.py` (textures); `rocks_spec.py` -> `assets.json`, `rocks_fal.py` (rock meshes; `fal/manifests/`);
`gemini/` prompts and every answer (`r1` to `r4`; `r2s` = sun shadows, `r3bare` = no grid or dressing, `r4` = higher
sun). Binaries (textures, plates, meshes, shots) are git-ignored and stay on the build box.
