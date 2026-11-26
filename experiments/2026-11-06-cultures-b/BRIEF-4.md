# Image brief: cultures-b-4

You are generating source plates for 3D reconstruction (image-to-3D) for a tabletop game. Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates, draws or edits images: every picture must come from image_gen.

For each shot below: pass the house STYLE REFERENCE image `style-references/heroic-handpainted-tavern-v1.png` to image_gen as a style reference (and, where the prompt names one, the plates/<id>.png reference in this folder too). Generate ONE image from the prompt EXACTLY as written (copy it verbatim), size 1024x1024 (square), with a transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing). The image tool may return another size or aspect (portrait, landscape, 1254 px): THAT IS FINE, keep it as it is; never retry for size.

Then look at your own result and check: (1) exactly one object, whole, nothing cut off by the frame (a tight margin is fine); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the corners are alpha 0); (3) it plainly shows what the shot asks for (the line `Should read as`), with the proportions asked for; (4) no text, no floor, no shadow, no people. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG-4.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next. When all are done, write `plates/DONE-4` containing the list of saved ids.

## Shots

### nrs-runestone
Size: 1024x1024 (square)
Should read as: a tall standing stone carved with a red serpent band

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: painted runestone.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A Viking RUNESTONE: one tall upright slab of grey granite, about 7 ft tall, its rounded outline taller than wide, rising from rough ground stones at its foot. Carved on its broad face, picked out in RED and black paint: a long ribbon-bodied serpent curling round the edge of the stone in a loop, its body carrying a band of small angular rune marks, its head biting its tail at the bottom. No cross, no figures. Real-world size about 40 in wide x 24 in deep x 84 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### nrs-wool-baskets
Size: 1024x1024 (square)
Should read as: two baskets of wool and yarn

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: baskets of raw wool and spindles.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: Two round woven wicker baskets side by side, one heaped high with fluffy cream raw wool, the other with balls of spun yarn in red, ochre and brown and two fat wooden drop spindles with round whorls lying on top. The things on it are FEW and BIG, packed tight as solid masses (nothing tiny, nothing floating). Real-world size about 36 in wide x 24 in deep x 26 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mde-tray-table
Size: 1024x1024 (square)
Should read as: a low round brass tray table with a coffee pot and cups

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: low round brass tray table with cups.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A low round TRAY TABLE: a big round engraved brass tray about 2.5 ft across on a short, stout octagonal wooden stand inlaid with pale bone; on the tray a round copper coffee pot and four small handleless cups. The things on it are FEW and BIG, packed tight as solid masses (nothing tiny, nothing floating). Real-world size about 30 in wide x 30 in deep x 18 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mde-merchant-platform
Size: 1024x1024 (square)
Should read as: a raised wooden shop platform with a rug, a scale and brass bowls

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: the merchant's raised platform-counter.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A souk shop's COUNTER: a broad raised wooden platform about 7 ft long and knee-to-waist high where the merchant sits cross-legged among his goods, its front of carved wooden panels in a geometric lattice, its top covered with a small red rug, a bolster at the back, a brass balance scale and a few brass bowls on it. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man's arm; nothing thin, no wire, no string, no loose dangling parts. Real-world size about 84 in wide x 36 in deep x 34 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### rus-stove
Size: 1024x1024 (square)
Should read as: a very large white clay oven block with an arched mouth

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: great whitewashed Russian stove.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A great RUSSIAN STOVE (pech): a huge solid block of WHITE-WASHED clay and brick about 6 ft wide, 7 ft long and 6.5 ft tall, its flat top a broad sleeping ledge with a folded red-and-white woven blanket on it, its front with one arched dark oven MOUTH at waist height with a plank shutter leaning beside it and two small arched niches below; NO chimney (the smoke leaves by a vent in the wall), the top front edge smoke-darkened. It is COLD and UNLIT: dull charcoal and pale ash, NO flames, NO glow, NO smoke (the game adds the fire). Real-world size about 72 in wide x 84 in deep x 78 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### rus-lectern
Size: 1024x1024 (square)
Should read as: a tall cloth-draped stand with a small icon on top

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: lectern (analoy) with an icon.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: An Orthodox ANALOY: a tall narrow wooden lectern with a sloping top, draped with a gold-embroidered cloth that hangs down all four sides, one small painted icon of a haloed saint lying on the sloping top. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man's arm; nothing thin, no wire, no string, no loose dangling parts. Real-world size about 24 in wide x 24 in deep x 50 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### rus-palisade
Size: 1024x1024 (square)
Should read as: a section of a fence of upright pointed logs

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: pointed-log palisade section.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: One 5-ft section of a log PALISADE: five thick upright pine logs standing side by side, their tops sharpened to points, about 10 ft tall, bound by one heavy horizontal rail across their backs, golden-brown weathered wood; both side edges cut clean so sections butt together. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man's arm; nothing thin, no wire, no string, no loose dangling parts. Real-world size about 60 in wide x 18 in deep x 120 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mes-altar
Size: 1024x1024 (square)
Should read as: a stone altar covered with maize, flowers and bowls

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: stone altar with offerings.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A Mexica stone ALTAR: a broad low rectangular block of grey stone, its sides carved with a band of stepped fret and painted red and ochre, its top laid with OFFERINGS: ears of yellow and red maize, a heap of orange marigold flowers, painted clay bowls and a three-legged clay incense burner with a lump of white copal resin. No blood, no knife, nothing grim. Real-world size about 84 in wide x 42 in deep x 36 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mes-metate
Size: 1024x1024 (square)
Should read as: a stone grinding slab on three legs with a stone roller

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: grinding stone (metate) with mano.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A Mesoamerican METATE: a slab of grey volcanic basalt on three short stout legs, its top dished, sloping toward the front, with a long cylindrical stone MANO (hand stone) lying across it and a little heap of yellow maize dough on the slab. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man's arm; nothing thin, no wire, no string, no loose dangling parts. Real-world size about 30 in wide x 18 in deep x 14 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mes-spread-cloth
Size: 1024x1024 (square)
Should read as: a mat with stacks of patterned folded cloth

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a weaver's spread of cotton mantles.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A market VENDOR'S SPREAD: a square reed mat on the ground with folded cotton mantles (tilmatli) stacked in neat piles, white with bold red, black and ochre geometric borders, and one mantle spread open on top showing its pattern. The things on it are FEW and BIG, packed tight as solid masses (nothing tiny, nothing floating). Real-world size about 54 in wide x 54 in deep x 22 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### nrs-roof-post
Size: 1024x1024 (square)
Should read as: a tall thick wooden post

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: roof-support post of a longhouse.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: One round timber ROOF-SUPPORT POST of a Viking longhouse: a thick round oak post about 10 ft tall and as thick as a man's thigh, standing straight on a flat foot stone, its top cut square to take a beam, a band of carved interlace round it at head height; weathered grey-brown wood. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man's arm; nothing thin, no wire, no string, no loose dangling parts. Real-world size about 16 in wide x 16 in deep x 120 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### rus-yard-gate
Size: 1024x1024 (square)
Should read as: a wooden gate under a little roof

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: plank gate of a fenced yard, with its little roof.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: The GATE of a Rus' fenced yard compound, as a kit piece 5 ft wide: two massive squared gateposts carrying a small pitched plank roof across their tops, and between them a pair of heavy plank gate leaves standing OPEN; weathered golden-brown wood, a simple carved board under the little roof. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man's arm; nothing thin, no wire, no string, no loose dangling parts. Real-world size about 60 in wide x 18 in deep x 132 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.
