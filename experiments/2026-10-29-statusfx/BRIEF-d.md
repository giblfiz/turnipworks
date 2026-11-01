# Image brief: d

Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that draws anything: every picture must come from image_gen. (Python/PIL may only CHECK files and resize.)

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim). Save it as `art/<id>.png` in this folder.

Then open your own result and check: (1) exactly one subject as described, whole, clear margin on every side; (2) the background is what the prompt asks (transparent: check with PIL that the PNG has an alpha channel and its four corners are alpha 0; black: corners pure black); (3) the right subject and colour; (4) no text or letters beyond any glyph the prompt explicitly allows. If a check fails, generate again (at most 3 tries per shot) and keep the best.

Append one line per shot to `LOG-d.md`: id, tries, checks passed/failed, one sentence on what it shows. Finish each shot (file saved, LOG line written) before the next. When all are done write `art/DONE-d` listing the saved ids. Then stop.

## Shots

### base-runes
Size: 1024x1024

Prompt:

Asset for Turnip Works, a rustic fantasy tabletop game. A flat MAGIC RUNE CIRCLE seen exactly from straight above (top-down, orthographic), to be laid on the floor around a miniature's base: a ring band of hand-painted glowing arcane runes between two thin concentric circles, warm GOLD with a soft amber glow, the centre completely EMPTY (a clear round hole, the miniature stands there, about 60% of the diameter). Perfectly round, centred, filling about 92% of the square frame. Genuinely TRANSPARENT background and transparent centre. No text in any real alphabet, no letters, no figure, no floor.

### base-drain
Size: 1024x1024

Prompt:

Asset for Turnip Works. A flat RING made of exactly SIX separate thick curved segments with clear even gaps between them, seen exactly from straight above (top-down, orthographic), like a segmented health meter around a coin: PURE WHITE segments on a PURE BLACK background (#000000), nothing else. One gap is exactly at 12 o'clock and the others every 60 degrees (at 2, 4, 6, 8 and 10 o'clock). Each segment is a chunky rounded band, all six identical. The centre is empty black (about 70% of the diameter). Perfectly round, centred, filling about 92% of the frame. No glow, no text, no shading, no texture.

### plate-label
Size: 1536x1024 (landscape)

Prompt:

Asset for Turnip Works, a cosy rustic fantasy tabletop game with hand-painted miniatures. One small BLANK wooden PLAQUE / sign plate for a short word, seen straight on: a wide rounded-rectangle (about 4 times as wide as tall) of dark warm wood with a thin painted cream border and slightly rounded corners, flat and simple, a little painted wood grain, completely EMPTY in the middle (no text, no letters, no symbols: words are added later). Fills the frame width with a small margin. Genuinely TRANSPARENT background, no shadow, no nails, no chains.
