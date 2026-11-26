# Image brief: w3re

You are generating source plates for 3D reconstruction (image-to-3D). Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates images or draws anything: every picture must come from image_gen.

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim), size as stated, with a transparent background. If the shot names a reference image, LOOK at it first and pass it to image_gen as the reference image (the new picture is an edit of it). Save the result as `plates/<id>.png` in this folder (create `plates/` if missing).

Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side (nothing cut off by the frame); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the corners are alpha 0); (3) it is plainly the requested kind of object, in a modern or near-future style; (4) NO text, letters, numbers, logos or brand marks anywhere on it (look closely: signs, screens, packages, cars); (5) no floor, no shadow, no people. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG-w3re.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next, so finished plates can be picked up while you work. When all are done, write `plates/DONE-w3re` containing the list of saved ids.

## Shots

### elevator-doors
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art, for a MODERN CITY setting (present day to near future): the same chunky storybook miniature style the game uses for its fantasy props, applied to a modern object. ONE elevator landing doors in a steel frame. A FLAT, THIN upright wall panel only 10 in deep, seen from the front: a pair of brushed-steel ELEVATOR LANDING DOORS standing shut in a flat steel frame flush with it (no box, no cab, no depth behind it, like a door in a wall), a small glowing amber arrow lamp over them (an arrow shape only, no numbers), a chunky round call button panel on the frame at one side. Real-world size about 60 in wide x 10 in deep x 96 in tall: keep these proportions. Palette: clean bathroom colours (warm white porcelain, chrome, pale grey, a soft teal or sage accent, warm wood where named); shade the whites with soft blue-grey and warm cream so the form reads, never flat pure white. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR, no photorealism. Glass and mirrors are painted OPAQUE (soft blue-grey with a pale highlight), never see-through. Exactly one complete object centered with generous clear margin, no scene or additional objects, no people or creatures. NO text, NO letters, NO numbers, NO logos, NO brand names, NO stickers and no recognisable real product design anywhere. Seen from its broad room-facing side at a slight three-quarter angle from slightly above (camera elevation 15 degrees); the whole piece fits in the frame. Genuinely transparent background, no floor, no ground and no cast shadow. Thick reconstructible parts; no wires, cables, thin rods, thin poles or isolated floating components.
