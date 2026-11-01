# Image brief: rest

You are generating source plates for 3D reconstruction (image-to-3D). Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates images or draws anything: every picture must come from image_gen.

For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim), size as stated, with a transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing).

Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side (nothing cut off by the frame); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the corners are alpha 0); (3) it is the requested kind of object (a free-standing column, or a flying buttress: a pier with a half arch) and the named motif is plainly visible; (4) no text, no floor, no shadow. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.

Append one line per shot to `LOG.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next, so finished plates can be picked up while you work. When all are done, write `plates/DONE-rest` containing the list of saved ids.

## Shots

### flavor-pillar--sun-fct
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One free-standing architectural PILLAR (a column that holds up a ceiling), not a statue: a square stepped plinth base, one thick shaft, and a broad square capital with a completely FLAT TOP. Proportions 30 inches across and 120 inches tall: a tall column about four times as tall as it is wide. The capital is a large radiant round SUN FACE disc with eight short thick triangular rays, repeated on all four sides; the shaft is fluted with thick vertical grooves. The motif belongs to the column itself and reads from every side and from above. Palette: warm golden ochre and ivory. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from ABOVE, camera elevation 35 degrees, so the flat top of the capital and the whole shaft down to the base are visible; the whole column fits in the frame. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-pillar--moon-fct
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One free-standing architectural PILLAR (a column that holds up a ceiling), not a statue: a square stepped plinth base, one thick shaft, and a broad square capital with a completely FLAT TOP. Proportions 30 inches across and 120 inches tall: a tall column about four times as tall as it is wide. The capital is a broad silver CRESCENT MOON with a calm face, its two thick horns pointing up under the flat top slab; the shaft is carved with a few thick five-pointed stars. The motif belongs to the column itself and reads from every side and from above. Palette: silver and muted midnight blue. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from ABOVE, camera elevation 35 degrees, so the flat top of the capital and the whole shaft down to the base are visible; the whole column fits in the frame. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-pillar--devils-fct
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One free-standing architectural PILLAR (a column that holds up a ceiling), not a statue: a square stepped plinth base, one thick shaft, and a broad square capital with a completely FLAT TOP. Proportions 30 inches across and 120 inches tall: a tall column about four times as tall as it is wide. The shaft is ridged and spiralled like one great horn; the capital is four broad HORNED DEVIL HEADS facing outward, each with two short thick horns. The motif belongs to the column itself and reads from every side and from above. Palette: brick red and dark charcoal. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from ABOVE, camera elevation 35 degrees, so the flat top of the capital and the whole shaft down to the base are visible; the whole column fits in the frame. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-pillar--spiders-fct
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One free-standing architectural PILLAR (a column that holds up a ceiling), not a statue: a square stepped plinth base, one thick shaft, and a broad square capital with a completely FLAT TOP. Proportions 30 inches across and 120 inches tall: a tall column about four times as tall as it is wide. A crouched SPIDER with a large oval abdomen clings to the upper shaft, its eight stout bent legs wrapping around the column; a thick carved web spreads over the capital. The motif belongs to the column itself and reads from every side and from above. Palette: deep plum and pale stone. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from ABOVE, camera elevation 35 degrees, so the flat top of the capital and the whole shaft down to the base are visible; the whole column fits in the frame. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-pillar--skulls-fct
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One free-standing architectural PILLAR (a column that holds up a ceiling), not a statue: a square stepped plinth base, one thick shaft, and a broad square capital with a completely FLAT TOP. Proportions 30 inches across and 120 inches tall: a tall column about four times as tall as it is wide. The capital is a ring of four large human SKULLS facing outward, large dark eye sockets and blocky teeth; the shaft is wound with thick carved crossed long bones. The motif belongs to the column itself and reads from every side and from above. Palette: ivory bone and charcoal. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from ABOVE, camera elevation 35 degrees, so the flat top of the capital and the whole shaft down to the base are visible; the whole column fits in the frame. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-pillar--tentacles-fct
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One free-standing architectural PILLAR (a column that holds up a ceiling), not a statue: a square stepped plinth base, one thick shaft, and a broad square capital with a completely FLAT TOP. Proportions 30 inches across and 120 inches tall: a tall column about four times as tall as it is wide. Three thick OCTOPUS ARMS with large round suckers spiral up around the shaft from the base and curl over the edge of the capital. The motif belongs to the column itself and reads from every side and from above. Palette: violet and pale mauve. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from ABOVE, camera elevation 35 degrees, so the flat top of the capital and the whole shaft down to the base are visible; the whole column fits in the frame. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-pillar--nature-fct
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One free-standing architectural PILLAR (a column that holds up a ceiling), not a statue: a square stepped plinth base, one thick shaft, and a broad square capital with a completely FLAT TOP. Proportions 30 inches across and 120 inches tall: a tall column about four times as tall as it is wide. The shaft is a living OAK TRUNK with bark, a calm green-man face carved near the top, and the capital a thick crown of broad oak leaves. The motif belongs to the column itself and reads from every side and from above. Palette: moss green and warm oak brown. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from ABOVE, camera elevation 35 degrees, so the flat top of the capital and the whole shaft down to the base are visible; the whole column fits in the frame. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-pillar--sword-shield-fct
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One free-standing architectural PILLAR (a column that holds up a ceiling), not a statue: a square stepped plinth base, one thick shaft, and a broad square capital with a completely FLAT TOP. Proportions 30 inches across and 120 inches tall: a tall column about four times as tall as it is wide. A large HEATER SHIELD is carved on the front and back of the shaft, each over a broad vertical SWORD whose pommel meets the capital; the capital is crenellated like a castle tower. The motif belongs to the column itself and reads from every side and from above. Palette: silver and royal blue. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from ABOVE, camera elevation 35 degrees, so the flat top of the capital and the whole shaft down to the base are visible; the whole column fits in the frame. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-pillar--death-fct
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One free-standing architectural PILLAR (a column that holds up a ceiling), not a statue: a square stepped plinth base, one thick shaft, and a broad square capital with a completely FLAT TOP. Proportions 30 inches across and 120 inches tall: a tall column about four times as tall as it is wide. A peaceful RAVEN with folded wings perches on top of the capital; the shaft carries a large HOURGLASS in relief and a thick carved shroud draped from the capital. The motif belongs to the column itself and reads from every side and from above. Palette: warm ivory and ink black. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from ABOVE, camera elevation 35 degrees, so the flat top of the capital and the whole shaft down to the base are visible; the whole column fits in the frame. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-pillar--scales-coin-fct
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One free-standing architectural PILLAR (a column that holds up a ceiling), not a statue: a square stepped plinth base, one thick shaft, and a broad square capital with a completely FLAT TOP. Proportions 30 inches across and 120 inches tall: a tall column about four times as tall as it is wide. The shaft is carved as a tall stack of broad thick COINS; on top of the capital stands a solid pair of balanced SCALES with broad deep pans on thick arms, no chains. The motif belongs to the column itself and reads from every side and from above. Palette: antique gold and deep emerald. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from ABOVE, camera elevation 35 degrees, so the flat top of the capital and the whole shaft down to the base are visible; the whole column fits in the frame. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-pillar--forge-hammer-fct
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One free-standing architectural PILLAR (a column that holds up a ceiling), not a statue: a square stepped plinth base, one thick shaft, and a broad square capital with a completely FLAT TOP. Proportions 30 inches across and 120 inches tall: a tall column about four times as tall as it is wide. The shaft is banded with thick riveted iron hoops, the capital is shaped like a broad ANVIL, and a large square-headed smith HAMMER is carved in relief down the front of the shaft. The motif belongs to the column itself and reads from every side and from above. Palette: iron grey and ember orange. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from ABOVE, camera elevation 35 degrees, so the flat top of the capital and the whole shaft down to the base are visible; the whole column fits in the frame. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-pillar--sea-storm-fct
Size: 1024x1536 (portrait)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One free-standing architectural PILLAR (a column that holds up a ceiling), not a statue: a square stepped plinth base, one thick shaft, and a broad square capital with a completely FLAT TOP. Proportions 30 inches across and 120 inches tall: a tall column about four times as tall as it is wide. The shaft is carved as rising curling OCEAN WAVES wrapping around it, a stout three-pronged TRIDENT is carved in relief up the front with its prongs on the capital, and the capital is a curling wave crest. The motif belongs to the column itself and reads from every side and from above. Palette: turquoise and pearl white. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from ABOVE, camera elevation 35 degrees, so the flat top of the capital and the whole shaft down to the base are visible; the whole column fits in the frame. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-buttress--skulls-fct
Size: 1536x1024 (landscape)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One architectural FLYING BUTTRESS section meant to stand against a wall, seen from the side so the whole quarter arch shows: on the right a massive upright stone pier about 3 ft wide, 1.5 ft deep and 9 ft tall on a moulded foot; from the top of the pier ONE thick half arch springs out to the left and sweeps down in a quarter circle to a stout low footing block about 8 ft away, leaving a clear open space under the arch that you can see through. Carving: the arch rib is carved as a row of thick VERTEBRAE like a giant spine; the pier front carries one large human SKULL in high relief with large dark eye sockets. Everything is very thick and blocky (the arch rib at least 1 ft thick). Palette: ivory bone and charcoal. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from slightly above, camera elevation 30 degrees. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-buttress--tentacles-fct
Size: 1536x1024 (landscape)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One architectural FLYING BUTTRESS section meant to stand against a wall, seen from the side so the whole quarter arch shows: on the right a massive upright stone pier about 3 ft wide, 1.5 ft deep and 9 ft tall on a moulded foot; from the top of the pier ONE thick half arch springs out to the left and sweeps down in a quarter circle to a stout low footing block about 8 ft away, leaving a clear open space under the arch that you can see through. Carving: the arch rib is one great thick OCTOPUS ARM with large round suckers along its underside, its tip curling onto the footing block; two more curling arms climb the pier front. Everything is very thick and blocky (the arch rib at least 1 ft thick). Palette: violet and pale mauve. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from slightly above, camera elevation 30 degrees. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-buttress--nature-fct
Size: 1536x1024 (landscape)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One architectural FLYING BUTTRESS section meant to stand against a wall, seen from the side so the whole quarter arch shows: on the right a massive upright stone pier about 3 ft wide, 1.5 ft deep and 9 ft tall on a moulded foot; from the top of the pier ONE thick half arch springs out to the left and sweeps down in a quarter circle to a stout low footing block about 8 ft away, leaving a clear open space under the arch that you can see through. Carving: the arch rib is a thick gnarled OAK BRANCH with broad leaves along it; the pier front carries a calm GREEN-MAN face framed by oak leaves. Everything is very thick and blocky (the arch rib at least 1 ft thick). Palette: moss green and warm oak brown. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from slightly above, camera elevation 30 degrees. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-buttress--sword-shield-fct
Size: 1536x1024 (landscape)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One architectural FLYING BUTTRESS section meant to stand against a wall, seen from the side so the whole quarter arch shows: on the right a massive upright stone pier about 3 ft wide, 1.5 ft deep and 9 ft tall on a moulded foot; from the top of the pier ONE thick half arch springs out to the left and sweeps down in a quarter circle to a stout low footing block about 8 ft away, leaving a clear open space under the arch that you can see through. Carving: the arch rib is plain and heavy, edged with a band of small heater shields; the pier front carries a large HEATER SHIELD over a broad vertical SWORD in high relief. Everything is very thick and blocky (the arch rib at least 1 ft thick). Palette: silver and royal blue. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from slightly above, camera elevation 30 degrees. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-buttress--death-fct
Size: 1536x1024 (landscape)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One architectural FLYING BUTTRESS section meant to stand against a wall, seen from the side so the whole quarter arch shows: on the right a massive upright stone pier about 3 ft wide, 1.5 ft deep and 9 ft tall on a moulded foot; from the top of the pier ONE thick half arch springs out to the left and sweeps down in a quarter circle to a stout low footing block about 8 ft away, leaving a clear open space under the arch that you can see through. Carving: the arch rib is carved as one long folded RAVEN WING of thick feathers; the pier front carries a large HOURGLASS in relief, and a raven with folded wings perches on the pier top. Everything is very thick and blocky (the arch rib at least 1 ft thick). Palette: warm ivory and ink black. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from slightly above, camera elevation 30 degrees. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-buttress--scales-coin-fct
Size: 1536x1024 (landscape)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One architectural FLYING BUTTRESS section meant to stand against a wall, seen from the side so the whole quarter arch shows: on the right a massive upright stone pier about 3 ft wide, 1.5 ft deep and 9 ft tall on a moulded foot; from the top of the pier ONE thick half arch springs out to the left and sweeps down in a quarter circle to a stout low footing block about 8 ft away, leaving a clear open space under the arch that you can see through. Carving: the arch rib is carved as a long row of broad COINS standing on edge; the pier front carries balanced SCALES above three broad coins in high relief, solid pans, no chains. Everything is very thick and blocky (the arch rib at least 1 ft thick). Palette: antique gold and deep emerald. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from slightly above, camera elevation 30 degrees. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-buttress--forge-hammer-fct
Size: 1536x1024 (landscape)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One architectural FLYING BUTTRESS section meant to stand against a wall, seen from the side so the whole quarter arch shows: on the right a massive upright stone pier about 3 ft wide, 1.5 ft deep and 9 ft tall on a moulded foot; from the top of the pier ONE thick half arch springs out to the left and sweeps down in a quarter circle to a stout low footing block about 8 ft away, leaving a clear open space under the arch that you can see through. Carving: the arch rib is carved as the long thick handle of a giant smith HAMMER whose square head rests on the footing block; the pier front carries an ANVIL in high relief. Everything is very thick and blocky (the arch rib at least 1 ft thick). Palette: iron grey and ember orange. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from slightly above, camera elevation 30 degrees. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.

### flavor-buttress--sea-storm-fct
Size: 1536x1024 (landscape)

Prompt:

Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One architectural FLYING BUTTRESS section meant to stand against a wall, seen from the side so the whole quarter arch shows: on the right a massive upright stone pier about 3 ft wide, 1.5 ft deep and 9 ft tall on a moulded foot; from the top of the pier ONE thick half arch springs out to the left and sweeps down in a quarter circle to a stout low footing block about 8 ft away, leaving a clear open space under the arch that you can see through. Carving: the arch rib is carved as a great curling OCEAN WAVE breaking downward onto the footing block; the pier front carries a stout three-pronged TRIDENT in high relief. Everything is very thick and blocky (the arch rib at least 1 ft thick). Palette: turquoise and pearl white. Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design. Three-quarter view from slightly above, camera elevation 30 degrees. Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.
