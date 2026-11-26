# Image brief: cultures-b-5

You are generating source plates for 3D reconstruction (image-to-3D) for a tabletop game. Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates, draws or edits images: every picture must come from image_gen.

For each shot below: pass the house STYLE REFERENCE image `style-references/heroic-handpainted-tavern-v1.png` to image_gen as a style reference (and, where the prompt names one, the plates/<id>.png reference in this folder too). Generate ONE image from the prompt EXACTLY as written (copy it verbatim), size 1024x1024 (square), with a transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing). The image tool may return another size or aspect (portrait, landscape, 1254 px): THAT IS FINE, keep it as it is; never retry for size.

Then look at your own result and check: (1) exactly one object, whole, nothing cut off by the frame (a tight margin is fine); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the corners are alpha 0); (3) it plainly shows what the shot asks for (the line `Should read as`), with the proportions asked for; (4) no text, no floor, no shadow, no people. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG-5.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next. When all are done, write `plates/DONE-5` containing the list of saved ids.

## Shots

### nrs-boat
Size: 1024x1024 (square)
Should read as: a small wooden boat with curled ends resting on two wooden stands

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: small clinker-built boat on its stocks.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A small Viking-Age boat (a faering) laid up on land: a narrow clinker-built wooden hull about 20 ft long and 5 ft across, its overlapping strakes (planks) honey-brown and tarred dark at the seams, both stem and stern posts rising and curling up high at the ends, three thick plank thwarts across it, the inside empty. It rests level on two heavy wooden trestle stocks. Seen from above it is a long pointed hull shape. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man's arm; nothing thin, no wire, no string, no loose dangling parts. Real-world size about 240 in wide x 72 in deep x 64 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### nrs-quern
Size: 1024x1024 (square)
Should read as: a pair of round grinding stones on a wooden box

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: rotary hand quern on a wooden box.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A Viking rotary hand QUERN: two thick round grey millstones stacked one on the other, the upper with a hole in its centre and a stout upright wooden handle near its edge, sitting on a low square wooden box half full of coarse flour. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man's arm; nothing thin, no wire, no string, no loose dangling parts. Real-world size about 30 in wide x 30 in deep x 24 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mde-coffee-hearth
Size: 1024x1024 (square)
Should read as: a brass brazier with two big copper pots on it

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: coffee brazier with long-spouted pots.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A coffee-maker's hearth of 16th-century Cairo: a square raised brass-bound BRAZIER box on four short stout legs, its top a bed of charcoal, with TWO big round-bellied tinned-copper boiling pots with straight spouts standing on it, a long-handled iron roasting pan and a stack of small handleless cups beside them. It is COLD and UNLIT: dull charcoal and pale ash, NO flames, NO glow, NO smoke (the game adds the fire). Real-world size about 36 in wide x 30 in deep x 34 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mde-niche-shelf
Size: 1024x1024 (square)
Should read as: a tall shelf full of brass and copper pots, trays and lanterns

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: niche shelves of brass and copper wares.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A tall shop shelf unit of dark wood built like a set of plastered wall niches with pointed tops, three rows, every niche packed with gleaming brass and copper wares: ewers with long spouts, engraved trays standing on edge, pierced lanterns, bowls and pitchers, all big and chunky. The things on it are FEW and BIG, packed tight as solid masses (nothing tiny, nothing floating). Real-world size about 60 in wide x 18 in deep x 72 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### rus-icon-corner
Size: 1024x1024 (square)
Should read as: a small wooden shelf with two painted icons and a red lamp

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: the beautiful corner: icon shelf with a lamp.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: An Orthodox home ICON SHELF (the "beautiful corner"): a carved wooden corner shelf with a small peaked canopy, holding two small painted icon panels of haloed saints in gold, red and green, a hanging red glass oil lamp (unlit) in front of them on a short chain-free bracket, and an embroidered white towel (rushnik) with red ends draped over the top. Painted with respect: calm faces, gold halos. It is UNLIT: NO flames, NO glow (the game adds the light). Real-world size about 30 in wide x 8 in deep x 34 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### rus-banya-heater
Size: 1024x1024 (square)
Should read as: a stone heater with a heap of rocks on top

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: banya heater: stones heaped over a firebox.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A Russian BANYA heater (kamenka): a squat square firebox of rough grey stones and clay, waist high, its top heaped high with a mound of round dark grey rocks, a small dark arched stoke hole in front, a wooden bucket and a long-handled wooden ladle beside it. It is COLD and UNLIT: dull charcoal and pale ash, NO flames, NO glow, NO smoke (the game adds the fire). Real-world size about 48 in wide x 48 in deep x 48 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### rus-fur-bundles
Size: 1024x1024 (square)
Should read as: a heap of fur bundles

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: bundles of furs and pelts.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A heap of fur trade goods: four fat bundles of pelts tied with cord, sable dark brown, fox red, squirrel grey and white ermine, stacked on a low plank pallet with two loose pelts draped over them. The things on it are FEW and BIG, packed tight as solid masses (nothing tiny, nothing floating). Real-world size about 54 in wide x 30 in deep x 32 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mes-brazier
Size: 1024x1024 (square)
Should read as: a large painted clay fire bowl on a pedestal

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: great painted ceramic brazier.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A great Mexica ceramic BRAZIER: a big round fired-clay brazier bowl on a tall flaring pedestal, waist high, painted ochre with a band of red and black geometric pattern and two big knobs on its rim, its bowl filled with black charcoal. It is COLD and UNLIT: dull charcoal and pale ash, NO flames, NO glow, NO smoke (the game adds the fire). Real-world size about 36 in wide x 36 in deep x 54 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mes-comal-hearth
Size: 1024x1024 (square)
Should read as: three stones holding a round flat clay griddle

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: three-stone hearth with a clay griddle (comal).

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A Mesoamerican HEARTH: three rounded grey hearthstones set in a triangle on the ground holding a big round flat clay griddle (comal), with three tortillas on it and a little black charcoal under it, a clay cooking pot beside the stones. It is COLD and UNLIT: dull charcoal and pale ash, NO flames, NO glow, NO smoke (the game adds the fire). Real-world size about 36 in wide x 36 in deep x 14 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mes-awning
Size: 1024x1024 (square)
Should read as: a cloth awning on four poles

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: cotton shade awning on four poles.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A market SHADE AWNING: a flat rectangle of undyed cotton cloth with a red striped border stretched taut on four THICK upright wooden poles about 8 ft tall, tied at each corner; nothing under it. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and pole is THICK, at least as thick as a man's arm; nothing thin, no wire, no string, no loose dangling parts. Real-world size about 108 in wide x 72 in deep x 96 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mde-floor-fountain
Size: 1024x1024 (square)
Should read as: a low octagonal marble fountain basin with water

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: octagonal marble floor fountain.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from HIGH above (camera elevation about 50 degrees), so its whole top and its height are both plainly visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A Mamluk FLOOR FOUNTAIN (fisqiya): a low OCTAGONAL basin of white marble set into the floor, knee high, about 5 ft across, its rim and the floor panel round it inlaid in a geometric pattern of red, black and white marble, a small stepped marble jet-stand in the middle; the basin holds shallow, pale, LIGHT TEAL water, painted flat and clear. Real-world size about 60 in wide x 60 in deep x 24 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### mes-codex-mat
Size: 1024x1024 (square)
Should read as: a long folded painted book spread open on a mat

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: screenfold codex unfolded on a reed mat.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from HIGH above (camera elevation about 50 degrees), so its whole top and its height are both plainly visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A Mexica SCREENFOLD CODEX laid open on the floor: a long strip of white-plastered bark paper folded like a fan, several pages unfolded flat side by side on a woven reed mat, a low woven cushion at one side where the painter kneels. The pages are painted in the manner of the Codex Borbonicus: day-sign pictures in coloured boxes on white, framed by red guide lines (pictures, no letters). The things on it are FEW and BIG, packed tight as solid masses (nothing tiny, nothing floating). Real-world size about 60 in wide x 42 in deep x 12 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.
