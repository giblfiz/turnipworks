#!/usr/bin/env python3
"""Write assets.json for the sprawl (modern city) batch, wave 1: the shell kit, four lights and the props of eight rooms.
Text-only prompts in the house template (D, heroic hand-painted) applied to contemporary objects. Siblings (`parent`) are
painted as EDITS of their parent's accepted plate (the brief passes it as the reference image).
Trademark rule: no words, numbers, logos, brand names or recognisable real product designs on anything.
    python3 tools/make_specs.py            -> assets.json"""
import json
from pathlib import Path
B = Path(__file__).resolve().parent.parent

INTRO = ('Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art, for a CONTEMPORARY CITY setting '
         '(present day): the same chunky storybook miniature style the game uses for its fantasy props, applied to a modern object.')
HOUSE = ('Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR, '
         'no photorealism. Glass is painted OPAQUE (soft blue-grey with a pale highlight), never see-through. '
         'Exactly one complete object centered with generous clear margin, no scene or additional objects, no people or creatures. '
         'NO text, NO letters, NO numbers, NO logos, NO brand names, NO stickers and no recognisable real product design anywhere.')
PAL = ('Palette: muted, softened contemporary colours (warm and cool greys, off-white, brushed steel, faded teal, mustard, brick red, navy) '
       'where they suit the object; avoid an all-grey result.')
VIEW = {'top': 'Three-quarter front view from ABOVE (camera elevation 35 degrees), so the front and the top are both visible; the whole object fits in the frame.',
        'wall': 'Seen from its broad room-facing side at a slight three-quarter angle from slightly above (camera elevation 15 degrees); the whole piece fits in the frame.',
        'side': 'Three-quarter view from ABOVE (camera elevation 35 degrees) showing the long side and the top; the whole object fits in the frame.'}
TAIL = 'Genuinely transparent background, no floor, no ground and no cast shadow. Thick reconstructible parts; no wires, cables, thin rods, thin poles or isolated floating components.'

PANEL = ('ONE single straight wall section standing upright, about 5 ft wide x 9 ft tall x 1 ft thick. It is a TALL, NARROW upright slab, almost '
         'TWICE as tall as it is wide (portrait format, like a wide door standing on end). It must NOT be square and must NOT be wider than it is tall. '
         'Nothing else: NO floor, NO ground, NO base slab under it, NO ceiling, NO corner return, NO furniture, NO lamp. Both side edges are clean, '
         'flat, vertical cuts and the top is one level line, so this piece butts against copies of itself to make a longer wall.')
SIB = ('The reference image is the existing plain wall section of this same building. The new piece must look cut from the same wall: the SAME '
       'materials, colours, courses or panels, the same trim at the bottom and top, the same overall size and proportions (a tall narrow upright '
       'panel about 5 ft wide x 9 ft tall, almost twice as tall as wide), the same painting style and camera angle. Change ONLY this: ')

A = []
def add(id, obj, desc, size, place, *, design, view='top', aspect='square', family='', shape='', parent=None, gate=None, room='', kit=None, opening=None, flags=''):
    if place == 'kit' and kit != 'leaf':
        body = (f'{INTRO} {(SIB + design) if parent else design} {PANEL} Real-world size about {size[0]} in wide x {size[1]} in deep x {size[2]} in tall: '
                f'keep these proportions. {HOUSE} {VIEW["wall"]} {TAIL}')
    else:
        body = (f'{INTRO} ONE {desc}. {design} Real-world size about {size[0]} in wide x {size[1]} in deep x {size[2]} in tall: keep these proportions. '
                f'{PAL} {HOUSE} {VIEW[view]} {TAIL}')
    rec = dict(id=id, object=obj, shape=shape, family=family, lane='3d', route='trellis', size=size, place=place, aspect=aspect, room=room,
               prompt=body, gate=dict(desc=gate or desc), flags=flags)
    if parent: rec['parent'] = parent
    if place == 'kit' and kit != 'leaf': rec.update(kit='wall', opening=opening or 'solid')
    if kit == 'leaf': rec.update(kit='leaf')
    A.append(rec)

W = [60, 12, 108]
# ---------------- corner pieces (look.js cornerSpec: post-timber, or pillar-square for a family that falls back to stone) ----------------
add('post-timber--drywall', 'post-timber', 'interior corner column', [14, 14, 108], 'kit', family='drywall', kit='leaf', aspect='portrait',
    design='A plain square INTERIOR CORNER COLUMN of a modern room on its own: a tall square column of smooth painted plaster in warm pale sage-grey, a chunky white skirting band round its foot and a thin white cornice band round its top. Otherwise completely plain. It is about 8 times as tall as it is wide.',
    view='wall', gate='a plain square plaster column (a room corner post)')
