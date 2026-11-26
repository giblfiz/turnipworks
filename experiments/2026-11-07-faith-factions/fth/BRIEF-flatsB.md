# Image brief: fth flatsB (flat pieces)

You are painting flat game art (wall hangings, wall roundels, floor emblems, picker icons) for a heroic hand-painted tabletop game. Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates or draws images: every picture must come from image_gen. Any size is fine; the sizes below are a preference.

The attached image `style-anchor.png` (in this folder) is the house STYLE guide only: match its painting style, never its contents.

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim) with a genuinely transparent background. Save it as `flats/<id>.png` in this folder (create `flats/` if missing).

Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side; (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the four corners are alpha 0); (3) it shows what the prompt asks, accurately (these are SACRED symbols of real faiths: a cross, a dharma wheel, the Om sign, a figure of the Buddha: they must be drawn correctly and respectfully); (4) NO text, letters, numbers or script-like marks anywhere (the Om sign, where asked for, is the only exception). If a check fails, generate again (at most 3 tries per shot) and keep the best.

Append one line per shot to `LOG-flatsB.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Finish each shot completely before the next. When all are done, write `flats/DONE-flatsB` listing the saved ids.

## Shots

### flavor-sigil--hindu
Size: 1024x1024 (square)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art (match the attached style image's painting style, never its contents). One flat MANDANA floor design seen exactly top-down, as painted on central-Indian temple and house floors: on a round ground of red ochre, a symmetrical LOTUS with eight petals drawn in thick white chalk lines, with dots and a simple geometric border of white lines round it. Stout connected forms, broad shapes, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object, centered, generous clear margin, no scene or additional objects. ABSOLUTELY NO TEXT: no letters, words, numbers, calligraphy, runes or anything that looks like script, in any language. Genuinely transparent background. Orthographic flat artwork suitable for a game texture.

### flavor-mat--muslim
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art (match the attached style image's painting style, never its contents). One flat long CARPET RUNNER seen exactly top-down, in the style of a 15th-century Cairo Mamluk carpet: a deep red ground with a row of large OCTAGON MEDALLIONS in green and blue filled with small geometric stars and rosettes, a border of small repeating geometric shapes. Geometric only: no figures, no lettering, no niche picture. Stout connected forms, broad shapes, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object, centered, generous clear margin, no scene or additional objects. ABSOLUTELY NO TEXT: no letters, words, numbers, calligraphy, runes or anything that looks like script, in any language. Genuinely transparent background. Orthographic flat artwork suitable for a game texture.

### flavor-relief--muslim
Size: 1024x1024 (square)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art (match the attached style image's painting style, never its contents). One flat square carved wooden PANEL, straight front-on: a Mamluk GEOMETRIC INTERLACE pattern of a large TEN-POINTED STAR in the centre with interlocking polygons round it, made of inlaid dark wood, light wood and ivory pieces; a wide plain wooden border. Stout connected forms, broad shapes, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object, centered, generous clear margin, no scene or additional objects. ABSOLUTELY NO TEXT: no letters, words, numbers, calligraphy, runes or anything that looks like script, in any language. Genuinely transparent background. Orthographic flat artwork suitable for a game texture.

### flavor-sigil--muslim
Size: 1024x1024 (square)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art (match the attached style image's painting style, never its contents). One flat circular floor MEDALLION seen exactly top-down: Mamluk polychrome MARBLE INLAY (opus sectile) of a large eight-pointed geometric STAR inside interlaced bands, in white, black, red and green marble, a round border of small triangles. Stout connected forms, broad shapes, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object, centered, generous clear margin, no scene or additional objects. ABSOLUTELY NO TEXT: no letters, words, numbers, calligraphy, runes or anything that looks like script, in any language. Genuinely transparent background. Orthographic flat artwork suitable for a game texture.

### emblem--christian
Size: 1024x1024 (square)

Prompt:

Use case: stylized-concept. One small painted emblem icon for a tabletop faction picker: one plain gold LATIN CROSS (the upright longer below the crossbar) on a deep red disc inside the charcoal circle. Bold chunky pictogram filling a centered dark charcoal CIRCULAR button ground, viewed perfectly straight on. Heroic hand-painted style, matte, broad simple shapes, extremely restrained brush texture. Must read at just 31 pixels: simple outer silhouette, large negative spaces, no fine detail. Outside the circle transparent. Exactly one icon, NO text, no lettering, no ornament border, no extra symbols, no 3D pedestal, no environment, no glow.

### emblem--buddhist
Size: 1024x1024 (square)

Prompt:

Use case: stylized-concept. One small painted emblem icon for a tabletop faction picker: one gold EIGHT-SPOKED DHARMA WHEEL (hub, eight straight spokes, a rim) on a maroon disc inside the charcoal circle. Bold chunky pictogram filling a centered dark charcoal CIRCULAR button ground, viewed perfectly straight on. Heroic hand-painted style, matte, broad simple shapes, extremely restrained brush texture. Must read at just 31 pixels: simple outer silhouette, large negative spaces, no fine detail. Outside the circle transparent. Exactly one icon, NO text, no lettering, no ornament border, no extra symbols, no 3D pedestal, no environment, no glow.

### emblem--hindu
Size: 1024x1024 (square)

Prompt:

Use case: stylized-concept. One small painted emblem icon for a tabletop faction picker: the sacred OM symbol (the Devanagari Om sign drawn accurately: the curved figure-3 shape with its tail, the crescent and dot above) in saffron on a vermilion disc inside the charcoal circle. Bold chunky pictogram filling a centered dark charcoal CIRCULAR button ground, viewed perfectly straight on. Heroic hand-painted style, matte, broad simple shapes, extremely restrained brush texture. Must read at just 31 pixels: simple outer silhouette, large negative spaces, no fine detail. Outside the circle transparent. Exactly one icon, NO text, no lettering other than the Om sign itself, no ornament border, no extra symbols, no 3D pedestal, no environment, no glow.

### emblem--muslim
Size: 1024x1024 (square)

Prompt:

Use case: stylized-concept. One small painted emblem icon for a tabletop faction picker: one gold EIGHT-POINTED INTERLACED STAR (two overlapping squares, one turned 45 degrees, their lines interlaced) on a deep green disc inside the charcoal circle; NO crescent. Bold chunky pictogram filling a centered dark charcoal CIRCULAR button ground, viewed perfectly straight on. Heroic hand-painted style, matte, broad simple shapes, extremely restrained brush texture. Must read at just 31 pixels: simple outer silhouette, large negative spaces, no fine detail. Outside the circle transparent. Exactly one icon, NO text, no lettering, no ornament border, no extra symbols, no 3D pedestal, no environment, no glow.
