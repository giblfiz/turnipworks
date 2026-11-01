# Parchment attack / target r3

2026-10-29. Built-in image_gen only. One edit call per image; all three requested parchment references passed on both calls, with the corresponding accepted charcoal image as the first input. No pixel post-processing, resizing, masking, recolouring, or background removal. Saved PNGs are byte-identical to tool originals.

| Image | Try | Size | Corner alpha | Centre alpha | Result |
| --- | --- | --- | --- | --- | --- |
| pawn.attack.r3 | 1 | 1254 × 1254 | 0, 0, 0, 0 | 252 | Selected |
| pawn.target.r3 | 1 | 1254 × 1254 | 0, 0, 0, 0 | 253 | Selected |

Opened and visually inspected both saved files. Attack retains the source crossed-sword arrangement, chunky guards, ochre handles and round pommels; ivory blades become slate. Target retains the central teal pawn and red ring with four inward cardinal pointers. Both use a warm parchment ground, brass rim and matte painted shading, with no added objects or text. Layout preservation was assessed visually, not established pixel-for-pixel. The source rim geometry remains relatively substantial compared with the smaller style references. The target's bottom pointer is very close to the pawn base, as in the source.

Small-size readability assessment: broad X and pawn-in-reticle silhouettes are strong; the very narrow bottom target gap may close at 31 px. This is a visual estimate from the original images, not an actual resized raster test; no resized images were produced. No generation or alpha-check failures, no retries.

Final files:

- `experiments/2026-10-29-ring-attack-target/sources/parchment--pawn.attack.r3.png`
- `experiments/2026-10-29-ring-attack-target/sources/parchment--pawn.target.r3.png`

Each has a `.png.json` sidecar containing the exact prompt, all input references including edit source, and original generator output path.

Original attack output: `~/.codex/generated_images/01a18905-2fa6-7d93-ac7d-50bc03c0c15b/exec-9953f163-1bef-45e3-af2b-4cbd786ad02e.png`

Original target output: `~/.codex/generated_images/01a18905-2fa6-7d93-ac7d-50bc03c0c15b/exec-c4b469d1-7ce0-4e5b-95e9-e0421b57928e.png`