add('pillar-square--city-brick', 'pillar-square', 'red brick corner pier', [18, 18, 108], 'kit', family='city-brick', kit='leaf', aspect='portrait',
    design='A square RED BRICK PIER on its own, the corner of a modern city building: warm red-brown city brick in neat bond with PALE grey mortar lines, a plain grey concrete cap on top and a darker damp band of brick near the bottom. About 6 times as tall as it is wide.',
    view='wall', gate='a square red brick pier')
add('pillar-square--concrete', 'pillar-square', 'cast concrete corner pier', [18, 18, 108], 'kit', family='concrete', kit='leaf', aspect='portrait',
    design='A square CAST CONCRETE PIER on its own, the corner of a parking garage or warehouse wall: warm light-grey bare concrete with chamfered edges, a few small round form-tie dots, a broad faded mustard-yellow painted band round its bottom 3 ft. About 6 times as tall as it is wide.',
    view='wall', gate='a square bare concrete pier with a yellow band at its foot')
# ---------------- shell kit ----------------
add('wall-straight--drywall', 'wall-straight', 'interior wall section', W, 'kit', family='drywall', aspect='portrait',
    design='An INTERIOR wall of a modern apartment or office: smooth painted plaster in a warm pale sage-grey, a chunky white skirting board along the bottom, a plain white cornice strip along the top, faint soft scuffs. Otherwise completely plain.',
    gate='a plain modern interior wall section (painted plaster with a skirting board)')
add('wall-straight--drywall--s2', 'wall-straight', 'interior wall section', W, 'kit', family='drywall', shape='s2', aspect='portrait', parent='wall-straight--drywall',
    design='a single chunky white wall socket box low down near the skirting board and a small white light-switch plate at shoulder height; everything else identical.',
    gate='a plain modern interior wall section with a switch and a socket')
add('wall-doorway--drywall', 'wall-doorway', 'interior wall section with a door opening', W, 'kit', family='drywall', aspect='portrait', parent='wall-straight--drywall', opening='door',
    design='an EMPTY door-sized opening through the wall, starting at the very bottom: about 3.5 ft wide and 7 ft tall, centred, framed by a chunky flat white painted door frame (architrave). NO door leaf, NO threshold step; you can see straight through the opening. About 9 in of wall remains each side and a band of wall runs above the frame.',
    gate='a modern interior wall section with an empty doorway')
add('wall-window-small--drywall', 'wall-window-small', 'interior wall section with a window', W, 'kit', family='drywall', aspect='portrait', parent='wall-straight--drywall', opening='window',
    design='a modern window in the middle of the wall, its sill at about 3 ft and its head at about 7 ft: a chunky white aluminium frame with one upright mullion and two panes of OPAQUE painted soft blue-grey glass with a pale diagonal highlight, a broad white sill.',
    gate='a modern interior wall section with a window')
add('wall-straight--city-brick', 'wall-straight', 'red brick wall section', W, 'kit', family='city-brick', aspect='portrait',
    design='An outside wall of a modern city building: warm red-brown city brick in neat stretcher bond, PALE grey mortar lines so the brick pattern reads clearly, a few bricks a little darker or paler, a plain grey concrete coping band along the very top and a darker damp band of brick near the bottom. Otherwise completely plain.',
    gate='a plain red brick wall section of a modern building')
add('wall-straight--city-brick--s2', 'wall-straight', 'red brick wall section', W, 'kit', family='city-brick', shape='s2', aspect='portrait', parent='wall-straight--city-brick',
    design='a chunky grey drainpipe (a thick round downpipe, 6 in across, with two brackets) running straight down near one side edge, and a few soft soot streaks under the coping; everything else identical.',
    gate='a red brick wall section with a drainpipe')
add('wall-doorway--city-brick', 'wall-doorway', 'red brick wall section with a door opening', W, 'kit', family='city-brick', aspect='portrait', parent='wall-straight--city-brick', opening='door',
    design='an EMPTY door-sized opening through the wall, starting at the very bottom: about 3.5 ft wide and 7 ft tall, centred, with a flat grey concrete lintel over it and a plain dark steel door frame. NO door leaf, NO step; you can see straight through the opening.',
    gate='a red brick wall section with an empty doorway')
