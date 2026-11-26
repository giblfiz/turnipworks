# Image brief: cultures-b-3

You are generating source plates for 3D reconstruction (image-to-3D) for a tabletop game. Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates, draws or edits images: every picture must come from image_gen.

For each shot below: pass the house STYLE REFERENCE image `style-references/heroic-handpainted-tavern-v1.png` to image_gen as a style reference (and, where the prompt names one, the plates/<id>.png reference in this folder too). Generate ONE image from the prompt EXACTLY as written (copy it verbatim), size 1024x1024 (square), with a transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing). The image tool may return another size or aspect (portrait, landscape, 1254 px): THAT IS FINE, keep it as it is; never retry for size.

Then look at your own result and check: (1) exactly one object, whole, nothing cut off by the frame (a tight margin is fine); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the corners are alpha 0); (3) it plainly shows what the shot asks for (the line `Should read as`), with the proportions asked for; (4) no text, no floor, no shadow, no people. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG-3.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next. When all are done, write `plates/DONE-3` containing the list of saved ids.

## Shots

### nrs-shield-row
Size: 1024x1024 (square)
Should read as: three round painted shields in a row

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: row of painted round shields hung on a board.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: Three Viking ROUND SHIELDS, each about 3 ft across, hung OVERLAPPING in a row on one thick plank board: plain wooden boards painted in bold halves and quarters of red, cream and ochre, each with a big domed iron boss in its centre and an iron-bound rim. They lie FLAT against the board, fixed along their whole backs, nothing projecting. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man's arm; nothing thin, no wire, no string, no loose dangling parts. Real-world size about 72 in wide x 8 in deep x 34 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### nrs-forge
Size: 1024x1024 (square)
Should read as: a low stone fire hearth with an upright stone slab and leather bellows behind

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: Norse forge with a stone bellows-shield.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A Viking-Age smith's forge: a low rectangular hearth of grey fieldstones and clay, knee to thigh high, its top a shallow bed of black charcoal. At its back stands one flat upright SLAB of soapstone (the bellows shield) with a round hole near its foot, and behind the slab lie two fat leather bag-bellows on a wooden board. It is COLD and UNLIT: dull charcoal and pale ash, NO flames, NO glow, NO smoke (the game adds the fire). Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man's arm; nothing thin, no wire, no string, no loose dangling parts. Real-world size about 60 in wide x 48 in deep x 40 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mde-divan
Size: 1024x1024 (square)
Should read as: a low cushioned bench with bolster pillows

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: built-in divan bench with mattress and bolsters.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: One section of a DIVAN: a low broad built-in bench of plastered masonry along a wall, about 5 ft long and knee high, covered by a thick flat mattress in woven red and ochre striped cloth, with three fat bolster cushions in dusty teal and cream leaning against the back. No legs, no back frame. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man's arm; nothing thin, no wire, no string, no loose dangling parts. Real-world size about 60 in wide x 30 in deep x 30 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mde-water-jar
Size: 1024x1024 (square)
Should read as: a tall clay water jar on a wooden stand

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: tall water jar on a stand.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A tall unglazed terracotta water JAR (zir), pale buff clay with a few incised wavy bands, its pointed bottom set into a stout square wooden stand, a round wooden lid on its mouth and a brass dipper hanging from the stand. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man's arm; nothing thin, no wire, no string, no loose dangling parts. Real-world size about 24 in wide x 24 in deep x 50 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### wall-straight--rus-log
Size: 1024x1024 (square)
Should read as: a log wall section of horizontal round logs with a carved board at the top

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a straight wall section.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, seen from its broad face at a slight three-quarter angle from slightly above (camera elevation about 15 degrees), the whole face visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: ONE straight wall section of a Russian log house (izba): thick round pine LOGS laid HORIZONTALLY one on another, about nine logs high, warm golden-brown with darker grey-brown weathering, moss packed in the seams between them, the log ends at both side edges cut flush. Along the very top runs a carved plank band with a row of pierced half-round scallops and painted red and green stripes. Nothing else: no window, no door. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end), about 5 ft wide, 9 ft tall and 1 ft thick. It must NOT be square and must NOT be wider than it is tall. The top edge is one level line, the bottom edge sits flat, and both side edges are clean flat vertical cuts so that copies butt together into a longer wall. NO floor, NO ground, NO base slab, NO roof, NO corner return, nothing attached.

