# Reproducible faction integration

`FACTION_DATA.md` is the contract with Task B. `sandbox.py` supplies main's immutable binaries as individual symlinks; mutable flat outputs are copied. It never links the entire writable assets directory. `build_data.py` ingests only `catalog/runs/factions-01/manifest.tsv` and the separately reviewed `accepted-flats.json` list. The latter holds `{sku, object, shape, path, size?}` rows, with `path` relative to this experiment. Native alpha is preserved explicitly; old chroma-key batches retain their existing processing.

`replacements.json` removes the old sun idol from selectable data only when its accepted new mesh exists. The new SKU carries `was:[{mesh,sku,until}]`; both old source and runtime mesh remain on disk. Before the first deployment, set `until` to the planned first-live timestamp and commit it. A null cutoff is allowed in previews but blocks landing. `orientation.json` must name every accepted SKU as `{yaw:<degrees>, sourceSha256:<source GLB hash>, evidence:<measurement or reviewed sheet>}`; a zero yaw still requires evidence. After QA/manifests, run `runtime.sh` for runtime meshes, LODs, textures, flats and measured orientation.

## Browser captures

Use the limiter and an unoccupied local port; port 8767 is occupied by an unrelated service. The smoke run at 18767 produced all three screenshots, 39 pieces and zero browser errors. This was plumbing verification **before new meshes**, not asset acceptance. Servers are stopped by `with_server.py` on exit.

```
LIMIT=/tmp/scratch/tw-slot
$LIMIT python3 ~/.codex/skills/webapp-testing/scripts/with_server.py \
  --server 'exec python3 -m http.server 18767 --bind 127.0.0.1 --directory tools/spawn-tuner >/tmp/tw-faction-http.log 2>&1' --port 18767 -- \
  python3 experiments/2026-10-13-factions/integration/room_shots.py \
  http://127.0.0.1:18767 experiments/2026-10-13-factions/shots/step1 --factions sun,moon,devils,spiders --read
```

Repeat with `--factions spiders --corbels-only --read` into a separate directory. The library response drops every other faction slot for this read, leaving the neutral architecture/furniture and the corbels. Each shot includes a JSON evidence record with placements, corbel count, browser errors, overlap/outside reports and image hashes. The judge receives neutral filenames and an unprimed description request, with no faction name. Normal acceptance refuses a room with no corbels; `--smoke` is exclusively a pre-asset plumbing mode.

## Landing

Commit only owned source, measured orientation, runtime metadata and the appropriate step's manifest. Review actual pairwise golden differences with `--print`; update the exact `allowTypes` in `golden-step1.json`, then run golden with `--allow-types=<reviewed types> --record-recipes=<batch>/integration/golden-scenes-step1.json` and set `observedDiffsReviewed:true`. Landing accepts only these exact before/after hashes; the type list permits recording, never blanket acceptance. Task B records exact classic-engine faction fixes in `test/faction-golden.json`; Task C compares against that landed baseline and separately reviews the Step 1 recipe differences. Step 2/3 allow **none**. Step 1 refuses a manifest containing anything except its five meshes.

Run `flock /tmp/tw-main.lock experiments/2026-10-13-factions/integration/land.sh 1` from Task C. `STAGE=preflight` runs all gates without advancing main. The script fetches origin, snapshots its tuner baseline, creates a temporary integration branch inside Task C, merges the committed task branch onto origin/main, rebuilds data and delivery, and runs assets/SKU/golden/Temple/Cult/faction/engine gates. Only then can main fast-forward. Accepted source models/flats and their runtime ladders are copied without deleting old meshes, identical data commands rebuild main, generated data is committed, normal deploy scripts run, and main is pushed. Logs stay under `integration/landing-<timestamp>-stepN/`.

After releasing the lock run `verify_live.sh`, then repeat browser captures against the live tuner. Check actual versions from tuner `version.json` and client main-module stamp. The scripts have passed syntax checks; deployment has not been attempted as of the pre-asset smoke run.

## Orientation evidence

After each harvest run `python3 integration/orientation_prepare.py --skus <harvested SKUs>` (paths from this batch when invoked there, or the full script path from repo root). It makes five-view sheets (A=+Z, B=+X, C=−Z, D=−X, E=above) and quantitative rear/front/top plane probes, under `orientation/raw/`. Read the numbered sheet blind with `orientation_blind.txt`; only afterwards match motifs and catalog roles. Mapping a verified front to local +Z: A→0°, B→−90°, C→180°, D→90°. Record the yaw, source SHA256 and evidence in `integration/orientation.json`, then re-run with `--verify` to inspect the final orientation. Runtime application refuses stale source hashes.

The calibration sweep on the two existing stone corbels matched their documented orientations: row 1 front C/back A (180°), row 2 front A/back C (0°). Gemini's blind descriptions independently matched both. The numeric plane score alone ranked their SIDE faces above their backs: it is useful measurement, not an automatic orientation oracle. Preserve that distinction on the faction corbels. The probe reports uniform-scale dimensions and back/top plane inset/RMS; it does not impose arbitrary aesthetic rejection thresholds.

## Spider table-read repair

The dark source and the pale-body grade both read as generic brackets in an isolated room. A 36-inch scale trial still failed. Shortened-shelf geometry trials read as gargoyles and were rejected; `shorten_spider_slab.py` documents that discarded experiment and is **not** part of final preparation. Final preparation is `grade_spider.py` then `inlay_spider.py`: the clean original geometry is retained, the carving is lifted to lavender, and our own accepted native spider pictogram is projected onto the broad top surface. Original and graded intermediate GLBs remain in `models-ungraded/` and `models-graded/`. Metadata records hashes, color transform, UV projection, and icon source. `runtime.sh --only flavor-corbel--spiders-fct` rebuilds just the repaired mesh and its tiers; full runs still prepare all accepted pieces.

For captures of many factions, redirect the development server log as above: `with_server.py` pipes server output without continuously draining it, so many asset requests can fill the pipe and stall serving. This affected the first nine-room run after five successful captures; redirecting logs resumed the remaining four.

The nine new altarpiece generation IDs retain their historical `flavor-altar-piece` source stem. Their canonical runtime SKUs use `flavor-altarpiece`, matching the actual slot and generic client validation. `manifest_overrides.rename` and `integration/sku-aliases.json` preserve this explicit source-to-runtime mapping.
