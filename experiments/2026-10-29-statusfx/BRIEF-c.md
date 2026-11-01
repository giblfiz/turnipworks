# Image brief: c

Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that draws anything: every picture must come from image_gen. (Python/PIL may only CHECK files and resize.)

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim). Save it as `art/<id>.png` in this folder.

Then open your own result and check: (1) exactly one subject as described, whole, clear margin on every side; (2) the background is what the prompt asks (transparent: check with PIL that the PNG has an alpha channel and its four corners are alpha 0; black: corners pure black); (3) the right subject and colour; (4) no text or letters beyond any glyph the prompt explicitly allows. If a check fails, generate again (at most 3 tries per shot) and keep the best.

Append one line per shot to `LOG-c.md`: id, tries, checks passed/failed, one sentence on what it shows. Finish each shot (file saved, LOG line written) before the next. When all are done write `art/DONE-c` listing the saved ids. Then stop.

## Shots

### orb-poisoned-skull
Size: 1024x1024

Prompt:

Asset for Turnip Works, a cosy rustic fantasy tabletop game with heroic hand-painted miniatures. Style: a BIG, BOLD, CARTOONY painted sticker, like a hand-painted game token: chunky simple silhouette, thick dark-brown ink outline all the way round, flat saturated painted colour with one soft highlight and one soft shade, a little brush texture, no fine detail, no hairlines. It must read instantly when it is only 30 pixels tall, floating over a miniature's head. Exactly ONE subject, centred, filling about 80% of the square frame, generous clear margin, nothing cut off. Genuinely TRANSPARENT background (alpha 0 outside the subject), no floor, no cast shadow, no frame, no circle or badge behind it, no text, no letters, no logo. Subject: One cartoon SKULL AND CROSSBONES, painted bright TOXIC GREEN (lime green skull and bones, darker green shading), cute-spooky.

### orb-poisoned-bubbles
Size: 1024x1024

Prompt:

Asset for Turnip Works, a cosy rustic fantasy tabletop game with heroic hand-painted miniatures. Style: a BIG, BOLD, CARTOONY painted sticker, like a hand-painted game token: chunky simple silhouette, thick dark-brown ink outline all the way round, flat saturated painted colour with one soft highlight and one soft shade, a little brush texture, no fine detail, no hairlines. It must read instantly when it is only 30 pixels tall, floating over a miniature's head. Exactly ONE subject, centred, filling about 80% of the square frame, generous clear margin, nothing cut off. Genuinely TRANSPARENT background (alpha 0 outside the subject), no floor, no cast shadow, no frame, no circle or badge behind it, no text, no letters, no logo. Subject: A tight cluster of three or four round bright TOXIC GREEN bubbles of different sizes, bubbling upward like poison, glossy highlights.

### orb-paralyzed
Size: 1024x1024

Prompt:

Asset for Turnip Works, a cosy rustic fantasy tabletop game with heroic hand-painted miniatures. Style: a BIG, BOLD, CARTOONY painted sticker, like a hand-painted game token: chunky simple silhouette, thick dark-brown ink outline all the way round, flat saturated painted colour with one soft highlight and one soft shade, a little brush texture, no fine detail, no hairlines. It must read instantly when it is only 30 pixels tall, floating over a miniature's head. Exactly ONE subject, centred, filling about 80% of the square frame, generous clear margin, nothing cut off. Genuinely TRANSPARENT background (alpha 0 outside the subject), no floor, no cast shadow, no frame, no circle or badge behind it, no text, no letters, no logo. Subject: One jagged electric-BLUE cartoon lightning spark (a zig-zag bolt with a little starburst at its middle), bright cyan-blue with white highlights.

### orb-zzz
Size: 1024x1024

Prompt:

Asset for Turnip Works, a cosy rustic fantasy tabletop game with heroic hand-painted miniatures. Style: a BIG, BOLD, CARTOONY painted sticker, like a hand-painted game token: chunky simple silhouette, thick dark-brown ink outline all the way round, flat saturated painted colour with one soft highlight and one soft shade, a little brush texture, no fine detail, no hairlines. It must read instantly when it is only 30 pixels tall, floating over a miniature's head. Exactly ONE subject, centred, filling about 80% of the square frame, generous clear margin, nothing cut off. Genuinely TRANSPARENT background (alpha 0 outside the subject), no floor, no cast shadow, no frame, no circle or badge behind it, no text, no letters, no logo. Subject: One big cartoon letter 'Z' for sleeping, puffy and rounded, pale sky-blue with a white highlight and a dark outline, slightly tilted. (This single Z is the only glyph allowed.)

### orb-exhaust-skull
Size: 1024x1024

Prompt:

Asset for Turnip Works, a cosy rustic fantasy tabletop game with heroic hand-painted miniatures. Style: a BIG, BOLD, CARTOONY painted sticker, like a hand-painted game token: chunky simple silhouette, thick dark-brown ink outline all the way round, flat saturated painted colour with one soft highlight and one soft shade, a little brush texture, no fine detail, no hairlines. It must read instantly when it is only 30 pixels tall, floating over a miniature's head. Exactly ONE subject, centred, filling about 80% of the square frame, generous clear margin, nothing cut off. Genuinely TRANSPARENT background (alpha 0 outside the subject), no floor, no cast shadow, no frame, no circle or badge behind it, no text, no letters, no logo. Subject: One plain cartoon SKULL, bone-white with grey shading and black eye sockets, no crossbones, simple and bold.
