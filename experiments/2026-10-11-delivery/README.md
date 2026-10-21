# Asset delivery: the before and after (2026-10-11 and 12)

What was built is in `docs/ASSET_DELIVERY.md`, with the numbers. This folder is how they were taken.

- `measure/`: copies of the asset-cost study's harness (`experiments/2026-10-11-asset-cost/`: `ac.py`, `load.py`,
  `glwrap.js`, `census.js`) pointed at their own ports and output folder, plus
  - `pixdiff.py <scene> <tag> name=extra …`: one scene shot from three cameras (table, leaning in, low and close) under
    each variant of the page's address, twice each in cold browsers; a variant against itself is the noise floor.
    Variants used: `&nodelivery` (plain addresses, uncompressed), `&imgtex` (the old picture loader), `&faces=fit`,
    `&faces=5000`; `TW_BROWSER=firefox PIX_FX=nofx` for Firefox.
  - `sumload.py tag …`: one line per scene from `load.py`'s output (bytes by kind, long tasks, memory).
  - `batch2.sh`, `batch3.sh`, `batch4.sh`: the exact runs for steps 2, 3 and 4. `suites.sh`: gates + browser suites.
  - Scenes: the study's `room`, `inn`, `town`, built once on a local relay. Bulk output: `/var/tmp/tw-delivery/out/`
    (not in the repo).
- `tiers/`: `props.py` renders 24 props (12 small, 12 furniture, seed 20261012) at 10,000 faces and at their fitted
  rung in the study's bench page, measures the difference over the prop's own pixels (`diff.json`) and makes blind
  side-by-side sheets; `gemini-prompt.txt` is what Gemini 2.5 Pro was asked; `sheets.json` is the key (which side was
  which). Its answers and the pictures: `/var/tmp/tw-delivery/tiers/`.
- `weld/`: `weld_build.py` (Blender: today's ladder and weld-first variants for the study's 30 sample props),
  `build.jsonl` (per prop: faces reached, seams, weld counts), `measure.json` (vertices and bytes after
  `prep/meshopt.mjs` + gzip for each prop, rung and variant: A = today, B4 = weld at 1e-4 then decimate, Ca / Cs =
  B4 with normals recomputed).

Conditions: the build box (i5-10400F, RTX 3060, headless Chromium on Vulkan), load average 2 to 18 while measuring: bytes,
counts and pixel differences do not care; every millisecond does. Nothing here was measured on a real network line or
on a Mac.