add('wall-window-small--city-brick', 'wall-window-small', 'red brick wall section with a window', W, 'kit', family='city-brick', aspect='portrait', parent='wall-straight--city-brick', opening='window',
    design='a tall modern window in the middle of the wall, sill at about 3 ft, head at about 7.5 ft: a dark green-grey steel frame divided into four panes of OPAQUE painted soft blue-grey glass with a pale highlight, a grey concrete sill and a concrete lintel.',
    gate='a red brick wall section with a window')
add('wall-straight--concrete', 'wall-straight', 'concrete wall section', W, 'kit', family='concrete', aspect='portrait',
    design='A wall of bare cast CONCRETE, as in a parking garage or a warehouse: warm light-grey concrete in big smooth panels with a few faint horizontal board lines, a regular grid of small round form-tie dots, a broad painted band of faded mustard-yellow along the bottom 3 ft, soft damp stains. Otherwise completely plain.',
    gate='a plain bare concrete wall section with a painted band along the bottom')
add('wall-straight--concrete--s2', 'wall-straight', 'concrete wall section', W, 'kit', family='concrete', shape='s2', aspect='portrait', parent='wall-straight--concrete',
    design='a thick grey steel pipe running horizontally across the wall at about 7 ft on two chunky brackets, and a small red-painted rectangular box (an alarm bell box, no words) below it; everything else identical.',
    gate='a bare concrete wall section with a pipe across it')
add('wall-doorway--concrete', 'wall-doorway', 'concrete wall section with a door opening', W, 'kit', family='concrete', aspect='portrait', parent='wall-straight--concrete', opening='door',
    design='an EMPTY door-sized opening through the wall, starting at the very bottom: about 3.5 ft wide and 7 ft tall, centred, with a plain dark grey steel frame. NO door leaf; you can see straight through the opening.',
    gate='a bare concrete wall section with an empty doorway')
add('wall-window-small--concrete', 'wall-window-small', 'concrete wall section with a high window', W, 'kit', family='concrete', aspect='portrait', parent='wall-straight--concrete', opening='window',
    design='a long low window HIGH up in the wall (its sill at about 6 ft, its head at about 8 ft): a dark steel frame with OPAQUE painted pale grey-green wired glass (a faint square grid painted on it).',
    gate='a bare concrete wall section with a high strip window')
add('door-roller-shutter--leaf', 'door-roller-shutter', 'concrete wall section with a closed roller shutter', W, 'kit', shape='leaf', aspect='portrait', parent='wall-straight--concrete', opening='panel',
    design='almost the whole width of the wall below 8 ft is filled by a CLOSED corrugated steel ROLLER SHUTTER: grey-blue painted steel with strong horizontal ribs every few inches, a chunky shutter box across its top, a steel bottom rail with a handle. Thin strips of concrete wall remain either side and above the box.',
    gate='a concrete wall section with a closed roller shutter (garage door)')
add('wall-storefront--drywall', 'wall-storefront', 'shop-front glass wall section', W, 'kit', family='drywall', aspect='portrait',
    design='A modern SHOP FRONT section: a low riser of dark grey tiles 2 ft tall along the bottom, above it ONE tall pane of OPAQUE painted glass (soft pale blue-grey with broad diagonal white highlight streaks) in a chunky dark charcoal aluminium frame, and a plain dark fascia band across the top 1 ft. No words, no posters, no stickers.',
    gate='a modern shop-front glass wall section')
add('door-shopfront--leaf', 'door-shopfront', 'shop-front section with a glass door', W, 'kit', shape='leaf', aspect='portrait', parent='wall-storefront--drywall', opening='door',
    design='instead of the low tiled riser and the big pane, a GLASS SHOP DOOR about 3.5 ft wide and 7 ft tall, centred, starting at the very bottom: a chunky charcoal aluminium door frame with one tall pane of the same opaque painted glass and a thick vertical steel pull handle; the fascia band above. The door is closed.',
    gate='a modern shop front with a glass door')
add('door-flush--leaf', 'door-flush', 'modern interior door leaf', [36, 3, 80], 'kit', kit='leaf', aspect='portrait',
    design='A plain modern interior DOOR LEAF on its own (no frame, no wall): a flat slab door painted soft off-white with a faint grey edge, a chunky brushed-steel lever handle and a round steel rose at about 3 ft on one side, three chunky hinges on the other edge. Shown standing upright, closed, front face toward the viewer.',
    view='wall', gate='a plain modern door (flat painted slab door with a lever handle)')
