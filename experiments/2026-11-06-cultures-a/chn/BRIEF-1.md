# Image brief: chn 1

You are generating source plates for 3D reconstruction (image-to-3D) for a heroic hand-painted fantasy tabletop game. Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates or draws images: every picture must come from image_gen.

The attached image `style-anchor.png` (in this folder) is the house STYLE guide only: match its painting style, never its contents. For a shot marked EDIT, first open the named reference plate from this folder and make the new picture as an edit of it (same materials, colours and camera), changing only what the prompt says.

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim), size as stated, with a genuinely transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing).

Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side (nothing cut off by the frame); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the four corners are alpha 0); (3) it is the requested kind of object and its named features are plainly visible; (4) no text, no letters, no floor, no shadow. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG-1.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next. When all are done, write `plates/DONE-1` containing the list of saved ids.

## Shots

### wall-straight--chn-brick
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a straight wall section of a Qing-dynasty Beijing courtyard house.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: ONE straight wall section of a north-Chinese courtyard house: a wall of dark blue-grey bricks with thin pale mortar joints laid in neat courses, a slightly projecting plinth of larger grey stone blocks along the bottom foot, a moulded grey brick cornice band along the top, and at each side edge a round timber column lacquered DARK RED-BROWN, half set into the wall. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end). It must NOT be square and must NOT be wider than it is tall. Real-world size about 60 in wide x 12 in deep x 108 in tall: keep these proportions. Nothing else: NO floor, NO ground, NO base slab under it, NO roof, NO corner return, NO lamp, banner, furniture or decoration attached. Both side edges are clean flat vertical cuts so that copies butt together into a longer wall. Seen from its broad side, three-quarter view from slightly above. Keep the WHOLE object well inside the frame with a generous margin. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it.


### wall-straight--chn-brick--s2
Size: 1024x1536 (portrait)

EDIT of `plates/wall-straight--chn-brick.png` (open it first and use it as the reference image)

Prompt:

Edit task. The supplied image is an accepted piece of this same set (a Qing courtyard house wall of grey brick). The new piece must look built by the same hands from the same materials: the SAME colours, timber, plaster or stone, thicknesses, painting style and camera angle. Change ONLY what is described below. Keep the transparent background.

Create a single asset in the Turnip Works house style (heroic hand-painted): a timber lattice partition wall of a Qing-dynasty courtyard house.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: The same wall section, the same dark red-brown columns, grey stone plinth and grey brick cornice, but between the columns a timber PARTITION of tall lattice panels (geshan): a dark red-brown frame, the upper two thirds a THICK geometric wooden lattice in a step-and-square pattern backed by warm cream paper, the lower third a solid dark wooden panel with one plain carved rectangle. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end). It must NOT be square and must NOT be wider than it is tall. Real-world size about 60 in wide x 12 in deep x 108 in tall: keep these proportions. Nothing else: NO floor, NO ground, NO base slab under it, NO roof, NO corner return, NO lamp, banner, furniture or decoration attached. Both side edges are clean flat vertical cuts so that copies butt together into a longer wall. Seen from its broad side, three-quarter view from slightly above. Keep the WHOLE object well inside the frame with a generous margin. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it.


### wall-doorway--chn-brick
Size: 1024x1536 (portrait)

EDIT of `plates/wall-straight--chn-brick.png` (open it first and use it as the reference image)

Prompt:

Edit task. The supplied image is an accepted piece of this same set (a Qing courtyard house wall of grey brick). The new piece must look built by the same hands from the same materials: the SAME colours, timber, plaster or stone, thicknesses, painting style and camera angle. Change ONLY what is described below. Keep the transparent background.

Create a single asset in the Turnip Works house style (heroic hand-painted): a Qing courtyard house wall section with an empty doorway.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: The same grey brick wall section with an EMPTY door opening through it from the very bottom: about 3.5 ft wide and 7 ft tall, centred, framed by two dark red-brown lacquered door posts, a dark lintel beam and a low grey stone threshold. Grey brick either side and above. NO door, NO curtain. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end). It must NOT be square and must NOT be wider than it is tall. Real-world size about 60 in wide x 12 in deep x 108 in tall: keep these proportions. Nothing else: NO floor, NO ground, NO base slab under it, NO roof, NO corner return, NO lamp, banner, furniture or decoration attached. Both side edges are clean flat vertical cuts so that copies butt together into a longer wall. Seen from its broad side, three-quarter view from slightly above. Keep the WHOLE object well inside the frame with a generous margin. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it.


### wall-window-small--chn-brick
Size: 1024x1536 (portrait)

EDIT of `plates/wall-straight--chn-brick.png` (open it first and use it as the reference image)

Prompt:

