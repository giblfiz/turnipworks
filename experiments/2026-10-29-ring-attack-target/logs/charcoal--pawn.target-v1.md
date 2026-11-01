# charcoal--pawn.target — no passing result

Timestamp: 2026-10-29T14:28:22.178700+00:00

Used built-in image generation with the exact brief prompt and transparent_background=true. Four attempts total. No references were fed to the generator; all four reference icons were opened for visual comparison after the first generation. No pixel modifications were made.

| Try | Original filename | Corners alpha | Center alpha | Result |
| --- | --- | --- | --- | --- |
| 1 | exec-5d1cec87-f96c-41fc-8700-911ffd28a334.png | 0,0,0,0 | 253 | Failed opaque-disc requirement |
| 2 | exec-42b69d83-c193-4363-9673-0b6136927619.png | 0,0,0,0 | 253 | Failed opaque-disc requirement |
| 3 | exec-d7cafcc4-6685-430e-97ed-b2d69a6f6b51.png | 0,0,0,0 | 253 | Failed opaque-disc requirement |
| 4 | exec-dc147ee0-b469-4d12-aaab-ee3d6c29cb1e.png | 0,0,0,0 | 253 | Failed opaque-disc requirement |

All originals are in `~/.codex/generated_images/01a1880b-b53d-7761-9e4e-a6d799d2c0f1/`. All images were visually inspected in tool output and checked using Pillow after copying unmodified to the requested path. Each is 1254 × 1254. Attempts 2–4 additionally have interior alpha extrema 251–254.

Visual QA: all show one teal pawn, one red ring, four inward cardinal triangular pointers and four red corner brackets, without text or extra symbols. Thick silhouettes remain legible at mentally reduced 31px. Charcoal ground, slate rim and painted highlights resemble the reference family, though the rim is heavier than the references and attempts 1–2 fill nearly the entire canvas. Attempt 3 has the closest disc occupancy. None passes alpha QA.

Final PNG: absent. Removed the failed candidate from `experiments/2026-10-29-ring-attack-target/sources/charcoal--pawn.target.png` because the brief permits only a passing result there. Original outputs remain untouched. The requested JSON records the exact prompt and last original output path for provenance; it is not an acceptance record. Stopped at the four-attempt limit without masking, background removal, recolouring or resizing.
