# Temple & chapel type (2026-10-11 / 12)

Harry: "build out the rest of the fantasy genre type assets". Ten rooms under Build → Fantasy → Temple & chapel, the `temple-stone` wall family, and the flavor slots filled for sun and moon.

| folder | what |
|---|---|
| `batch/` | the mesh run: `build_spec.py` → `assets.json` → plates (`inputs/`, `masked/`, free Codex image route) → `models/` (TRELLIS on RunPod) → `qa/` → `catalog/runs/tem-01/manifest.tsv` |
| `flats/` | `gen.py`: the flat flavor pieces (banner, relief, sigil for sun and moon) and ten room icons |
| `integration/` | `apply.py` (every edit to shared files as appended blocks and one-line hooks; re-runnable), `programs-tem.js`, `walls-tem.js`, `room_types.py`, `tem.test.mjs`, `sandbox.py` + `dev.sh` (a scratch tuner built from the worktree against the main tree's binaries), `room_shots.py` |
| `tools/` | the castle / crypt / mansion runner scripts, pointed at this folder; pod name `tw-type-tem`, with the pod-side deletion timer |
| `BENCH.md`, `ROOM_READS.md`, `spend.log` | for Harry's bench; the blind reads; dollars |

Numbers: 29 mesh plates (29 accepted, 1 semantic re-roll, 4 GPU out-of-memory errors on the shared local matte that passed on a second run), 29 meshes in one wave (0 failures, all 29 accepted by measurement and the blind gate), 6 flats and 10 icons. Pod: one A100, 0.77 h, about $1.38 (the account's balance cannot separate it from five other pods that ran beside it); deleted and verified.

Provenance: every plate from a text prompt and our own style reference (`style-references/heroic-handpainted-tavern-v1.png`), siblings from our own parent plate; no third-party image. Per asset: `batch/assets.json` → `provenance`.

Lessons (beyond the crypt's):
- Real meshes are stouter than their catalog lines: the pulpit came out 6 ft square at 84 in tall (now 68 in), the column is 3.1 ft across, the moon idol 3.7 ft deep. Lay out by `ctx.dims` of a rolled sku, not by the catalog box, where an inch matters.
- A KEEP strip that ends within half a foot of a rank refuses pieces on one side only (the room's inset makes the two sides differ by a grid cell).
- Robes on three stands in a row are a tailor's shop; cots are green-topped tables; beds in two rows are a dormitory whatever stands at the end.
- A buttress or a pulpit has no "front" a blind reader agrees on (two reads of the same shape disagreed): measure where the mass is on the runtime mesh and write the yaw by hand (`prep/orient_ccm.py MANUAL`).
- A flat sku in a role whose catalog box is a thick mesh is mounted at the catalog's depth: the program gives the flat its own thin box (`temWith`).