### rus-iconostasis
Size: 1024x1024 (square)
Should read as: a wide gilded wooden screen of painted saint icons with doors in the middle

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: iconostasis screen section with central doors.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A section of an Orthodox ICONOSTASIS (icon screen), about 10 ft wide and 11 ft tall: a carved and gilded wooden screen holding TWO tiers of painted icon panels side by side, tall saints in the lower tier and smaller ones above, each with a gold halo and calm face in red, green and blue robes on gold ground, in the manner of 15th-century Novgorod icons (the upper tier a Deesis row: Christ enthroned in the centre, the Virgin and St John the Baptist turned toward him); in the middle of the lower tier a pair of carved gilded double doors with an arched top (the Royal Doors), shut. Reverent and orderly. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man's arm; nothing thin, no wire, no string, no loose dangling parts. Real-world size about 120 in wide x 18 in deep x 132 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### rus-well-sweep
Size: 1024x1024 (square)
Should read as: a log well with a tall lever pole and bucket

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: well-sweep over a log well-head.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A Russian WELL-SWEEP (zhuravl): a square log WELL-HEAD of stacked logs, waist high, with a plank lid; beside it a thick forked upright post 10 ft tall carrying a long THICK lever pole pivoted across its fork, a heavy stone tied to its short end near the ground and a wooden bucket hanging on a stout pole from its long end over the well. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man's arm; nothing thin, no wire, no string, no loose dangling parts. Real-world size about 156 in wide x 60 in deep x 168 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mes-chacmool
Size: 1024x1024 (square)
Should read as: a stone statue of a reclining figure holding a dish

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: chacmool offering figure.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A CHACMOOL: a Mesoamerican stone sculpture of a reclining figure lying on its back with knees raised, propped on its elbows, its head turned to face the side, holding a round shallow stone dish on its stomach (an offering vessel) with a few yellow marigold flowers in it; carved from grey stone with traces of red and blue-green paint. Calm and dignified. Real-world size about 60 in wide x 30 in deep x 36 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mes-reed-chest
Size: 1024x1024 (square)
Should read as: a woven reed box with a lid

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: woven reed chest (petlacalli).

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A Mexica PETLACALLI: a rectangular lidded chest woven of golden reed matting in a twill pattern with a dark red woven border, tied shut with a thick cotton cord. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man's arm; nothing thin, no wire, no string, no loose dangling parts. Real-world size about 40 in wide x 24 in deep x 22 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mes-spread-pottery
Size: 1024x1024 (square)
Should read as: a mat with painted clay pots and bowls

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a potter's spread of jars and bowls.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A market VENDOR'S SPREAD: a square reed mat on the ground set out with orange and black painted clay pots, tripod bowls, griddles stacked on edge and two big jars, arranged in tight groups. The things on it are FEW and BIG, packed tight as solid masses (nothing tiny, nothing floating). Real-world size about 54 in wide x 54 in deep x 28 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mes-paint-pots
Size: 1024x1024 (square)
Should read as: small pots of coloured paint and brushes on a mat

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a scribe's paint pots and brushes on a mat.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A Mexica SCRIBE'S paint set on a small reed mat: six small round clay pots of thick paint (red, black, ochre, white, turquoise, green), a few thick reed brushes lying beside them and a stack of folded blank bark paper. The things on it are FEW and BIG, packed tight as solid masses (nothing tiny, nothing floating). Real-world size about 30 in wide x 24 in deep x 14 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mde-khan-gate
Size: 1024x1024 (square)
Should read as: a tall stone arched gateway with open wooden gates

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: great gateway of a khan.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: The GATEWAY of a caravanserai, as a kit piece 5 ft wide: a tall pointed-arch portal in honey limestone with striped dark and light arch stones, a carved band of stepped honeycomb (muqarnas) in its hood, and a pair of heavy wooden gate leaves studded with iron standing wide OPEN against its sides. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man's arm; nothing thin, no wire, no string, no loose dangling parts. Real-world size about 60 in wide x 24 in deep x 156 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.
