# Image brief: b

Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that draws anything: every picture must come from image_gen. (Python/PIL may only CHECK files and resize.)

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim). Save it as `art/<id>.png` in this folder.

Then open your own result and check: (1) exactly one subject as described, whole, clear margin on every side; (2) the background is what the prompt asks (transparent: check with PIL that the PNG has an alpha channel and its four corners are alpha 0; black: corners pure black); (3) the right subject and colour; (4) no text or letters beyond any glyph the prompt explicitly allows. If a check fails, generate again (at most 3 tries per shot) and keep the best.

Append one line per shot to `LOG-b.md`: id, tries, checks passed/failed, one sentence on what it shows. Finish each shot (file saved, LOG line written) before the next. When all are done write `art/DONE-b` listing the saved ids. Then stop.

## Shots

### orb-blinded-eye
Size: 1024x1024

Prompt:

Asset for Turnip Works, a cosy rustic fantasy tabletop game with heroic hand-painted miniatures. Style: a BIG, BOLD, CARTOONY painted sticker, like a hand-painted game token: chunky simple silhouette, thick dark-brown ink outline all the way round, flat saturated painted colour with one soft highlight and one soft shade, a little brush texture, no fine detail, no hairlines. It must read instantly when it is only 30 pixels tall, floating over a miniature's head. Exactly ONE subject, centred, filling about 80% of the square frame, generous clear margin, nothing cut off. Genuinely TRANSPARENT background (alpha 0 outside the subject), no floor, no cast shadow, no frame, no circle or badge behind it, no text, no letters, no logo. Subject: One cartoon EYE (white eyeball, dark pupil) with a thick black diagonal slash crossing it out, like a 'cannot see' sign but painted and cartoony, no circle around it.

### orb-blinded-cloud
Size: 1024x1024

Prompt:

Asset for Turnip Works, a cosy rustic fantasy tabletop game with heroic hand-painted miniatures. Style: a BIG, BOLD, CARTOONY painted sticker, like a hand-painted game token: chunky simple silhouette, thick dark-brown ink outline all the way round, flat saturated painted colour with one soft highlight and one soft shade, a little brush texture, no fine detail, no hairlines. It must read instantly when it is only 30 pixels tall, floating over a miniature's head. Exactly ONE subject, centred, filling about 80% of the square frame, generous clear margin, nothing cut off. Genuinely TRANSPARENT background (alpha 0 outside the subject), no floor, no cast shadow, no frame, no circle or badge behind it, no text, no letters, no logo. Subject: One small BLACK cartoon storm cloud (charcoal-black puffy cloud, dark-grey highlights) with two little dark raindrops under it.

### orb-grappled
Size: 1024x1024

Prompt:

Asset for Turnip Works, a cosy rustic fantasy tabletop game with heroic hand-painted miniatures. Style: a BIG, BOLD, CARTOONY painted sticker, like a hand-painted game token: chunky simple silhouette, thick dark-brown ink outline all the way round, flat saturated painted colour with one soft highlight and one soft shade, a little brush texture, no fine detail, no hairlines. It must read instantly when it is only 30 pixels tall, floating over a miniature's head. Exactly ONE subject, centred, filling about 80% of the square frame, generous clear margin, nothing cut off. Genuinely TRANSPARENT background (alpha 0 outside the subject), no floor, no cast shadow, no frame, no circle or badge behind it, no text, no letters, no logo. Subject: One cartoon GRABBING HAND, ORANGE-TAN (a tan-orange glove-like hand), fingers curled as if clutching, seen from the side, chunky fingers.

### orb-restrained
Size: 1024x1024

Prompt:

Asset for Turnip Works, a cosy rustic fantasy tabletop game with heroic hand-painted miniatures. Style: a BIG, BOLD, CARTOONY painted sticker, like a hand-painted game token: chunky simple silhouette, thick dark-brown ink outline all the way round, flat saturated painted colour with one soft highlight and one soft shade, a little brush texture, no fine detail, no hairlines. It must read instantly when it is only 30 pixels tall, floating over a miniature's head. Exactly ONE subject, centred, filling about 80% of the square frame, generous clear margin, nothing cut off. Genuinely TRANSPARENT background (alpha 0 outside the subject), no floor, no cast shadow, no frame, no circle or badge behind it, no text, no letters, no logo. Subject: One heavy cartoon PADLOCK in BRASS-GOLD with a short loop of dark iron CHAIN through its shackle (three or four chunky links), the padlock large and the chain short.
