# Image brief: buttress-dragons

You are generating source plates for 3D reconstruction (image-to-3D). Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates images or draws anything: every picture must come from image_gen.

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim), size as stated, with a transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing).

Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side (nothing cut off by the frame); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the corners are alpha 0); (3) it is the requested kind of object (a free-standing column, or a flying buttress: a pier with a half arch) and the named motif is plainly visible; (4) no text, no floor, no shadow. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next, so finished plates can be picked up while you work. When all are done, write `plates/DONE-buttress-dragons` containing the list of saved ids.

## Shots

### flavor-buttress--dragons-fct
Size: 1536x1024 (landscape)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One architectural FLYING BUTTRESS section meant to stand against a wall, seen from the side so the whole quarter arch shows: on the right a tall upright stone pier on a moulded foot: 9 ft tall, 3 ft along the arch and only 2.5 ft thick, the TALLEST part of the piece; from the top of the pier ONE thick half arch springs out to the left and sweeps down in a quarter circle to a stout low footing block about 6 ft away, so the piece is taller than it is long, leaving a clear open space under the arch that you can see through. The whole piece is one flat-sided slab 2.5 ft thick: pier, arch and footing share the same two flat side faces, and nothing projects more than a few inches from them. It stands alone: no wall, no panels, slats or backing behind it, no second leg. Carving, in deep relief on the flat side faces and along the arch: the arch rib is carved as one thick scaly DRAGON TAIL sweeping down onto the footing block; the pier front carries a large DRAGON HEAD in high relief with a long blunt snout and short thick horns. Everything is very thick and blocky (the arch rib at least 1 ft thick). Palette: burnt copper and deep crimson. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Seen mostly from the side (the camera 20 degrees round from square-on to the side face, elevation 20 degrees), so the full profile of pier and arch shows. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.
