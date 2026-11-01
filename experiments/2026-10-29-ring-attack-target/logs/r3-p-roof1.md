# r3-p-roof1 — 2026-10-29

Built-in imagegen edits; all three supplied parchment style references passed with the corresponding charcoal edit source on every call. One try per image. No generation or alpha failures. PNGs copied byte-for-byte from the returned originals, with no pixel post-processing. Exact prompts, references, and original output paths are recorded in each PNG's .json sidecar.

| Subject | Tries | Visual review | Corner alpha | Centre alpha | Final file |
| --- | --- | --- | --- | --- | --- |
| Marble | 1 | Two courses of three white veined slabs; source arrangement retained; dark outline separates marble from parchment | 0,0,0,0 | 253 | sources/parchment--roof.style.marble.png |
| Deck | 1 | Five broad brown planks and low front lip; source arrangement retained | 0,0,0,0 | 253 | sources/parchment--roof.style.deck.png |
| Flagstone | 1 | Five irregular grey-beige stones with thick joints; source arrangement retained | 0,0,0,0 | 253 | sources/parchment--roof.style.flagstone.png |

All outputs opened visually: one parchment circular badge, brass rim, matte painted texture, upper-left light, no text or extra symbols. All are 1254 × 1254. Saved copies verified byte-identical to originals. Thick silhouettes and countable divisions support small-icon readability; 31px readability was judged from structure, without creating resized pixel derivatives. Pixel-exact geometry preservation is not established by visual inspection. The brass rims are somewhat heavier than the small reference rims, following the source badge contours.

