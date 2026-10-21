# Mega-sized maps: where the frame rate falls, why, and what to fix first (2026-10-06)

Measure and report only: no game code was changed. Everything here ran on a LOCAL relay and client served from the main
tree; the live relay was never touched.

**These numbers are for the build box (RTX 3060, i5-10400F, Chromium headless on Vulkan, 1920x1080, frame rate uncapped).
They are not numbers for Harry's M4 Max MacBook.** Nothing in this folder measures a Mac. The cause found here is
processor time inside the page (JavaScript and three.js walking the whole map every frame), not the graphics card, so the
SHAPE (cost grows with the size of the whole map, whatever is on screen) should carry over; the absolute frame times will
not. The M4 Max is faster per core than this box's processor, so expect the limits to sit somewhat further out there: an
estimate, not a measurement.

## Summary

Test maps are a town: 80 ft lots with 15 ft streets, a fixed cycle of seven buildings (inn, three-storey mansion with
cellar, crypt, two-storey castle with dungeon, two-storey inn with cellar, a row of small houses, a mansion wing), house
fog (atmos-harry-v2), house lighting and fire, yards with trees and fences. About 7.5 rooms and 265 objects a building.

| rooms | buildings | objects | default view, ms (fps) | quarter of the map, ms | whole map, ms | load: first picture / everything in, s | JS heap MB | GPU memory MB |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 15 | 2 | 639 | 15 to 16 (about 62) | 15 | 17 to 18 | 3.0 / 3.7 | 218 | not caught |
| 31 | 4 | 1,057 | 21 to 24 (about 44) | 22 to 25 | 32 to 53 | 3.6 / 4.7 | 287 | not caught |
| 52 | 7 | 1,835 | 42 to 75 (13 to 24) | 51 to 53 | 78 to 84 | 6.5 / 9.3 | 385 | 726 |
| 104 | 14 | 3,657 | 103 to 144 (7 to 10) | 122 to 129 | 169 to 175 | 6.5 / 8.8 | 493 | 750 |
| 203 | 27 | 7,142 | 180 to 420, mostly 200 to 310 (3 to 5) | 315 | 360 to 390 | 19.9 / 38 | 582 | 1,340 |
| 405 | 54 | 14,189 | 473 to 506 (2) | 1,433 | 944 to 1,027 | 39.5 / 62 | 733 | 1,385 |
| 802 | 108 | 27,913 | 1,083 (0.9) | 1,722 | 2,363 | 212 / 218 | 1,093 | 1,409 |

All measured. Where a range is given it is the spread of the separate runs made of that view (see "Runs" below); the
"default view" is the camera the game opens with, 110 ft from the middle of one building.

**Where the limits fall (default view, measured; the 30 fps point is read off between two measured sizes):**
- **60 frames a second: up to about 15 rooms, 2 buildings, 640 objects.** It is on the line there (15 to 16 ms against 16.7).
- **30 frames a second: up to about 40 rooms, 5 buildings, 1,400 objects** (31 rooms is 21 to 24 ms; 52 rooms is 42 to 75 ms).
  Zoomed out to the whole map, 30 is already lost at about 31 rooms.
- **Unpleasant (under 10 frames a second): from about 100 rooms, 14 buildings, 3,700 objects.** At 200 rooms it is 3 to 5
  frames a second; at 400, 2; at 800, under 1, and the map takes three and a half minutes to load.
- **Nothing breaks.** Up to 802 rooms and 27,913 objects: no lost graphics context, no tab crash, no relay refusal, no
  failed room, no load that never ends. The wall is frame time, and it arrives early.

**Why (measured at 203 rooms unless said):** the frame is spent on the processor, and its cost follows the size of the
WHOLE map, not what is on screen. At the default view the number of draw calls barely moves (1,000 at 15 rooms, 2,300 at
203, 3,500 at 802) while the frame goes from 15 ms to 1,083 ms. Each frame the page walks every one of the map's scene
nodes (47,000 at 203 rooms) ten times or more.
1. **Everything far away is still walked: 63% of the frame** (178 → 66 ms with every piece beyond 150 ft taken out of the
   scene; at 405 rooms 78%, 506 → 114 ms).
