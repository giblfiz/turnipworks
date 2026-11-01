# r3-c-cond2 generation log

2026-10-29. Built-in imagegen; four separate calls, exact brief prompts, all three style references passed on every call, transparent_background=true. No pixel post-processing. Each PNG copied byte-for-byte from the generator output. Prompts, reference paths and original output paths are in the adjacent .png.json files.

| Final file | Tries | Corner alpha | Centre alpha | Result |
|---|---:|---|---:|---|
| `experiments/2026-10-29-ring-attack-target/sources/charcoal--pawn.cond.exhaustion.up.png` | 1 | [0, 0, 0, 0] | 252 | Accepted |
| `experiments/2026-10-29-ring-attack-target/sources/charcoal--pawn.cond.exhaustion.down.png` | 1 | [0, 0, 0, 0] | 253 | Accepted |
| `experiments/2026-10-29-ring-attack-target/sources/charcoal--pawn.cond.other..png` | 1 | [0, 0, 0, 0] | 252 | Accepted |
| `experiments/2026-10-29-ring-attack-target/sources/charcoal--pawn.cond.other.png` | 1 | [0, 0, 0, 0] | 253 | Accepted |

Visual inspection: all four generated images were displayed and inspected. Each contains one charcoal circular badge with a slate rim, upper-left lighting and chunky painted forms consistent with the supplied set. Exhaustion icons have a sagging ochre head, half-shut eyes, one sweat drop and the requested right-hand sign. Custom-condition icons have one ivory tag and the requested teal checkmark or plus. No lettering, numbers or unrelated subjects. The exhaustion colours are brighter/golder than the phrase dusty ochre, but consistent with the supplied painted head reference.

Small-size readability assessed from the broad silhouettes and thick isolated symbols; no resized pixel artifact was created, respecting the no-resize instruction. No separate literal 31px render was inspected. No failed generations or retries. All originals are 1254 × 1254; native alpha preserved.
