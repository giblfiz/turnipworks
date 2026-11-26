# Image brief: jpn 1

You are generating source plates for 3D reconstruction (image-to-3D) for a heroic hand-painted fantasy tabletop game. Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates or draws images: every picture must come from image_gen.

The attached image `style-anchor.png` (in this folder) is the house STYLE guide only: match its painting style, never its contents. For a shot marked EDIT, first open the named reference plate from this folder and make the new picture as an edit of it (same materials, colours and camera), changing only what the prompt says.

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim), size as stated, with a genuinely transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing).

Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side (nothing cut off by the frame); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the four corners are alpha 0); (3) it is the requested kind of object and its named features are plainly visible; (4) no text, no letters, no floor, no shadow. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG-1.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next. When all are done, write `plates/DONE-1` containing the list of saved ids.

## Shots

### wall-straight--jpn-shoji
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a straight wall section of an Edo-period Japanese townhouse.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: ONE straight wall section of a Japanese townhouse: two square posts of dark brown cedar at the two side edges (each about 5 in square), a dark cedar sill beam along the very bottom, a dark head rail (nageshi) across at 7 ft and a dark beam along the very top. Between the posts, from the sill to the head rail, stand SHOJI screens: a grid of THICK honey-coloured wooden lattice bars in large square panes (each pane about 10 in), backed by smooth glowing WHITE paper; the bottom 2 ft is a solid panel of dark cedar boards. Above the head rail a band of smooth warm cream plaster up to the top beam. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end). It must NOT be square and must NOT be wider than it is tall. Real-world size about 60 in wide x 12 in deep x 108 in tall: keep these proportions. Nothing else: NO floor, NO ground, NO base slab under it, NO roof, NO corner return, NO lamp, banner, furniture or decoration attached. Both side edges are clean flat vertical cuts so that copies butt together into a longer wall. Seen from its broad side, three-quarter view from slightly above. Keep the WHOLE object well inside the frame with a generous margin. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it.


### wall-straight--jpn-shoji--s2
Size: 1024x1536 (portrait)

EDIT of `plates/wall-straight--jpn-shoji.png` (open it first and use it as the reference image)

Prompt:

Edit task. The supplied image is an accepted piece of this same set (a Japanese townhouse wall with shoji screens). The new piece must look built by the same hands from the same materials: the SAME colours, timber, plaster or stone, thicknesses, painting style and camera angle. Change ONLY what is described below. Keep the transparent background.

Create a single asset in the Turnip Works house style (heroic hand-painted): a straight earthen-plaster wall section of an Edo-period Japanese townhouse.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: The same wall section, the same dark cedar posts, sill, head rail and top beam, but the panel between the posts is smooth EARTHEN PLASTER (tsuchikabe) in a warm sandy ochre-cream from the sill to the top beam, with a dark cedar board skirt along the bottom 1.5 ft. No shoji, no lattice in this one. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end). It must NOT be square and must NOT be wider than it is tall. Real-world size about 60 in wide x 12 in deep x 108 in tall: keep these proportions. Nothing else: NO floor, NO ground, NO base slab under it, NO roof, NO corner return, NO lamp, banner, furniture or decoration attached. Both side edges are clean flat vertical cuts so that copies butt together into a longer wall. Seen from its broad side, three-quarter view from slightly above. Keep the WHOLE object well inside the frame with a generous margin. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it.


### wall-doorway--jpn-shoji
Size: 1024x1536 (portrait)

EDIT of `plates/wall-straight--jpn-shoji.png` (open it first and use it as the reference image)

Prompt:

Edit task. The supplied image is an accepted piece of this same set (a Japanese townhouse wall with shoji screens). The new piece must look built by the same hands from the same materials: the SAME colours, timber, plaster or stone, thicknesses, painting style and camera angle. Change ONLY what is described below. Keep the transparent background.

