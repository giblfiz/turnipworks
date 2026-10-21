# inn-02 lab notes (2026-10-02)

Harry approved this RunPod batch on 2026-10-02 before he left the house. A scope change from him the same day raised it to 300–600 assets, aiming for about 450, with a $90 RunPod cap and a 7 h maximum deletion timer. The result is 444 SKUs specified and **441 meshed**, all 441 Blender-valid. Spend was **$3.84 RunPod** (measured from the account balance) plus about **$29.70 Gemini** (estimated). No fal was used. Review page: `/projects/turnip-works/review-02/`.

## What was built

| group | SKUs | meshed | notes |
|---|---|---|---|
| open | 34 | 31 | OPEN states for two-state swap, each edited from that variant's own closed plate. 3 double doors failed every edit |
| regen | 52 | 52 | inn-01 problem assets: 23 with model ≤2 and 31 masking-flagged (2 overlap). Prompts corrected from Harry's notes |
| wall | 33 | 33 | 16 wall-light styles × iron/brass/wood, common/fine (incl. barn lantern s2/s3). UNLIT |
| ground | 24 | 24 | 11 floor/table light styles. UNLIT |
| fire | 8 | 8 | open central fires: round pit ×2, raised square, sunken, iron ring, hooded hearth, log ring + spit, plain central hearth. Cold logs and ash only |
| vessel | 7 | 7 | EMPTY and deep, so the water shader can fill them: water trough, stone horse trough, ewer and basin, open rain barrel, open-top well, bucket, washtub |
| firekit | 8 | 8 | woodpile ×2, fire irons, poker set, bellows, ash bucket, firewood basket, kindling |
| gaps | 39 | 39 | things the room grammars want (v2 solver run over 880 rooms): privy stall partitions and doors, stall back panels, more stall partitions, gates and mangers, bunks, cots, bedrolls, trunks, armchairs, dressers, stone sinks, wall racks, a wall mirror … |
| vary | 89 | 89 | extra s2–s5 variants of the most-placed props, ranked by solver placement counts (stool-bar ×3, tables, chairs, benches, barrels, sacks, crates, shelving, beds, tankards, plates, lanterns, candles …) |
| inn | 150 | 150 | TAV-tagged catalog lines that had no mesh (P1, P2, and inn-relevant P3) |

## Factory order (as corrected after inn-01)

The order is: plate → semantic gate → reroll (up to 2×) → BiRefNet matte → mask gate → TRELLIS. The tool is `src/plate_gate_batch.py`.

- **Plates:** `gemini-3.1-flash-image`, 1K, house style `style/heroic-handpainted.object.md`. Open versions are edit prompts with the closed plate as the only reference. Unlit and empty rules are written into every relevant prompt *and* every gate.
- **Semantic gate:** `gemini-3.8-flash` vision, JSON verdict. A rejection's problems are fed back into the reroll prompt.
- **Mask:** pinned MIT BiRefNet (`ZhengPeng7/BiRefNet@e2bf8e4`) runs locally on the the build box RTX 3060 (`src/birefnet_matte.py`, venv `~/.local/share/tw-birefnet-venv`). It reports metrics (fg, soft, components, border, IoU against the chroma key), then a vision mask gate checks the cut-out on magenta, and a chroma key is the fallback matte. 417 plates were matted with BiRefNet and 24 with chroma.
- **Chroma-hole refinement:** BiRefNet keeps background that is trapped inside closed shapes (handle loops, between bars, window frames). `refine_with_chroma` cuts every sizeable connected region that is plainly the chroma colour. 34 plates changed by more than 300 px. The ones already in TRELLIS wave 1 were re-meshed in wave 2.
- **Gate totals:** about 568 plates generated for 444 SKUs, 107 semantic rejects, 15 mask rejects, and 3 final rejects.
- **Second-model audit:** `gemini-3.1-pro-preview` looked at 6-tile contact sheets of every accepted plate (`audit/`). Its mask complaints were almost all false: measured residual chroma pixels were ≈0 on nearly every flagged tile, so **measure, don't believe**. Its semantic complaints led to 4 rerolls. Single-image follow-up questions then overturned 3 of its sheet-level verdicts (corners, lantern-post); 12-tile sheets also mis-mapped tile numbers. Use small sheets with SKU-labelled keys, and ask single-image questions before acting.

## RunPod

- **Pod:** 1× A100-SXM4-80GB, secure cloud, EUR-IS-1, on network volume `tw-trellis-cache`, image `runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04`, running `src/setup_runpod_trellis2_clean.sh` (the NVIDIA-free export). Settings match inn-01: 512 pipeline, 50k faces, 1024 textures, 3 resident workers, DINOv3 mirror encoder.
- **Model load took 18 min** (inn-01 took 3.5). Three workers loading from the network volume at once were CPU-bound. Steady state was ~35 s per asset per worker, about 12 s effective.
- **Two waves:** `launch_wave.sh` started wave 1 on the first 115 gated plates. Wave 2 (341 plates, including re-matted wave-1 items, with `--overwrite`) loaded on CPU while wave 1 ran, using the new `--wait-pids` flag in `runpod_trellis2_batch.py`, so the slow load overlapped compute.
- **Timeline:** the pod ran 11:41 → 14:09 PDT (2.47 h). The deletion timer was armed at 4 h, re-armed to 6 h (under the 7 h cap) when throughput looked slower, and cancelled after deletion.
- **Deletion:** the pod was deleted, then verified via the REST API (GET pod returned 404, `/v1/pods` returned `[]`, spend/hr 0.005 = volume only).

## Downstream

- **Blender:** 441/441 valid (`blender-validation.json`).
- **Tuner:** runtime tier, LOD ladder and texture ladder were built for all 441 (`prep/jobs-inn02.json`, `results-inn02.jsonl`, `lod-inn02.jsonl`). `build_data.py` now reads inn-02 (regens win over inn-01/01b) and carries `open_of` / `mount` into `library.json`: 679 objects, 897 mesh SKUs, no room missing anything. The node solver suites (solver2, zones, wall_items, stable) are green. The tuner itself was not deployed and `js/` was not touched.
- **Review:** `web/review-02` is deployed via `deploy_review.sh` (`REVIEW_SRC` / `REVIEW_MANIFEST`). The page code is shared with inn-01. The run comes from `assets.json` `"run"`, so ratings key as `inn-02/<sku>/{model,plate}`, and there is an inn-01 / inn-02 switcher in the header. Browser-tested both runs at 1600 px and 390 px: no errors, no overflow, no writes.

## Known weak spots (for Harry's review)

- 3 open double doors (barn rough-timber, grand rough-timber, grand dressed-stone) were never accepted. Gemini, flash and pro alike, keeps the leaves closed or coplanar. They need a different approach, probably a leaf-only mesh with a rotation.
- In a mesh render, the fieldstone open window read as a filled surface rather than a passage, and the open bread oven showed a loaf inside. Mesh-level QA beyond a 6-render spot check was not done; Harry's review is the mesh gate.
- Several prose details lost to Gemini's priors: it draws four legs where three were asked (tripods), and a "sunken" pit comes out as a raised kerb. The gate accepted these when the object was still right.
