# Image brief: fth hindu

You are generating source plates for 3D reconstruction (image-to-3D) for a heroic hand-painted fantasy tabletop game. Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates or draws images: every picture must come from image_gen.

The attached image `style-anchor.png` (in this folder) is the house STYLE guide only: match its painting style, never its contents. For a shot marked EDIT, first open the named reference plate from this folder and make the new picture as an edit of it (same materials, colours and camera), changing only what the prompt says.

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim), size as stated (any size is fine: the stated size is only a preference), with a genuinely transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing).

Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side (nothing cut off by the frame); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the four corners are alpha 0); (3) it is the requested kind of object and its named features are plainly visible; (4) no text, no letters, no floor, no shadow. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG-hindu.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next. When all are done, write `plates/DONE-hindu` containing the list of saved ids.

## Shots

### flavor-idol--hindu
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a carved sandstone Ganesha sanctum of a medieval North Indian temple.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A small enclosed SANCTUM (garbhagriha) of an 11th-century central-Indian temple, carved in warm buff SANDSTONE: a cube-like stone cell with a richly carved DOORWAY in its front (stepped carved door jambs and lintel), a short curved beehive-shaped SHIKHARA tower on top with a round ribbed crowning stone. Inside, seen through the open doorway, a seated GANESHA murti of dark stone: elephant head, FOUR arms (upper right holding an axe, upper left a noose, lower right his broken tusk, lower left a bowl of round sweets, toward which his trunk curves to his left), seated at ease on a low pedestal, a small mouse at his feet, a garland of white jasmine flowers round his neck. Nothing else inside. Made with reverence: dignified, calm, symmetrical where the real object is, a sacred object treated respectfully, never cartoonish. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and bar is THICK; nothing thin, no wire, no string, no dangling loose parts. Real-world size about 60 in wide x 54 in deep x 108 in tall: keep these proportions. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### flavor-altarpiece--hindu
Size: 1024x1024 (square)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a brass Hindu offering plate on a low stand.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A Hindu OFFERING PLATE (thali): a round polished brass plate on a short brass stand with a round foot; on the plate a small unlit clay oil lamp (diya), a little heap of white jasmine flowers and one pink lotus flower, two bananas, and two tiny brass bowls, one of red kumkum powder and one of rice. It is UNLIT: no flames, no glow, no smoke (the game adds the light). Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and bar is THICK; nothing thin, no wire, no string, no dangling loose parts. Real-world size about 18 in wide x 18 in deep x 12 in tall: keep these proportions. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### flavor-censer--hindu
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a tall brass standing oil lamp of a Hindu temple.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A tall Hindu temple standing OIL LAMP (dipa) of polished brass: a stout round stepped foot, a thick turned stem with rings, and at the top a broad flat dish with FIVE small pointed spouts round its rim for wicks, a small finial in its centre. It is UNLIT: no flames, no glow, no smoke (the game adds the light). Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and bar is THICK; nothing thin, no wire, no string, no dangling loose parts. Real-world size about 16 in wide x 16 in deep x 60 in tall: keep these proportions. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### flavor-bell--hindu
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a brass Hindu temple bell hanging from its chain.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A Hindu temple BELL (ghanta) of polished brass: a stout bell shape with a thick rim and a heavy clapper inside, hanging from a short THICK brass chain rod with a round hook at the top. Made with reverence: dignified, calm, symmetrical where the real object is, a sacred object treated respectfully, never cartoonish. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and bar is THICK; nothing thin, no wire, no string, no dangling loose parts. Real-world size about 14 in wide x 14 in deep x 36 in tall: keep these proportions. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### flavor-gate--hindu
Size: 1024x1024 (square)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a carved sandstone kirti-torana gateway arch.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A free-standing KIRTI-TORANA gateway of the 11th-century Solanki style (as at Modhera, Gujarat), carved in warm sandstone: two tall square carved PILLARS on moulded bases, carrying a heavy horizontal carved LINTEL across the top, and between the pillars, below the lintel, a CUSPED (scalloped) arch springing from the pillars. Open in the middle so one walks through it. No walls on either side. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and bar is THICK; nothing thin, no wire, no string, no dangling loose parts. Real-world size about 96 in wide x 24 in deep x 120 in tall: keep these proportions. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.

