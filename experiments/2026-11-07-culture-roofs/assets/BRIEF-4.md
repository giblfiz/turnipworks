# Image brief: culture-roofs-1

You are generating source plates for 3D reconstruction (image-to-3D) for a tabletop game. Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates, draws or edits images: every picture must come from image_gen.

For each shot below: pass the house STYLE REFERENCE image `style-references/heroic-handpainted-tavern-v1.png` to image_gen as a style reference (and, where the prompt names one, the plates/<id>.png reference in this folder too). Generate ONE image from the prompt EXACTLY as written (copy it verbatim), size 1024x1024 (square), with a transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing). The image tool may return another size or aspect (portrait, landscape, 1254 px): THAT IS FINE, keep it as it is; never retry for size.

Then look at your own result and check: (1) exactly one object, whole, nothing cut off by the frame (a tight margin is fine); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the corners are alpha 0); (3) it plainly shows what the shot asks for (the line `Should read as`), with the proportions asked for; (4) no text, no floor, no shadow, no people. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG-4.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next. When all are done, write `plates/DONE-4` containing the list of saved ids.

## Shots

### roof-dome
Size: 1024x1024 (square)
Should read as: a low white plastered dome dotted with small round glass lights

Prompt:

Using the style reference image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: Mamluk bathhouse dome with glass light-caps.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from HIGH above (camera elevation about 50 degrees), so its whole top and its height are both plainly visible, generous clear space around every edge, a genuinely TRANSPARENT background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.

Specific design: ONLY the ROOF DOME of a Mamluk Cairo HAMMAM (bathhouse), as it stands on a flat roof: a low broad hemispherical masonry dome with a smooth warm off-white PLASTER finish, on a SHORT plain round drum (about one fifth of the total height) that sits on a thin flat square plaster plinth slab at the very bottom. NOTHING below the plinth: NO walls, NO building, NO doors, NO windows, NO arches, NO decorated facade; the whole piece is wider than tall (about 3 times as wide as the drum is tall). The dome is studded with ordered rings of small raised round GLASS LIGHT-CAPS (thick little glass bowls set in the plaster, pale green-blue and amber, each with a soft rim), about forty of them in four rings, none at the very top. Matte limewashed plaster with faint warm staining. Built CHUNKY for a tabletop miniature seen from across the table: every part THICK and solid, broad soft bevels, nothing thin, no wire, no loose or dangling parts, nothing floating. NO text, letters, inscriptions or script-like marks anywhere; NO figures, faces or deity images. Real-world size about 144 in wide x 144 in deep x 96 in tall: keep these proportions. It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.
