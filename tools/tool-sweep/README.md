# Tool sweep: every library asset reaches Harry's review tools

Harry reviews assets by hand in three tools. A batch used to reach them only if its agent wired it in; several left only
a markdown list. Since 2026-10-12 it is automatic: `tools/spawn-tuner/deploy.sh` ends by running

- `sweep.py`: lists every library asset that is not presented yet where it belongs (idempotent; 0.6 s when nothing is new);
- `check.py --warn`: prints `tool coverage OK: …`, or `TOOL COVERAGE FAILED` with the assets and the reason.
  `engine/deploy.sh` prints the check too. Standalone, `python3 tools/tool-sweep/check.py` exits 1 on a finding.

## For an agent landing a batch

Nothing to wire. Build the library and deploy as usual (`build_data.py`, `prep/flats.py`, `deploy.sh`); the deploy's last
lines say what was listed. Three things decide where a piece goes, and they are things a batch already writes:

| tool | a piece is listed when |
|---|---|
| asset rater | it is in `data/library.json` (mesh or flat). Its scores are stored under its own `src`. |
| bench: fire | `fx/fire.js fireType()` gives its id a flame. A catalog `aff: lit` piece with no flame type FAILS the check: add the type, or a line in `waivers.json` with the reason. |
| bench: water | the run manifest's `flags` column says `bench:water` for it (`catalog/runs/<run>/manifest.tsv`). The catalog has no water affordance, so this flag is the only way a new vessel is found. |
| bench: open/shut | its catalog line has `aff: open`, or another line is its `open_of:` twin, or the manifest flags it `bench:hinge` / `bench:twin`. |
| open/shut tester | it has an `open_of:` twin with a mesh. |

`BENCH.md` is no longer needed for a piece to be listed. It is still read as a cross-check (table rows only): a piece it
names under Water or Hinge is listed even without the flag, and every disagreement with the catalog is printed on the
"what is waiting" page instead of being settled quietly. Write one if the pieces need notes for Harry (which flame
height is a guess, which gate has two leaves); skip it otherwise.

## What is published (under /var/www/implausible-landing/projects/turnip-works)

| path | what |
|---|---|
| `review-lib/` | the asset rater's combined page: every mesh and flat no older run page shows (inn-01, inn-01b, inn-02 and figures-01 keep `review/`, `review-01b/`, `review-02/`, `review-figures/`). One queue, a Batch filter, `?batch=<src>` links. A score is stored as `<src>/<sku>/model`, the key `build_data.py` reads back, so batches cannot collide. The model is the shipping mesh in the deployed tuner (nothing is copied); a flat is an upright card; the source plate is found through the mesh id's hash. |
| `queues/queues.json` | who is in each queue. `queues/bench.json`: the declared water vessels and openables the bench adds to its own rules. `queues/pairs.json`: the closed / open pairs. |
| `queues/` | "What is waiting": live counts per queue, by batch, and the disagreements. The landing page carries the four totals. |
| `align/` | the bench, redeployed. Its fire queue now uses the deployed tuner's own `fireType()`, not a copy. |
| `openclose/pairs/` | every closed / open pair at catalog size, side by side or swapped in place. |

Nothing generated is committed: the lists are rebuilt from the library on each deploy.

## Why one combined rater page

Nine room types as nine pages would be nine queues to remember. One page with "Unreviewed" as the default is one queue
that simply has more in it after a type lands; the Batch filter (and the per-batch links on the landing page) narrows it
when Harry wants one type. Scores still go under each batch's own name.

## Files

`sweep.py` (the lists, the rater data, publishing) · `membership.mjs` (the bench's own `queues.js` + the tuner's own
`fireType`, run in node, so the sweep, the check and the page agree) · `check.py` (the gate) · `waivers.json` ·
`test/tools_check.py` (opens every tool like Harry does; writes go to the test sandbox) · pages in `web/queues/`,
`web/openclose-pairs/`, and the shared rater code in `web/review/`.

Run from the main working tree: a git worktree has no GLBs (`--bin <main tree>` and `--dest <folder>` exist for trying it out).

## One sku, one batch (2026-10-12)

Every mesh ships as one file named for its sku, in a folder all worktrees share. Two batches that pick the same sku
overwrite each other (four times in two days: `scroll-rack`, `apothecary-drawers`, `orb-socket-pedestal`).

- **Before generating:** `python3 tools/tool-sweep/sku_free.py <assets.json | manifest.tsv | names>` lists every planned
  sku already taken on main or by another batch in an in-flight worktree (`../3d-vtt-type-*`, `../3d-vtt-wizard`).
- **The gate:** `sku_guard.py` exits 1 when two batch folders claim one sku with different source models and names both.
  `build_data.py` runs it before it writes anything; `tools/spawn-tuner/deploy.sh` runs it before it copies anything
  (`TW_SKU_GUARD=warn` lets one deploy through). `--worktrees` reads the in-flight trees too; `--all` lists what
  `sku_guard_allow.json` accepts (the inn's own re-generations, and single names settled by hand, each with a reason).
- **The build:** `prep/blender_runtime.py` refuses a job that would replace a mesh built from another batch folder
  (`prep/owner_guard.py`, a `<sku>.glb.owner` note beside each file; `"takeover": true` on the job overrides). A branch
  gets this when it merges main; `sku_guard.py --stamp` writes the notes for files built before.
- **The audit:** `sku_guard.py --live` (browser-venv python) compares every shipped mesh's proportions with its own
  batch's source model and says which, if any, is another batch's mesh.
