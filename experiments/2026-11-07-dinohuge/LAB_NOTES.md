# dinohuge lane, 2026-11-07 (Fauna, Claude Opus 5.5)

Harry: bump the T-Rex (foe-tyrannosaur) and Triceratops (foe-triceratops) from large (10-ft base) to huge (15-ft base),
as 5e has them and as the seven new dinosaurs are. Then (mid-lane): "The standing [pterodactyl] needs to be thrown away.
For now let's just use the flying one as standing."

## How the engine sizes a figure (read, not changed)
- `size` (squares a side) comes from the row's `base_ft` (build_figures.py: round(base/5)). The base disc is 80% of it.
- The drawn height is the row's own `h` (scale `k` = feet per mesh unit, measured to the stated height), independent of
  the base, times the house FIGURE_SCALE (0.67) and figureK (squares on the table / the figure's made size).
- So a base change alone leaves the T-Rex 12 ft on a 15-ft base. Chosen: scale the whole figure by the base ratio, 1.5x
  (12 -> 18, 7 -> 10.5): exactly what the engine already drew for a T-Rex resized to huge, and a pawn saved as large still
  draws 12 ft (figureK 2/3). T-Rex now taller than spinosaurus (15) and stegosaurus (12); triceratops under the stegosaurus.
- Ground: the engine puts the mesh's lowest point on the disc (client/figures.js), so a flying pose stands on its feet/belly.

## What was run
- set_more.py RESIZED (base 15, heights x1.5; prompts kept as the record) -> set/assets.json patched to match (checked:
  set_spec.py run in a scratch copy gives the same rows, the absolute `refs` paths aside).
- remeasure.py: set_qa.one() (unchanged code; tier re-cut stubbed, the mesh did not change) and publish.py (unchanged) in a
  scratch mirror; refuses if any other row changes. scale 13.16 -> 19.75 and 11.61 -> 17.43 (x1.501). measure.py is not
  exactly deterministic (a second run: 19.7436 vs 19.7508). The triceratops' `floating` count went 1 -> 36: the loose-piece
  thresholds are in feet, so a bigger figure crosses them; verdict still accept, only near-body bits noted.
- dinos/stand_as_fly.py: the pterodactyl's pack row takes its fly manifest's mesh, frame, thumbnail, sha and plate.
- build_figures.py (754 rows, 3 changed), build_review.py (754/754; output on USB, the two json copied to web/review-figures).
- A trap: build_figures/build_review read a pack's binaries from the WORKTREE when its manifest is there; linked
  tiers/thumbs/models from main (untracked symlinks, never committed).

## Gemini blind read (blind.py, agy-run, never told before/after)
- Before: "the Tyrannosaurus rex is too small ... shorter than the Stegosaurus and Spinosaurus on an undersized base"; the
  standing pterodactyl read as a "Protoceratops".
- After: "overall scale is well balanced after the T-Rex enlargement"; T-Rex height rank 2 of 9 (after the brontosaurus).
  The triceratops change was not named as a difference (rank 6 both times). Pterodactyl: "Pteranodon ... wings spread",
  "feet rest directly on the top surface of the round base ... neither floating nor sunken".

## Stills (USB: /mnt/usb/turnip-works/lanes-2026-11-07/dinohuge/)
before/, after/ (lineup.py: low camera and play pitch), ptero-stand/ (leaning in), contact-sheet.jpg.

Spend: $0.