add('door-steel--leaf', 'door-steel', 'grey steel fire door leaf', [36, 4, 80], 'kit', kit='leaf', aspect='portrait',
    design='A heavy STEEL DOOR LEAF on its own (no frame, no wall): a flat steel slab door painted mid grey-green, a chunky horizontal push bar across it at waist height, a small square window of OPAQUE painted wired glass at head height, a closer arm block at the top. Shown standing upright, closed, front face toward the viewer.',
    view='wall', gate='a grey steel fire-exit door with a push bar')
# ---------------- lights ----------------
add('light-fluorescent', 'light-fluorescent', 'ceiling fluorescent light fitting', [48, 14, 6], 'ceiling', aspect='landscape',
    design='A long rectangular office light fitting: a white steel box with two fat glowing white-and-pale-cyan TUBES under a ribbed white diffuser frame, as it hangs flush on a ceiling, seen from below and to the side so the glowing tubes show.',
    view='side', gate='a fluorescent tube ceiling light fitting', flags='lit')
add('sign-neon', 'sign-neon', 'wall-mounted neon sign', [36, 4, 28], 'wall', aspect='landscape',
    design='A NEON SIGN for a bar wall: the outline of a cocktail glass with an olive, drawn in FAT glowing hot-pink tube (as thick as a thumb, bulging), the olive a glowing cyan tube, mounted on a chunky black backboard plate with a narrow dark edge. The tubes glow softly. No words, no letters.',
    view='wall', gate='a neon sign shaped like a cocktail glass', flags='lit')
add('streetlight', 'streetlight', 'city streetlight', [30, 72, 200], 'ground', aspect='portrait',
    design='A modern city STREETLIGHT: a stout tapered dark green-grey steel pole (as thick as a small tree trunk, 9 in across at the base) on a chunky square concrete footing, rising 16 ft and curving over at the top into one long arm ending in a broad flat cobra-head lamp housing with a glowing warm amber-orange lens underneath. The pole is STOUT and solid, never thin.',
    view='top', gate='a city streetlight on a stout pole', flags='lit')
add('lamp-floor--mod', 'lamp-floor', 'modern floor lamp', [18, 18, 62], 'floor', shape='mod', aspect='portrait',
    design='A modern living-room FLOOR LAMP: a heavy round brass-grey base, one stout straight stem (2 in thick) and a big drum lampshade of warm cream fabric glowing softly from inside.',
    gate='a modern floor lamp with a drum shade', flags='lit')
# ---------------- apartment ----------------
add('sofa--mod', 'sofa', 'modern three-seat sofa', [84, 36, 32], 'floor', shape='mod', aspect='landscape', room='apartment',
    design='A modern living-room SOFA: a low boxy three-seat couch upholstered in soft teal-grey fabric, three plump seat cushions and three back cushions, broad square arms, short dark wooden block feet, one mustard throw cushion.',
    view='side', gate='a modern three-seat sofa')
add('armchair--mod', 'armchair', 'modern armchair', [34, 34, 32], 'floor', shape='mod', room='apartment',
    design='A modern boxy ARMCHAIR to match a living-room sofa: soft mustard-ochre fabric, one plump seat cushion and back cushion, broad square arms, short dark wooden block feet.',
    gate='a modern upholstered armchair')
add('coffee-table', 'coffee-table', 'low modern coffee table', [48, 26, 16], 'floor', aspect='landscape', room='apartment',
    design='A low rectangular COFFEE TABLE: a thick warm-oak top with rounded corners, four stout square legs, a lower shelf with a few chunky magazines (blank covers, no words) and a mug on top.',
    view='side', gate='a low modern coffee table')
add('tv-stand', 'tv-stand', 'flat-screen TV on a low cabinet', [60, 18, 50], 'wall', aspect='landscape', room='apartment',
    design='A low modern media CABINET (dark walnut, two drawers and an open shelf with a game console box) carrying a big FLAT-SCREEN TELEVISION on a chunky stand: the screen a thick black-framed slab (3 in deep, chunky for the miniature style) whose screen face glows soft blue-grey with a pale highlight, no picture, no logo.',
    view='top', gate='a flat-screen television on a low media cabinet', flags='lit')
add('bed-double--mod', 'bed-double', 'modern double bed', [62, 82, 36], 'floor', shape='mod', aspect='landscape', room='apartment',
    design='A modern DOUBLE BED: a low upholstered grey-blue fabric bed frame with a tall padded headboard, a thick white mattress, a rumpled soft teal duvet folded back, two plump white pillows.',
    view='side', gate='a modern double bed')