2. **The contact-shadow pass draws the whole scene a second time: 30 to 40% of the frame** (209 → 135 ms; whole map
   369 → 221 ms). Its library (N8AO) sees a see-through material somewhere, switches itself to a "transparency aware"
   mode, and from then on re-walks and re-draws the scene every frame.
3. **The fire's shadow: 20 to 30%** (whole map 376 → 302 ms; 405 rooms 473 → 336 ms), and far more when it is redrawn
   every frame rather than every other one (see "The slow state").
4. **World positions recomputed for every node three times a frame: 16 to 24%** (whole map 360 → 301 ms; default 190 → 145 ms).

The shares overlap (they are each "take this one thing away"), so they do not add to 100.

**The three to do first, and what each unlocks** (default view; frame times measured by switching the thing off in the page):

| each row adds to the one above | 31 rooms | 52 rooms | 104 rooms | 203 rooms | work |
|--|--:|--:|--:|--:|--|
| today | 23 ms | 42 ms | 105 ms* | 178 ms | |
| far buildings put to sleep | 22 | 37 | 69* | 66 | medium |
| and the contact-shadow pass stops re-drawing the scene | 20 | 24 | 41* | 41 | small |
| and static things keep their world positions | 13 | 20 | 36* | 37 | small to medium |
| and the fire's shadow limited (measured as: off) | 10.5 | 15 | 30* | 27 | small to medium |

(* the graphics card was shared during that run; read it as an upper bound. A repeat of the 203 column on a busier box
gave 222* → 83* → 49* → 42 → 33.)

- **The contact-shadow change is the cheapest and should be done first** (a setting, plus an eye check). On its own it is worth 30 to 40%
  at 203 rooms: measured there, estimated elsewhere. That moves the 30 fps point from about 40 rooms to about 55 to 60
  (estimated).
- **Putting far buildings to sleep is the one that removes the cliff.** With those two the table view holds 24 frames a second at 100 and at 200
  rooms (41 ms, measured), where today it is 5 to 10.
- **With all four, the table view is 27 to 33 ms at 200 rooms (30 to 37 frames a second) and 15 ms at 52 rooms (60).**
  Past 200 rooms the trend is flat between 104 and 203, so 400 rooms should land near 40 to 60 ms: estimated, not measured.
- **None of this fixes the whole-map view.** With the contact-shadow change, frozen positions and the shadow off together the whole 203-room map is 151 to 159 ms
  (from 360 to 390): better, still 6 frames a second. That view needs fewer pieces (instancing or merging: see the list).

**Alarming or odd:**
- Building in the GM's own tab slows with every room: the 203-room town took 558 s that way (6.4 s a room by the end)
  against 24 to 40 s through the GET API. The slowdown is in the tab, not the relay.
- The relay's room check looks at every room, so building is quadratic: 405 rooms in 153 s, 802 in 756 s; one more room
  on the 802-room map takes 1.4 s. `GET state` on that map takes 21 to 26 s.
- A pawn move is acknowledged in 66 ms on the small map and 4.6 s on the 802-room one: the relay answers in 14 ms, the
  rest is the tab waiting on its own frames.

**Not measured:** a Mac, or any second platform (WebKit cannot start on this box, Firefox timed out, software rendering
gave 7.7 s a frame on the 15-room map, which says nothing); more than one player moving at once; long sessions (leaks);
picture-in-picture views on a big map; several areas; maps past 802 rooms; a capped (vsync) run.

**Throwaway campaigns left: none.** All test campaigns ("TEST megamap N rooms (throwaway)") lived on local relays whose
data folders are gone (the first in the crash, the second removed at the end of this job). Nothing was created on the live relay.

---

## Runs: what was made before the crash and what after

the build box crashed and rebooted at about 15:33 PDT. The first relay data folder was under /tmp, which is memory-backed
here, so the test maps went with it.

