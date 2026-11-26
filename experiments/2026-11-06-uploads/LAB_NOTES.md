# Lab notes: user uploads and safe harbour (lane "uploads", 2026-11-06)

Harry: "upload meaning users can upload models (and safe harbor setup)". The doc is docs/UPLOADS.md; the legal drafts are
docs/legal/ (excluded from the public export). These are the working notes: what was tried, what broke, what was learned.

## Timeline (times approximate)

- **22:05** Read the lane rules, docs/IMPORTS.md, ASSET_DELIVERY.md, PRODUCT_DIRECTIONS.md, the wiki's sharing-builds and
  licensing nodes. Tension found at once: IMPORTS "Decided" says the conversion runs in the importer's browser and "no
  server-side conversion of strangers' files"; the lane brief asks for server-side processing in a sandbox. Took the brief
  (a stranger's bytes must be rebuilt before we serve them, whatever the browser did) and wrote the reason down.
- **22:15** The sandbox's primitives on the build box: unprivileged user namespaces are OFF (`unshare -rn` fails), so no network
  namespace. Node 22's permission model works (`--permission`, `--allow-fs-read/-write`, no child processes), sharp loads
  under `--allow-addons`. Network is not covered by node 22's model, so `sandbox.mjs` shuts sockets, DNS, HTTP and fetch
  in-process. `prlimit` (CPU, file size) + `nice` + a wall clock + an RSS watch. `RLIMIT_AS` is useless with wasm (V8
  reserves huge virtual ranges), hence the RSS watch.
- **22:25** First converter run on real files: the Import Lab's gnome (28,858 → 20,000/4,999/1,500 triangles, 1.9 s), a
  library figure, a delivered meshopt mesh (decoded and re-tiered), all validator-clean.
- **22:30** Fixture run hung: the Khronos validator, run on the ORIGINAL before our structural checks, spun on an accessor
  claiming a billion elements. Moved it after `cleanGltf`. Lesson: even the validator is a parser of hostile input; bound
  the input before any library sees it.
- **22:35** Two surprises from gltf-transform: `normals()` makes FLAT normals by unwelding every triangle (so the simplifier
  had nothing to collapse: 59,858 → 59,684); and `prune()` folds a solid-colour texture into the material factor (a test
  fixture's red PNG vanished). Wrote area-weighted smooth normals; made the fixture's texture noise.
- **22:45** A texture on a part with no UVs fails validation (MESH_PRIMITIVE_TOO_FEW_TEXCOORDS): that part now loses its
  pictures, said in the notes.
- **23:00** Relay suite: 119/119, then the adversarial review (GPT via `codex exec`) found real holes in the machinery,
  not just the drafts: a global restore let one campaign's counter-notice override another's takedown; termination was
  erased by a restore; unforwarded counter-notices waited forever; deficient notices were discarded; and, biggest, prod
  would have hosted private uploads before an agent was registered. All fixed, each with a test (docs/legal/
  ADVERSARIAL_REVIEW.md lists them). Suite: 137/137.
- **23:20** Browser suite 30/30 (32/32 after a select-and-move check was added) with the gnome: upload, picture, place, the player sees it, delete, notice, takedown, the
  player's marked box, the counter-notice from the game.

- **23:50** Gemini (agy-run, gemini-4-argon-high, blind folder), two passes. First: the Up select truncated ("Automatic (an STL sta"), the counter-notice checkboxes sat above their words, and the player's pictures showed only fog of war (the fixture had it on). Fixed (short labels with a tooltip, checkbox beside its words, the test opens the table). Second pass: section and list clean, no horizontal scroll; the gnome stands upright on the floor, about chair height (4 ft as set), textured, on the GM's and the player's tables; after the takedown the player sees a box labelled "Model removed (notice)"; the counter-notice form clean.
- **23:55** Settings suite 88/89 and build suite 99/99 (the one settings failure, "the geometry tier applies", fails on unchanged main too). Two build-suite failures earlier were the worktree missing git-ignored icons (engine/client/data/icons, the ui-icons painted sets): linked from main, then 99/99.

## Measurements

| file | in | tiers (triangles) | bytes t0 / t2 | ms |
|---|---|---|---|---|
| garden gnome (Import Lab sample) | 28,858 tris, 3 textures | 20,000 / 4,999 / 1,500 | 396 KB / 61 KB | 1,962 |
| beast-bear figure | 7,999 | 7,999 / 5,225 / 1,500 | 208 KB / 60 KB | 866 |
| acorns pile (meshopt-compressed input) | 10,000 | 10,000 / 4,995 / 1,500 | 99 KB / 22 KB | 171 |
| dense test sphere, 2048 px texture without UVs | 59,858 | 19,999 / 5,000 / 1,499 | 85 KB / 10 KB | 989 |

(Direct `convert()` timings on the build box; inside the box add ~0.3 s of node start-up.)

## Money

$0. No paid generation; GPT through `codex exec` (ChatGPT plan), Gemini through `agy-run`.

## Open threads

- A persistent uploader identity (both reviewers' first fix). Harry's call.
- The separate cookieless serving domain from IMPORTS "Decided": not built; headers stand in for now.
- Browser-side reduction (the Import Lab's code) as the front end for files over 500,000 triangles: not wired into the
  upload window; the window points at the Import Lab in its error message.