add('kitchenette', 'kitchenette', 'apartment kitchenette run', [96, 26, 38], 'wall', aspect='landscape', room='apartment',
    design='A modern KITCHENETTE as one solid counter run against a wall: pale grey cabinet doors with chunky steel bar handles below, a thick light wood-look worktop, a steel SINK with a stout tap in one part, a black four-ring hob in another part, a kettle and a chopping board on top. No wall cupboards above.',
    view='side', gate='a modern kitchen counter run with a sink and a hob')
add('fridge', 'fridge', 'modern refrigerator', [30, 30, 70], 'floor', aspect='portrait', room='apartment',
    design='A tall modern REFRIGERATOR: a rounded-corner off-white steel box with two doors (a small freezer door on top), two chunky vertical steel bar handles, small grey feet; plain, no magnets, no notes.',
    gate='a modern refrigerator')
add('table-dining--mod', 'table-dining', 'modern small dining table', [48, 32, 30], 'floor', shape='mod', aspect='landscape', room='apartment',
    design='A small modern DINING TABLE: a thick pale-oak rectangular top with rounded edges on four stout tapered legs; a bowl of oranges on it.',
    view='side', gate='a modern small dining table')
add('chair-plain--mod', 'chair-plain', 'modern dining chair', [18, 20, 34], 'floor', shape='mod', aspect='portrait', room='apartment',
    design='A modern DINING CHAIR: a moulded seat-and-back shell in soft brick-red, on four stout pale-oak legs.',
    gate='a modern dining chair')
add('houseplant', 'houseplant', 'potted house plant', [24, 24, 40], 'floor', aspect='portrait', room='apartment',
    design='A potted HOUSE PLANT for a modern home or office: a big rubber-plant / monstera with a few broad glossy-green leaf clumps (chunky solid leaf masses, not thin) in a plain round white ceramic pot.',
    gate='a potted house plant in a white pot')
# ---------------- office ----------------
add('cubicle-desk', 'cubicle-desk', 'office cubicle workstation', [60, 60, 54], 'floor', room='office',
    design='An office CUBICLE workstation as one solid unit: an L-shaped light-grey desk with a computer MONITOR (a chunky dark slab whose screen glows pale blue), a keyboard and a stack of folders on it, enclosed on two sides by thick padded fabric partition panels (blue-grey fabric, 4 in thick, chest high) with rounded aluminium caps.',
    gate='an office cubicle desk with partitions and a computer monitor')
add('office-chair', 'office-chair', 'office swivel chair', [26, 26, 40], 'floor', aspect='portrait', room='office',
    design='An office SWIVEL CHAIR: a padded charcoal seat and tall mesh-look back, stout padded armrests, one thick central column on a FIVE-spoke base with chunky castors (the spokes thick).',
    gate='an office swivel chair')
add('filing-cabinet', 'filing-cabinet', 'four-drawer filing cabinet', [18, 28, 52], 'floor', aspect='portrait', room='office',
    design='A steel FILING CABINET: four drawers, putty-grey painted steel, each drawer with a chunky recessed handle and a blank label holder (no writing).',
    gate='a four-drawer steel filing cabinet')
add('water-cooler', 'water-cooler', 'office water cooler', [14, 14, 48], 'floor', aspect='portrait', room='office',
    design='An office WATER COOLER: a white cabinet with two small taps (one blue, one red), and on top an upside-down big round water bottle of OPAQUE painted pale blue, chunky.',
    gate='an office water cooler with a big blue bottle on top')
add('photocopier', 'photocopier', 'office photocopier', [40, 28, 42], 'floor', aspect='landscape', room='office',
    design='A big office PHOTOCOPIER: a chunky off-white and grey box on a cabinet base with paper drawers, a dark lid on top, an output tray at one side with a stack of white paper, a small glowing green panel (no words).',
    view='side', gate='an office photocopier')
add('whiteboard', 'whiteboard', 'wall whiteboard', [72, 4, 48], 'wall', aspect='landscape', room='office',
    design='An office WHITEBOARD for a wall: a big white board in a chunky aluminium frame with a pen tray along the bottom holding two fat markers; on the board a few broad loose coloured marker scribbles (boxes and arrows, NO words, NO numbers).',
    view='wall', gate='an office whiteboard with diagrams drawn on it')
# ---------------- bar & nightclub ----------------
add('bar-counter--mod', 'bar-counter', 'modern bar counter with beer taps', [96, 30, 42], 'floor', shape='mod', aspect='landscape', room='bar',
    design='A modern BAR COUNTER section: a long dark-wood counter with a thick polished-look top edged in brushed steel, a padded oxblood-red leather front panel with steel studs, and a row of four chunky chrome BEER TAPS standing on the top with a drip tray, a few glasses.',
    view='side', gate='a modern bar counter with beer taps')
