# Faction batch runner

Adapted from the proven Temple / Cult / Lair pipeline. This folder is one level shallower than those batches; ROOT resolution has been corrected. No script here generates images: the parent session uses native OpenAI image generation. No pod has been provisioned by preparing these tools.

`assets.json` at the batch root contains `assets` records: `id`, `object` (catalog role), `lane: "3d"`, `size: [width, depth, height]` in inches, exact `prompt`, `refs` (our own images only), `gate: {desc, must: [], must_not: []}`, `route: "trellis"`, optional `bench`, `rooms`, `family`, `hung`. Save generated images outside `masked/`; then run:

```
python3 experiments/2026-10-13-factions/tools/ingest_plate.py SKU IMAGE.png --transparent
```

Omit `--transparent` for opaque plates (BiRefNet matte). `--prepare-only` retains provenance and a 110px image without vision or acceptance. Ingest preserves native image bytes under `inputs/`, exact prompt under `prompts/`, and hashes for image/references under `plate-qa/`. The blind gate passes a neutrally named 110px image to Gemini with tabletop viewing context, then separately matches the description to the object and emblem. A full semantic gate and a clean-cutout gate follow. Only accepted images enter `masked/`. Rejection removes an older masked copy so stale acceptances cannot reach the pod. These gates assess the supplied view: they cannot manufacture an overhead view from a low-angle image.

After all intended mesh plates have passed, the coordinator authorizes the one pod. Default timer is 60 minutes, with a pod-side backup; pass a shorter plausible duration (decimal hours) if sufficient. Missing remote dead-man deletes the pod immediately. `pod-ever-created` records the one-pod constraint across deletion, so a second create refuses. Only this batch's pod name and run prefix are touched.

```
T=experiments/2026-10-13-factions/tools
B=experiments/2026-10-13-factions
$T/pod_up.sh 1 --dry-run
$T/pod_up.sh 1
$T/launch_wave.sh "$B" auto auto
$T/harvest.sh "$B" auto auto
$T/pod_down.sh
runpodctl pod list
$T/qa.sh "$B"
python3 "$T/make_manifest.py" "$B" factions-01
```

Harvest every finished wave, and delete as soon as the final wave is harvested, before local QA. `pod_extend.sh MINUTES` extends both existing timers, at most 60 minutes per extension. Spend log uses this pod's elapsed uptime times its quoted rate, not the shared account balance. Mesh QA invokes Blender through the project limiter, retains the established structural measurements and four-view blind gate, and measures scale against the largest catalog dimension. This folder's scripts passed `bash -n` and Python compile checks; actual pod and visual operation await plates.

Landing belongs to the coordinator because stage-specific integration/manifests and intentional golden differences must be known. Do not reuse the old Lair landing scripts unchanged: they contain legacy branch and baseline assumptions. Build and test a temporary branch in this worktree before touching main; fast-forward only under the standard lock.

`landing_gates.sh BASELINE_TUNER [reviewed-recipe-json]` runs the required build-data/flats/build-data, asset/sku/golden, Temple/Cult and engine checks in the prepared Task C worktree. It refuses main. The coordinator retains ownership of the temporary branch, precise step-1 reviewed scene hashes, binaries, fast-forward, commits and deployments. No golden changes are allowed by default; accepted changes must match the reviewed before/after scene hashes.

`gate_ready.py --follow` watches the separate `step2-assets.json` and `step2/plates/`, with at most three concurrent native plate gates. It reports every 40 seconds, skips accepted/rejected records, and stops when every mesh is gated or batch `GATE_STOP` appears. Error attempts are logged but not hammered repeatedly. Correct the error and restart the watcher to retry (successful state is still skipped). No pod calls. Stop the watcher before intentional re-gating of a rejected plate; the coordinator performs that explicit rerun with `ingest_plate.py`.

`gate_icons.py --follow` (BiRefNet venv Python) watches icon PNGs and keeps originals untouched. It pads to a centered square and resizes to31px for a blind read,128/256px for runtime (`icons/runtime/<faction>.png`, `<faction>@2x.png`). Individual evidence and exact-prompt/hash provenance live in `icons/qa/<faction>/verdict.json`. It only checks recognizable emblem components, not tiny detail. `ICON_GATE_STOP` stops it.
