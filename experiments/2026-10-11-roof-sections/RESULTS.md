# Roof sections: numbers, reads, stills (2026-10-11)

## Cost on a big map (203 rooms, 120 roofs; the build box, RTX 3060, 1920x1080, uncapped)

The megamap rung (27 buildings, 7,142 objects), roofs on. **Taken inside a shared slot (`tw-slot`) on 2026-10-12 with
the box's load average at 6 to 7** (other agents were working; no run had the GPU to itself, so read these as
comparisons). One page, one view, the surface switched back and forth, five rounds, the median of the rounds
(`perf_ab.py`, `perf_ab.jsonl`: every round is in the file). An earlier set, 2026-10-11 at load 9 to 13, said the same.

| view | surface | frame, ms: median (rounds) | draw calls | triangles | roofs near / far |
|--|--|--:|--:|--:|--:|
| table, 110 ft | painted flat (the old surface) | 23.7 (21.0 to 26.2) | 1,152 | 4.37 M | |
| | **roof sections** | **20.1** (20.0 to 27.5) | **1,150** | **4.77 M** | 60 / 60 |
| | sections, every roof pinned near | 21.5 (19.2 to 31.1) | 1,153 | 4.78 M | 120 / 0 |
| quarter of the map, 278 ft | painted flat | 75.0 (73.1 to 90.2) | 7,750 | 31.6 M | |
| | **roof sections** | **82.8** (76.4 to 89.4) | **7,770** | **31.7 M** | 0 / 120 |
| | sections, every roof pinned near | 83.8 (73.3 to 100.6) | 7,754 | 33.9 M | 120 / 0 |
| whole map, 638 ft | painted flat | 115.4 (110.7 to 150.8) | 13,338 | 55.2 M | |
| | **roof sections** | **122.6** (110.4 to 139.0) | **13,348** | **55.0 M** | 0 / 120 |
| | sections, every roof pinned near | 118.1 (100.3 to 140.0) | 13,344 | 57.8 M | 120 / 0 |

- **Draw calls are the same** (a roof was one surface mesh; it is one instanced mesh). Differences of a few are roofs
  waking and sleeping between rounds.
- **Triangles: +0.40 M at the table view** (9%), nothing measurable further out (the far tier is two triangles a copy:
  7,427 copies on the whole map are 14,854 triangles).
- **Frame time.** Table view: not slower (20.1 against 23.7 ms). Zoomed out, the medians of the sections are 6 to 10%
  above the painted surface, on both days, with the rounds overlapping. Checked again at the quarter view with seven
  rounds and 4 s of settling after each switch (`perf_ab_quarter_long.jsonl`): painted 73.7 ms (66.9 to 94.8), sections
  77.7 (68.0 to 83.8), sections casting no shadow 76.1 (64.1 to 100.2). So: within the spread of the rounds, and at most
  about 5% if it is real. No cause was found (the far tier draws the same number of calls and almost the same
  triangles); it is left as an open question, not a finding.
- **Checkout against checkout** (`perf_checkouts.jsonl`, the megamap's own method, same slot): the code before
  (25397e4) 1,124 draw calls, 4.15 M triangles, 22.7 ms at the table view; this branch merged with main 1,161, 4.81 M,
  30.9 ms. That comparison is not a clean one: main moved by 44 commits in between, and the same file's roofs-OFF
  rows, which this work does not touch, swing from 106 to 130 ms and from 176 to 139 ms between the two runs. The
  interleaved table above is the measurement to use.
- Copies: 7,427 for 120 roofs (62 a roof); none needed splitting (no copy had more than four clip planes).

## Stills

`shots/before/` (checkout 25397e4), `shots/after/`, `shots/far-tier/` (every roof pinned to the far tier), `shots/live/` (https://turnipworks.net/ after the deploy, 2026-10-12): per style
`<style>-table.png` (the table view, 95 ft), `-close.png` (45 ft), `-top.png` (from above). 1920x1080, the game's own
look (the built-in night lighting: a local page has no house look). PNGs are not in git; they are on the build box in the
main checkout's copy of this folder.

## Gemini's reads (gemini-2.5-pro; `gemini/`)

Blind description of every table still (`blind-<before|after>-<style>.txt`), and a blind pair per style
(`pair-<style>.txt`; which of A and B was which is in `pairs.txt`, never shown to it). See the section at the end of this
file for what it said.

### What it said (the final sections, 2026-10-11 20:24)

**Blind pairs, close view (45 ft), 4 styles:** it named the modelled roof as the one with physical relief in 4 of 4 and
would ship it in 4 of 4 (95 to 100% sure each).

**Blind pairs, table view (95 ft), 4 styles:** it would ship the modelled roof for slate and wood shingle, the painted
one for thatch and clay tile. But it named the wrong image as "the 3D one" in 3 of 4 (it called the old painted roof
"individually modelled tiles"), so at the table view it cannot tell the two surfaces apart reliably; its preference
there is not evidence either way. Over the four rounds of reads made while tuning, its table-view verdicts flipped
with small changes and with nothing changed.

**What it listed as faults, more than once** (checked against the stills):
- "a hole" / "a black triangular gap" on the wing's slope: that is the kit's DORMER seen from behind in shadow (the slate
  one is nearly black), not a hole in the roof. At 45 degrees the seeded dormers fall on different slopes than at 40.
- "the valley is a sharp line, no flashing": true. The two slopes are cut clean on the valley line and nothing is laid
  over it. (docs/ASSETS_TO_BUILD.md: hip and valley trim.)
- "tiles clip into the chimneys and dormers": true, and as before: trim is sunk into the roof, the roof is not cut round it.
- "a light grey untextured triangle at the gable end": the plaster gable wall, as before.
- "the same cluster repeats": true of both surfaces (one 5-ft plate / section).
- "a catastrophic gap in the valley" (clay tile, one read): not in the still; the measured layout covers every slope
  exactly (engine/test/roofs.test.mjs).

**Blind single reads, table view:** every modelled still was read as the right material; thatch and clay tile were read
as "real physical relief" each time, slate usually, wood shingle once as "a flat picture trying to imitate relief".
