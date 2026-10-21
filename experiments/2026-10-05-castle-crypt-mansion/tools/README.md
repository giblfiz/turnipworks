# Runner scripts for the castle / crypt / mansion / vertical batch

Generalised from `experiments/2026-10-05-yard-props/` (gen, launch_wave, qa_mesh, qa_gate, make_manifest) and from
inn-02's pod notes. Every script takes the type folder first (`crypt`, or a path). B = this folder's parent.
Nothing here calls fal or a paid image model. The only thing that costs money is the pod (`pod_up.sh`).

## The commands, in order

    PY=python3

    # 1. plates (free: Codex image tool -> blind describe -> match -> BiRefNet matte -> mask gate)
    $PY tools/gen.py crypt --group p1 --dry-run          # what would run
    $PY tools/gen.py crypt --group p1 [--workers 2] [--prio 1] [--ids a,b] [--rerolls 1]
    #    or the queue: steps in B/queue.txt ("crypt p1", one per line; append while it runs)
    nohup tools/queue.sh > /dev/null 2>&1 &              # logs to B/queue.log; WORKERS=3 FOLLOW=1 optional
    tools/quota_status.sh                                # one line: done / waiting / Codex error text / last probe

    # 2. the pod (ONE for all four types)
    tools/pod_up.sh --dry-run                            # balance, stock, the exact create command, worst-case cost
    tools/pod_up.sh 4                                    # creates, arms the 4 h deletion timer, B/pod.json, START in spend.log, setup
    # 3. meshes; HOST PORT can be `auto auto` (from B/pod.json)
    tools/launch_wave.sh crypt auto auto                 # every gated plate without a GLB; WORKERS=n, QUEUE=1, DRY=1
    tools/wait_wave.sh crypt auto auto                   # (or `all`) waits on the pid files, one status line a minute
    tools/harvest.sh crypt auto auto                     # GLBs -> crypt/models, logs -> crypt/worker-logs, models-missing.txt
    tools/launch_wave.sh crypt auto auto sku-a sku-b     # re-mesh those with a new seed
    # 4. QA (run again after every harvest; each step skips meshes it has already done, by GLB sha1)
    tools/qa.sh crypt                                    # -> crypt/qa/<sku>.json, .sheet.jpg, .verdict.json, summary.tsv
    # 5. pod away
    tools/pod_down.sh --dry-run ; tools/pod_down.sh      # delete, verify gone, SPENT line with measured dollars, timer off
    # 6. manifest
    python3 tools/make_manifest.py crypt crypt-01 --dry-run
    python3 tools/make_manifest.py crypt crypt-01        # -> catalog/runs/crypt-01/manifest.tsv

## What each one does

- **gen.py** Resumable (accepted plates are skipped; `rejected` too unless `--retry-rejected`; errors run again). A sibling
  whose parent plate (`inputs/<parent>.jpg`) is missing is left *waiting*, not failed. Paces Codex: 2 workers, at least
  20 s between launches (`--gap`). One retry for an ordinary failure. **Quota:** a Codex usage / rate-limit error (or the
  image tool refused twice running) stops the run at once: `B/QUOTA_STOP` (JSON: the exact text Codex printed, time,
  plates accepted / waiting in all four folders, last probe), `TYPE/plates-waiting.txt`, exit 75. While QUOTA_STOP exists
  gen.py will not start, except `--probe` (one plate). The first image that succeeds removes the file.
- **queue.sh** Sequential, one queue at a time (`B/queue.lock`), done steps in `B/queue.done`. A type's `p1` runs before
  its `sib1` (p2 before sib2) whatever the file order. On quota it does not exit: every 15 min (`PROBE_EVERY`) one image
  request, each probe logged, and it carries on when one succeeds.
