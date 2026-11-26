# Image brief: cultures-b-2

You are generating source plates for 3D reconstruction (image-to-3D) for a tabletop game. Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates, draws or edits images: every picture must come from image_gen.

For each shot below: pass the house STYLE REFERENCE image `style-references/heroic-handpainted-tavern-v1.png` to image_gen as a style reference (and, where the prompt names one, the plates/<id>.png reference in this folder too). Generate ONE image from the prompt EXACTLY as written (copy it verbatim), size 1024x1024 (square), with a transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing). The image tool may return another size or aspect (portrait, landscape, 1254 px): THAT IS FINE, keep it as it is; never retry for size.

Then look at your own result and check: (1) exactly one object, whole, nothing cut off by the frame (a tight margin is fine); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the corners are alpha 0); (3) it plainly shows what the shot asks for (the line `Should read as`), with the proportions asked for; (4) no text, no floor, no shadow, no people. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG-2.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next. When all are done, write `plates/DONE-2` containing the list of saved ids.

## Shots

### wall-doorway--mde-plaster
Size: 1024x1024 (square)
Should read as: a wall section with a striped pointed-arch doorway

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a wall section with an empty door opening.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, seen from its broad face at a slight three-quarter angle from slightly above (camera elevation about 15 degrees), the whole face visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: The reference image plates/wall-straight--mde-plaster.png is the existing plain straight section of this SAME wall. The new piece must look cut from the same wall: the SAME materials, colours, thickness, height, width and proportions, painting style and camera angle. Change ONLY what is described here: The same wall with an EMPTY door opening from the very bottom, about 3.5 ft wide and 7 ft tall, under a POINTED ARCH whose arch stones (voussoirs) alternate dark charcoal and honey-cream. NO door leaf, NO hinges, NO step. You can see straight through the opening. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end), about 5 ft wide, 9 ft tall and 1 ft thick. It must NOT be square and must NOT be wider than it is tall. The top edge is one level line, the bottom edge sits flat, and both side edges are clean flat vertical cuts so that copies butt together into a longer wall. NO floor, NO ground, NO base slab, NO roof, NO corner return, nothing attached.

### wall-straight--rus-log--s2
Size: 1024x1024 (square)
Should read as: a log wall with a carved painted plank on it

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a straight wall section.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, seen from its broad face at a slight three-quarter angle from slightly above (camera elevation about 15 degrees), the whole face visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: The reference image plates/wall-straight--rus-log.png is the existing plain straight section of this SAME wall. The new piece must look cut from the same wall: the SAME materials, colours, thickness, height, width and proportions, painting style and camera angle. Change ONLY what is described here: The same log wall with one carved wooden wall-post (a thick upright plank) fixed on its face in the middle, carved with a stack of rosettes and painted in faded red and green. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end), about 5 ft wide, 9 ft tall and 1 ft thick. It must NOT be square and must NOT be wider than it is tall. The top edge is one level line, the bottom edge sits flat, and both side edges are clean flat vertical cuts so that copies butt together into a longer wall. NO floor, NO ground, NO base slab, NO roof, NO corner return, nothing attached.

### wall-window-small--rus-log
Size: 1024x1024 (square)
Should read as: a log wall with a small window

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a wall section with a window.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, seen from its broad face at a slight three-quarter angle from slightly above (camera elevation about 15 degrees), the whole face visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: The reference image plates/wall-straight--rus-log.png is the existing plain straight section of this SAME wall. The new piece must look cut from the same wall: the SAME materials, colours, thickness, height, width and proportions, painting style and camera angle. Change ONLY what is described here: The same log wall with ONE small window in its upper half, about 2 ft wide and 2.5 ft tall, closed by a casement of small pale amber MICA panes in a lead grid, in a plain thick plank frame with a simple carved top board (restrained, unpainted wood). It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end), about 5 ft wide, 9 ft tall and 1 ft thick. It must NOT be square and must NOT be wider than it is tall. The top edge is one level line, the bottom edge sits flat, and both side edges are clean flat vertical cuts so that copies butt together into a longer wall. NO floor, NO ground, NO base slab, NO roof, NO corner return, nothing attached.

### wall-doorway--mes-stucco
Size: 1024x1024 (square)
Should read as: a white plastered wall with a square doorway

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a wall section with an empty door opening.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, seen from its broad face at a slight three-quarter angle from slightly above (camera elevation about 15 degrees), the whole face visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: The reference image plates/wall-straight--mes-stucco.png is the existing plain straight section of this SAME wall. The new piece must look cut from the same wall: the SAME materials, colours, thickness, height, width and proportions, painting style and camera angle. Change ONLY what is described here: The same wall with an EMPTY doorway from the very bottom, about 4 ft wide and 6.5 ft tall, under a heavy squared stone LINTEL, the jambs painted red. NO door leaf, NO curtain, NO hinges. You can see straight through the opening. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end), about 5 ft wide, 9 ft tall and 1 ft thick. It must NOT be square and must NOT be wider than it is tall. The top edge is one level line, the bottom edge sits flat, and both side edges are clean flat vertical cuts so that copies butt together into a longer wall. NO floor, NO ground, NO base slab, NO roof, NO corner return, nothing attached.
