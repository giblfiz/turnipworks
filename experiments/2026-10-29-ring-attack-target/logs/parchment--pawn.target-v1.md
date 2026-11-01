# Parchment pawn.target generation QA — 2026-10-29

Status: FAILED acceptance after the maximum four attempts. No passing final PNG or provenance sidecar was installed in sources/.

Used the built-in image generation tool, with the brief prompt verbatim and transparent_background=true on every attempt. No reference images were supplied to the generator. All four reference PNGs were opened for comparison. Generated PNGs were inspected visually and checked with Pillow; no pixels were modified.

| Try | Original generated filename | Size | Corner alpha values | Center alpha | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | exec-43f31b28-a040-4d8e-867f-c602cbdc880d.png | 1254×1254 | 0, 0, 0, 0 | 253 | Fail: disc not fully opaque |
| 2 | exec-c69a601b-1bab-4ed1-853f-547be5e36704.png | 1254×1254 | 0, 0, 0, 0 | 252 | Fail: disc not fully opaque |
| 3 | exec-1f2321d5-595e-477d-9889-9798b81d94b2.png | 1254×1254 | 0, 0, 0, 0 | 253 | Fail: disc not fully opaque |
| 4 | exec-421fd7d4-8126-4a9c-89a9-3135bdb9e0ce.png | 1254×1254 | 0, 0, 0, 0 | 253 | Fail: disc not fully opaque |

All original filenames above are under `~/.codex/generated_images/01a1880b-b538-70b0-9e02-a48ee0edf58e/`.

Visual inspection: each has one teal pawn inside one red ring, four inward cardinal triangular pointers and four external corner brackets. No text or extra scene. Chunky silhouettes retain the targeting read when mentally reduced to 31 px. Warm parchment, brass edging, teal pawn and painted bevels are consistent with the reference family, though the rim is heavier and the disc occupies more than the requested 94% of the canvas. Transparency check definitively rejects every attempt: center alpha must be 255 for an opaque disc. No postprocessing was performed to repair this.

Final file: none. The brief requires only a passing result at `sources/parchment--pawn.target.png`; all four attempts failed, so that destination was not populated. Stopped at the stated four-try limit.
