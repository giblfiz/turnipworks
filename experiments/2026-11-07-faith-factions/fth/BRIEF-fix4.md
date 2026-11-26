# Image brief: fth fix4

You are generating source plates for 3D reconstruction (image-to-3D) for a heroic hand-painted fantasy tabletop game. Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates or draws images: every picture must come from image_gen.

The attached image `style-anchor.png` (in this folder) is the house STYLE guide only: match its painting style, never its contents. For a shot marked EDIT, first open the named reference plate from this folder and make the new picture as an edit of it (same materials, colours and camera), changing only what the prompt says.

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim), size as stated (any size is fine: the stated size is only a preference), with a genuinely transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing).

Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side (nothing cut off by the frame); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the four corners are alpha 0); (3) it is the requested kind of object and its named features are plainly visible; (4) no text, no letters, no floor, no shadow. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG-fix4.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next. When all are done, write `plates/DONE-fix4` containing the list of saved ids.

## Shots

### flavor-idol--muslim--v2
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a Mamluk marble mihrab prayer niche.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A MIHRAB of a 15th-century Mamluk mosque in Cairo, as a free-standing wall piece with a FLAT BACK: a tall rectangular frame of plain smooth marble in a few BROAD STRIPES of alternating white and red-brown stone (ablaq), with only BIG simple geometric shapes (a few large interlocking squares and plain chevrons) and wide PLAIN borders, around a deep recessed NICHE. NO narrow bands, NO fine patterns, NO knotwork, NO panels of small ornament: nothing that could look like writing or calligraphy (real mihrabs often carry Qur'anic inscriptions; this one deliberately has none). A solid block, closed and finished on every side, with a POINTED ARCH, the arch stones alternating light and dark, the niche's half-dome hood fluted, two slender marble COLUMNS with small capitals standing in the niche's corners; the niche's back wall panelled in striped marble. NO inscription band, NO letters. NO figures, NO faces, NO animals anywhere: geometric and arabesque ornament only. Made with reverence: dignified, calm, symmetrical where the real object is, a sacred object treated respectfully, never cartoonish. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and bar is THICK; nothing thin, no wire, no string, no dangling loose parts. Real-world size about 72 in wide x 24 in deep x 120 in tall: keep these proportions. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### flavor-wheel--buddhist--v2
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a large standing Tibetan prayer wheel in its frame.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A large standing Tibetan PRAYER WHEEL: a tall upright CYLINDER DRUM of polished copper and brass, its surface SMOOTH polished copper with only ONE broad ring of a few LARGE simple lotus petals round its middle and plain raised rims at top and bottom; NO bands of small marks, NO embossed patterns, nothing that could look like writing or script (real prayer wheels carry the mantra in Tibetan letters; this one deliberately has none: the prayer scroll is hidden inside), turning on a thick vertical iron axle, set in a sturdy wooden FRAME painted red with gilt and green trim, a little roof on the frame, on a square wooden plinth. Made with reverence: dignified, calm, symmetrical where the real object is, a sacred object treated respectfully, never cartoonish. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and bar is THICK; nothing thin, no wire, no string, no dangling loose parts. Real-world size about 30 in wide x 30 in deep x 72 in tall: keep these proportions. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### flavor-stand--muslim--v3
Size: 1024x1024 (square)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: an open empty wooden rehal (Qur'an stand).

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A REHAL, built very CHUNKY and SOLID for a tabletop miniature: a folding wooden book stand made of two THICK single slabs of wood that cross in an X, joined where they cross by one thick solid wooden peg, no thin struts, no gaps, no separate hinges, every part one solid whole, opened so that it stands with a V-shaped cradle on top. The boards are PLAIN polished dark walnut, their faces SMOOTH and EMPTY, with only a carved scalloped edge and one small carved eight-pointed star cut through each leg below the cradle. It is EMPTY: NO book, NO pages, NO paper, NO cloth on it, NO pattern on the inner faces of the cradle, nothing that could look like an open book or like writing. NO figures, NO faces, NO animals anywhere: geometric and arabesque ornament only. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and bar is THICK; nothing thin, no wire, no string, no dangling loose parts. Real-world size about 12 in wide x 16 in deep x 14 in tall: keep these proportions. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.

