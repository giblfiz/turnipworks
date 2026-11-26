# Light use on the front web server, before the SPEED lane (2026-11-06)

Measured with `tools/perf-bench/lightuse.py --machine the front web server --preset auto --profile --idle-watch 60`, serving the
client of main as it was (`0543729f`, `TW_PERF_CODE=` a `git archive` of it). Raw: `results/baseline-the front web server-auto.{txt,json}`.

**Machine.** The front web server: i7-4785T, Intel HD 4600 (Haswell GT2, 2014; a 2012 MacBook's HD 4000 is the same family, a little
slower), Mesa's Haswell Vulkan driver through ANGLE, snap Chromium 156 headless (`--headless=new --enable-gpu
--ignore-gpu-blocklist --use-angle=vulkan --enable-features=Vulkan`), a 1440 x 900 window at 1 pixel per CSS pixel,
60 Hz. The timer query extension is there, so GPU numbers are real. The game as a new player gets it: Auto, the idle rate,
the 60 limit and the governor all live. Frame times are the gaps between DRAWN frames; on a 60 Hz display they come in
steps of 16.7 ms, so 66.7 means "missed three vsyncs" (15 a second).

## The table (p50 / p95 ms between frames; long = frames over 50 ms in the phase; GPU = mean ms a frame)

| map (Auto's pick) | rest | pan | orbit | zoom | hover | select | place | drag | ring |
|---|---|---|---|---|---|---|---|---|---|
| inn, 10 rooms, 433 things (Low) | 67 / 133 | 67 / 150 | 67 / 150 | 67 / 150 | 67 / 150 | 83 / 150 | 67 / 150 | **150 / 183** | **150 / 283** |
| town, 104 rooms, 3,700 things (**High**: Auto measured nothing) | 400 / 400 | 367 / 533 | 483 / 1000 | 400 / 767 | 383 / 450 | 317 / 533 | 333 / 467 | 283 / 433 | 300 / 600 |
| cave country, 7 rooms (Low) | 67 / 150 | 67 / 150 | 67 / 150 | 67 / 150 | 67 / 133 | 67 / 133 | 67 / 183 | **150 / 167** | **150 / 283** |

Input to the frame that shows it (p50): 75 to 175 ms on the inn and the caves, 300 ms in a drag; 400 to 1,100 ms on the town.

## The worst phases, and why

1. **Dragging a pawn and its ring, on every map: ~130 ms of JavaScript a frame, not the GPU.** One frame listener: the
   selected pawn's ring re-searched its button slots every frame (a slide-along-the-oval search, and a row too long for the
   oval re-tried at 50 grown sizes, each a new 2,048-point table; the search itself cleared that table cache). The same
   130 ms on the build box's RTX 3060. A pawn being selected at all costs it, moving or not (select: 30 ms).
2. **Auto keeps High on the big town: 2.5 frames a second.** Auto throws away 20 frames after a change before it times
   anything, inside a 4 s measurement. At ~400 ms a frame, 20 frames is 8 s: it measured nothing, and nothing measured
   read as "not slow". (On the inn and the caves it measured and chose Low.)
3. **Everywhere else: the GPU, per pixel.** At Low, ~60 ms of GPU a frame even at rest:

   | GPU ms a frame, by pass (scripted orbit) | scene (RenderPass) | final pass (tone, grade, SMAA, bloom) | underground pre-pass | fog | water | other | total |
   |---|---|---|---|---|---|---|---|
   | inn, Low | 39.4 | 14.4 | 4.4 | 2.6 | 0.9 | | 61.6 |
   | caves, Low | 38.6 | 15.1 | **10.0** | 2.5 | 0.9 | | 67.1 |
   | town, High | **317** (100 fires, every one a real light) | 15.4 | 7.2 | 11.6 | 0.9 | contact shadows 27.5, fire shadow 11.5 | 392 |

   The scene and the final pass are paid per pixel. The governor's stages (fire shadow still, fog half rate, small things,
   contact shadows) are almost all already OFF at Low, so it found nothing to shed: its trials (8 frames each, ~0.5 s of
   a slow move) bought nothing, and its last stage, fewer pixels, only ever ran on 2x screens.
4. **The underground under the ground** (cellars, caves seen faintly from above) is drawn again on every moving frame:
   10 ms of GPU and 8 ms of JavaScript a frame on the cave map while panning (none at rest).
5. **The town is also CPU-bound on the front web server**: ~110 ms of JavaScript a frame at rest (world.frame 40, fx.frame 32,
   fx.render 30). That is the big-map work of the 2026-10-06 megamap study, on a slow low-power CPU; it caps that map at
   ~9 a second whatever the GPU does. Not this lane's levers; noted.

Draw calls: ~790 a frame on the inn at Low, ~370 on the caves, 1,100 to 2,900 on the town. Fire-shadow redraws: none at
Low (off); every frame of a pawn drag at High.

## Auto on the front web server
Inn: High measured 133 ms a frame, stepped to **Low** (frames 67 ms, GPU 57 ms). Caves: High's GPU 94 ms, **Low**. Town:
**stayed High** (the measurement caught no frame: see 2). With Low on the town, the scene's lights drop from every fire to
a pool of 4. So Auto picks well where it measures, and did not measure on the one map that most needed it.

## The ~26 s main-thread task
Not seen on the front web server. 60 s of an idle page after each map's phases: the longest tasks were 347 ms (inn), 258 ms (caves),
and on the town a steady ~60 to 115 ms every ~300 ms (those are the idle-rate frames themselves: the town's JavaScript
frame is ~100 ms there). The 26 s task was seen under SwiftShader (software GL) and looks like a software-GL artefact.

## the build box, for calibration
`results/baseline-local-auto.txt`: the RTX 3060 desktop, on a box at load 25 to 45 from other lanes (so read its numbers
as upper bounds). Auto picks High on every map there. The ring cost is the same 110 to 140 ms a frame (it is JavaScript).