- **pod_up.sh / pod_down.sh / pod_timer.sh / pod_setup.sh** The yard's method: `runpodctl pod create --name tw-ccm --gpu-id …
  --data-center-ids EUR-IS-1 --network-volume-id 7hbjaot7ej --image runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04
  --container-disk-in-gb 40 --ports 22/tcp --wait`. A100 80 GB first if EUR-IS-1 has stock, else RTX 4090. Refuses if the
  account already has a pod. The timer is armed the moment a pod id exists, even if the create call itself errored.
  `pod_down.sh` refuses while a wave runs or GLBs are unharvested (`--force`), deletes, checks GET pod = 404 and the pod
  list, reads the balance (GraphQL), writes `SPENT` = balance at start minus balance now, stops the timer, moves
  `pod.json` to `pod-<id>.json`. Key from `RUNPOD_API_KEY` in the environment only.
- **launch_wave.sh** Remote dir per type: `/workspace/tw-runs/ccm-<type>`. Default 3 resident workers on an A100, 1
  non-resident on a 4090 (`WORKERS`, `RESIDENT`); the todo list is split between workers. A second type while another
  runs: refused, or `QUEUE=1` (loads on the CPU, takes the GPU when the others exit: `--wait-pids`). Specs with
  `"route": "hunyuan-mv"` are not sent: listed in `TYPE/route-other.txt` (today: `castle/cage-floor`). That route is fal,
  $0.525 a mesh, `experiments/2026-10-02-openclose/mv/fal_multi.py`: not in these tools.
- **qa.sh** = `qa_mesh.py` (Blender: size at the tuner's auto rule, proportions, floating pieces, base slab, underside,
  wall-panel silhouette, four tiles) + `qa_unpainted.py` (the slope pilot's measure, same numbers as
  `slopes/surf_unpainted.py`) + `qa_gate.py` (rules, blind Gemini read, text-only match, ladder, `summary.tsv`).
  Verdicts: `accept | reroll-mesh | reroll-plate | reject`. Thresholds are the `THRESHOLDS` dict at the top of
  `qa_gate.py`. `qa/overrides.json` `{sku: {"verdict": …, "note": …}}` is the supervisor's last word.
  `NOVISION=1` = rules only.
- **make_manifest.py** Accepted rows in the outdoors-02 columns. `TYPE/manifest_overrides.json` for renames and own sizes
  (kit boxes: keep within about 1.5x of the mesh, as the yard did).

## Numbers from the logs

| | measured | where |
|---|---|---|
| plate, Codex | 99 s for one image call (2026-10-05 16:08); 2.6 min per image per worker with the gates | test; crypt p1: 17 images, 14 plates, 14.8 min, 3 workers |
| plates per hour | about 55 accepted at 3 workers, about 38 at 2; the yard did 35 in 23.8 min at 5 workers | crypt/gen-p1.log, yard gen-main.log |
| re-rolls | 1.1 to 1.3 images per accepted plate | yard, crypt p1, inn-02 (568 / 444) |
| pod setup | 7 min | yard worker-logs/setup.log |
| model load | 4.5 min per wave on a 4090 (1 worker); A100: 3.5 min (inn-01), **18 min** with 3 workers loading at once (inn-02) | READMEs |
| mesh, RTX 4090, 1 worker, not resident | median 17 to 38 s (19 s in the 34-mesh wave); first mesh of a wave 30 to 100 s | yard worker manifests |
| mesh, A100, 3 resident workers | 37 s per worker, about 12 s effective | inn-02 |
| $/hr | A100 80 GB $1.59, RTX 4090 $0.74 (secure, EUR-IS-1); volume $0.005/hr always | spend logs, `runpodctl gpu list` |
| whole runs | inn-02: 441 meshes, 2.47 h, $3.84 = **$0.87 per 100**; yard: 58 meshes, 62 min, $0.76 = $1.31 per 100 (five small waves) | spend logs |
| steady state | 4090: about 190 meshes/h, $0.39 per 100; A100: about 300/h, $0.53 per 100 | computed from the above |
| QA | Blender 3 s a mesh, unpainted 1.2 s, Gemini two flash calls | tests here |

For about 370 meshes: A100 about 1.7 h and $2.70; 4090 about 2.2 h and $1.60. The A100 is faster, not cheaper. Few
big waves beat many small ones: every wave pays the model load again.

## Tested, and how

- gen.py + queue.sh: in a scratch batch with a fake `codex` (quota / refused / fails / paints): one call then stop, exact
  text in QUOTA_STOP, waiting list, exit 75, refusal to start, probe, recovery, parent-before-sibling order, and the real
  gates (Gemini + BiRefNet) on the painted plate. In production: crypt p1, 14 of 14.
- The limit patterns come from the strings inside the Codex 0.160.1 binary. **A real usage-limit message has not been
  seen**; a real 91 KB success transcript gives no false hit.
- Codex image route: one real test image, 2026-10-05 16:08, worked.
- pod_up / pod_down / pod_timer: dry runs against the live account (read only), and full runs against a stub
  `runpodctl` in a scratch folder: fallback when both GPUs refuse, timer fires and deletes, pod_down verifies 404, books
  SPENT, stops the timer without it firing. **Never run against a real pod**: the parsing of a real create result, the ssh
  address lookup and `pod_setup.sh` are untested.
- launch_wave / wait_wave / harvest: locally (`TW_LOCAL`) with a stub worker: 3-way split, double-launch refused, QUEUE=1
  behind another type, a failed asset listed, re-mesh with a new seed, a half-written GLB removed. **The ssh path and the
  real worker on an A100 with WORKERS=3 `--resident` are untested here** (they are inn-02's settings).
- QA: 12 yard meshes + both rejected `hoe` meshes + 4 wall panels. Both hoes fail (floating piece 16% / 39%); 11 yard
  meshes the yard accepted are accepted; the slope pilot's `slope-bank-10` measures 33% unpainted (would re-roll); the
  log-cabin doorway, window and open window reproduce the lab notes (opening 50% wide from the floor; 49% x 25%;
  a slit) and pass; a 10/01 fieldstone panel fails only because I gave it this batch's 60 x 108 size.
- make_manifest: yard rows equal `catalog/runs/outdoors-02/manifest.tsv` except hand-set sizes, hints edited since, notes.

## Fragile

- The deletion timer is a process on the build box: a reboot loses it. `pod_down.sh` is the real stop.
- Never edit `queue.sh` in place while it runs (bash reads it as it goes): write a copy and `mv` it over.
- Never `pgrep -f` / `pkill -f` for a worker or a timer: they match themselves. Pid files only.
- A wave of another type on the same GPU without `QUEUE=1` is refused for a reason: two sets of resident models do not fit.
- Floating pieces are found by voxel connectivity (1/72 of the largest dimension, two cells of slack), not by mesh
  shells: TRELLIS meshes are hundreds of unwelded shells. A piece hovering closer than about 3% of the size is missed.
- The footprint rule only fails a piece that came out *squarer* than the catalog by 24 in or more of floor; thin tools
  lying askew pass with a note. Trees and anything `leafy` are never failed on height.
- `reroll-mesh` for unpainted surface is the cheap first try; the slope pilot found re-meshing did not cure it (the plate
  filled the frame). The ladder turns the second failure into `reroll-plate`.
- Wall rules apply to panel-sized ids (5 ft wide, 8 ft or more tall, at most 2 ft deep, id `wall-` / `window-` /
  `door-`). `"kit": "wall"` or `"opening": "door|window-open|window|solid|panel"` in a spec overrides the guess.
- Harvested GLBs stay on the network volume (`/workspace/tw-runs/ccm-*`) after the pod is gone.
- `TW_B=<dir>` points every script at a scratch copy of the batch folder; `TW_LOCAL=<dir>` replaces the pod by a local
  directory. Both are for tests.

## First real pod session (crypt mesh agent, 2026-10-05 16:36 to 17:53, $0.97 measured, 75 mesh runs in 7 waves): what held and what was fixed

- **pod_up.sh, pod_timer.sh, pod_setup.sh, launch_wave.sh, wait_wave.sh, harvest.sh all worked unchanged against a real
  pod** (RTX 4090, `--gpu 4090 --no-setup`, then `pod_setup.sh`). The create result parsed (`.ssh.ip` / `.ssh.port`), the
  timer armed, ssh `auto auto` worked. Setup took **185 s** (not 7 min), model load **182 to 187 s** per wave (not 4.5 min),
  mesh median **20 s** on the 4090, 0 worker failures in 50+ meshes.
- 4090 stock in EUR-IS-1 flaps between `Low` and `none` within seconds: the first create was refused ("no longer any
  instances available"), the retry 40 s later got one. `pod_up.sh` does not retry by itself: run it again.
- **Fixed, qa_mesh.py `is_wall`**: the panel rule only looked at ids starting `wall-` / `window-` / `door-`, so
  `ossuary-wall--crypt-stone*` and `tomb-door-sealed--crypt-stone` would have been judged as props. Both prefixes added.
  **Fixed, qa_gate.py**: those two are `solid` panels (hole rule) rather than `panel`.
- `crypt-gate-iron` and `door-crypt--leaf` are not panel-sized (4 ft and 3.3 ft wide) so they run under the prop rules;
  the kit proportions for them were checked by hand (see `crypt/QA.md`) and their boxes are set in
  `crypt/manifest_overrides.json`.
- **Parent wall plate came out square** (mesh 9.0 x 9.0 ft, w:h 1.01 against the catalog's 0.56) although the plate gate
  passed it ("clearly taller than wide" is not something the plate gate measures). Caught by the wall rule. The prompt
  of `wall-straight--crypt-stone` was strengthened in `crypt/build_spec.py` and `crypt/assets.json` (ten courses of two or
  three blocks; "TALL, NARROW ... almost TWICE as tall as it is wide ... must NOT be square") and the plate re-rolled
  once: mask box 0.43 w:h, mesh w:h 0.48, accepted. This was done BEFORE the queue reached `crypt sib1`, so all eight
  sibling wall panels are painted from the tall parent. **Castle and mansion wall parents will want the same sentence
  and a check of the mask box (width / height of the alpha bounding box under about 0.6) before their siblings run.**
- Queue order as it actually ran: crypt p2, p3, sib1, sib2 (not sib1 first).
- **New, `qa_twin.py`** (open twin against its closed mesh: sizes at auto scale and a hollow measure from a top-down
  height map) and **`qa_recess.py`** (niche panels: how much of the face is really recessed). Both run in
  `tw-trimesh-venv`, print, and write to `TYPE/qa-extra/`. **Never put another .json in `TYPE/qa/`**: qa_gate.py takes
  every `qa/*.json` for a mesh (a stray `twins.json` became a "twins" row until it was moved).
- The twin LOOK check is one Gemini call per pair on the two sheets, blind (prompt and answers in `crypt/qa-extra/`,
  `twinlook-*.json`), with one control pair of two different designs.
- The measurement's "leaning or cantilevered" note fires on any mesh made of two bodies with a gap (the lid-off
  sarcophagus): check before believing it.
- `pod_down.sh` worked as written: refused nothing wrongly, deleted, GET 404, pod list empty, SPENT line, timer cancelled.
- Seven waves for 75 meshes cost 21 min of model loading out of 77 min: with plates arriving at one a minute a wave every
  10 plates is about the break-even against an idle pod.
- `pod_down.sh` books SPENT 20 s after the delete; the balance kept settling for a few minutes ($0.92 then, $0.97 final). Read the balance again before quoting a total.

## Castle / mansion / vertical sessions (second mesh agent, 2026-10-05 20:07 to 23:25, two pod sessions, 290 mesh runs): fixes and additions

- **make_manifest.py**: `manifest_overrides.json` now takes `"tier": {"<id>": "fine"}` (the five mansion specs the
  integration wanted tiered without regenerating).
- **New `qa_stairs.py`** (tw-trimesh-venv): top-surface profile along the run (risers counted, low end, top tread, ramp /
  block / flat tests), a polar profile for spirals, an ascii top view; `qa-extra/stairs.json`. Its 40-band profile takes the
  median across the width, so a stair with RAILS needs the centre strip read by hand (the grand stair's top tread is at
  76% of the mesh height: the box height must be storey / 0.76). Its spiral direction label is not calibrated to a hand.
- **New `qa_boxfit.py`**: per-axis stretch of a `fit: box` / `kit: wall` piece at its box, and the anisotropy (limit about 1.5).
- **New `kit_boxes.py [--write]`**: for accepted kit roles, proposes a deeper box where only the thin axis breaks 1.5x
  (door leaves, bars, gates) and prints FAIL where width:height itself does.
- **New `qa_twinlook.py`** (the crypt's by-hand Gemini pair read as a script) and **`qa_suite.py`** (mean texture colour
  of a sibling against its parent, Lab dE; confounded by material mix: a note, never a verdict).
- Spec switches used: `"kit": "wall"` + `"opening": "panel" | "door"` on `portcullis--castle-rough`, `portcullis-raised`,
  `cell-bars` (qa_mesh.py only guesses panels 5 ft wide). qa_gate.py keeps a verdict cached by GLB sha1, so a mesh judged as
  a prop keeps that verdict after the spec changes: use `--redo` on it.
- **`QUEUE=1` waves load their models on the CPU while the first wave runs: the running wave's first meshes take 50 s
  instead of 20**, and wait_wave.sh `all` reports the queued workers as alive. Still worth it (no second model load on the GPU).
- **harvest.sh during a wave can copy a GLB that a re-mesh is about to replace**: after a re-mesh wave, harvest again once
  the wave has ended before believing a measurement.
- **`gen.py --redo` of an accepted plate that the gate then refuses sets the status to `rejected`** although `masked/`
  still holds the first plate: `make_manifest.py` then leaves the mesh out ("plate not accepted"). Restore the status by
  hand (done for `vertical/wall-crenellated--dressed-stone`). And never run it on a type the queue is painting: each
  process rewrites `gate-manifest.json` whole.
- The plate's alpha box is NOT a measure of a thin panel's proportions (three-quarter view): `door-cell-bars` 0.58 on the
  plate, 0.91 as a mesh. For panels, believe the mesh and re-PLATE.
- `cage-floor` (spec route `hunyuan-mv`) passed on TRELLIS; the route in `castle/assets.json` is now `trellis`.
- Pieces painted lying down (scepter, round shield, quiver) fail the height rule against an upright catalog line: sound
  meshes, shipped at their own boxes by override.
- 4090 stock: one refusal in two creates again; the retry 45 s later worked. Setup 251 s and 188 s; model load 167 to 310 s
  on the GPU; mesh median 18 to 23 s; 0 worker failures in 290 runs.
