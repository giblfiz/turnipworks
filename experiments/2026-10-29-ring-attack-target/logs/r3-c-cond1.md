# r3-c-cond1 — generation and QA

2026-10-29. Built-in image_gen only. Exact verbatim prompts from briefs/r3-c-cond1.md; all three named style references supplied on every call; transparent_background=true. No edit sources. PNGs copied unchanged, with byte equality verified against original outputs. Prompt, references and original output path are recorded in each PNG's .json sidecar.

## pawn.cond.paralyzed

- Tries: 1. Selected try 1; no generation errors or rejected candidates.
- Original: `~/.codex/generated_images/01a188fd-73bd-75b2-9e91-df97278e7aa1/exec-46bdf497-d9e0-4881-873f-36e1705c74e0.png`
- Final: `experiments/2026-10-29-ring-attack-target/sources/charcoal--pawn.cond.paralyzed.png`
- Alpha: 1254 × 1254; corners [0, 0, 0, 0]; centre 252.
- Opened saved PNG and visually inspected: Rigid steel-grey standing figure, arms down, two broad blue lightning zigzags; strong blue/grey contrast. One charcoal circular badge, slate rim, upper-left light and matte painted forms consistent with the supplied set. No text or unrelated symbols.
- Small-size assessment: broad recognizable silhouettes; actual 31 px rendering remains unverified (see limitation below).

## pawn.cond.incapacitated

- Tries: 1. Selected try 1; no generation errors or rejected candidates.
- Original: `~/.codex/generated_images/01a188fd-73bd-75b2-9e91-df97278e7aa1/exec-ea310662-8086-440e-b812-d40b0f9d8bce.png`
- Final: `experiments/2026-10-29-ring-attack-target/sources/charcoal--pawn.cond.incapacitated.png`
- Alpha: 1254 × 1254; corners [0, 0, 0, 0]; centre 253.
- Opened saved PNG and visually inspected: Ash-grey seated slumped figure, bowed head and limp arms, one dark grey cloud. One charcoal circular badge, slate rim, upper-left light and matte painted forms consistent with the supplied set. No text or unrelated symbols.
- Small-size assessment: broad recognizable silhouettes; actual 31 px rendering remains unverified (see limitation below).

## pawn.cond.dead

- Tries: 1. Selected try 1; no generation errors or rejected candidates.
- Original: `~/.codex/generated_images/01a188fd-73bd-75b2-9e91-df97278e7aa1/exec-72a9d74a-8837-4fef-aaa0-7b0088e70457.png`
- Final: `experiments/2026-10-29-ring-attack-target/sources/charcoal--pawn.cond.dead.png`
- Alpha: 1254 × 1254; corners [0, 0, 0, 0]; centre 252.
- Opened saved PNG and visually inspected: Rounded grey gravestone, one broad carved dark cross, dark earth mound. One charcoal circular badge, slate rim, upper-left light and matte painted forms consistent with the supplied set. No text or unrelated symbols.
- Small-size assessment: broad recognizable silhouettes; actual 31 px rendering remains unverified (see limitation below).

## pawn.cond.concentrating

- Tries: 1. Selected try 1; no generation errors or rejected candidates.
- Original: `~/.codex/generated_images/01a188fd-73bd-75b2-9e91-df97278e7aa1/exec-5203ccb0-4a1a-4eb0-80ed-1a75a03a2e26.png`
- Final: `experiments/2026-10-29-ring-attack-target/sources/charcoal--pawn.cond.concentrating.png`
- Alpha: 1254 × 1254; corners [0, 0, 0, 0]; centre 253.
- Opened saved PNG and visually inspected: Front-facing calm gold head, closed eyes, three amber concentric rings at forehead. One charcoal circular badge, slate rim, upper-left light and matte painted forms consistent with the supplied set. No text or unrelated symbols.
- Small-size assessment: broad recognizable silhouettes; actual 31 px rendering remains unverified (see limitation below).

## QA limitation

Attempted a browser-only 31 px display of the unmodified originals. Headless Chromium failed before opening the page with sandbox_host_linux.cc:41, shutdown: Operation not permitted. No screenshot was produced and no pixel processing was performed. Original-size visual inspection and alpha checks passed; the precise 31 px readability check was not completed. All four requested PNGs and JSON sidecars are present.

