# r3-c-roof5 — generation and QA

2026-10-29. Built-in imagegen only. Exact prompts from the brief; all three specified style references supplied on every call. Transparent background requested. PNGs copied byte-for-byte, without pixel processing.

Visual inspection: all six original generated images were opened in the tool output. Charcoal grounds, slate rims, matte painted bevels and upper-left lighting match the set. No text or unintended symbols. Thick silhouettes support small-size reading; 31px readability assessed from forms, without creating resized files.

| File | Tries | Corner alpha | Centre alpha | Result |
|---|---:|---|---:|---|
| `charcoal--roof.shape..png` | 1 | [0, 0, 0, 0] | 252 | Two distinct roofs, steep teal left and flat grey right; accepted. |

Final: `experiments/2026-10-29-ring-attack-target/sources/charcoal--roof.shape..png`
Original: `~/.codex/generated_images/01a188fd-73fa-76d1-9d85-81316add562d/exec-f3c87dd8-1dc7-40c0-8bae-66d2be8ed4d7.png`

| `charcoal--roof.shape.gable.png` | 3 | [0, 0, 0, 0] | 252 | Best of three retained: clear two-slope gable silhouette, but triangular end is open rather than a flat gable wall. Does not fully pass subject QA. |

Final: `experiments/2026-10-29-ring-attack-target/sources/charcoal--roof.shape.gable.png`
Original: `~/.codex/generated_images/01a188fd-73fa-76d1-9d85-81316add562d/exec-e8e6b414-661a-46b4-b385-6af3479a11ee.png`

| `charcoal--roof.shape.hip.png` | 1 | [0, 0, 0, 0] | 253 | Short ridge and sloping ends, no gable wall; accepted. |

Final: `experiments/2026-10-29-ring-attack-target/sources/charcoal--roof.shape.hip.png`
Original: `~/.codex/generated_images/01a188fd-73fa-76d1-9d85-81316add562d/exec-aff89862-d4af-4560-9caa-361826157d80.png`

| `charcoal--trim.reset.png` | 1 | [0, 0, 0, 0] | 253 | Red-brick chimney, short teal slope and one ivory return arrow; accepted. |

Final: `experiments/2026-10-29-ring-attack-target/sources/charcoal--trim.reset.png`
Original: `~/.codex/generated_images/01a188fd-73fa-76d1-9d85-81316add562d/exec-65654348-8ba6-42ef-8756-950b0bbadbf2.png`

## Gable retries

Attempt 1: `~/.codex/generated_images/01a188fd-73fa-76d1-9d85-81316add562d/exec-cd02f445-3dd8-4e9f-9af2-0390f1d68cfe.png` — rejected: tiled sloping triangular end reads as hip rather than flat gable. Alpha corners 0; centre 253.
Attempt 2: `~/.codex/generated_images/01a188fd-73fa-76d1-9d85-81316add562d/exec-87d43b1e-701c-4d98-8601-9f49dc780fd3.png` — rejected: same structural mismatch. Alpha corners 0; centre 253.
Attempt 3 retained at the required destination; open triangular end remains a disclosed limitation. Three-attempt cap respected.

All final images are 1254×1254. JSON sidecars preserve the exact prompt, reference paths, and original output path.
