# Performance: light use on a weak machine (2026-11-06, the SPEED lane)

Harry: "We are bound by the weakest PC that the party has." The first reaction most people have to Turnip Works is that it
melts their computer. A 2012 MacBook chokes, Nick says movement isn't "crisp", and an r/VTT tester's weak laptop
"struggled at times". Idle already feels fine. The target is **light use**: a player scrolling, orbiting, zooming,
hovering, selecting, putting a few things down, dragging a pawn and opening its ring. This file covers how that is
measured, what was found and what was changed. Lab notes and raw numbers are in `experiments/2026-11-06-perf/`.

## The measuring stick: `tools/perf-bench/lightuse.py`
The bench drives **real input** (mouse and key events through the browser, paced at a hand's 60 a second) through nine
phases:
- rest
- pan (right-drag)
- orbit (middle-drag)
- zoom (wheel)
- hover
- select (clicks)
- place (the bar: "barrel", three put down)
- drag (a pawn)
- ring (click a pawn, open ☰)

It runs these on three maps it builds itself (`maps.py`: a furnished two-storey inn, a 104-room town, hill country with
caves under the ground), on its own relay and static server (ports 17631/17632). The maps are built once and kept in
`~/.cache/tw-perf-bench`. Every run puts the map back as it found it.

For each phase it prints:
- the gaps between drawn frames: p50, p95 and p99, plus the long frames (over 50 ms)
- the main-thread time inside a frame
- input-to-frame latency
- GPU time a frame (from the timer query)
- draw calls, fire-shadow redraws and underground redraws
- what the governor tried
- main-thread time per piece (world.frame, fx.render, the underground, input handlers, each frame listener by name)

It writes every frame to JSON. Options:
- `--machine the front web server` drives the front web server's browser over one ssh tunnel (`remote.py`; wiki infrastructure/network/the front web server)
- `--profile` cuts the GPU frame into passes
- `--cpuprofile <phase>` takes a V8 profile
- `--configs off,on` A/B-tests the levers in one page (`tw.levers`)
- `--budget p95=..,long=..` exits 1 over budget
- `TW_PERF_CODE=<tree>` serves another tree's client, for a true before/after

`compare.py` puts configs side by side. The bench is registered in `tools/test_matrix.json` as a non-asserting bench (the
inn only, locally).

## What the front web server showed (Intel HD 4600, like a 2012 MacBook's HD 4000; 1440 x 900 at 1x)
Full report: `experiments/2026-11-06-perf/BASELINE.md`.
1. **A selected pawn cost ~130 ms of every frame, on any machine.** The ring searched for its button slots again every
   frame. Fixed: `ringlab/model.js` curveSlots is worked out once per shape about (0, 0) and moved to the anchor.
   `world.boundsOf` keeps each mesh's box until its positions change (`client/geobox.js`). Test:
   `engine/test/ring_frame_cost.test.mjs`.
2. **Auto kept High on the big town, at 2.5 frames a second.** At 400 ms a frame its 20 warm-up frames outlasted its 4 s
   measurement, and "nothing measured" read as "not slow". On the cave map, Medium was 117 ms against High's 133, short of the
   10% gain Auto asks for, so Auto put High back. Fixed in `client/graphics.js`: warm-up is 20 frames or a
   quarter of the time; an empty measurement is the time it ran; and one step that bought nothing gets a second step
   before Auto concludes "not the picture".
3. **Everywhere else it is the GPU, per pixel.** At Low the frame is ~60 ms of GPU: the scene ~39 ms and the final pass
   ~15 ms, both paid per pixel. The governor's stages were almost all already off at Low. Its last stage, fewer pixels,
   only ever ran on 2x screens.
4. **The underground** (cellars and caves seen faintly from above) was drawn again every moving frame: 10 ms of GPU and
   8 ms of JavaScript on the cave map.

## The levers (`engine/client/levers.js`; each is a runtime switch, `tw.levers = { name: false }`)
Each lever changes the picture only while the hand moves. At rest the picture is the same, pixel for pixel
(`engine/test/browser_levers.py` checks this).
- **dynres**: while moving, the pixel stage works on 1x screens too. It draws 3/4 of the pixels each way, never under
  0.75 per CSS pixel. (2x screens: 1.5.)
- **early**: the governor steps down before frames drop, in five ways:
  - It skips the stages that are already off for this viewer.
  - When frames are far over the target it judges a stage in 4 frames, not 8.
  - When frames are 3x the target it tries fewer pixels first.
  - The pixel stage can be learned, and what a machine's moves needed is kept in `tw.governor` (per graphics chip) for
    its next visit.
  - The very first move of a picture that is already twice the target at rest starts lean.
- **underMove**: the underground is left out while the hand moves. It fades back in over 300 ms after the hand stops.
- **shadowCache**: measured, not built (see below).

### Before and after, on the front web server (2026-11-07; `experiments/2026-11-06-perf/results/final-the front web server.*`)
All configs ran in one page per map, so the load on the machine is the same for each. Auto picked Low on all three maps.
"Moving" pools the pan, orbit, zoom and drag phases. The cells are p50 / p95 ms between frames, long frames (over
50 ms), input-to-frame p50 in ms, and GPU ms a frame. 67 ms is 15 frames a second, 50 is 20 and 33 is 30.

| map, moving | the lane's fixes, levers off | + underMove | + early alone | + dynres with early | all on |
|---|---|---|---|---|---|
| inn | 67 / 150 · 352 · 89 · 61 | 67 / 150 · 323 · 84 · 62 | 67 / 150 · 343 · 92 · 64 | 50 / 117 · 244 · 74 · 49 | **50 / 117 · 208 · 64 · 47** |
| town | 67 / 150 · 453 · 114 · 74 | 67 / 150 · 427 · 100 · 69 | 67 / 167 · 458 · 108 · 74 | 50 / 133 · 302 · 96 · 58 | **50 / 133 · 261 · 91 · 54** |
| caves | 67 / 150 · 340 · 97 · 66 | 50 / 133 · 305 · 71 · 57 | 67 / 150 · 323 · 95 · 64 | 50 / 117 · 234 · 67 · 46 | **33 / 100 · 199 · 51 · 40** |

How each lever did:
- **underMove** pays where there is an underground to see: on the caves it took 9 ms of GPU, cut input lag from 97 to
  71 ms, and moved p50 from 15 to 20 frames a second. On the inn (one cellar) it did nothing measurable. Kept.
- **early** alone does nothing at Low, because Low has nothing left to shed. Its job is to make dynres arrive in time,
  and to keep a slow machine from wasting its first second of every move on trials. Kept.
- **dynres** alone (an earlier run, `results/levers-the front web server.*`) never fired: as the fifth stage it was never reached
  inside a 1 s stroke. With early it is the big one: GPU 61 → 49 ms on the inn, long frames down by a third. Kept.
- **All on**: moving goes from 15 to 20 frames a second on the inn and the town and from 15 to 30 on the caves. Long
  frames drop by 40%. On the caves, input reaches the screen in half the time.
- **The fixes that are not levers**: the ring took a dragged pawn from 150 to 67 ms frames and its ring from 150 to 67
  (on the build box too: 167 to ~40). The Auto fix took the town from 2.5 frames a second (High) to 15 (Low).

What is still slow on the front web server, and why: even at Low and 56% of the pixels, a moving frame is ~45 ms of GPU. About 23 ms
of that does not shrink with pixels: it is the scene's ~790 draw calls and their vertices. 60 frames a second there would
need fewer things drawn, not fewer pixels. Hover, select and place are 15 a second: the camera does not move, so nothing
is shed, and a hover should not go blurry.

### The taste question: how soft may a moving picture get?
Stills: `/mnt/usb/turnip-works/lanes-2026-11-06/perf/stills/` (PNGs are git-ignored; copy of `experiments/2026-11-06-perf/stills/`: the inn and the town at High, at a pixel ratio of 1, 0.75, 0.6 and 0.5).
A blind Gemini read (`stills/gemini-blind-read.md`) ranked them correctly. It called 0.75 "nearly indistinguishable"
and fine while moving, 0.6 borderline (props and pawn labels fuzzy) and 0.5 not acceptable. **Built: 0.75**
(`DYN_K`, `DYN_MIN` in `engine/client/interact.js`). On the front web server, 0.6 would buy little: the fixed part of the frame stays.
0.5 would reach 30 a second on the inn, at the look Gemini rejected.

## Not done, and why
- **shadowCache (the fire's shadow of things that do not move, drawn once): measured, not built.** On the front web server at High
  (`results/shadow-the front web server-high.*`: the fire's shadow on and off, interleaved, two rounds each), the shadow costs
  ~15 ms of GPU a frame during a pawn drag (93 vs 78 ms). In an orbit it costs nothing (72 vs 73), because the governor
  already holds it still while the camera moves. It costs ~5 ms at rest, where it dances for the look. A perfect cache
  would save less than those 15 ms, since the dragged pawn's own shadow still has to be redrawn. And it would only help
  at High or Medium, which Auto does not choose on a machine this weak (at Low the shadow is off). Splitting a point
  light's cube map into a cached static part and a live moving part means owning three.js's shadow pass. That is not
  worth ~13% of one phase on one preset. If it is ever wanted, the cheap form is to drop the dragged pawn from the
  caster list while it is in the hand. The static map then never needs redrawing during a drag.
- The 104-room town is also CPU-bound on the front web server: ~110 ms of JavaScript a frame (the scene walk, world.frame, room
  labels). That is the megamap study's subject (wiki projects/3d-vtt/big-maps-frame-time) and a lane of its own.
- The ~26 s main-thread task seen under SwiftShader does not happen on the front web server's GPU.