| | when | what | files |
|--|--|--|--|
| before | 12:00 to 12:45 | the ladder built: 15 to 203 rooms in a GM tab, 405 and 802 through the GET API | `build.jsonl`, `build_get.log` |
| before | 12:46 to 12:50 | relay probe at 802 rooms | `relay.jsonl` |
| before | 13:16 to 15:16 | the full measurement, every view, 15 to 802 rooms | `measure.jsonl`, `measure.log`, `tables.md` (an earlier pass with the graphics card shared throughout is kept as `measure_first_pass_shared_gpu.*`) |
| before | about 15:16 to 15:29 | first take-away round at 203 and 405 rooms (far pieces hidden / removed, far lights, labels, post, fires, lowest detail) with a sampling profile | `ablate.jsonl`, `ablate.log` |
| before | 15:29 to 15:31 | profile at 203 rooms charged to whoever called three.js | `profile2-203.txt`, `profile2.jsonl` |
| before, cut off | 15:31 to 15:33 | second pass over the headline views: 15 rooms finished, 31 rooms was two views in | `measure_second_pass.jsonl` (first line), `second.log` |
| **after** | 15:40 | 15, 31, 52, 104 and 203 rooms rebuilt through the GET API on a local relay with its data on disk (38 s for all five) | `build_rebuilt_after_crash.jsonl` |
| **after** | 15:41 to 15:48 | second take-away round at 203 rooms (the contact-shadow pass, the shadow, world positions, far asleep, stacked) | `ablate2.jsonl` (first line), `ablate2.log` |
| **after** | 15:48 to 15:50 | repeat-draw counts at 203 and 52 rooms | `repeats.jsonl`, `repeats-*.log` |
| **after** | 15:50 to 15:58 | second pass over the headline views at 31, 52, 104, 203 rooms | `measure_second_pass.jsonl` (tag `second-after-crash`), `second_after_crash.log` |
| **after** | 15:58 to 16:09 | other engines (nothing usable; the 52-room software run was stopped) | `other_browsers.jsonl`, `other_browsers.log` |
| **after** | 16:09 to 16:31 | the second take-away round repeated at 203 rooms | `ablate2.jsonl` (second line), `ablate2-203-repeat.log` |
| **after** | 16:32 to 16:45 | the stacked fixes only, at 52, 104 and 31 rooms | `ablate2.jsonl` (lines 3 to 5), `ablate2-*-stack.log` |

Never run: a second pass at 405 and 802 rooms (their first pass was on a quiet graphics card); the second take-away round
at 405 rooms.

The rebuilt maps are the same town plan (same seeds) built by the relay instead of by a GM tab; the room, building and
object counts match. The game code under test is the main tree as it stood at each run: other agents merged client
changes during the afternoon (12:29 to 15:09), so the before and after runs are not on byte-identical code. Nothing merged
in that window was aimed at frame time.

### How a frame time is taken, and what the load was
- One Chromium (Playwright, the flags of `tools/spawn-tuner/test/atmos_game.py` plus no vsync and no frame-rate limit),
  1920x1080. A view is set, left 2.5 s, then timed over `requestAnimationFrame` for 2.5 s or a dozen frames, whichever is longer.
  The figure is the MEAN (wall time / frames): above about 16 ms Chromium delivers frames in pairs, so the median and p95
  of the gaps jump between modes (see engine/LAB_NOTES.md, 2026-10-06). p95 and worst gap are in `tables.md`.
- **The graphics card is shared** with other agents' browser tests and bakes. Before every timed run the script waits
  until no other process has used the card for three samples, and checks again after; a run that was disturbed is kept
  only if no quiet one could be had, and is marked `*` (`quiet: false` in the data).
- **Load on the box:** before the crash, load average 2 to 12 (mostly 4 to 6), other processes on the card 0 to 47% of
  the time. After the crash: at 15:40 the card was idle apart from a figure-plate job (`run_plates.py`, in bursts of
  about 40%); load average 3 to 6.5 during the first second round, then 5 to 19 from 16:08 (a six-process mesh check
  and Blender jobs from another agent).
