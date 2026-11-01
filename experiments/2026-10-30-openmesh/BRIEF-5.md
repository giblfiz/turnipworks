# Image brief: openmesh-5

You are generating source plates for 3D reconstruction (image-to-3D). Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates or draws or edits images: every picture must come from image_gen.

Each shot below is the OTHER STATE (open, or shut) of an existing game prop whose look must be matched exactly. First LOOK at every reference image the prompt names (they are in this folder under ref/<id>/: renders of the existing 3D model, and sometimes its original source plate), and pass them to image_gen as reference images. Then generate ONE image from the prompt EXACTLY as written (copy it verbatim), size 1024x1024 (square), with a transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing).

Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side (nothing cut off by the frame); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the corners are alpha 0); (3) it is plainly the SAME object as the references (same design, materials, colours, proportions), side by side it would read as a matching pair; (4) it is plainly in the state the shot asks for, as stated under 'State'; (5) no text, no floor, no shadow, no people. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG-5.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next, so finished plates can be picked up while you work. When all are done, write `plates/DONE-5` containing the list of saved ids.

## Shots

### smith-farrier-box
Size: 1024x1024 (square)
State: SHUT (closed, nothing inside visible, nothing swung out)

Prompt:

Use case: stylized-concept, an EDIT of an existing asset. Asset for Turnip Works, heroic hand-painted miniature game art. The reference images (ref/smith-farrier-box/partner-plate.png, ref/smith-farrier-box/partner-render-34.png, ref/smith-farrier-box/partner-render-front.png) all show ONE existing game prop, a free-standing piece of furniture (the game's 'smith-farrier-box-open'). Make the SAME object: the same design, the same materials and colours, the same ornament, the same proportions, width and footprint, so the two could be swapped in the game without anyone noticing anything but this ONE change: its lid SHUT, lying flat and closed on top, so no tools or contents are visible; a plain closed box with its carrying handle, NO drawers or compartments open anywhere (any drawer is pushed fully shut, flush with the box), nothing pulled out, nothing hanging open. The change must be obvious at a glance from across a room. Everything else stays as in the references. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin on every side, no scene or additional objects, no people or creatures, no text, no logos. Three-quarter front view from ABOVE (camera elevation 30 degrees), so the front and the top are both visible; the whole object fits in the frame. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.
