# The stand-in for far fires: diagnosis and the new one (2026-10-12)

Harry on the painted floor glow under flames that are not real lights: "It's um, not good. Much much worse than nothing at this point. I do feel like this isn't hopeless, it might just need a run in a tuner and be horribly out of tune." What was built is in `tools/spawn-tuner/PLAN.md` ("Far-fire glow") and `docs/UI.md` ("Graphics: what the picture costs"). This file is the measurements.

- **Machine:** the build box, RTX 3060, headless Chromium (ANGLE on Vulkan). Load average 8 to 22 all evening (other agents).
- **Scene:** the Spawn Tuner's Far-fire glow test room: a common room with ten real lights (a hearth, a brazier, a wall torch, three lanterns, four shared candle lights of which two are chandeliers) and a guest room sharing a wall. Night lighting, clear air, flames held steady.
- **"Difference from real":** the same frame drawn three ways at one instant (every flame real; a pool with no stand-in; a pool with the stand-in), compared pixel by pixel, 0 to 255, over the lit region (where the real lights change the picture by more than 8). The panel shows the same number.
- Scripts: `tuner_glow.py` (stills, the number, where the light lands, the pop), `game_room.py` (step 1 stills in the game), GPU time with `../2026-10-11-graphics/measure.py --cases-json`. Results in `results/`, stills in `shots/` (`tuner-final-*.png`; pictures are not in git).

## The number

| pool of real lights | no stand-in | old floor disc | new stand-in |
|---|---|---|---|
| none (10 stand-ins) | mean 11.4, largest 130 | mean 73.1, largest 224 | **mean 2.8**, largest 123 (95% under 10.7) |
| 2 (8 stand-ins) | mean 10.5 | mean 71.1 | **mean 2.8** (95% under 10) |
| 4 (6 stand-ins; the lit region is 9% of the picture) | mean 9.9 | mean 19.6 | **mean 3.7** (95% under 13) |

- The old disc was six times farther from the real lights than drawing nothing. Harry's eye was right.
- The new one is a quarter as far as nothing. On the whole it is 1 of 255 darker than real.
- The largest differences sit on the flames' own holders and on the hearth, where the real light casts a shadow and the stand-in does not.
- A blind read by Gemini of the four stills (`results/gemini-blind-final.txt`): real and the new stand-in are "most alike" and both convincing; the old disc is "completely artificial".

## Each suspected culprit

| suspected | verdict | measured |
|---|---|---|
| a hard-edged disc, not a smooth falloff | **not the cause as stated** | The disc's own falloff was smooth. It read as flat because it was so bright that it saturated: along 20 ft of floor from the brazier it added about 200 of 255 everywhere, where the real lights add 18 to 31. |
| wrong brightness and warmth | **confirmed, the main cause** | Over the lit region the real lights add (29, 5, 0) in red, green, blue. The disc added (103, 94, 35): 3.6 times the red and 19 times the green. It ADDS a yellow-white colour; a light MULTIPLIES the surface (a dark red floor stays dark red). The new one adds (26, 4, 0). |
| additive stacking into white blobs | **confirmed** | Same numbers; the disc's green channel reached 248 to 255 on the open floor. New: a multiply with a soft clamp, no white pixel. |
| drawn on the floor only | **confirmed by construction** | The disc is a flat quad 0.03 ft above the floor. What it put on walls and tables (+62 to +196) was its own bloom, not light. New, against real: table top beside a candle +30 (real +37); floor 5 and 16 ft from the brazier +21 and +28 (real +21 and +27). Wall beside a sconce +3 to +14 (real +8 to +21): surfaces within a foot or two of a wall-mounted flame get a third to four fifths of the real light. |
| through walls into the next room | **confirmed for the disc; and real lights do it too** | Next room's floor, 2 to 6 ft past the shared wall: real +17 to +23 (only one fire casts a shadow; every other real light passes through walls), disc +91 to +101, new +9 to +19. Every stand-in's ring of wall distances is cut at the walls (`glow_ui.py` G6). What still arrives next door was not traced; the door between the rooms is not a wall piece. |
| a pop when a flame swaps | **confirmed, fixed** | The largest change of the whole picture between two frames while the pool changes (camera still): 0.46 with no fade, 0.04 with the 0.4 s cross-fade (0.30 and 0.03 with the stand-in on). The old code faded by distance from the pool's edge, not in time. |
| under furniture | **not a fault** | A real light with no shadow lights the floor under a table as well. The new one matches that. |
| z-fighting, sorting with rugs and fog | **not measured** | The new one is not geometry: nothing to sort or fight. It is applied before the fog pass. |
| upper storeys | **not measured** | The light map has one tile per storey (the focus's, one below, one above) and each light's walls are its own storey's. The tuner has one storey; this was not run in a multi-storey building. |

## GPU time (ms a frame, the lowest of 4 interleaved rounds; 1920 × 1080 CSS pixels)

| | room, ratio 1 | room, ratio 2 | town 104 rooms, ratio 1 | town, ratio 2 |
|---|---|---|---|---|
| no real lights, no stand-in | 2.50 | 6.58 | 7.78 | 8.78 |
| no real lights + stand-in (6 in the room, about 96 on the town) | 2.50 | 6.66 | 6.50 | 8.91 |
| pool of 8, no stand-in | 3.62 | 7.53 | 8.77 | 9.57 |
| pool of 8 + stand-in (none needed in the room) | 3.23 | 7.64 | 8.49 | 9.83 |
| pool of 8 + old floor disc | 2.87 | 7.58 | 4.45 | 9.68 |

- **Room:** +0.0 ms at ratio 1, +0.1 ms at ratio 2.
- **Town:** not resolved. The box was loaded and the rounds differ by 1 to 4 ms; the differences read +0.1 to +0.3 ms at ratio 2 and negative at ratio 1. It is under about 0.3 ms; a quiet box would say how far under.
- The cost does not grow with the number of flames: one instanced draw into a 768 × 256 map, one pass over the picture (five texture reads a pixel).
- Render-target memory: +3 MB (four half-float targets), not visible in the ledger's rounding.
- CPU: a light's ring of wall distances is worked out once, when it or the walls change.

## What is still wrong with the new one
- No shadows and no shine. A stand-in lights the far side of a barrel.
- Close to a flame it is an estimate (three heights, blended): the wall behind a sconce is under-lit.
- Where several lights overlap, the direction the light comes from is their average.
- Which way a surface faces is read from the depth's slope: one pixel of error along edges.
- Not run on an upper storey, with a closed door, or on a Mac.
