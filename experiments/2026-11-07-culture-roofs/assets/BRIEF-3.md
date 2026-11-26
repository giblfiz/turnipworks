# Image brief: culture-roofs-3

You are generating source plates for 3D reconstruction (image-to-3D) for a tabletop game. Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates, draws or edits images: every picture must come from image_gen.

For each shot below: pass the house STYLE REFERENCE image `style-references/heroic-handpainted-tavern-v1.png` to image_gen as a style reference (and, where the prompt names one, the plates/<id>.png reference in this folder too). Generate ONE image from the prompt EXACTLY as written (copy it verbatim), size 1024x1024 (square), with a transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing). The image tool may return another size or aspect (portrait, landscape, 1254 px): THAT IS FINE, keep it as it is; never retry for size.

Then look at your own result and check: (1) exactly one object, whole, nothing cut off by the frame (a tight margin is fine); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the corners are alpha 0); (3) it plainly shows what the shot asks for (the line `Should read as`), with the proportions asked for; (4) no text, no floor, no shadow, no people. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG-3.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next. When all are done, write `plates/DONE-3` containing the list of saved ids.

## Shots

### roof-ridge--glazed
Size: 1024x1024 (square)
Should read as: a long straight green glazed temple roof-ridge section

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: 5-ft ridge section of a Chinese green-glazed temple roof.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A mid-Qing Beijing temple-hall RIDGE module of moulded GREEN-GLAZED ridge pieces: a tall straight ridge with a deep moulded panel along its side (a sunken band with a simple raised plain border and a row of plain round bosses), a rounded glazed coping along its whole top and a moulded base course. Deep jade to malachite green glaze with a soft restrained sheen, the sunken band a touch darker; no dragons, no figures on it. It is ONE straight 5-ft MODULE of a roof ridge, seen from the side at a three-quarter angle: a LONG horizontal bar about three times as long as it is tall, its long axis running LEFT-RIGHT across the picture. Both ENDS are cut clean and flat (square), so copies butt end to end into one continuous ridge; the underside is a shallow inverted V (it sits astride the roof peak). No end ornament, no roof slopes attached. Built CHUNKY for a tabletop miniature seen from across the table: every part THICK and solid, broad soft bevels, nothing thin, no wire, no loose or dangling parts, nothing floating. NO text, letters, inscriptions or script-like marks anywhere; NO figures, faces or deity images. Real-world size about 60 in wide x 20 in deep x 22 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### roof-cupola-onion
Size: 1024x1024 (square)
Should read as: a tall wooden onion-domed church cupola with a cross on top

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: Rus' wooden church cupola: drum, onion dome of aspen shingles, plain cross.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A wooden Russian church CUPOLA (late 16th c. style, modest): a tall round timber DRUM of horizontal logs, a thin plain cornice band at its top, and on it a MODEST ONION dome (a restrained bulb, only a little wider than the drum, with a short neck), covered all over in overlapping rounded aspen-wood ploughshare shingles (lemekh) like fish scales, weathered SILVER-GREY with warm honey edges, and on top a short thick neck carrying ONE plain wooden CROSS with three bars (the lowest slanted), the bars as thick as the neck, no figure on it. The whole piece is tall and narrow; the drum stands on a short square timber base that sits astride a roof ridge. Built CHUNKY for a tabletop miniature seen from across the table: every part THICK and solid, broad soft bevels, nothing thin, no wire, no loose or dangling parts, nothing floating. NO text, letters, inscriptions or script-like marks anywhere; NO figures, faces or deity images. Real-world size about 72 in wide x 72 in deep x 168 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.

### roof-shikhara
Size: 1024x1024 (square)
Should read as: a tall curving Indian sandstone temple tower with a ribbed disc and pot finial on top

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: Nagara latina temple tower (shikhara) with amalaka and kalasha.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from HIGH above (camera elevation about 50 degrees), so its whole top and its height are both plainly visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: A north-Indian Nagara temple TOWER of the LATINA (rekha-prasada) type, as built round Amber and Jaipur: one tall, single, CURVILINEAR tower of buff and pale pink sandstone rising from a square base, its sides curving gently inward to the top like a beehive, made of many stacked horizontal storey bands and divided by strong PROJECTING VERTICAL RIBS (a broad central offset on each face and stepped offsets beside it); at its top a short neck, a big round ribbed AMALAKA (a fluted cushion-shaped stone disc with a SCALLOPED outline) and on it a pot-shaped KALASHA finial. Carving is only abstract and architectural: mesh-like gavaksha (horseshoe-arch) lattice and mouldings, no figures, no deities, no animals. Built CHUNKY for a tabletop miniature seen from across the table: every part THICK and solid, broad soft bevels, nothing thin, no wire, no loose or dangling parts, nothing floating. NO text, letters, inscriptions or script-like marks anywhere; NO figures, faces or deity images. Real-world size about 144 in wide x 144 in deep x 264 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.
