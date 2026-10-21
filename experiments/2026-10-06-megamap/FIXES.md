# Big maps made fast, and the hand comes first: what was built and what it bought (2026-10-06, evening)

Follows `README.md` in this folder (the measurement of where the frame goes on a big map). Harry read it and asked for all
three fixes, the fog checked "just to be sure", and priority for pan / rotate / mouse actions. This is the before and
after. Branch `perf`; how each thing works is in `engine/LAB_NOTES.md` (2026-10-06, night); how it behaves, in `docs/UI.md`
("Big maps: far rooms sleep, and the hand comes first").

**Every number here is for the build box (RTX 3060, i5-10400F, headless Chromium on Vulkan, 1920x1080, uncapped), not for
Harry's M4 Max MacBook.** Nothing here measures a Mac. And the box was badly shared tonight: three other agents ran browser
suites all evening, the load average was between 5 and 26 (it has 12 threads) and another process was on the graphics
card during every single timed run, so every figure carries a star. What can be trusted is the COMPARISON: before and
after were measured in turn on the same maps within minutes of each other (old code, new code, old, new), and each fix
against its own baseline in one page. Where two figures are given, "53 (78)", the first is the best run and the second
the worst; the best run is the least disturbed one and is the one to read. Treat any single figure as good to about 20%,
and expect a quiet box to do somewhat better than every "after" number below.

## Summary

Same test towns as the README (80 ft lots, seven building kinds, about 7.5 rooms and 265 objects a building, house fog,
house lighting and fire). "Before" is main as it stood this morning (bb14488, the code the README measured), served with
tonight's measuring scripts; "after" is branch `perf`. Milliseconds a frame, all measured.

| rooms | default: before | after | quarter of the map: before | after | whole map: before | after | panning: before | after |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 15 | 15 (31)* | 10 (18)* | 15 (31)* | 9 (17)* | 20 (32)* | 13 (26)* | 18 (47)* | 9 (21)* |
| 52 | 59 (75)* | 20 (37)* | 69 (83)* | 26 (51)* | 108 (128)* | 43 (92)* | 55 (94)* | 25 (56)* |
| 104 | 154 (204)* | 27 (36)* | 210 (267)* | 44 (56)* | 270 (360)* | 77* | 173* | 37* |
| 203 | 227 (426)* | 53 (78)* | 335 (629)* | 102 (179)* | 405 (717)* | 143 (267)* | 230 (481)* | 52 (93)* |

**405 rooms (54 buildings, 14,189 objects), after only** (one take, fog as shipped): default 74 (126)\*, a quarter of the
map 302 (404)\*, the whole map 291 (344)\*, panning 147\*. The old code was not run at this size tonight; the README
measured it this morning on a quieter box at 473 to 506, 1,433 and 944 to 1,027. So the table view is about six times
faster there and no longer follows the size of the map much (53 ms at 203 rooms, 74 at 405); the far views still do.

How many times faster (best run against best run):

| rooms | default | quarter | whole map | panning |
|--:|--:|--:|--:|--:|
| 15 | 1.4 times | 1.7 times | 1.5 times | 2.0 times |
| 52 | 2.9 times | 2.7 times | 2.5 times | 2.2 times |
| 104 | 5.7 times | 4.7 times | 3.5 times | 4.7 times |
| 203 | 4.3 times | 3.3 times | 2.8 times | 4.4 times |

**The limits, read off those figures (measured at the sizes above, the crossing points read off between two sizes):**

| | 60 frames a second, before | after | 30 frames a second, before | after |
|--|--|--|--|--|
| default view (the table) | about 15 rooms, 2 buildings, 640 objects | about 40 rooms, 5 buildings, 1,400 objects | about 30 rooms, 4 buildings, 1,100 objects | about 125 rooms, 17 buildings, 4,400 objects |
| a quarter of the map | about 15 rooms | about 30 rooms, 4 buildings, 1,100 objects | about 28 rooms | about 70 rooms, 9 buildings, 2,500 objects |
| the whole map | under 15 rooms | about 20 rooms, 3 buildings, 700 objects | about 20 rooms | about 40 rooms, 5 buildings, 1,400 objects |