add('back-bar-shelves--mod', 'back-bar-shelves', 'back-bar shelving with bottles', [96, 18, 84], 'wall', shape='mod', aspect='landscape', room='bar',
    design='The BACK BAR of a modern bar: a low dark cabinet with a steel top, above it three glass shelves (painted opaque) lined with chunky colourful liquor BOTTLES (amber, green, clear-blue, red; no labels), a softly glowing warm backlight behind the shelves.',
    view='wall', gate='a back-bar shelf unit full of liquor bottles', flags='lit')
add('stool-bar--mod', 'stool-bar', 'modern bar stool', [16, 16, 30], 'floor', shape='mod', aspect='portrait', room='bar',
    design='A modern BAR STOOL: a round padded oxblood-red seat on one stout chrome column, a thick chrome foot ring and a heavy round chrome base.',
    gate='a modern chrome bar stool with a red seat')
add('booth-seat', 'booth-seat', 'diner-style booth with a table', [72, 60, 42], 'floor', aspect='landscape', room='bar',
    design='A BOOTH: two high-backed bench seats in red vinyl with piped edges facing each other across a small square table with a thick top on one stout pedestal, as one solid unit; a pair of glasses and a napkin holder on the table.',
    view='side', gate='a diner or bar booth: two red benches facing across a table')
add('table-cafe', 'table-cafe', 'small round bar table', [24, 24, 30], 'floor', aspect='portrait', room='bar',
    design='A small round BAR TABLE: a thick dark round top on one stout chrome pedestal with a heavy round base; one glass on it.',
    gate='a small round bar table on a pedestal')
add('table-billiards--mod', 'table-billiards', 'modern pool table', [100, 56, 32], 'floor', shape='mod', aspect='landscape', room='bar',
    design='A POOL TABLE: a chunky dark-wood frame on four thick square legs, the bright green felt playing surface edged with thick cushions, six pockets, a triangle of coloured balls racked on it and one cue lying across one end (the cue fat and short).',
    view='side', gate='a pool table with racked balls')
add('jukebox', 'jukebox', 'retro jukebox', [36, 28, 60], 'floor', aspect='portrait', room='bar',
    design='A retro JUKEBOX: a chunky rounded cabinet with an arched top, glowing bands of warm orange and pink light around its arch, a chrome speaker grille below, a dark window in the middle (no words, no numbers).',
    gate='a retro jukebox with glowing coloured bands', flags='lit')
add('dj-booth', 'dj-booth', 'DJ booth', [72, 36, 44], 'floor', aspect='landscape', room='bar',
    design='A nightclub DJ BOOTH: a chunky black desk with a front panel glowing in a broad band of magenta and cyan light, on top two round turntables and a mixer box with fat knobs between them, a pair of chunky headphones.',
    view='side', gate='a nightclub DJ booth with two turntables', flags='lit')
add('speaker-stack', 'speaker-stack', 'stack of loudspeakers', [30, 24, 60], 'floor', aspect='portrait', room='bar',
    design='A STACK of two big black LOUDSPEAKER cabinets, one on the other: chunky black boxes with steel corners, big round dark speaker cones and smaller round tweeters, a dark mesh grille edge.',
    gate='a stack of big black loudspeakers')
# ---------------- street ----------------
add('car-sedan', 'car-sedan', 'four-door sedan car', [72, 180, 56], 'floor', aspect='landscape', room='street',
    design='A parked four-door SEDAN CAR of no particular make: a chunky rounded toy-like body (like a sturdy die-cast miniature), painted faded navy blue, thick black tyres with grey hubs, windows of OPAQUE painted dark blue-grey glass with a pale highlight, chunky bumpers, headlights. No badges, no number plate text.',
    view='side', gate='a parked sedan car')
add('car-hatchback', 'car-hatchback', 'small hatchback car', [68, 156, 58], 'floor', aspect='landscape', room='street',
    design='A parked small HATCHBACK CAR of no particular make: a chunky rounded toy-like body (like a sturdy die-cast miniature), painted faded brick red, a short rounded rear, thick black tyres, windows of OPAQUE painted dark blue-grey glass, chunky bumpers. No badges, no number plate text.',
    view='side', gate='a parked small hatchback car')
