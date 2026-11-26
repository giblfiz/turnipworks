# Image brief: fth muslim

You are generating source plates for 3D reconstruction (image-to-3D) for a heroic hand-painted fantasy tabletop game. Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates or draws images: every picture must come from image_gen.

The attached image `style-anchor.png` (in this folder) is the house STYLE guide only: match its painting style, never its contents. For a shot marked EDIT, first open the named reference plate from this folder and make the new picture as an edit of it (same materials, colours and camera), changing only what the prompt says.

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim), size as stated (any size is fine: the stated size is only a preference), with a genuinely transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing).

Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side (nothing cut off by the frame); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the four corners are alpha 0); (3) it is the requested kind of object and its named features are plainly visible; (4) no text, no letters, no floor, no shadow. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG-muslim.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next. When all are done, write `plates/DONE-muslim` containing the list of saved ids.

## Shots

### flavor-idol--muslim
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a Mamluk marble mihrab prayer niche.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A MIHRAB of a 15th-century Mamluk mosque in Cairo, as a free-standing wall piece with a FLAT BACK: a tall rectangular frame of polychrome MARBLE INLAY (bands of white, black, red and green marble in geometric patterns) around a deep recessed NICHE with a POINTED ARCH, the arch stones alternating light and dark, the niche's half-dome hood fluted, two slender marble COLUMNS with small capitals standing in the niche's corners; the niche's back wall panelled in striped marble. NO inscription band, NO letters. NO figures, NO faces, NO animals anywhere: geometric and arabesque ornament only. Made with reverence: dignified, calm, symmetrical where the real object is, a sacred object treated respectfully, never cartoonish. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and bar is THICK; nothing thin, no wire, no string, no dangling loose parts. Real-world size about 72 in wide x 24 in deep x 120 in tall: keep these proportions. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### flavor-censer--muslim
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a tall Mamluk brass mosque candlestick.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A tall MAMLUK MOSQUE CANDLESTICK of brass: a broad bell-shaped BASE, a short thick neck, a round candle socket on top holding a very thick tall white wax candle; the base inlaid with silver and dark bands of GEOMETRIC ornament and roundels of arabesque (NO inscription). It is UNLIT: no flames, no glow, no smoke (the game adds the light). NO figures, NO faces, NO animals anywhere: geometric and arabesque ornament only. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and bar is THICK; nothing thin, no wire, no string, no dangling loose parts. Real-world size about 18 in wide x 18 in deep x 54 in tall: keep these proportions. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### flavor-pulpit--muslim
Size: 1536x1024 (landscape)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a carved wooden Mamluk minbar.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A MINBAR (mosque pulpit) of 15th-century Mamluk Cairo, like the minbar of Sultan Qaytbay: carved dark wood, seen from the side so its whole length shows: a straight STAIR of steps rising between two TRIANGULAR SIDE PANELS filled with GEOMETRIC STAR-PATTERN inlay of wood and ivory; at the low end a tall doorway frame with a small cresting; at the top a small open PAVILION of four posts carrying a BULB-SHAPED wooden cupola. NO figures, NO faces, NO animals anywhere: geometric and arabesque ornament only. NO letters. Made with reverence: dignified, calm, symmetrical where the real object is, a sacred object treated respectfully, never cartoonish. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and bar is THICK; nothing thin, no wire, no string, no dangling loose parts. Real-world size about 30 in wide x 96 in deep x 106 in tall: keep these proportions. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### flavor-lamp--muslim
Size: 1024x1536 (portrait)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: an enamelled glass Mamluk mosque lamp hanging on chains.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A MAMLUK MOSQUE LAMP of clear enamelled glass: a wide flaring NECK, a round bulbous BODY with six small glass loop handles, a short foot; painted with enamel BANDS of deep blue, red and gold: geometric bands, roundels and floral arabesque only, NO inscription. It HANGS: at the top, three or four THICK straight chain rods (drawn as solid rods, not fine links) rise to one small ceiling ring; nothing below it touches the ground. It is UNLIT: no flames, no glow, no smoke (the game adds the light). NO figures, NO faces, NO animals anywhere: geometric and arabesque ornament only. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and bar is THICK; nothing thin, no wire, no string, no dangling loose parts. Real-world size about 14 in wide x 14 in deep x 36 in tall: keep these proportions. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### flavor-stand--muslim
Size: 1024x1024 (square)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: an open empty wooden rehal (Qur'an stand).

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: A REHAL: a folding wooden book stand made of two thick boards that cross in an X, opened so that it stands with a V-shaped cradle on top, its boards INLAID with a geometric star pattern in light wood and mother-of-pearl. It is EMPTY: NO book on it. NO figures, NO faces, NO animals anywhere: geometric and arabesque ornament only. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and bar is THICK; nothing thin, no wire, no string, no dangling loose parts. Real-world size about 12 in wide x 16 in deep x 14 in tall: keep these proportions. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### flavor-font--muslim
Size: 1024x1024 (square)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: an octagonal marble ablution fountain of a Mamluk mosque courtyard.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: An ABLUTION FOUNTAIN of a Mamluk mosque courtyard: a broad OCTAGONAL basin of white and grey marble with a polychrome inlaid band round its rim, small brass SPOUTS set round its sides, a low marble step round its foot for sitting, and in its centre a short marble post. No water spray. NO figures, NO faces, NO animals anywhere: geometric and arabesque ornament only. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and bar is THICK; nothing thin, no wire, no string, no dangling loose parts. Real-world size about 48 in wide x 48 in deep x 40 in tall: keep these proportions. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.


### flavor-corbel--muslim
Size: 1024x1024 (square)

Prompt:

Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: a carved stone muqarnas corbel bracket.

Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Palette: rich but softened burgundy, moss green, dusty teal, ochre, cream, warm honey wood and blue-gray stone, used where they suit the object; avoid an all-brown result.
Avoid: invented handles or ring pulls on food, bottles, beds, textiles and other objects that don't have them; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.

Specific design: One architectural carved CORBEL bracket, not a freestanding statue: a stout block projecting out from a FLAT VERTICAL wall-mounting back, with a wide FLAT HORIZONTAL TOP to carry a beam; under that top its front is carved as stepped tiers of MUQARNAS cells (little niche-like facets stacked in rows, widening upward), pale limestone. Back completely flat; top completely flat. No wall, no beam. NO figures, NO faces, NO animals anywhere: geometric and arabesque ornament only. Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and bar is THICK; nothing thin, no wire, no string, no dangling loose parts. Real-world size about 24 in wide x 24 in deep x 30 in tall: keep these proportions. NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it. Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.

