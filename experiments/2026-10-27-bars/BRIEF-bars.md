# Image brief: bars

You are generating source plates for 3D reconstruction (image-to-3D). Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates images or draws anything: every picture must come from image_gen.

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim), size as stated, with a transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing).

Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side (nothing cut off by the frame); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the corners are alpha 0); (3) it is the requested kind of object (one tall slender square iron post with a foot plate and a cap, nothing attached; the foot plate and cap stick out only a thin lip beyond the shaft, no flared or spreading base) and its proportions are slender (about 13 times as tall as wide); (4) no text, no floor, no shadow. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next, so finished plates can be picked up while you work. When all are done, write `plates/DONE-bars` containing the list of saved ids.

## Shots

### cell-bars-post
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One free-standing square wrought-iron POST (the corner or end stanchion of a run of prison-cell iron bars), standing alone with nothing attached to it: one thick plain straight square iron shaft that is the same width almost all the way up, a low square iron foot plate at the bottom and a squat square iron cap with a flat top; two flat iron bands, only slightly raised, wrap the shaft at one third and two thirds of its height, and a few round rivet heads sit on the bands, the foot plate and the cap. Proportions 8 inches square and 108 inches tall: a very tall slender post about thirteen times as tall as it is wide. The foot plate and the cap stick out only a thin one-inch lip beyond the shaft on every side, no flare, no stepped or spreading base: the outline of the whole post is a straight-sided tall narrow box with just a small lip at the bottom and at the top, like the bands. Dark charcoal-grey forged iron with a little rust-brown patina and softly worn lighter edges, the same iron as a prison cell's bars; dark grey, not black. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, clear transparent space above the cap and below the foot plate, no scene or additional objects, no bars, panels, gates or chains attached, no text, no logos, no recognizable product design. Three-quarter view from ABOVE, camera elevation 35 degrees, so the flat top of the cap and the whole shaft down to the foot plate are visible; the whole post fits in the frame. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, finials, thin spikes or isolated floating components.
