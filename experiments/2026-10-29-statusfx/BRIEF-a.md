# Image brief: a

Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that draws anything: every picture must come from image_gen. (Python/PIL may only CHECK files and resize.)

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim). Save it as `art/<id>.png` in this folder.

Then open your own result and check: (1) exactly one subject as described, whole, clear margin on every side; (2) the background is what the prompt asks (transparent: check with PIL that the PNG has an alpha channel and its four corners are alpha 0; black: corners pure black); (3) the right subject and colour; (4) no text or letters beyond any glyph the prompt explicitly allows. If a check fails, generate again (at most 3 tries per shot) and keep the best.

Append one line per shot to `LOG-a.md`: id, tries, checks passed/failed, one sentence on what it shows. Finish each shot (file saved, LOG line written) before the next. When all are done write `art/DONE-a` listing the saved ids. Then stop.

## Shots

### orb-charmed
Size: 1024x1024

Prompt:

Asset for Turnip Works, a cosy rustic fantasy tabletop game with heroic hand-painted miniatures. Style: a BIG, BOLD, CARTOONY painted sticker, like a hand-painted game token: chunky simple silhouette, thick dark-brown ink outline all the way round, flat saturated painted colour with one soft highlight and one soft shade, a little brush texture, no fine detail, no hairlines. It must read instantly when it is only 30 pixels tall, floating over a miniature's head. Exactly ONE subject, centred, filling about 80% of the square frame, generous clear margin, nothing cut off. Genuinely TRANSPARENT background (alpha 0 outside the subject), no floor, no cast shadow, no frame, no circle or badge behind it, no text, no letters, no logo. Subject: One plump PINK cartoon heart (hot pink, a lighter pink highlight), slightly tilted, like a love-struck cartoon heart.

### orb-stunned
Size: 1024x1024

Prompt:

Asset for Turnip Works, a cosy rustic fantasy tabletop game with heroic hand-painted miniatures. Style: a BIG, BOLD, CARTOONY painted sticker, like a hand-painted game token: chunky simple silhouette, thick dark-brown ink outline all the way round, flat saturated painted colour with one soft highlight and one soft shade, a little brush texture, no fine detail, no hairlines. It must read instantly when it is only 30 pixels tall, floating over a miniature's head. Exactly ONE subject, centred, filling about 80% of the square frame, generous clear margin, nothing cut off. Genuinely TRANSPARENT background (alpha 0 outside the subject), no floor, no cast shadow, no frame, no circle or badge behind it, no text, no letters, no logo. Subject: One fat five-pointed YELLOW cartoon star (golden yellow, rounded points), the kind that circles a dazed cartoon character's head.

### orb-frightened-ghost
Size: 1024x1024

Prompt:

Asset for Turnip Works, a cosy rustic fantasy tabletop game with heroic hand-painted miniatures. Style: a BIG, BOLD, CARTOONY painted sticker, like a hand-painted game token: chunky simple silhouette, thick dark-brown ink outline all the way round, flat saturated painted colour with one soft highlight and one soft shade, a little brush texture, no fine detail, no hairlines. It must read instantly when it is only 30 pixels tall, floating over a miniature's head. Exactly ONE subject, centred, filling about 80% of the square frame, generous clear margin, nothing cut off. Genuinely TRANSPARENT background (alpha 0 outside the subject), no floor, no cast shadow, no frame, no circle or badge behind it, no text, no letters, no logo. Subject: One little PURPLE cartoon ghost (lavender-purple sheet ghost with a wavy bottom), wide scared eyes and an open 'O' mouth, cute not scary.

### orb-frightened-bang
Size: 1024x1024

Prompt:

Asset for Turnip Works, a cosy rustic fantasy tabletop game with heroic hand-painted miniatures. Style: a BIG, BOLD, CARTOONY painted sticker, like a hand-painted game token: chunky simple silhouette, thick dark-brown ink outline all the way round, flat saturated painted colour with one soft highlight and one soft shade, a little brush texture, no fine detail, no hairlines. It must read instantly when it is only 30 pixels tall, floating over a miniature's head. Exactly ONE subject, centred, filling about 80% of the square frame, generous clear margin, nothing cut off. Genuinely TRANSPARENT background (alpha 0 outside the subject), no floor, no cast shadow, no frame, no circle or badge behind it, no text, no letters, no logo. Subject: Two bold RED exclamation marks side by side, '!!', chunky and slightly wobbly like a cartoon alarm, red with a dark outline. (These two marks are the only glyphs allowed.)
