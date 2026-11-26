# Image brief: ind 2

You are generating source plates for 3D reconstruction (image-to-3D) for a heroic hand-painted fantasy tabletop game. Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates or draws images: every picture must come from image_gen.

The attached image `style-anchor.png` (in this folder) is the house STYLE guide only: match its painting style, never its contents. For a shot marked EDIT, first open the named reference plate from this folder and make the new picture as an edit of it (same materials, colours and camera), changing only what the prompt says.

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim), size as stated, with a genuinely transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing).

Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side (nothing cut off by the frame); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the four corners are alpha 0); (3) it is the requested kind of object and its named features are plainly visible; (4) no text, no letters, no floor, no shadow. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG-2.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next. When all are done, write `plates/DONE-2` containing the list of saved ids.

## Shots

### wall-straight--ind-temple
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a straight wall section of a Nagara Hindu temple hall.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: ONE straight wall section of an 18th-century north-Indian (Nagara) temple hall in pale golden-buff SANDSTONE: the whole face carved in horizontal BANDS of mouldings from bottom to top: a stepped plinth, a band of rounded cushion mouldings, a band of carved lotus petals, a band of small square carved panels with rosettes, plain ashlar, and at the top a band of small pointed niche outlines; a slim carved pilaster at each side edge. Geometric and floral carving only: no figures. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end). It must NOT be square and must NOT be wider than it is tall. Real-world size about 60 in wide x 12 in deep x 108 in tall: keep these proportions. Nothing else: NO floor, NO ground, NO base slab under it, NO roof, NO corner return, NO lamp, banner, furniture or decoration attached. Both side edges are clean flat vertical cuts so that copies butt together into a longer wall. Seen from its broad side, three-quarter view from slightly above. Keep the WHOLE object well inside the frame with a generous margin. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it.


### wall-doorway--ind-temple
Size: 1024x1536 (portrait)

EDIT of `plates/wall-straight--ind-temple.png` (open it first and use it as the reference image)

Prompt:

Edit task. The supplied image is an accepted piece of this same set (a carved golden sandstone Hindu temple wall). The new piece must look built by the same hands from the same materials: the SAME colours, timber, plaster or stone, thicknesses, painting style and camera angle. Change ONLY what is described below. Keep the transparent background.

Create a single asset in the Turnip Works house style (heroic hand-painted): a Nagara temple hall wall section with an empty doorway.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: The same golden sandstone temple wall section with an EMPTY opening through it from the very bottom: about 4 ft wide and 7 ft tall, rectangular, framed by several stepped carved door jambs and a carved lintel; a raised stone threshold. NO door. You can see straight through it. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end). It must NOT be square and must NOT be wider than it is tall. Real-world size about 60 in wide x 12 in deep x 108 in tall: keep these proportions. Nothing else: NO floor, NO ground, NO base slab under it, NO roof, NO corner return, NO lamp, banner, furniture or decoration attached. Both side edges are clean flat vertical cuts so that copies butt together into a longer wall. Seen from its broad side, three-quarter view from slightly above. Keep the WHOLE object well inside the frame with a generous margin. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it.


### ind-tulsi
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a tulsi vrindavan planter with its holy basil.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A TULSI VRINDAVAN: a square masonry planter about 4 ft tall on a stepped base, plastered white and painted with soft red and ochre borders, a small arched niche on its front, its top shaped like a tiny shrine's rim, and growing from it a bushy holy basil plant of small green leaves in a round solid mass. Dignified and tidy. Real-world size about 30 in wide x 30 in deep x 48 in tall: keep these proportions. Foliage is painted as a FEW big solid masses with broad leaf shapes on their surface, never as separate thin leaves or twigs; no gaps in the foliage you can see through, nothing floating free. It stands on nothing: NO floor, NO rug, NO ground, NO base slab, platform or plinth under it that the real object would not have. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### ind-charpai
Size: 1536x1024 (landscape)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: an Indian charpai rope cot.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A CHARPAI: a low rectangular wooden cot with four stout turned legs painted with red and green rings, its frame strung with thick woven jute ROPE in a diagonal crisscross pattern, a folded cotton quilt in faded red at one end. Real-world size about 36 in wide x 72 in deep x 18 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground, NO base slab, platform or plinth under it that the real object would not have. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### ind-jhula
Size: 1536x1024 (landscape)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: an Indian jhula swing.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A JHULA swing: a broad flat wooden swing seat with a carved low back rail, painted red with yellow flowers, hanging from a thick carved wooden frame of two posts and a beam by four THICK brass-ringed chains drawn as solid bars. Real-world size about 72 in wide x 36 in deep x 84 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground, NO base slab, platform or plinth under it that the real object would not have. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### ind-water-pots
Size: 1024x1024 (square)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: Indian terracotta water pots on a stand.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: Three round-bellied TERRACOTTA water pots (matka), red-orange clay with a few painted white lines, sitting in a row on a low wooden stand, a brass drinking cup on one lid. Real-world size about 40 in wide x 24 in deep x 36 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground, NO base slab, platform or plinth under it that the real object would not have. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### ind-gaddi-throne
Size: 1024x1024 (square)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a Rajput gaddi throne under its canopy.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A Rajput ruler's GADDI throne: a low square platform about 1 ft high on a carved marble dais, covered with a deep red velvet mattress and a big round BOLSTER cushion at the back and two at the sides, all embroidered in gold; over it a CANOPY of four slim gilded posts carrying a small domed canopy roof (a chhatri shape) of gold-embroidered red cloth with a scalloped fringe. Real-world size about 96 in wide x 72 in deep x 120 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground, NO base slab, platform or plinth under it that the real object would not have. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### ind-floor-seating
Size: 1536x1024 (landscape)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: Indian floor seating with bolsters.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A long low floor MATTRESS (gadda) covered in clean white cotton with a thin red border, and laid along its back two fat round BOLSTER cushions of deep red and gold striped silk. Real-world size about 72 in wide x 36 in deep x 20 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground, NO base slab, platform or plinth under it that the real object would not have. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### ind-lamp-stand
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: an Indian brass oil lamp stand.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A tall Indian brass OIL LAMP STAND (samai): a round stepped brass foot, a thick turned brass column, three tiers of round flat brass dishes each with a ring of small spouted lamp cups, and a small brass peacock finial on top; polished warm gold. It is UNLIT: no flames, no glow, no smoke (the game adds the light). Real-world size about 18 in wide x 18 in deep x 60 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground, NO base slab, platform or plinth under it that the real object would not have. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.

