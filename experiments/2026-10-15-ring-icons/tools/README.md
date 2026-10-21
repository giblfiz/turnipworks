# Ring icon packaging and blind reads

`process.py --once` packages every available source in `../plan.json`; `--follow`
checks for new plan/source files every ten seconds. Run with
`python3`. Only one writer should run.
Sources may be absolute, repository-relative, or experiment-relative. Each picture
has `id`, `set`, numeric `alt` (zero for the primary), `metaphor`, exact `prompt`,
`actions` (registry IDs), `source`, and optional `refs` / `references`.
`inventory.json` supplies action titles. Missing source files remain pending;
fully opaque sources are rejected for regeneration with native alpha.

The script preserves native alpha, pads rectangular images transparently, and
uses Lanczos resizing into lossless WebP. It emits 128 px main files plus size
copies covering the default ring and the minimum/maximum slider sizes at 1x/2x.
The 128 px source supports intermediate slider settings. It does not paint,
mask, recolour, remove backgrounds, or invent missing assets. Contact sheets
show actual 31 px and 128 px art, without upscaling the small preview.

The manifest's `file` and `sizes` paths are relative to
`tools/spawn-tuner/assets/ui-icons/manifest.json`. Multiple actions can share one
picture. Every variant uses the same fields: `set`, `alt`, `file`, `metaphor`,
`sizes`, `sha256`, and `blindRead`. Actions with no available source have an empty
variants array, so completeness is checked by coverage, not action count alone.

Blind gating uses three concurrent `gemini-3.1-pro-preview` calls, each seeing
only a neutral `candidate.png`: the icon is 31 px, centered on 67 px of the game's
`#1c1f24` ring ground. No intended action, metaphor, or descriptive filename is
passed. Source-and-prompt-hash-addressed evidence in `reads/` retains old attempts.
The shared prompt supplies only the contextual-menu/selected-piece surface,
never an action name, ID or metaphor. Original generic-context reads and
decisions remain in `reads/` and `review-round1.json`, with first-round
provenance and READS snapshots. Results
are cached; `--retry-errors` explicitly retries failed calls. `--no-gates` does
packaging alone and leaves unread images marked `not-read`. A successful model
call yields `needs-review`, never acceptance. `READS.md` is generated evidence:
store human/coordinator decisions in `review.json`, mapping
`<set>/<id>[--altN]` to `{"status": "accepted"|"learned"|"rejected",
"note": "reason"}`. These flow into manifest and READS once the model call
has succeeded. Never annotate READS directly while the watcher runs. Provenance JSON records exact prompts, references, native and
export hashes, processing, candidate hash, and the blind prompt/model.

`validate.py --allow-pending --report ../validation/contract-partial.json`
checks available work without passing missing generation or review off as done.
For the landing gate, stop the watcher and run `validate.py` without
`--allow-pending`. This requires every planned picture and every inventory
entry's primary in both sets, all 15 size files with correct dimensions and
transparent corners, matching source/export hashes and exact provenance,
neutral 31 px candidates and successful model reads, and explicit `accepted`
or `learned` decisions with notes. Any rejected picture fails even partial
validation. Duplicate JSON keys, variant collisions, incorrect aliases, and
unplanned manifest entries also fail. `--report` accepts a path relative to
the current working directory.

Current evidence accessor for scripts: import `tools/process.py` and call
`read_directory(pic)` with the plan picture dictionary. It returns
`reads/<set>/<stem>/<source-sha16>-<prompt-sha10>/`. The same path appears in
provenance `read_directory` and manifest variant `blindRead.evidence` (relative
to this experiment). Shared style comparison sheets pair the same primary
picture in adjacent cells, independent of per-set alternate counts.

## Round 2: specific condition reads and sibling distinctions

A plan picture may specify `blind_prompt` (or `blindPrompt`); its exact text
replaces the general selected-piece protocol only for that picture. Default
pictures retain the original prompt hash and evidence paths. `read_directory`
and `blind_prompt` are the shared accessors used by packaging, validation and
`unreviewed.py`; no intended title or descriptive filename reaches the reader.

`confusion.py --follow` prepares ten-way matching sheets as soon as the current
condition exports exist. It obtains condition IDs from `round2-arcs.json`,
checks primary sets plus each single-condition alternate substitution, and
shows only shuffled letters A–J below actual 31 px icons. The model receives
`candidate.png` plus an independently shuffled list of the ten condition names.
Local `answer-key.json` retains the exact assignment, native/export hashes,
seed, prompt and candidate hash. Results, deterministic matching scores and
confusions remain evidence; they never accept an icon automatically. Options:
`--once`, `--no-gates`, `--set charcoal`, `--configuration primary`,
`--allow-pending`, and explicit `--retry-errors`. Hash-addressed directories
preserve earlier sheets/reads if any source changes.

The strict validator uses `round2-arcs.json` to reject identical files or image
bytes among simultaneously visible choices, across every alternative in a set.
Specific D&D condition pictures require `accepted`; `learned` does not pass.
Existing faction-emblem swatches and the dynamic-destination boundary appear
explicitly under report `limitations`;
a static asset audit does not claim to paint arbitrary destination names. All six
roof options now have distinct painted families and pass the sibling audit.
All fourteen current condition configurations also require a complete 10/10
one-to-one match without uncertainty and an explicit accepted review in
`confusion-review.json`; source, prompt and evidence hashes must still match.