- **The frame here is processor time, and the quiet check only watches the graphics card.** A busy processor slows these
  numbers too and is not flagged. That is why every take-away is measured straight after its own baseline, and why the
  ranges in the summary are as wide as they are. Treat any single figure as good to about ±20%.

## The slow state at the default view (measured, cause not proven)

At 203 rooms the default view has two states: about 180 to 220 ms and about 350 to 420 ms. The slow one appeared straight
after a lighting parameter was changed and went away at the next change, twice in the first run and once in the repeat
(baselines 346 and 406 ms, then 422 ms, between baselines of 178 to 222 ms). With the fire's shadow off both states
collapse to 150 to 190 ms. A cold load landed between the two (310 and 343* ms).

Likely cause (read from `tools/spawn-tuner/js/fx/lighting.js`, about line 179; not tested): the fire's shadow is redrawn
"every 2nd frame with shadow dance", but every frame while anything is marked moving or dirty. A shadow from a point
light is six pictures, and each one walks the whole scene. If the dirty mark sticks, the shadow costs twice as much.
Whoever takes the shadow fix should look for that first: it may be a few lines.

## Where the time goes

### Sampling profile, 203 rooms (before the crash; `profile2-203.txt`)
Share of processor time in the frame, by who asked three.js for the work:

| | default view | whole map |
|--|--:|--:|
| the main picture, shadow pictures included (`postprocessing` render pass) | 42% | 51% |
| the contact-shadow pass drawing the scene again (N8AO `renderTransparency`) | 20% | 24% |
| the same pass walking the scene to save and restore what is visible | 12% | 8% |
| browser and driver (`(program)`) | 5% | 4% |
| the game's own per-frame code, all of it | about 17% | about 12% |

The game's own code, default view, ms of a 284 ms frame: `world.js frame` 8.9, fog (`atmos.js` and its particles) 11.2,
labels 5.6, the cut 4.8, fire particles 5.7, settling 4.9, water's light list 3.4, floor lookups 1.5. None of these is a
problem at today's sizes; all of them walk every entity, so each grows with the map. Per frame the scene is traversed in
full 4.3 times and its world positions recomputed 3 times, before three.js's own walks for each picture it draws.

### Take-aways (one thing off at a time; all measured)

Before the crash, from the ladder (`measure.jsonl`) and the first round (`ablate.jsonl`):

| off | 203 rooms | 405 rooms | note |
|--|--|--|--|
| all post-processing (contact shadows, bloom and the rest) | 311 → 71 ms (after the crash) | 473 → 151 ms | −68 to −77%. 52 rooms: 46 → 19 ms |
| all fire (lights, flames, particles, and with them the shadow) | 311 → 140 ms (after the crash); whole map 391 → 230 | 473 → 285 ms | −40 to −55% |
| the fire's shadow | 343* → 153 ms | 473 → 336 ms | −29% at 405 |
| far pieces hidden (`visible = false`), beyond 150 ft | 225 → 141 ms | 506 → 265 ms | what plain culling by building would give |
| far pieces out of the scene | 225 → 72 ms | 506 → 114 ms | twice as good as hiding: hidden pieces are still walked |
| far point lights out (beyond 120 ft) | 194 → 182 ms; whole map 391 → 311 | 487 → 427 ms | small at the table view |
| labels | no change | 114 → 90 ms once far pieces are gone | grows with the map; hidden under the bigger costs |
| fog | 198* against 199 to 343* | 670 against 473 | nothing gained; fog is not a cost |
| whole map at the lowest detail tier (1,500 faces) | whole map 391 → 341 ms, triangles 88 M → 14 M | not run | −13%: triangles are not the cost here |

After the crash, second round at 203 rooms (`ablate2.jsonl`; first run, then the repeat on a busier box):

| off | default view | whole map |
|--|--|--|
| contact shadows off altogether | 218 → 139; repeat 208 → 119 | 360 → 278; repeat 402* → 269* |
| contact shadows kept, their second drawing of the scene stopped | 346 → 128 (slow-state baseline); repeat 209 → 135 | 369 → 221; repeat 579* → 238* |
| the fire's shadow | 406 → 150 (slow-state baseline); repeat 422 → 190* | 376 → 302; repeat 378* → 359* |
| world positions frozen | 190 → 145; repeat 221* → 156* | 360 → 301; repeat 362* → 333* |