add('fire-hydrant', 'fire-hydrant', 'fire hydrant', [16, 16, 30], 'ground', aspect='portrait', room='street',
    design='A street FIRE HYDRANT: a stout cast-iron hydrant painted bright red with a domed cap, two chunky side nozzles with caps and a pentagon nut on top.',
    gate='a red fire hydrant')
add('trash-can-city', 'trash-can-city', 'city litter bin', [24, 24, 38], 'ground', aspect='portrait', room='street',
    design='A city STREET LITTER BIN: a stout round dark green steel bin with a domed lid and a wide slot opening, a little litter visible at the slot.',
    gate='a city street litter bin')
add('newspaper-box', 'newspaper-box', 'street newspaper vending box', [20, 18, 44], 'ground', aspect='portrait', room='street',
    design='A street NEWSPAPER BOX: a chunky blue-painted steel box on four short legs with a sloping top and a front window of opaque painted glass showing a folded blank grey paper (no words, no headline).',
    gate='a street newspaper vending box')
add('traffic-cone', 'traffic-cone', 'traffic cone', [14, 14, 28], 'ground', aspect='portrait', room='street',
    design='A TRAFFIC CONE: a stout bright orange cone with two broad white reflective bands, on a square black base.',
    gate='an orange traffic cone')
add('bench-street--mod', 'bench-street', 'modern city bench', [72, 26, 32], 'ground', shape='mod', aspect='landscape', room='street',
    design='A modern city BENCH: thick wooden slats (warm teak) for the seat and back on two chunky black cast-iron end frames with armrests.',
    view='side', gate='a modern city park bench')
# ---------------- alley ----------------
add('dumpster', 'dumpster', 'commercial dumpster', [72, 40, 50], 'floor', aspect='landscape', room='alley',
    design='A commercial DUMPSTER: a big boxy steel waste skip painted dull dark green with dents and rust patches, two thick black plastic lids on top (one propped half open with a black trash bag poking out), chunky side pockets for lifting, small castors. No words.',
    view='side', gate='a green dumpster')
add('trash-bags', 'trash-bags', 'pile of trash bags', [48, 36, 26], 'floor', aspect='landscape', room='alley',
    design='A PILE of five plump black plastic TRASH BAGS heaped together with tied tops, one grey bag among them, a crushed cardboard box leaning on them.',
    view='side', gate='a pile of black trash bags')
add('cardboard-boxes', 'cardboard-boxes', 'stack of cardboard boxes', [40, 32, 34], 'floor', room='alley',
    design='A small STACK of three brown CARDBOARD BOXES of different sizes, taped shut with tan tape, one corner crushed; plain, no printing, no words.',
    gate='a stack of cardboard boxes')
add('pallet-stack', 'pallet-stack', 'stack of wooden pallets', [48, 40, 30], 'floor', aspect='landscape', room='alley',
    design='A STACK of five rough wooden shipping PALLETS, slightly askew, pale weathered pine with thick slats and blocks.',
    view='side', gate='a stack of wooden shipping pallets')
add('oil-drum', 'oil-drum', 'steel oil drum', [24, 24, 34], 'floor', aspect='portrait', room='alley',
    design='A steel OIL DRUM: a 55-gallon barrel painted faded blue with two raised ribs, a dented rim, rust streaks, a small bung on the lid. No words.',
    gate='a blue steel oil drum')
add('ac-unit', 'ac-unit', 'wall air-conditioning unit', [36, 26, 30], 'wall', room='alley',
    design='An outdoor AIR-CONDITIONING UNIT: a boxy beige-grey steel cabinet with a big round fan grille on its front (a thick spoked grille), louvred sides, a stout drip pipe; as it stands on a wall bracket.',
    gate='an outdoor air-conditioning unit')
# ---------------- garage ----------------
add('pillar-concrete', 'pillar-concrete', 'square concrete support column', [24, 24, 108], 'floor', aspect='portrait', room='garage',
    design='A square CONCRETE COLUMN from a parking garage: bare light-grey cast concrete with chamfered corners, a broad band of diagonal yellow-and-black hazard stripes painted around its bottom 3 ft and a flat top.',
    gate='a square concrete column with hazard stripes at its base')
add('jersey-barrier', 'jersey-barrier', 'concrete traffic barrier', [72, 24, 32], 'floor', aspect='landscape', room='garage',
    design='A concrete JERSEY BARRIER: a long low grey concrete traffic barrier with the classic sloped profile, chipped edges, a band of faded red-and-white stripes along its side.',
    view='side', gate='a concrete traffic barrier')