Create a single asset in the Turnip Works house style (heroic hand-painted): a Japanese townhouse wall section with an empty doorway.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: The same wall section with an EMPTY door opening through it from the very bottom: about 3.5 ft wide and 6.5 ft tall, centred, framed by two dark cedar door posts and the head rail as its lintel (the sill beam continues across the threshold as a low dark wooden sill). About 9 in of shoji wall remains each side and the plaster band and top beam run unbroken above. NO door, NO curtain, NO step. You can see straight through the opening. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end). It must NOT be square and must NOT be wider than it is tall. Real-world size about 60 in wide x 12 in deep x 108 in tall: keep these proportions. Nothing else: NO floor, NO ground, NO base slab under it, NO roof, NO corner return, NO lamp, banner, furniture or decoration attached. Both side edges are clean flat vertical cuts so that copies butt together into a longer wall. Seen from its broad side, three-quarter view from slightly above. Keep the WHOLE object well inside the frame with a generous margin. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it.


### wall-window-small--jpn-shoji
Size: 1024x1536 (portrait)

EDIT of `plates/wall-straight--jpn-shoji.png` (open it first and use it as the reference image)

Prompt:

Edit task. The supplied image is an accepted piece of this same set (a Japanese townhouse wall with shoji screens). The new piece must look built by the same hands from the same materials: the SAME colours, timber, plaster or stone, thicknesses, painting style and camera angle. Change ONLY what is described below. Keep the transparent background.

Create a single asset in the Turnip Works house style (heroic hand-painted): a Japanese townhouse wall section with a wooden lattice window.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: The same wall section, the panel smooth warm ochre-cream earthen plaster (as in the plain plaster version), with ONE window in its middle: a square opening about 2.5 ft across at chest height, closed by a THICK lattice of upright square dark wooden bars set close together (koshi lattice, 8 bars), with a dark wooden frame. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end). It must NOT be square and must NOT be wider than it is tall. Real-world size about 60 in wide x 12 in deep x 108 in tall: keep these proportions. Nothing else: NO floor, NO ground, NO base slab under it, NO roof, NO corner return, NO lamp, banner, furniture or decoration attached. Both side edges are clean flat vertical cuts so that copies butt together into a longer wall. Seen from its broad side, three-quarter view from slightly above. Keep the WHOLE object well inside the frame with a generous margin. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it.


### door-plank--jpn-fusuma-leaf
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a Japanese fusuma sliding panel used as an inner door.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A FUSUMA panel: a thick slim black-lacquered wooden frame around a panel of heavy cream paper painted with a soft gold-and-green landscape of low hills and a pine; one small round sunken black finger pull at the middle height near one edge. It is ONE flat door leaf, a slab about 4 ft wide, 4 in thick and 8 ft tall, standing upright on its bottom edge, seen from the front, a little from one side and slightly above, so its face and one edge show. No frame, no wall, no hinges sticking out, no floor. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Keep the WHOLE leaf well inside the frame with a generous margin.


### door-plank--jpn-koshido-leaf
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a Japanese wooden lattice street door (koshido).

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A KOSHIDO street door: a thick frame of honey-brown wood filled with a close lattice of THICK upright wooden bars over a backing of white paper, and a solid panel of boards along the bottom 2 ft. It is ONE flat door leaf, a slab about 4 ft wide, 4 in thick and 8 ft tall, standing upright on its bottom edge, seen from the front, a little from one side and slightly above, so its face and one edge show. No frame, no wall, no hinges sticking out, no floor. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Keep the WHOLE leaf well inside the frame with a generous margin.


### post-timber--jpn-shrine
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a vermilion lacquered round shrine post.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: One tall round wooden post lacquered bright vermilion red, about 12 in thick, with a black lacquered base ring and a slightly flared top, standing alone. Real-world size about 12 in wide x 12 in deep x 108 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground, NO base slab, platform or plinth under it that the real object would not have. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### fence-bamboo
Size: 1536x1024 (landscape)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a Japanese bamboo garden fence section.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: ONE straight section of a Japanese bamboo fence (yotsume-gaki): three thick upright green-gold bamboo posts and four thick horizontal bamboo rails, crossed in an open grid and tied at every crossing with neat black rope knots; about 5 ft long and 4 ft tall. Both ends are clean cuts so sections butt together. Real-world size about 60 in wide x 6 in deep x 48 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground, NO base slab, platform or plinth under it that the real object would not have. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.

