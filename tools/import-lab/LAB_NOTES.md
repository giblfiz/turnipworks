# Import Lab: lab notes

## 2026-10-05: built, measured, deployed (Fauna, Claude substrate)

Machine for every number below: the build box (i5-10400F), headless Chromium with the RTX 3060 for drawing. The conversion itself is single-threaded JS + WASM and does not use the GPU. A recent laptop should be faster.

### Ladder (each rung checked before the next)
1. **Cube** (19,200 → 5,000 triangles). Bake off: the two panes are pixel-identical (difference 0.0). Bake on: mean difference 0.2 of 255, worst 1 (8-bit rounding of a flat normal map). Surface error 0.
2. **Smooth ball** (300 triangles + bake): decoded normals within 0.4° of the true sphere normal at 1,800 sample points (`selftest`, done in the page). Gemini: no mesh pattern on the surface, one faint chart seam.
3. **Bumpy ball**: bumps the size of the triangles. The bake halves the difference but cannot hide a silhouette this coarse. A deliberately nasty case.
4. **Stanford Dragon** (871,414 triangles), then the same model as a 43 MB binary STL (identical result, so the weld is right), then the textured **Garden Gnome** (colour carry).

Two identical models in the two panes differ by exactly 0, so every difference number below is signal, not renderer noise.

### Does normal-map baking work in a browser? Yes.
Ray-cast bake with three-mesh-bvh, box-projection UVs, explicit tangents. 1024² takes about 4–5 s against an 871k-triangle original, whatever the budget. 2048² takes about 16 s and measures no better than 1024² (close-up difference 1.73 vs 1.75 at 5k); 512² takes about 1.5 s and is slightly worse (1.99). **1024² is the right default.**

### The dragon, per budget (bake on, 1024²)
Time = simplify + unwrap + bake + export; add about 1.6 s once per model to read, weld and index the original. Error = distance between the surfaces as % of model height (typical / worst). Pane difference = mean absolute pixel difference between original and converted (0–255) at table / leaning in / close-up.

| budget | triangles | GLB (PNG) | with WebP | time | error typical / worst | pane difference |
|---|---|---|---|---|---|---|
| 5k | 4,996 | 1.18 MB | 0.39 MB | 5.4 s | 0.133% / 2.94% | 0.23 / 1.22 / 1.75 |
| 10k | 9,974 | 1.32 MB | 0.57 MB | 4.9 s | 0.076% / 2.77% | 0.20 / 0.93 / 1.32 |
| 20k | 19,988 | 1.70 MB | 0.94 MB | 5.5 s | 0.042% / 0.64% | 0.17 / 0.76 / 1.06 |
| 50k | 49,970 | 2.74 MB | 2.00 MB | 6.1 s | 0.020% / 0.13% | 0.14 / 0.63 / 0.90 |
| 100k | 99,998 | 4.41 MB | 3.73 MB | 6.5 s | 0.011% / 0.10% | 0.12 / 0.58 / 0.84 |

Same budgets, bake **off** (no texture):

| budget | GLB | time | pane difference |
|---|---|---|---|
| 5k | 0.12 MB | 1.3 s | 0.39 / 3.50 / 5.78 |
| 10k | 0.21 MB | 0.8 s | 0.32 / 2.83 / 4.70 |
| 20k | 0.39 MB | 0.9 s | 0.25 / 2.17 / 3.61 |
| 50k | 0.95 MB | 0.9 s | 0.18 / 1.49 / 2.46 |
| 100k | 1.88 MB | 1.1 s | 0.14 / 1.10 / 1.81 |

Readings:
- **5k with the bake (1.75 close-up) beats 100k without it (1.81).** The bake is worth far more than triangles.
- **The worst-case error falls off a cliff between 10k and 20k** (2.8% → 0.64% of height; on a 12-ft dragon that is 4 inches → under 1 inch). Below 20k some thin part has been eaten. The normal map cannot put back a missing horn tip.
- With the bake on, the **file is mostly texture** below 20k (a 1024² PNG normal map is about 1 MB), so dropping from 20k to 5k saves only 0.5 MB.
- At table distance the 12-ft dragon is 80 px tall on a 900-px-high pane. A 6-ft mini is about 40 px.

### Gemini, blind (gemini-2.5-pro)
Unlabelled pane crops, A/B order randomised, "describe A, describe B, then compare", plus an identical-pair control at each distance.
- **Bake on:** "no visible difference" at every budget (5k–100k) at table distance, leaning in and close-up. Controls: also "same".
- **Bake off** (the sensitivity check: can it see a difference when there is one?): picks the original as sharper at 5k and 10k at **every** distance including the table ("scales almost completely absent"); same from 20k at table and leaning in; at close-up it still picks the original at 20k, and at 50k it picked the *converted* one (i.e. a coin flip).
- So the judge can see degradation, and with the bake on it does not. It is a triage instrument, not Harry's eye: it missed pixel differences that are measurably there at close-up.

### Things that went wrong on the way
- **Derivative tangents drew the mesh onto the model.** First bake used three's no-tangent path (frame from screen-space derivatives). That frame is constant per triangle and jumps at every edge; the numbers were right inside triangles and the look was a fine triangle net over the bumpy ball. Fixed with explicit per-vertex tangents (the chart's u direction laid into the vertex's tangent plane, w = +1), which cost 16 bytes a vertex in the file.
- **Per-corner crease normals are not transitive.** Judging each corner against its own face gave neighbouring faces slightly different normals at a shared vertex with no crease between them; baked, every such edge is a line. Replaced, for the low model, with smoothing groups (union across soft edges round each vertex).
- **A textured original came out half black**: its metalness *factor* is 1 because a texture supplies the real value. Now the texture's average is used.
- **three's GLTFExporter silently writes PNG when asked for WebP.** The WebP figure in the readout is the GLB size with the textures re-encoded by the browser, not a second export.
- The stamped sample URL (`.glb?v=…`) broke the extension sniff on the first deploy. Caught by the live smoke test.

### Not done
- xatlas (the box unwrap answered the question; roughly half the texture is wasted and there are a few hundred charts).
- Carrying an original's own normal map through the bake.
- A worker (the tab freezes for 5–8 s).
- Mesh quantisation / meshopt compression of the GLB.
- A real thin-feature test: a HeroForge-style mini with a sword, fingers and a cape edge. The dragon is forgiving, chunky and organic. **This is the test that matters most and needs a model Harry actually cares about.**

### Records
- `reviews/tuner/import_lab.jsonl` has two self-test rows from this session (names `fauna-selftest` and `dragon-res3.stl`, notes say so). They are not verdicts.
- Server: `import_lab` added to `TUNER_KINDS` in `server/ratings_server.py`; tw-ratings restarted 12:01.
- Landing page card added (`/var/www/implausible-landing/projects/turnip-works/index.html`; backup beside it).

### Recommendation going in (before Harry has looked)
Default **20k triangles + 1024² normal map**, about 1.7 MB as written (about 0.9 MB with WebP textures), about 7 s for a ~1M-triangle source. 20k is the smallest budget where the worst-case error is under 1% of height; below it the saving is small because the texture dominates. Confidence that this is the budget Harry lands on or below after looking: about 65%. The estimate is most sensitive to how thin-featured minis behave, which has not been tested.
