# Graphics presets and switches: what each one costs (2026-10-11, measured the night of 10-11)

What was built is in docs/UI.md, "Graphics: what the picture costs". This file is the numbers.

- **Machine:** the build box, RTX 3060, headless Chromium (ANGLE on Vulkan), no vsync, no frame-rate limit. Not a Mac.
- **Window:** 1920 × 1080 CSS pixels. Pixel ratio 1 = 2.1 megapixels; pixel ratio 2 = 8.3 megapixels (a 16-inch MacBook Pro at 2× is 7.7).
- **Scenes:** "room" = one common room (6 fire lights, one casting a shadow) with a pond beside it; "town" = the megamap town plan at 104 rooms (about 100 fire lights), table view.
- **GPU time:** `EXT_disjoint_timer_query_webgl2` round the whole frame (the game's own timer, `tw.gfx`), the mean of 120 frames with the slowest 5% dropped. Each case 4 times, interleaved; the table gives the LOWEST of the four (another process on the card can only add time).
- **Load:** the room at ratio 1 ran with a load average of 10 to 24 and other browsers on the card (read ±0.4 ms). Everything from the room at ratio 2 onward ran on a quiet box (load under 3, every run "quiet").
- Scripts: `measure.py` (built on the megamap harness `experiments/2026-10-06-megamap/mm.py`; texture memory from the asset-cost work's `glwrap.js`), `show.py results/measure.jsonl`.

## Presets: GPU ms a frame

| | room, ratio 1 | room, ratio 2 | town 104, ratio 1 | town 104, ratio 2 |
|---|---|---|---|---|
| High (the full look) | 3.0 | 7.6 | 17.9 | 55.9 |
| Medium | 2.2 | 5.3 | 8.4 | 9.0 |
| Low | 1.3 | 1.7 | 4.6 | 5.3 |

On the town the frame is also bound by JavaScript: 27 to 28 ms a frame whatever the preset at ratio 1 (the megamap work's subject). At ratio 2 High is bound by the card (56 ms); Medium brings it back to the JavaScript floor.

## Each switch, from High: change in GPU ms a frame

| switch | room, ratio 1 | room, ratio 2 | town, ratio 1 | town, ratio 2 |
|---|---|---|---|---|
| (High itself) | 2.7 | 7.6 | 17.9 | 56.3 |
| Real lights: none | +0.2 | 0.0 | −10.0 | **−45.6** |
| Real lights: nearest 4 | +0.1 | +0.4 | −8.8 | −43.9 |
| Real lights: nearest 8 | +0.2 | +0.2 | −8.7 | −43.0 |
| Real lights: nearest 16 | +0.4 | +0.9 | −8.6 | −40.2 |
| Shadows from fires off | 0.0 | −0.2 | −0.3 | 0.0 |
| Contact shadows off | −0.8 | **−3.2** | −1.5 | −5.1 |
| Fog off | −0.3 | −0.5 | −0.4 | (+1.2: noise) |
| Soft effects at half resolution | −0.5 | −1.3 | −0.7 | −1.5 |
| Fire steady | 0.0 | −0.2 | −0.2 | (noise) |
| Water plain (a pond in view) | 0.0 | −0.4 | (no water) | (no water) |
| Render resolution 1.5× | | −2.8 | | −20.5 |
| Render resolution 1× | | −4.8 | | −38.1 |
| Lighting effects off (the whole post stack) | −1.7 | −4.8 | +4.3 | +5.1 |
| not switches, measured for the record: bloom off | 0.0 | −0.7 | −0.1 | (noise) |
| edge smoothing (SMAA) off | (noise) | −0.3 | 0.0 | (noise) |
| nothing selected (3 things selected in every other row) | (noise) | 0.0 | 0.0 | (noise) |

What the table says:
- **On a big map the lights are the cost.** A pool of 8 real lights takes the town at ratio 2 from 56 ms to 13. The pool size hardly matters between 4 and 16 (12.4, 13.3, 16.0 ms), so the pool is 8 in Medium and 4 in Low.
- **In one room the pool costs a little** (up to +0.9 ms at 16): black stand-in lights still run the light loop. That is why High keeps "every flame".
- **Contact shadows are the dearest pixel-bound effect**: 3.2 of 7.6 ms in a room at ratio 2. Half resolution gives back 1.3 of that.
- **Render resolution is the lever on a 2× screen**: about a third off at 1.5×, two thirds at 1×.
- **The fire's shadow, the flicker, the fog, water, bloom, edge smoothing and the selection signs are each under 0.7 ms.** The selection signs cost nothing measurable.
- **"Lighting effects off" is not a saving on a big map** (+5 ms): without the post stack the lit picture is drawn straight to the 4×-multisampled canvas.

## Render-target memory (textures that are not images), MB

| | room, ratio 1 | room, ratio 2 | town, ratio 2 |
|---|---|---|---|
| High | 220 | 839 | 822 |
| Medium | 198 | 433 | 423 |
| Low | 101 | 97 | 97 |
| High with contact shadows off | 104 | 374 | 358 |

The contact-shadow pass holds more than half of it (465 MB at ratio 2). Off, its buffers are given back.

## Toggle hitch: the longest gap between frames in the second after a switch (5 s for the lights), ms

| | room, ratio 1 | room, ratio 2 | town, ratio 2 |
|---|---|---|---|
| a usual frame there | 4 to 8 | 7 to 8 | 28 to 65 |
| every switch except the lights (first time, back, again) | 9 to 26 | 15 to 30 | 105 to 169 |
| Real lights: a new pool size, first time | 16 to 91 | 24 to 29 | 120 to 174 |
| back to every flame | 18 to 164 | 142 to 308 | 165 to 176 |
| the same size again | 10 to 20 | 24 to 26 | 88 to 111 |
| preset Medium / Low (first, back, again) | 14 to 25 | 9 to 25 | 97 to 180 |

- No switch compiled a program in the frame it was flipped (program counts in `results/measure.jsonl`: unchanged for every switch but the lights, +1 to +2 for a pool size, built in the background).
- The worst case is going back to "every flame" in a room at ratio 2: one gap of 0.3 s. On the town every gap is two to three of its own (slow) frames.
- Before this work a change in the light count froze the town for seconds (0.75 s at a table view, 14 s zoomed out: `experiments/2026-10-06-megamap/FIXES.md`).

## The idle rate (vsync on, 60 Hz, High, ratio 1)

| | pictures a second | GPU ms a picture | GPU ms a second | card busy (nvidia-smi, this process) |
|---|---|---|---|---|
| town, full rate | 45 | 18.1 | 818 | 74% |
| town, idle 30 | 30 | 18.2 | 546 | 55% |
| town, idle 20 | 20 | 18.8 | 380 | 37% |
| town, idle 10 | 10 | 29.2 | 292 | 33% |
| room, full rate | 60 | 5.2 | 313 | 37% |
| room, idle 20 | 20 | 13.2 | 264 | not read |
| room, idle 10 | 10 | 15.6 | 156 | not read |

- **Town: the card's load halves at 20 a second** (74% to 37%).
- **Room: the timer says a picture costs more when fewer are drawn** (5 ms at 60 a second, 13 at 20), so GPU ms a second fall only 16% at 20 and 50% at 10. The asset-cost measurement saw the same. Cause not established. Guess (50%): the card slows its clock when lightly loaded, so the same work takes longer and the heat still falls. The room's "card busy" was not read at idle; that reading would settle it.
- **First picture after a pointer move while idle:** 4 to 28 ms in the room (median 23), 23 to 43 ms on the town: one display frame plus the frame itself. The loop never sleeps, so nothing waits for a timer.

## What to expect on a Mac (expectation, not measured)

- A MacBook Pro's screen is 120 Hz. Before this work the game drew 120 pictures a second for ever. With the 60 limit and the idle rate of 20 a still table draws a sixth as often. This is very likely the largest part of "cooks the GPU" (75%).
- Ratio 2 there is 7.7 megapixels, close to the ratio-2 columns here. Which is faster, an M4 Max or an RTX 3060, is not known for these passes; Apple's tile-based card is said to pay more for many small passes (the fog simulation, the post stack's copies).
- The GPU timer is expected in Chrome on a Mac and absent in Safari and Firefox. Without it Auto judges by frame times only, and the FPS meter shows no GPU figure.
- Auto's thresholds (45 frames a second, 12 ms of GPU time) were chosen on this box.
