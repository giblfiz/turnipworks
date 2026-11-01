# Image brief: dragons

You are generating source plates for 3D reconstruction (image-to-3D). Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates images or draws anything: every picture must come from image_gen.

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim), size as stated, with a transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing).

Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side (nothing cut off by the frame); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the corners are alpha 0); (3) it is the requested kind of object (a free-standing column, or a flying buttress: a pier with a half arch) and the named motif is plainly visible; (4) no text, no floor, no shadow. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next, so finished plates can be picked up while you work. When all are done, write `plates/DONE-dragons` containing the list of saved ids.

## Shots

### flavor-pillar--dragons-fct
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One free-standing architectural PILLAR (a column that holds up a ceiling), not a statue: a square stepped plinth base, one thick shaft, and a broad square capital with a completely FLAT TOP. Proportions 30 inches across and 120 inches tall: a tall column about four times as tall as it is wide. A single thick-bodied dragon coils in a spiral twice around the shaft, its scaly body nearly as thick as the shaft, clawed forefeet gripping the capital and its blunt horned head resting on the top edge of the capital looking outward; small folded wings lie flat against the shaft. The motif belongs to the column itself and reads from every side and from above. Palette: burnt copper and deep crimson. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from ABOVE, camera elevation 35 degrees, so the flat top of the capital and the whole shaft down to the base are visible; the whole column fits in the frame. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-buttress--dragons-fct
Size: 1536x1024 (landscape)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One architectural FLYING BUTTRESS section meant to stand against a wall, seen from the side so the whole quarter arch shows: on the right a massive upright stone pier about 3 ft wide, 1.5 ft deep and 9 ft tall on a moulded foot; from the top of the pier ONE thick half arch springs out to the left and sweeps down in a quarter circle to a stout low footing block about 8 ft away, leaving a clear open space under the arch that you can see through. Carving: the arch rib is carved as one thick scaly DRAGON TAIL sweeping down onto the footing block; the pier front carries a large DRAGON HEAD in high relief with a long blunt snout and short thick horns. Everything is very thick and blocky (the arch rib at least 1 ft thick). Palette: burnt copper and deep crimson. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from slightly above, camera elevation 30 degrees. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.