add('parking-barrier', 'parking-barrier', 'car-park entry barrier', [110, 20, 44], 'floor', aspect='landscape', room='garage',
    design='A car-park ENTRY BARRIER: a chunky yellow steel post-box housing at one end with a dark glowing panel (no words), and a FAT boom arm (as thick as a forearm, square section) painted in red-and-white stripes lying level across, its far end resting on a small yellow support post.',
    view='side', gate='a car-park barrier with a striped arm')
# ---------------- convenience store ----------------
add('store-shelving', 'store-shelving', 'stocked shop shelving aisle', [96, 36, 60], 'floor', aspect='landscape', room='store',
    design='A double-sided supermarket shelving unit (a GONDOLA) for a convenience store: white steel shelves on both sides packed with rows of chunky colourful packages, boxes, cans and bottles (bright red, yellow, blue, green; no labels, no words), a rounded end cap.',
    view='side', gate='a convenience-store shelving aisle stocked with colourful goods')
add('drinks-cooler', 'drinks-cooler', 'glass-door drinks fridge', [60, 30, 80], 'wall', aspect='portrait', room='store',
    design='A shop DRINKS COOLER: a tall white two-door refrigerated cabinet whose doors are OPAQUE painted glass panels showing rows of brightly coloured bottles and cans behind them, lit from inside with a cool white glow, a plain blank header panel on top (no words).',
    view='top', gate='a glass-door shop drinks fridge full of bottles', flags='lit')
add('checkout-counter', 'checkout-counter', 'shop checkout counter', [72, 30, 42], 'floor', aspect='landscape', room='store',
    design='A convenience-store CHECKOUT COUNTER: a chunky laminate counter (cream top, teal front panel), a CASH REGISTER box with a small screen on it, a little rack of chunky colourful snacks at the front, a basket of fruit.',
    view='side', gate='a shop checkout counter with a cash register')
add('atm', 'atm', 'cash machine', [26, 30, 64], 'floor', aspect='portrait', room='store',
    design='A free-standing CASH MACHINE (ATM): a chunky grey-blue steel kiosk with a sloped hood over a softly glowing screen and a chunky keypad (blank keys), a card slot, a cash slot. No words, no logo.',
    gate='a free-standing cash machine (ATM)', flags='lit')
add('coffee-station', 'coffee-station', 'self-serve coffee station', [48, 26, 54], 'wall', aspect='landscape', room='store',
    design='A shop SELF-SERVE COFFEE STATION: a low counter with two chunky steel coffee machines, a stack of paper cups, a tray of lids and a glass jug on a hot plate, a red cabinet front.',
    view='side', gate='a self-serve coffee station counter')
# ---------------- warehouse ----------------
add('pallet-racking', 'pallet-racking', 'warehouse pallet racking', [104, 44, 144], 'wall', aspect='landscape', room='warehouse',
    design='A section of WAREHOUSE PALLET RACKING: two tall thick upright frames painted blue with orange beam levels between them (the steel members CHUNKY, 5 in thick), three levels each holding wooden pallets of brown cardboard boxes and plastic-wrapped loads.',
    view='side', gate='tall warehouse pallet racking loaded with boxes')
add('pallet-boxes', 'pallet-boxes', 'pallet of shrink-wrapped boxes', [48, 40, 52], 'floor', room='warehouse',
    design='A wooden shipping PALLET stacked with brown cardboard boxes wrapped tight in translucent-looking (painted opaque) shrink wrap with a pale sheen, a strap around them.',
    gate='a pallet of shrink-wrapped boxes')
add('forklift', 'forklift', 'warehouse forklift', [50, 100, 86], 'floor', aspect='landscape', room='warehouse',
    design='A warehouse FORKLIFT truck: a chunky rounded yellow body with a black counterweight at the back, an open driver seat under a stout overhead guard frame (thick bars), the lifting mast at the front with two FAT forks lowered to the ground, thick black tyres. No words.',
    view='side', gate='a yellow warehouse forklift')
add('shipping-container', 'shipping-container', 'steel shipping container', [96, 240, 102], 'floor', aspect='landscape', room='warehouse',
    design='A 20-ft steel SHIPPING CONTAINER: a long box of corrugated steel painted faded rust-orange, strong vertical ribs along its sides, chunky corner castings, two closed end doors with thick vertical locking bars. No words, no numbers, no logos.',
    view='side', gate='a steel shipping container')

(B / 'assets.json').write_text(json.dumps({'batch': 'sprawl-01', 'assets': A}, indent=1) + '\n')
print(len(A), 'specs ->', B / 'assets.json', '|', sum(1 for a in A if a.get('parent')), 'siblings')
