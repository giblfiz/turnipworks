# Image brief: die-face symbols

You are generating flat face SYMBOLS that get printed on 3D game dice (a decal on each face of a die). Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates or draws images: every picture must come from image_gen. (Python/PIL is allowed only to CHECK files.)

These are ORIGINAL symbols for our own product. They must NOT copy or imitate any published game's dice glyphs (no Fantasy Flight / Asmodee / Renegade / Paradox / Catalyst / Wizards symbols, no ankh, no Japanese mon or kanji, no letters, no numbers). Simple, bold, generic shapes only.

Common style for EVERY shot (append it mentally to each prompt; the prompts below already include it):
one single bold flat symbol, warm ivory-cream fill (#f4e6c4) with a thick dark brown-black outline (#1a1008) of even width, a faint painted highlight on the upper-left of the fill, heroic hand-painted miniature-game style, chunky simple silhouette that still reads when it is only 40 pixels wide, centered, filling about 70% of the square with clear empty margin on every side, genuinely transparent background, no shadow, no frame, no circle or badge behind it, no text, no letters, no numbers.

For each shot: generate ONE image, size 1024x1024, transparent background. Save it as `out/<id>.png` (create `out/`).
Then look at your own result and check: (1) exactly one symbol, whole, centered, clear margin on every side; (2) genuinely transparent background (check with Python/PIL: the PNG has an alpha channel, the four corners are alpha 0, and at least 15% of the pixels are opaque); (3) it is the requested shape and reads at a glance when you imagine it 40 px wide; (4) cream fill with dark outline, no text/letters/numbers, no background badge; (5) it does not resemble any published game's dice glyph. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite only with a better one.

Append one line per shot to `LOG.md`: id, tries, checks passed/failed, one sentence on what it shows. Do the shots in order, each one completely (file saved, LOG line written) before the next. When all are done write `out/DONE` listing the saved ids.

## Shots

### sym-success
A bold upward-pointing SPEARHEAD: a broad leaf-shaped blade point with a short straight socket below it, perfectly symmetric, pointing straight up. Style: one single bold flat symbol, warm ivory-cream fill with a thick dark brown-black outline, faint painted highlight upper-left, heroic hand-painted miniature-game style, chunky silhouette, centered with clear margin, transparent background, no shadow, no badge, no text.

### sym-opportunity
A bold simple FIVE-PETAL BLOSSOM seen from the front: five round fat petals around a small round centre (the centre a slightly darker cream), symmetric. Style: one single bold flat symbol, warm ivory-cream fill with a thick dark brown-black outline, faint painted highlight upper-left, heroic hand-painted miniature-game style, chunky silhouette, centered with clear margin, transparent background, no shadow, no badge, no text.

### sym-strife
A bold jagged FORKED CRACK like a lightning bolt: one thick zig-zag bolt from top-right to bottom-left with three sharp angular bends, chunky and wide, no thin parts. Style: one single bold flat symbol, warm ivory-cream fill with a thick dark brown-black outline, faint painted highlight upper-left, heroic hand-painted miniature-game style, chunky silhouette, centered with clear margin, transparent background, no shadow, no badge, no text.

### sym-explosive
A bold upward-pointing leaf-shaped SPEARHEAD (the same kind of spearhead: broad blade point, short socket) in the middle, with eight short thick triangular RAYS bursting outward all around it like a starburst, the rays separate from the spearhead by a small gap. Style: one single bold flat symbol, warm ivory-cream fill with a thick dark brown-black outline, faint painted highlight upper-left, heroic hand-painted miniature-game style, chunky silhouette, centered with clear margin, transparent background, no shadow, no badge, no text.

### hunger-ten
Two long sharp curved FANGS side by side pointing down (like a predator's upper canine teeth, nothing else of the mouth), with one fat round drop falling from the tip of the left fang. Style: one single bold flat symbol, warm ivory-cream fill with a thick dark brown-black outline, faint painted highlight upper-left, heroic hand-painted miniature-game style, chunky silhouette, centered with clear margin, transparent background, no shadow, no badge, no text.

### hunger-one
Three thick parallel diagonal CLAW SLASHES, like a beast raked the surface: three long tapered torn strokes from upper-right to lower-left, each wide in the middle and pointed at both ends, side by side with even gaps. Style: one single bold flat symbol, warm ivory-cream fill with a thick dark brown-black outline, faint painted highlight upper-left, heroic hand-painted miniature-game style, chunky silhouette, centered with clear margin, transparent background, no shadow, no badge, no text.