### Answers to the brief's questions
- **Is there culling of what is outside the view?** Per mesh, yes (three.js tests each mesh against the camera: the default view of the
  203-room map makes about 2,300 draw calls for 16,000 meshes). Per room or per building, no. And a mesh that is
  culled still costs: it is visited, its position recomputed and tested, several times a frame. That visiting is the cliff.
- **Are detail levels used by distance?** No. The library's ladder is one tier for the whole map (Settings ▸ Me ▸
  Graphics, or `?faces=`). And on this box it would gain little: the whole map at the lowest tier was 13% faster.
  It may matter more for memory on a smaller machine: not measured.
- **How many draw calls are repeats?** At 203 rooms, whole map (`repeats.jsonl`): 15,964 meshes drawn. Grouped by same
  mesh and same material, as three.js could instance today: 7,701 (−52%). Grouped by same mesh and same picture, if
  look-alike materials were shared: 1,843 (−88%). Furniture alone: 6,299 → 1,324. The shell (floors, walls, posts):
  9,462 → 6,178 as it stands, because nearly every shell piece has its own material (5,543 materials), or → 870 if they
  were shared. The biggest single group is one wall piece drawn 504 times. At 52 rooms: 4,148 → 2,412 → 955.
- **Lights and shadow casters.** One real point light per fire (13 at 15 rooms, 208 at 203, 757 at 802), one shadow
  caster at every size. The lights themselves are cheap; the one shadow is not, because it walks the whole map.
- **Fog simulation and far fog.** Under 2 ms at every size (the simulation window follows the camera and has a fixed grid).
- **Labels and overlays, hover and drag.** Hover and drag cost nothing measurable beyond the frame (`tables.md`). Labels
  are about 2% of the frame.
- **Texture and geometry memory.** Flattens out, because meshes and pictures are shared: 1,028 textures (est. 508 MB) at
  203 rooms, 1,093 (540 MB) at 802; graphics memory of our browser 1.34 GB at 203, 1.41 GB at 802. JS heap grows
  steadily (582 MB at 203, 1,093 MB at 802): the scene nodes.
- **Relay.** Memory 63 to 96 MB with one of these maps loaded and a client attached (250 to 370 MB with the 802-room campaign being built or probed); idle processor 0.0 to
  0.2%; journal 2.7 MB and snapshot 6.5 MB at 203 rooms, 10.5 and 17.7 MB at 802. A late joiner costs the relay 0.2 s of
  processor at 203 rooms and 1.1 s at 802; the wait (13.6 s at 203, 182 s at 802) is the joiner's own tab building the
  scene. What scales badly: `room.spawn` checks (`floorUnder`, `roomWithCell`, `chooseExteriorDoor` look at every room)
  and `GET state` (`roofStyleOf` in `engine/core/height.js` took 25 of 61 profiled seconds at 802 rooms). Boot with the
  802-room campaign: 6.9 s.

Full tables for every view and size (roofs on, an upper floor with the depth look, a cellar, panning, hover, dragging a
pawn, fog off, shadows off, fires off, post off; p95 and worst gaps; draw calls; triangles; scene counts; relay): `results/tables.md`.

## Build and load

| rooms | build in a GM tab, s | build through the GET API, s | game ready, s | first picture, s | everything in, s | late joiner, everything in, s |
|--:|--:|--:|--:|--:|--:|--:|
| 15 | 3.8 | 0.9 | 1.3 | 3.0 | 3.7 | 3.4 |
| 31 | 15.0 | 1.4 | 1.3 | 3.6 | 4.7 | 6.2 |
| 52 | 28.5 | 3.0 | 2.1 | 6.5 | 9.3 | 5.7 |
| 104 | 128 | 9.1 | 2.0 | 6.5 | 8.8 | 8.6 |
| 203 | 558 | 23.9 | 4.5 | 19.9 | 38 | 13.6 |
| 405 | not tried | 153 | 10.6 | 39.5 | 62 | 56.8 |
| 802 | not tried | 756 | 29.9 | 212 | 218 | 182 |

