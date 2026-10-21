# Blind picture read, 2026-10-13

`gemini-2.5-pro`, API via `~/fauna-tools/gemini-vision.py`, temperature 0.2. Prompt in `prompt.txt`, unedited answer in `read.txt`. Generic frame filenames avoided telling the reader which fog state to expect. Images are local evidence, not required source assets.

Frames 1–5 correspond to `engine/test/shots/fog/01-unseen.png`, `02-visible.png`, `03-explored.png`, `05-flat-fog-off.png`, and `06-flat-low.png` from the first 31/31 browser integration pass. The reader identified the clear starting room and ghostly explored furniture, and observed the sentinel label disappear. It mistook the raster sight boundary for stairs. That is a visual concern, not evidence of physical stairs; the sight polygon/pawn assertions are independently checked by `browser_fog.py`.

## Final local render, 41/41 checks

`read-final.txt` repeats the same prompt and model against freshly copied generic frames in `final/` after the composer, visible-pawn mask, ruler-overlay, and explored-edge softening changes. Frame mapping is unchanged. The reader identifies the clear starting room, a sentinel label appearing and disappearing, and ghost-like furniture in the flat fallback. It does not identify the second player's overlapping label and describes the partial sight wedge sparsely. My inspection still finds a stepped orange rim at the coarse explored boundary and overlapping pawn labels; the near-wall label clipping was reported to the renderer owner. This remains a sanity check, not a visual verdict or proof that all details read correctly.
