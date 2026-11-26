# Image brief: fth flatsA (flat pieces)

You are painting flat game art (wall hangings, wall roundels, floor emblems, picker icons) for a heroic hand-painted tabletop game. Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates or draws images: every picture must come from image_gen. Any size is fine; the sizes below are a preference.

The attached image `style-anchor.png` (in this folder) is the house STYLE guide only: match its painting style, never its contents.

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim) with a genuinely transparent background. Save it as `flats/<id>.png` in this folder (create `flats/` if missing).

Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side; (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the four corners are alpha 0); (3) it shows what the prompt asks, accurately (these are SACRED symbols of real faiths: a cross, a dharma wheel, the Om sign, a figure of the Buddha: they must be drawn correctly and respectfully); (4) NO text, letters, numbers or script-like marks anywhere (the Om sign, where asked for, is the only exception). If a check fails, generate again (at most 3 tries per shot) and keep the best.

Append one line per shot to `LOG-flatsA.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Finish each shot completely before the next. When all are done, write `flats/DONE-flatsA` listing the saved ids.

## Shots

### flavor-banner--christian
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art (match the attached style image's painting style, never its contents). One flat processional BANNER of a Gothic church, straight front-on: deep red silk with a broad gold border, in its middle a large plain gold LATIN CROSS; it hangs from a short horizontal gilt crossbar along its top, its bottom edge cut into three points each with a small gold tassel. Stout connected forms, broad shapes, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object, centered, generous clear margin, no scene or additional objects. ABSOLUTELY NO TEXT: no letters, words, numbers, calligraphy, runes or anything that looks like script, in any language. Genuinely transparent background. Orthographic flat artwork suitable for a game texture.

### flavor-relief--christian
Size: 1024x1024 (square)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art (match the attached style image's painting style, never its contents). One flat round carved limestone ROUNDEL, straight front-on: a Gothic QUATREFOIL (four-lobed frame) carved in relief, inside it a plain equal-armed CROSS with small flared ends, gilded; wide bevelled stone border. Relief shading painted into a mostly flat face; no wall behind. Stout connected forms, broad shapes, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object, centered, generous clear margin, no scene or additional objects. ABSOLUTELY NO TEXT: no letters, words, numbers, calligraphy, runes or anything that looks like script, in any language. Genuinely transparent background. Orthographic flat artwork suitable for a game texture.

### flavor-sigil--christian
Size: 1024x1024 (square)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art (match the attached style image's painting style, never its contents). One flat circular PAVEMENT LABYRINTH seen exactly top-down: the medieval Chartres-type eleven-circuit labyrinth laid in pale limestone paths between thin dark stone lines, a single winding path from the opening at the bottom to the six-lobed rosette at the centre; a ring of small dark scallops (lunations) round the outside. Stout connected forms, broad shapes, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object, centered, generous clear margin, no scene or additional objects. ABSOLUTELY NO TEXT: no letters, words, numbers, calligraphy, runes or anything that looks like script, in any language. Genuinely transparent background. Orthographic flat artwork suitable for a game texture.

### flavor-banner--buddhist
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art (match the attached style image's painting style, never its contents). One flat Tibetan THANGKA, straight front-on: a painted scroll in a mount of maroon and gold brocade with a dark blue lower border; in the painted panel the BUDDHA SHAKYAMUNI seated cross-legged on a lotus, serene, gilt skin, a red robe, his right hand reaching down to touch the ground and the left in his lap, a green-and-gold halo behind him, on a plain deep-blue ground with a few soft clouds. NO inscriptions, no lettering anywhere, no other figures. Stout connected forms, broad shapes, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object, centered, generous clear margin, no scene or additional objects. ABSOLUTELY NO TEXT: no letters, words, numbers, calligraphy, runes or anything that looks like script, in any language. Genuinely transparent background. Orthographic flat artwork suitable for a game texture.

### flavor-relief--buddhist
Size: 1024x1024 (square)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art (match the attached style image's painting style, never its contents). One flat round ROUNDEL, straight front-on: a gilt EIGHT-SPOKED DHARMA WHEEL (a hub with a small swirl, eight straight spokes, a rim) carved in relief on a disc of deep red lacquered wood with a gilt bevelled border. Stout connected forms, broad shapes, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object, centered, generous clear margin, no scene or additional objects. ABSOLUTELY NO TEXT: no letters, words, numbers, calligraphy, runes or anything that looks like script, in any language. Genuinely transparent background. Orthographic flat artwork suitable for a game texture.

### flavor-sigil--buddhist
Size: 1024x1024 (square)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art (match the attached style image's painting style, never its contents). One flat circular floor emblem seen exactly top-down: an ornamental EIGHT-PETALLED LOTUS flower inlaid in polished stone, cream and saffron petals on a maroon ground, a gold ring round it. Only the flower and the ring. Stout connected forms, broad shapes, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object, centered, generous clear margin, no scene or additional objects. ABSOLUTELY NO TEXT: no letters, words, numbers, calligraphy, runes or anything that looks like script, in any language. Genuinely transparent background. Orthographic flat artwork suitable for a game texture.

### flavor-mat--buddhist
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art (match the attached style image's painting style, never its contents). One flat long low SEATING RUNNER of a Tibetan monastery assembly hall, seen exactly top-down: a long narrow cushioned mat of maroon wool with a plain saffron-gold border and a simple repeating band of small lotus shapes at both ends; no people. Stout connected forms, broad shapes, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object, centered, generous clear margin, no scene or additional objects. ABSOLUTELY NO TEXT: no letters, words, numbers, calligraphy, runes or anything that looks like script, in any language. Genuinely transparent background. Orthographic flat artwork suitable for a game texture.

### flavor-relief--hindu
Size: 1024x1024 (square)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art (match the attached style image's painting style, never its contents). One flat round carved sandstone ROUNDEL, straight front-on: in its centre the sacred symbol OM (the Devanagari Om sign, drawn accurately: the curved figure-3 shape with its tail, the small crescent and dot above) carved in relief and painted vermilion and saffron, inside a ring of lotus petals; wide bevelled sandstone border. Om is the ONLY sign on it: nothing else that looks like writing. Stout connected forms, broad shapes, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object, centered, generous clear margin, no scene or additional objects. ABSOLUTELY NO TEXT: no letters, words, numbers, calligraphy, runes or anything that looks like script, in any language. Genuinely transparent background. Orthographic flat artwork suitable for a game texture.