All measured. GM-tab builds and the 405 and 802 GET builds are from before the crash, on a box with other work running;
the 15 to 203 GET builds are the rebuild after it (a just-rebooted box), so the two GET groups are not one clean series.
Loads are a cold browser joining the finished map over the local relay (no network delay; over the internet add the
download of a 6.5 MB snapshot at 203 rooms, 17.7 MB at 802).

## Recommendations, ranked by frames gained for the work and risk

Size: small = a day or less, medium = a few days, large = a week or more. "Measured" means the saving was measured by
switching the thing off or out in the page; a real fix may get a little less.

1. **Stop the contact-shadow pass re-drawing the scene. Small.** Measured −30 to −40% of the frame at 203 rooms, at every
   view; estimated similar from about 50 rooms up, little below. N8AO turns its "transparency aware" mode on by itself when
   any material in the scene is see-through; set it off explicitly (or exclude the few see-through things). Risk: contact
   shadows may show through fog, flames or glass. Needs one look by eye in the tuner; no data or netcode change.
2. **Put far buildings to sleep: take every building farther than some distance from every camera out of the scene, and
   skip it in the per-frame passes. Medium.** Measured −63% at 203 rooms and −78% at 405 at the table view; nothing at the
   whole-map view. It has to be "out of the scene", not "invisible": hiding gives half as much. Risk: everything that
   walks the scene (picking, settling, the cut, fly-away, picture-in-picture cameras, another player's cursor far away)
   must agree on what asleep means. Client only: the data and the commands do not change.
3. **Limit the fire's shadow: only the things of its own room or building cast into it, redraw it less often, and check
   the "always dirty" case. Small to medium.** Measured ceiling (shadow off) −20 to −30%, and about −55% in the slow
   state. Already suggested in engine/LAB_NOTES.md for the storeys work. Risk: low.
4. **Keep world positions of things that do not move. Small to medium.** Measured −16% (whole map) to −24% (table view).
   Risk: anything that moves must say so (drags, spawn animation, fly-away, doors); a missed case shows as a thing that
   does not move. Good test coverage exists for those.
5. **A "performance" look for big maps: post-processing off. Small (a preset).** Measured −68 to −77% at 52 to 405 rooms
   (52 rooms: 46 → 19 ms; 203: 311 → 71). It is a look decision, so it is Harry's; it is also the only thing here that
   helps today with almost no engineering, and it helps the whole-map view too (203 rooms: 391 → 177 ms).
6. **Instance or merge the shell (floors, walls, posts) per room or per building, and share its look-alike materials.
   Large.** Measured: draw calls 15,964 → 7,701 as things stand, → 1,843 with shared materials. Estimated saving: at the
   table view little once far buildings sleep; at the whole-map view 30 to 50% of what is left (16,000 draw calls at
   about 10 µs each is some 160 ms of a 360 to 390 ms frame, and the scene walks shrink with the node count). Risk:
   high. Walls are edited, cut, selected and flown away piece by piece. This is the one that touches how the shell is
   represented in the client; it does not touch the data model.
7. **Whole-map view: one simple mesh per far building (roof and outline), no furniture, no fires. Large.** Estimated: the
   whole-map frame would follow the number of buildings (27 to 108) instead of meshes (16,000 to 62,000). Nothing was
   measured for this; it follows from 2 and 6.
8. **Cap live fires by distance. Small**, once 2 exists (a sleeping building's fires sleep with it). All fire off measured
   −40 to −55%, of which the shadow is about half. Until 2 exists: estimated −10% for the particles and lights of far fires.
9. **Load far buildings lazily. Medium to large, after 2.** Estimated: first picture and "everything in" would follow the
   neighbourhood instead of the map (about 4 to 9 s instead of 38 s at 203 rooms and 218 s at 802). Not measured.
10. **Relay: index rooms by cell or by building for the spawn checks and for `GET state`. Small.** Measured cost today:
    1.4 s a room and 21 to 26 s a `state` at 802 rooms. No frame-rate gain; it is what makes building a mega map by
    script or by an AI seat tolerable. Do it before anyone builds past about 400 rooms.
11. **The GM tab's own slowdown while building. Small to medium.** Measured 0.3 s a room at the start, 6.4 s by room 200.
    Most of it is the frame time above (it eases with 1 to 4); the room solver's share also grows (45 → 849 ms a room).
12. **Detail levels by distance. Medium. Low priority on this evidence:** −13% at the whole-map view, nothing at the table.
    Revisit if a Mac or a laptop turns out to be limited by its graphics card or memory.

Not worth doing for speed: pausing the fog off-screen (under 2 ms), anything about labels, hover or drag.

### The three to do first
1. **The contact-shadow setting (item 1).** Smallest, helps every view at every size. Unlocks: 30 frames a second up to
   about 55 to 60 rooms instead of 40 (estimated from −35% measured at 203 rooms).
2. **Far buildings asleep (item 2).** Removes the cliff at the table view. With item 1: 24 frames a second at 100 and at
   200 rooms (measured 41 ms at both), and by the flat trend about the same at 400 (estimated).
3. **The fire's shadow (item 3), with frozen world positions (item 4) straight after.** With all four: 60 frames a second
   at 52 rooms (15 ms), 30 to 37 at 100 to 200 rooms (27 to 33 ms), measured with the shadow fully off, which is the
   ceiling for item 3.

After these the table view is fine to at least 200 rooms on this box and the whole-map view is still about 6 frames a
second at 200 rooms. Zooming all the way out on a mega map needs items 6 and 7, or the performance look.

### What would change the data model or the netcode
Nothing in the first five. Things to decide early, because they are hard to add later:
- **Sleep and lazy loading want a spatial unit everyone agrees on.** The building already is one (`building` on each
  room), so far this is free. Objects in the street or in open ground belong to no building: they need a rule (a grid
  cell, or "nearest building").
- **Late join sends the whole area** (6.5 MB at 203 rooms, 17.7 MB at 802). Sending the near part first, then the rest,
  would be a change to the snapshot protocol in docs/NETCODE.md. Not needed until maps pass a few hundred rooms or
  players join over slow links.
- **The relay keeps the whole campaign in one snapshot and re-checks rooms by scanning.** Item 10 is an index inside the
  relay, no protocol change.
- **One area is one scene.** A mega map split into several areas (a district each) already works with today's netcode and
  costs nothing new; it is the cheapest way to a very large world if the fixes above are slow to arrive.

## Clean-up
- Local relays (ports 18212, 18213) and local client server (18839): stopped. Data folders: the first
  (the old session's scratchpad under /tmp) was erased by the reboot; the second (`/var/tmp/tw-megamap-relay-data`,
  18 MB) was removed when this was written.
- Test writes went through `tests/tw_sandbox.py`; every run ends with "live house look and ratings unchanged".
- Live relay: nothing created, nothing read but its health.
- One software-rendering browser left over from the stopped "other engines" run was killed by hand.

## Files
- `layout.py` the town plan. `build.py` builds a size in a GM tab; `build_get.py` through the GET API. `mm.py` shared
  pieces (local relay and client, the browser, the quiet-card check, the timer).
- `measure.py` one size, every view, load, memory, relay. `report.py` → `results/tables.md`.
- `ablate.py`, `ablate2.py` (`--stack-only` for the quick form) the take-aways. `profile2.py` the profile by caller.
  `repeats.py` repeat draws. `relay_probe.py` the relay alone. `other_browsers.py` other engines.
- `run_ladder.sh`, `run_rest.sh` as run before the crash; `run_after_crash*.sh` after it. Scripts read the build record
  from `BUILD_JSONL` when set (the rebuilt maps have new seat tokens).
- The seat tokens in `results/build*.jsonl` were removed before the commit; the campaigns they opened are gone, so the
  scripts need a fresh build (`build_get.py`) before they will run again.
- `results/*.png` (pictures of the built towns) stay on the box; the repo does not track images.