Edit task. The supplied image is an accepted piece of this same set (a Qing courtyard house wall of grey brick). The new piece must look built by the same hands from the same materials: the SAME colours, timber, plaster or stone, thicknesses, painting style and camera angle. Change ONLY what is described below. Keep the transparent background.

Create a single asset in the Turnip Works house style (heroic hand-painted): a Qing courtyard house wall section with a lattice window.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: The same grey brick wall section with ONE square window in its middle at chest height, about 3 ft across: a dark red-brown timber frame filled with a THICK geometric wooden lattice (interlocking squares and rectangles) backed by warm cream paper. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end). It must NOT be square and must NOT be wider than it is tall. Real-world size about 60 in wide x 12 in deep x 108 in tall: keep these proportions. Nothing else: NO floor, NO ground, NO base slab under it, NO roof, NO corner return, NO lamp, banner, furniture or decoration attached. Both side edges are clean flat vertical cuts so that copies butt together into a longer wall. Seen from its broad side, three-quarter view from slightly above. Keep the WHOLE object well inside the frame with a generous margin. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it.


### post-timber--chn-brick
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a round dark red-brown lacquered column on a stone drum base.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: One tall round timber column lacquered dark red-brown, about 12 in thick, standing on a round carved grey stone drum base, with a plain flared top. Real-world size about 14 in wide x 14 in deep x 108 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground, NO base slab, platform or plinth under it that the real object would not have. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### door-plank--chn-gate-leaf
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a Chinese courtyard-house street door leaf.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A thick plank door leaf lacquered dark red-black, with two rows of round domed bronze studs and ONE round bronze knocker ring hanging from a lion-mask plate at the middle height. It is ONE flat door leaf, a slab about 4 ft wide, 4 in thick and 8 ft tall, standing upright on its bottom edge, seen from the front, a little from one side and slightly above, so its face and one edge show. No frame, no wall, no hinges sticking out, no floor. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Keep the WHOLE leaf well inside the frame with a generous margin.


### door-panelled--chn-lattice-leaf
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a Chinese lattice door (geshan men) used between rooms.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A lattice door leaf: a dark red-brown frame, the upper two thirds a THICK geometric wooden lattice of interlocking squares backed by cream paper, the lower third a solid wooden panel with one carved plain rectangle. It is ONE flat door leaf, a slab about 4 ft wide, 4 in thick and 8 ft tall, standing upright on its bottom edge, seen from the front, a little from one side and slightly above, so its face and one edge show. No frame, no wall, no hinges sticking out, no floor. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Keep the WHOLE leaf well inside the frame with a generous margin.


### wall-straight--chn-temple
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a straight wall section of a Chinese Buddhist temple hall.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: ONE straight wall section of a Chinese Buddhist temple hall: a smooth wall plastered deep RED OCHRE, standing on a plinth of pale grey stone, at each side edge a round column lacquered bright red; along the top a broad beam painted with a band of blue-green and gold geometric ornament (no figures, no writing). It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end). It must NOT be square and must NOT be wider than it is tall. Real-world size about 60 in wide x 12 in deep x 108 in tall: keep these proportions. Nothing else: NO floor, NO ground, NO base slab under it, NO roof, NO corner return, NO lamp, banner, furniture or decoration attached. Both side edges are clean flat vertical cuts so that copies butt together into a longer wall. Seen from its broad side, three-quarter view from slightly above. Keep the WHOLE object well inside the frame with a generous margin. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it.


### wall-doorway--chn-temple
Size: 1024x1536 (portrait)

EDIT of `plates/wall-straight--chn-temple.png` (open it first and use it as the reference image)

Prompt:

Edit task. The supplied image is an accepted piece of this same set (a red-ochre Chinese temple wall). The new piece must look built by the same hands from the same materials: the SAME colours, timber, plaster or stone, thicknesses, painting style and camera angle. Change ONLY what is described below. Keep the transparent background.

Create a single asset in the Turnip Works house style (heroic hand-painted): a Chinese temple hall wall section with an empty doorway.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: The same red temple wall section with an EMPTY opening through it from the very bottom: about 4 ft wide and 7.5 ft tall, centred, framed by two red lacquered posts and a red lintel under the painted beam, a raised grey stone threshold. NO door. You can see straight through the opening. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end). It must NOT be square and must NOT be wider than it is tall. Real-world size about 60 in wide x 12 in deep x 108 in tall: keep these proportions. Nothing else: NO floor, NO ground, NO base slab under it, NO roof, NO corner return, NO lamp, banner, furniture or decoration attached. Both side edges are clean flat vertical cuts so that copies butt together into a longer wall. Seen from its broad side, three-quarter view from slightly above. Keep the WHOLE object well inside the frame with a generous margin. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it.