(The README, on a quieter box this morning, put the old limits at 15 rooms for 60 and about 40 rooms for 30 at the default
view. Tonight's "before" is a little worse than that, which is the box; the "after" figures suffer the same.)

- **At the table view a 200-room town went from 4 frames a second to about 20** (227 ms to 53; 39 to 48 in the run that
  measured the fixes one at a time), and a 100-room one from 6 to about 37 (154 ms to 27).
- **What a loaded map costs straight after loading changed more than that.** Before, the default view at 203 rooms ran at
  278 to 304 ms for the first three to four minutes (1,033 to 1,045 things still waiting to be seated on their table tops,
  188 s and over 240 s to run out); after, 62 to 97 ms with the queue empty in 2 to 4 s. That was the README's "slow
  state" (below).
- **Loading 203 rooms** (a cold browser on the local relay, one take each, a busy box): every mesh in after 19.6 s before
  and 9.8 s after; the longest single freeze while loading 2.9 s before, 0.34 s after.
- **Nothing changed in the picture at rest.** Stills of one frozen instant with all four fixes off and on, at nine views:
  the difference is never larger than the difference between two stills of the same code (table below).
- **The whole-map view is still slow on a big map** (143 ms at 203 rooms): everything is in view there, so nothing sleeps.

## What was built, in the order of the README's list

Each fix has a switch (`tw.perf.set({ ... })`, `?perfoff=<name>`, `?perf=off` for all; the list is `AreaWorld.PERF` in
`engine/client/world.js`). Off is the old code path, which is how each was measured in one page against its own baseline
and how one is backed out without touching the others: set its word to `false` in `PERF`, or revert its commit.

1. **`aoList`: the contact-shadow pass no longer re-draws the scene.** It still does exactly what it did (keep contact
   shadows off flames, rugs, labels and glass), from a list of the see-through things instead of six walks over the
   whole scene. Not "the mode switched off": the picture is the same.
2. **`sleep`: far rooms are out of the scene.** The unit is the room, so that at the edge of the view only the near rooms
   of a building are awake. Awake whenever any part of the room's box is within 40 ft, measured along the ground, of what
   any camera on the area sees (main view, picture-in-picture, an area picture); woken in the same frame, before it is
   drawn; asleep again after 1.5 s more than 50 ft outside every view. **Why 40 ft:** it is as far as anything of an unseen
   room reaches into the picture. A fire's light and its shadow carry 30 ft at the house look, so within 40 ft of the view
   every wall that could shade something visible is there; and it leaves room for the one frame by which a waking fire's
   flame follows. Pawns, loose things, pings, selection signs and the LIGHT of every fire never sleep.
3. **`shadowList`: the fire's shadow is drawn from the things within its light's reach,** not by walking the whole scene
   for each of its six faces. Same shadow: nothing farther than the reach could be drawn into it. **`freeze`: world
   positions are worked out only for what moved** (one test per thing; three.js did every node on every draw).
   **And the slow state: found and fixed** (next section).

**The fixes one at a time** (branch `perf`, one page per size, every switch off, then on one after another; ms a frame).
The first row is not the "before" column above: it already has the fixes that have no switch (the seating queue, decals,
labels, the lists of rooms).

default:

| each row adds to the one above | 15 rooms | 52 rooms | 104 rooms | 203 rooms |
|--|--:|--:|--:|--:|
| every switch off | 17 (23)* | 94 (125)* | 102 (144)* | 207* |
| and the contact-shadow pass draws from a list | 11* | 45 (66)* | 75* | 133* |
| and far rooms sleep | 11 (13)* | 50* | 54 (90)* | 50 (90)* |
| and the fire's shadow is drawn from a list | 11 (14)* | 30 (42)* | 48 (68)* | 39 (91)* |
| and world positions only for what moved | 10* | 33 (41)* | 31 (47)* | 48 (98)* |
| (not shipped) and far fires go dark | – | – | 43 (55)* | 58 (93)* |

quarter:

| each row adds to the one above | 15 rooms | 52 rooms | 104 rooms | 203 rooms |
|--|--:|--:|--:|--:|
| every switch off | 15 (19)* | 85* | 126 (183)* | 251* |
| and the contact-shadow pass draws from a list | 12* | 56 (68)* | 93 (101)* | 189 (206)* |
| and far rooms sleep | 11 (13)* | 47 (61)* | 90 (119)* | 136 (182)* |
| and the fire's shadow is drawn from a list | 11* | 36 (45)* | 62 (72)* | 129 (235)* |
| and world positions only for what moved | 10* | 37 (62)* | 53 (66)* | 102 (199)* |
| (not shipped) and far fires go dark | – | – | 54 (86)* | 100 (136)* |

whole:

| each row adds to the one above | 15 rooms | 52 rooms | 104 rooms | 203 rooms |
|--|--:|--:|--:|--:|
| every switch off | 20 (23)* | 101 (137)* | 144 (228)* | 313 (377)* |
| and the contact-shadow pass draws from a list | 14* | 73 (87)* | 125 (146)* | 206 (260)* |
| and far rooms sleep | 15 (18)* | 66 (76)* | 126* | 195 (252)* |
| and the fire's shadow is drawn from a list | 14 (16)* | 75* | 108* | 162 (217)* |
| and world positions only for what moved | 13* | 63 (75)* | 83* | 157 (193)* |
| (not shipped) and far fires go dark | – | – | 88 (114)* | 148 (162)* |

(The last row is not shipped: see "What is still slow". Its figures here were taken while its shaders were being compiled
and are worse than the 35 to 38 ms measured for it at 203 rooms once they were.)

### The slow state (about 400 ms instead of 200 at 203 rooms): cause found

The README guessed a dirty flag that stuck. It is not that. Things that stand on other things (a mug on a table) are
seated on the real surface by a queue, 3 ms a frame. For every thing it seated, the queue asked the game for "the things of
this room", and the game answered by filtering every thing in the area: 7,000 at 203 rooms. So on a big map the queue ran
for minutes after loading (measured tonight on the old code: 1,033 things still waiting when everything had loaded; 188 s
to run out, and in the second take not done after 240 s). Every thing it seated moved a little, the lighting stack's
"something moved" signature is a sum over every thing in the area, and "something moved" redraws the fire's shadow EVERY
frame instead of every other one, by walking the whole scene six times. That is the 400 ms; it "went away at the next
lighting change" in the README only because the queue happened to run out about then.

Fixed three ways: the game keeps an index of things by room (the queue now empties in 2 to 4 s at 203 rooms); "something
moved" is asked only of the things within the light's reach; and the measuring scripts wait for the queue before timing
(`mm.wait_seated`). `fx.stats().shadow_why` now counts why the shadow was redrawn (motion, dirty, dance, timer).

### Found by profiling after the three, and fixed with them (no look change)

- **See-through floor decals** were double-sided two-pass materials. three.js marks such a material changed for each of its
  two draws, so its shader program was looked up again four times a frame for every decal: about 12 ms a frame at 203
  rooms. One pass draws the same picture (a decal is one flat plane).
- **Room labels** filtered every entity and touched one page element per room in the area every frame, on screen or not:
  6 ms at 203 rooms, now 0.6.
- **The fog's level, the floor under the pointer, the level meter's range, the building in focus, pawns for the water and
  the drop lines, the GM's hidden things:** each walked every entity or every thing, every frame or every pointer move. They
  are worked out once per state now. This is what took the game's own event code for one pan event from 40 ms to 0.1 at
  203 rooms (table under "The hand").
- **A lantern lost its glow to another lantern.** Lanterns of one kind share a material and each wrote its own glow into it
  every frame; with far rooms asleep, a sleeping lantern switched a lit one in view off. Found by the before / after stills
  (0.15% of the pixels, all on two lanterns; Gemini named the object from an enlarged crop). It was already happening
  between a lantern in view and one hidden by the cut. The glow is now on if any of them is alight.

## The picture: before and after

`perf_shots.py`: time stands still (`tw.freezeTime`), then one still with the switches off (A), on (B), off again (A2).
A against A2 is the noise between two stills of the same code (the fog and the water still stir a little). Share of
pixels that differ by more than 8 of 255 in any channel; final code, all four switches together:

| view | A against B | A against A2 (noise) | Gemini, blind ("are these two pictures different, and how") |
|--|--:|--:|--|
| 203 rooms, default (126 rooms asleep in B) | 0.000% | 0.001% | identical |
| 203 rooms, a quarter of the map (16 asleep) | 0.001% | 0.001% | identical |
| 203 rooms, the whole map | 0.000% | 0.000% | "different": only the shapes of the flames |
| 52 rooms: the inn, a hearth, a pond and a river, a pawn, a selected table | 0.000% | 0.000% | "different": only the shapes of the flames |
| the inn's hearth, close | 0.001% | 0.007% | "different": only the shapes of the flames and the water's highlights |
| the conservatory (glass, fountains) | 0 (byte-identical) | 0 | identical |
| the crypt chapel (torches, candles) | 0.003% | 0.014% | identical |
| the whole 52-room map | 0.000% | 0.000% | (not asked) |
| the inn with the fog sea on | 0.000% | 0.001% | identical |

Where Gemini said "different" it named the flames, and the pixel numbers say the flames differ just as much between two
stills of the same code; where measurement and Gemini disagree, measurement decides (the project's rule). For fix 1 alone
(earlier in the evening, five views) Gemini answered "identical" five times of five.

## Fog, "just to be sure"

House atmosphere as shipped (`atmos-harry-v2`) / no fog at all (`clear`) / the house fog with the fog sea on (0.75); ms a
frame, before and after the fixes, at each view and while panning:

| rooms | code | default: fog / none / sea | quarter | whole map | panning |
|--:|--|--|--|--|--|
| 15 | before | 15 (31)* / 14 (35)* / 17 (23)* | 15 (31)* / 18 (31)* / 18 (29)* | 20 (32)* / 22 (50)* / 18 (31)* | 18 (47)* / 14 (27)* / 14 (35)* |
| 15 | after | 10 (18)* / 8 (19)* / 13 (21)* | 9 (17)* / 9 (21)* / 13 (19)* | 13 (26)* / 12 (26)* / 13 (21)* | 9 (21)* / 10 (19)* / 5 (17)* |
| 52 | before | 59 (75)* / 63 (80)* / 54 (90)* | 69 (83)* / 76 (94)* / 64 (90)* | 108 (128)* / 94 (148)* / 105 (159)* | 55 (94)* / 53 (97)* / 70 (121)* |
| 52 | after | 20 (37)* / 19 (31)* / 19 (38)* | 26 (51)* / 23 (49)* / 26 (45)* | 43 (92)* / 37 (93)* / 45 (93)* | 25 (56)* / 16 (41)* / 17 (52)* |
| 104 | before | 154 (204)* / 157* / 126 (184)* | 210 (267)* / 148 (214)* / 162 (198)* | 270 (360)* / 254* / 233 (335)* | 173* / 158* / 163 (216)* |
| 104 | after | 27 (36)* / 22 (28)* / 31 (53)* | 44 (56)* / 37 (44)* / 46* | 77* / 70 (76)* / 70* | 37* / 29 (33)* / 37 (42)* |
| 203 | before | 227 (426)* / 219 (362)* / 216 (339)* | 335 (629)* / 348 (529)* / 323 (530)* | 405 (717)* / 396 (665)* / 395 (699)* | 230 (481)* / 227 (423)* / 254 (395)* |
| 203 | after | 53 (78)* / 47 (73)* / 51 (74)* | 102 (179)* / 82 (150)* / 96 (179)* | 143 (267)* / 124 (229)* / 137 (269)* | 52 (93)* / 66* / 55 (122)* |

- **Before the fixes the README was right: fog is within the noise** at every size and view (203 rooms, default: 227 with,
  219 without).
- **After the fixes it is no longer nothing on a big map.** With the big costs gone, taking the fog away is worth about
  5 ms of 27 at 104 rooms and 6 to 20 ms at 203 rooms (default 53 to 47, a quarter 102 to 82, the whole map 143 to 124):
  roughly a tenth to a fifth of the new frame, at the edge of what these runs can resolve. At 15 and 52 rooms it is still
  within the noise. The fog sea costs the same as the house fog, within noise.
- **Where it is:** not the simulation (its grid is fixed and follows the camera). It is two walks that grow with the map:
  every thing that could stir the fog is asked for its world position every frame (about 2 ms at 203 rooms in the
  profile), and every wall and floor is measured again twice a second to see whether the rooms changed.
- **What it would take:** small. Ask only the things near the simulation's window, and re-measure when the rooms change
  instead of on a timer. Not done tonight: it is in the tuner's shared fog code, whose own parity test runs only against
  the live site.

## The hand comes first

A frame is one piece of work on one thread, so input cannot be given priority inside it. What the hand feels is the rest
of the frame being drawn when it moved, plus the whole of the next frame. So the only things that help are a cheaper
frame and less work that is not the picture. Measured: `perf_input.py` sends real mouse and wheel events and times each
from its own timestamp to the end of the drawing of the first frame that shows it (the graphics card's own time and the
compositor come after and are not in the number).

default view: before -> after, ms (median of the events of the better of two takes; in brackets the mean frame during the gesture)

| rooms | pan | turn | wheel zoom | pawn drag | hover |
|--:|--|--|--|--|--|
| 15 | 36 (25) -> 18 (11) | 36 (21) -> 17 (12) | 84 (24) -> 35 (10) | 40 (21) -> 24 (13) | 39 (22) -> 26 (16) |
| 52 | 184 (109) -> 55 (37) | 202 (104) -> 66 (37) | 321 (100) -> 78 (24) | 218 (113) -> 52 (27) | 214 (109) -> 62 (32) |
| 104 | 297 (160) -> 58 (40) | 331 (179) -> 63 (38) | 510 (135) -> 106 (30) | 312 (155) -> 68 (38) | 312 (154) -> 99 (52) |
| 203 | 619 (312) -> 52 (36) | 639 (316) -> 68 (44) | 712 (216) -> 172 (51) | 394 (203) -> 96 (62) | 479 (231) -> 148 (73) |

quarter view: before -> after, ms (median of the events of the better of two takes; in brackets the mean frame during the gesture)

| rooms | pan | turn | wheel zoom | pawn drag | hover |
|--:|--|--|--|--|--|
| 104 | 294 (153) -> 104 (62) | 308 (158) -> 130 (73) | 430 (126) -> 146 (46) | 330 (166) -> 121 (65) | 322 (170) -> 153 (80) |
| 203 | 585 (297) -> 283 (147) | 578 (295) -> 298 (156) | 835 (228) -> 286 (86) | 603 (307) -> 306 (158) | 598 (305) -> 352 (188) |

handler time per event (the game's own event code), ms, default view: before -> after

| rooms | pan | hover | pawn drag |
|--:|--|--|--|
| 15 | 3.4 -> 0.1 | 3.15 -> 2.25 | 0.1 -> 0.1 |
| 52 | 14.2 -> 0.1 | 14.35 -> 5.05 | 0.9 -> 0.1 |
| 104 | 21.5 -> 0.1 | 19.35 -> 7.55 | 1.4 -> 0.2 |
| 203 | 40.3 -> 0.1 | 28.75 -> 9.35 | 2 -> 0.2 |

- **Everything lagged before, by about two frames, and at 100 and 200 rooms that was a third to two thirds of a second**
  for a pan, a turn, a pawn drag and hovering alike; the wheel was worse (events queue up behind long frames). None of
  them waits on anything but the frame, and the mouse pointer itself is the system's and never lags.
- **Besides the frame, the game's own event code was in the way:** 40 ms for every pan event at 203 rooms, 29 for a hover.
  It walked every entity to find the floor under the pointer and raycast every thing in the area. Now 0.1 ms for a pan.
- **A pick** (what is under the pointer, done on every move while hovering; `perf_pick.py`, 400 pointer places): 1.9, 7.7,
  14.4 and 28.7 ms at 15, 52, 104 and 203 rooms before; 0.5, 0.8, 1.0 and 0.9 ms after, with the same answers at all 400
  places. The raycast is now given only what stands near the pointer's ray (about 20 things instead of thousands), sleeping
  rooms are left out, and world positions are not worked out again when nothing has moved. The rule that a drawn floor
  stops the pointer is untouched (`browser_cut.py --floors` 37/37). (The hover figures in the table above were taken
  before this last change: its handler time there, 9 ms at 203 rooms, is now about 1.)

**What was built** (`engine/client/interact.js`; behaviour in docs/UI.md):

- **A frame-time governor.** While the hand moves (the camera changed since the last frame, a drag, a button down on the
  map, the wheel) the frame has a target of a 60th of a second. Over it, effects are shed one at a time in a fixed order,
  and each is kept only if it bought at least 5% on this machine: the fire's shadow stops dancing; the fog steps every
  second frame; things under 5 pixels on screen are not drawn; contact shadows go; on a high-density screen, and only at
  twice the target, fewer pixels. All back 350 ms after the hand stops, contact shadows fading in over 300 ms. Under the
  target nothing is shed, so a small map never changes.
- **Work that is not the picture waits for the hand:** the seating queue (0.4 ms a frame instead of 3), putting rooms to
  sleep, area pictures. A burst of changes from other seats is applied to the scene once a frame, not once per change
  (30 moves sent at once: 7 updates of the scene instead of 60). Chromium can also say when input is waiting
  (`navigator.scheduling.isInputPending`) and the same work gives way to that; Firefox and Safari have no such call, so
  there it waits for the hand to stop, which is most of it.
- **Settings ▸ Me ▸ Graphics ▸ "Lighter picture while moving"**, on by default.

**What the governor itself buys on this box: little.** One take each at 203 rooms with the switch on and off: at the
default view a pan measured the same (52 to 89 ms on, 65 to 78 off); at the quarter view 283 to 301 ms on against 347 to
362 off, perhaps 15%, which is the small-things stage (it saves draw calls). This box is limited by the processor, and the
other stages save graphics-card work. The governor is built for machines where the passes cost more, a Mac at twice the
pixel density above all, and that is not measured. What made the hand fast here is the three fixes and the event code.

**What the picture loses while moving** (stills with each stage held on, 203 rooms; share of pixels differing by more than
8 of 255 from the full picture):

| stage held on (with those above it) | default | quarter | whole map |
|--|--:|--:|--:|
| two stills of the full picture (noise) | 0.001% | 0.000% | 0.000% |
| the fire's shadow still | 0.001% | 0.000% | 0.000% |
| and the fog stepping every second frame | 0.002% | 0.000% | 0.000% |
| and things under 5 px not drawn (234 / 1,552 / 3,399 things) | 0.006% | 0.123% | 0.468% |
| and contact shadows off | 22% | 19% | 7.5% |
| put back (after the fade) | 0.009% | 0.000% | 0.000% |

Gemini, blind, saw no difference for the fog stage or after everything was put back, and for the small-things stage and
the contact-shadow stage named only the flames; the numbers say the contact-shadow stage is the one that shows (a fifth of
the pixels change, by 6 of 255 on average: the picture is a little flatter while the hand moves).

**What a player will notice.** On a small map, nothing. On a big one: the view no longer drags behind the hand by half a
second. On a machine that cannot hold a 60th of a second while moving, the picture goes a little flatter while the view is
moving (no contact shadows) and comes back softly a third of a second after it stops; zoomed far out, the smallest props
are missing while it moves.

**Not built: drawing the things under the hand in a cheaper way when the scene cannot keep up.** The dragged thing, the
selection sign and the camera all live in the one picture, and a second, cheap picture on top cannot be shown while the
main one is being drawn (same thread). The way to do it is to keep the last full picture and re-project it for the new
camera each frame, drawing the full scene only when the hand pauses. That is a real technique with a real cost (blank
edges and smearing while moving) and it was not attempted.

## What is still slow, and what it would take

1. **The lights of far fires: now the top item at the table view.** Every fire in the area has a real light and every
   shader loops over all of them: 208 at 203 rooms, of which the table view can see about 80. Measured tonight on the new
   code: with only the fires near the view lit, 55 to 67 ms became 35 to 38 ms at 203 rooms (default view). It is built
   (`lightSlots`: far fires go dark, and dark stand-in lights keep the count on a ladder of fixed sizes) **and switched
   off**, because three.js compiles its shaders for an exact number of lights, and the first time a rung of the ladder is
   outgrown every shader in view is compiled again: 0.75 s at the table view, 14.6 s when first zooming out to the whole
   map, 31 s for a 384-light rung. A freeze like that in the middle of a zoom is exactly what Harry asked not to have.
   What it would take: compile each rung in the background before using it (the browser's parallel shader compile), and
   leave the far fires dark until it is ready. Medium. Try it: `?perfon=lightSlots`.
   (The same compile freeze already happens today whenever the number of lit fires changes on a big map, a level cut away
   for instance. The ladder would cure that too.)
2. **Instancing or merging the shell (floors, walls, posts): the top item for the quarter and whole-map views**, where
   nothing can sleep. 203 rooms, whole map: 143 ms for about 18,000 draw calls. The README's estimate stands: 30 to 50% of
   that view. Large.
3. **Loading.** Tried tonight and not shipped: a queue that loads meshes nearest the view first, 24 at a time. It made the
   whole load four times longer at 104 rooms (40 s against 11 s on a busy box) because the cloning it spreads out is the
   same work. The honest version needs the cloning itself budgeted per frame. Medium.
4. **The fog's two walks** (above). Small.
5. **Whole-map view on a mega map** wants the README's item 7 (one simple mesh per far building). Large.

## Decided by me (Harry could not be asked)

- The sleeping unit is the room, not the building (less stays awake at the edge; the promise is the same).
- Wake at 40 ft, sleep at 50 ft, after 1.5 s; measured along the ground. Named constants at the top of world.js.
- Fire lights never sleep (the light-count freeze above); pawns and loose things never sleep.
- A room with something selected, hovered or dragged stays awake; one with an unconfirmed action of mine does not.
- The governor's target (a 60th of a second), its order, the 5-pixel size, 350 ms hold, 300 ms fade; a stage stays only
  for a 5% gain; fewer pixels only at twice the target and never where a move starts. Constants at the top of interact.js.
- The switch's name and place, and on by default.
- Under a test driver the shedding is off unless the test asks for it (it follows frame time, and would come and go
  inside suites about other things on a busy box).
- The first change of a frame is applied at once and later ones in the same frame wait for the next.
- Light slots and the loading queue are not shipped.
- "Before" is this morning's main (the code the README measured), not tonight's main with figures and X-ray in it; the
  "after" code has those.

## Tests

New: `engine/test/browser_sleep.py` (47 checks: asleep; in every frame of a pan, a turn, a tilt, a zoom, a jump, a level
change, a picture-in-picture and an area picture, whatever the camera that drew the frame could see was in the scene;
state arriving while asleep; selection, a click and a ping across the edge) and `engine/test/browser_interaction.py`
(40 checks). Both also pass in Firefox (sleep 43/43 before its last four checks were added, interaction 39/40 then 40/40
after a test fix), which is the confirmation that the game loads and runs there. Counts for the other suites, main before the merge against the branch
(the same box, the same evening): identical.

| suite | main | perf |
|--|--:|--:|
| core / relay / harness / roofs / wheel / framing / water (node) | 446 / 163 / 5 / 60 / 30 / 7 / 16 | the same |
| migrate / areas (node, in the main tree with its saved campaigns) | 434 / 114 | 434 / 114 |
| cut (and `--floors`) | 112 (140 with the floor checks, 37) | 140, 37 |
| storeys / stairs / roofs / rooms / tiles / build | 42 / 41 / 60 / 118 / 37 / 89 | the same |
| UI / nits / nits render / lift / follow-ons / pieces | 87 / 72 / 37 / 17 / 41 / 63 | the same |
| fly / track / chat line / two-tab / announce | 45 / 34 / 34 / 28 / 20 | the same |
| areas / figures / pawn ring | 57 / 171 (192 after the last merge) / 95 | 57 / 192 / 95 |
| settings | 66 of 67 | 66 of 67 (the same check: a player's area picture) |
| asset gate | 0 missing of 18,896 | 0 missing |
| the tuner's own: fx_ui / atmos_ui / fx_regress / smoke | not run | 17 / 55 / 12 / clean |
| sleep, interaction (new) | | 47, 40 |

Two things the first full run on the branch turned up, both fixed before the merge: the announce suite failed one check in
one run of two (announcements listen for changes, and a change held to the next frame was announced a frame late: held
changes are now announced at once, only the scene waits), and the cut suite once had a whole batch of picks land on a
hidden level (an area picture lifted the cut one frame before it was taken, an old race this work made likelier by
moving when pictures are taken: the picture is now lifted, drawn and put back inside one frame's job). The fog parity
test runs only against the live site and was run there after the deploy (below).

## Live

Merged to main (6c3489c) and deployed 2026-10-06 22:19 PDT: tuner v=20261006221936, game client v=20261006221940. On
https://turnipworks.net/ afterwards, in Chromium: the sleep suite 47/47 and the interaction suite 40/40 (each on its own
small throwaway campaign, removed); the fog parity test 11 of 12, as before the work (the one failure, P6, fails on main
too with equal printed values). The parity test compares every counter the lighting stack reports, so the new ones
(`ao_*`, `shadow_*`, `light_*`, `graph_gen`: counts of the scene round the fog) are listed there as known differences.

**Firefox:** both new suites pass in Firefox against a local relay (above). Against the live site the Firefox that
Playwright drives could not create a campaign: the relay's answer comes back from Cloudflare compressed with zstd and that
build of Firefox does not decode it ("JSON.parse: unexpected character"). That is before any game code runs and is the
same for any suite; it says nothing about Harry's own Firefox, which does decode zstd. Not looked into further.

## Files

`perf_ab.py` (one switch off and on in turn), `perf_matrix.py` (every view, fog variants, the switches one at a time;
`TW_MM_REPO` serves the old code with the new scripts), `perf_input.py`, `perf_pick.py`, `perf_shots.py` (`--std`,
`--shed`), `perf_load.py`, `profile2.py --chains`; results in `results/fixes-*.jsonl`. Maps were rebuilt through the GET
API on a local relay with its data on disk (`/var/tmp/tw-perf`, removed when this was written); nothing was built on the
live relay. Stills are in `results/stills/` on the box (the repo does not track images).
