# r3-c-at generation and QA

Generated 2026-10-29 using built-in imagegen, transparent_background=true. Both prompts passed verbatim from briefs/r3-c-at.md, with all three named style references on each call. No pixel post-processing. Saved PNGs verified byte-identical to tool originals. Full prompts, reference paths, and original output paths are in each PNG.json sidecar.

| Icon | Tries | Size | Corner alpha | Center alpha | Final |
| --- | --- | --- | --- | --- | --- |
| attack | 1 | 1254 × 1254 | 0, 0, 0, 0 | 252 | ../sources/charcoal--pawn.attack.r3.png |
| target | 1 | 1254 × 1254 | 0, 0, 0, 0 | 253 | ../sources/charcoal--pawn.target.r3.png |

Opened and visually inspected both original PNGs. Attack: two broad ivory swords in an X, slate guards and round pommels, ochre grips; clear overlap and no extra symbols. Target: one teal pawn within a red ring with four cardinal inward triangular pointers; dark separation, no exterior brackets. Both use a charcoal circular ground, slate rim, matte brushwork, upper-left illumination, and the reference palette. Neither has lettering or numbers. Rim and brush texture are somewhat stronger than the small references; target red is brighter than the prompt's deep-crimson wording, consistent with the damage reference. Retained first attempts.

Small-size silhouette assessment: thick X and contrasting pawn/reticle are simple and recognizable. Actual 31 px browser display remains UNVERIFIED: Chromium launch failed with sandbox_host_linux.cc shutdown: Operation not permitted. The attempted preview only used CSS display sizing and never modified image pixels. No screenshot was produced. This is a QA tooling limitation, not a confirmed image failure. No failed generations or regeneration attempts.
