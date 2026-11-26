# Plates for ASSETS (from SUCH, lane culture-roofs, 2026-11-07)

Three new Mexica meshes for the ballcourt (blind reads called it a "council chamber"). The codex sensitivity read is
`../reads/sensitivity-codex.md` (done BEFORE plating; its changes are in the designs below: plain end walls with no red
band, a black/dark-green centre line, no border or centre dot, a brown-black solid ball, a leather hip guard rather
than a Veracruz stone yoke). Plates: Codex image_gen (free route), `../tools/gen.py`, transparent backgrounds (check
the alpha for haze before TRELLIS, as culture-packs-a found). Every piece is tier `mes` (exclusive), like the pack.

The catalog lines are already written (by SUCH, uncommitted) in `catalog/objects-culture-mesoamerica.catalog.md`;
the room program that places them is in `tools/spawn-tuner/js/solver2.js` (mes-ballcourt). It wishes for them by id and
skips any that are missing, so the room still solves before the meshes land.

| id | size in (W x D x H) | what it is | see-as (what a blind read should say) | priority |
|---|---|---|---|---|
| `mes-court-endwall` | 120 x 24 x 48 | a straight 10-ft section of the LOW wall closing a ballcourt's end zone: thick masonry under smooth cream-white lime plaster, flat top, plain (no paint band, no carving) | "a low plastered stone wall section" | P1 (makes the I-plan) |
| `mes-court-ball` | 10 x 10 x 10 | a solid natural-rubber ball (olli), near-round, brown-black, matte, no seams | "a dark rubber ball" | P1 |
| `mes-court-hip-guard` | 30 x 18 x 8 | a ballplayer's folded leather hip guard with its cloth girdle, laid down (Sahagun, Florentine Codex Book 8), tan-brown | "a folded leather belt / hip pad" | P3 (optional; skip if the pod is short of time) |

Placement (data, solver2.js): the end walls line the two end zones' long sides and close both short ends (a way in in
the middle of each end); the ball lies in the alley near mid-court; the hip guard is not placed yet (if it lands, a
one-line `near` step on the bench end adds it).

Not for ASSETS: `decal-mes-court-line` (the painted centre line, a flat) is SUCH's, in `../flats/`.
Plates (PNG) sit beside this README as they are made: `mes-court-endwall.png`, `mes-court-ball.png`,
`mes-court-hip-guard.png` (each with its `.prompt.md`).


Status 2026-11-07 (SUCH): ASSETS landed mes-court-endwall (measured 120x27x35) and mes-court-ball in the library; the ballcourt program places them (20 pieces at 16x6). The hip guard is not placed (Gemini read its plate as a "ballplayer yoke and sash": a yoke is what the sensitivity read warned against; it stays unplaced unless Harry wants it).

## Re-mesh plates for a LATER pod session (open items, 2026-11-07 ~11:05)
| plate | replaces | why |
|---|---|---|
| `mes-court-endwall-v2.png` (120 x 24 x 36 in) | `mes-court-endwall` | the landed mesh shows text-like specks / "orange graffiti" (Gemini). v2 plate read blind: "a smooth rectangular off-white block", marks: none |
| `ind-stepwell-v2.png` (180 x 180 x 60 in) | `ind-stepwell` (cultures-a) | sunk into the ground (core/holes.js `sunk`), the old mesh's ragged side, stretched over its 15-ft cut, reads "a stretched, distorted wall fragment along one edge". v2: perfectly square plan, whole rim, nothing above it. NOT yet read; after re-meshing, re-measure its `core` (tools/core_rect.py) and rim share (`sunk`) and update PIT_CATS['ind-stepwell'] |
