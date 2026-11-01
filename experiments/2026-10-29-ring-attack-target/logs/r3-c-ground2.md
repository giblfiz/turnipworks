# r3-c-ground2 generation and QA log

2026-10-29T18:55:24.989447+00:00

Built-in imagegen only. Each call used the exact corresponding brief prompt verbatim and all three supplied style-reference paths, with transparent_background=true. No edit source. Final PNGs are byte-for-byte copies of original generated files; no pixel processing. Exact prompts, references and original output paths are recorded in each PNG.json sidecar.

All outputs visually inspected in the generator display. All are single charcoal circular badges with slate rims, upper-left light, matte painted bevels and no lettering. The rims are somewhat broader and brushwork more pronounced than the references. Main subjects are bold and visually separable; actual 31-pixel rendered inspection was attempted with browser CSS sizing but blocked by Chromium sandbox launch failure (Operation not permitted). Small-size readability is therefore a visual estimate, not a verified rendered pass.

## r0
Original: `~/.codex/generated_images/01a188fd-73fa-74d2-afdf-f525ae24ed22/exec-47fd153d-d0b2-4fa4-be6c-f8b421f63fd2.png`
Alpha: 1254 × 1254 RGBA; four tested corners [0, 0, 0, 0]; centre 252.
Rejected: extra rocks, foliage and foreground mounds.

## r0b
Original: `~/.codex/generated_images/01a188fd-73fa-74d2-afdf-f525ae24ed22/exec-db4da254-7e23-473c-9803-e4d1e1732ce4.png`
Alpha: 1254 × 1254 RGBA; four tested corners [0, 0, 0, 0]; centre 252.
Rejected: extra rocks, foliage and foreground mounds.

## r0c
Original: `~/.codex/generated_images/01a188fd-73fa-74d2-afdf-f525ae24ed22/exec-c41e5bf5-503d-4b45-981d-6bbbf98457e0.png`
Alpha: 1254 × 1254 RGBA; four tested corners [0, 0, 0, 0]; centre 253.
Best retained at three-try cap: clear upward arrow and rounded mound, but small grass tufts and foreground relief remain. Strict simplicity check not fully passed.

## r1
Original: `~/.codex/generated_images/01a188fd-73fa-74d2-afdf-f525ae24ed22/exec-efa629db-3d38-475c-b122-eb38c7110295.png`
Alpha: 1254 × 1254 RGBA; four tested corners [0, 0, 0, 0]; centre 253.
Rejected: extra rocks on mound.

## r1b
Original: `~/.codex/generated_images/01a188fd-73fa-74d2-afdf-f525ae24ed22/exec-abb15d8d-dac7-45c3-abec-179f5ff7894d.png`
Alpha: 1254 × 1254 RGBA; four tested corners [0, 0, 0, 0]; centre 252.
Rejected: extra rocks and lumpy foreground.

## r1c
Original: `~/.codex/generated_images/01a188fd-73fa-74d2-afdf-f525ae24ed22/exec-8523745f-c63b-4a51-a6d1-e44486990a38.png`
Alpha: 1254 × 1254 RGBA; four tested corners [0, 0, 0, 0]; centre 253.
Best retained at three-try cap: clear downward arrow and low mound, but small grass tufts remain. Strict simplicity check not fully passed.

## r2
Original: `~/.codex/generated_images/01a188fd-73fa-74d2-afdf-f525ae24ed22/exec-f0791a3f-bab8-49a7-ae5f-aec4a553fde3.png`
Alpha: 1254 × 1254 RGBA; four tested corners [0, 0, 0, 0]; centre 252.
Accepted visual subject: exactly one green-topped brown terrace; no extra symbols or text.

## r3
Original: `~/.codex/generated_images/01a188fd-73fa-74d2-afdf-f525ae24ed22/exec-7025f049-ba84-4c7d-91a9-07ec4ad765c3.png`
Alpha: 1254 × 1254 RGBA; four tested corners [0, 0, 0, 0]; centre 252.
Accepted visual subject: exactly two stacked green-topped brown terraces; no extra symbols or text.

## Final files

- `experiments/2026-10-29-ring-attack-target/sources/charcoal--room.hill.height.raise.png` — r0c; sidecar `experiments/2026-10-29-ring-attack-target/sources/charcoal--room.hill.height.raise.png.json`. Copy equality verified.
- `experiments/2026-10-29-ring-attack-target/sources/charcoal--room.hill.height.lower.png` — r1c; sidecar `experiments/2026-10-29-ring-attack-target/sources/charcoal--room.hill.height.lower.png.json`. Copy equality verified.
- `experiments/2026-10-29-ring-attack-target/sources/charcoal--room.hill.height.10.png` — r2; sidecar `experiments/2026-10-29-ring-attack-target/sources/charcoal--room.hill.height.10.png.json`. Copy equality verified.
- `experiments/2026-10-29-ring-attack-target/sources/charcoal--room.hill.height.20.png` — r3; sidecar `experiments/2026-10-29-ring-attack-target/sources/charcoal--room.hill.height.20.png.json`. Copy equality verified.

Eight generation calls total: raise 3, lower 3, height.10 1, height.20 1. No image missing. Arrow images retained with the noted simplicity deviations at the maximum allowed attempts.
