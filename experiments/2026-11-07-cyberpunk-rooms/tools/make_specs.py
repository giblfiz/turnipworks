#!/usr/bin/env python3
"""Write assets.json for the cyberpunk pack, wave 2 (2026-11-07): the Cyberpunk type's props, its glass and chain-link pieces,
the rooftop, and two shared lights/screens. Wave 1 (the City type) is ../../2026-11-06-sprawl/tools/make_specs.py.
Text-only prompts in the house template (D, heroic hand-painted) applied to contemporary objects. Siblings (`parent`) are
painted as EDITS of their parent's accepted plate (the brief passes it as the reference image).
Trademark rule: no words, numbers, logos, brand names or recognisable real product designs on anything.
    python3 tools/make_specs.py            -> assets.json"""
import json
from pathlib import Path
B = Path(__file__).resolve().parent.parent

INTRO = ('Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art, for a gritty NEAR-FUTURE CITY setting '
         '(cyberpunk: worn concrete, chrome, improvised tech, glowing screens and neon): the same chunky storybook miniature style the game uses '
         'for its fantasy props, applied to a near-future object.')
HOUSE = ('Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR, '
         'no photorealism. Glass is painted OPAQUE (soft blue-grey with a pale highlight), never see-through. '
         'Exactly one complete object centered with generous clear margin, no scene or additional objects, no people or creatures. '
         'NO text, NO letters, NO numbers, NO logos, NO brand names, NO stickers and no recognisable real product design anywhere.')
PAL = ('Palette: muted, softened city colours (warm and cool greys, gunmetal, brushed steel, faded teal, mustard, brick red, navy) with '
       'small glowing accents of cyan, magenta or amber where the object has lights or screens; avoid an all-grey result.')
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
# ---------------- street clinic (the ripperdoc) ----------------
add('surgical-chair', 'surgical-chair', 'reclining surgical chair', [32, 78, 44], 'floor', aspect='landscape', room='clinic',
    design='A back-street SURGICAL CHAIR: a long fully reclined padded chair like a dentist chair, upholstered in cracked teal vinyl with patches of grey tape, '
           'thick padded arm rests with chunky buckled straps, all on one fat chrome hydraulic pedestal with a round heavy foot, a chunky folded instrument arm '
           'at its head ending in a small glowing cyan lens.',
    view='side', gate='a reclined surgical or dentist chair')
add('surgical-light', 'surgical-light', 'wheeled surgical lamp', [30, 30, 84], 'floor', aspect='portrait', room='clinic', flags='lit',
    design='A wheeled SURGICAL LAMP: a heavy round five-wheeled base, a THICK steel column (6 in across), a chunky bent arm and a big round lamp head the size of a '
           'cart wheel holding a ring of glowing white bulbs, a scuffed off-white housing with a chipped edge.',
    gate='a wheeled operating-theatre lamp')
add('med-monitor-rig', 'med-monitor-rig', 'medical monitor cart', [26, 22, 62], 'floor', aspect='portrait', room='clinic', flags='lit',
    design='A rolling MEDICAL MONITOR CART: a chunky grey steel trolley on fat castors carrying two stacked boxy monitors whose screens glow dark green with bright '
           'wavy pulse lines (no numbers), a drawer of chunky equipment below, a thick coiled lead hanging from it.',
    gate='a rolling cart of medical monitors with pulse lines on the screens')
add('tool-tray-cart', 'tool-tray-cart', 'surgical instrument cart', [30, 18, 38], 'floor', aspect='landscape', room='clinic',
    design='A steel SURGICAL INSTRUMENT CART: a two-shelf brushed-steel trolley on fat castors, the top tray laid with chunky oversized tools (a bone saw, forceps, '
           'a small drill, a spare chrome finger joint), a stack of folded blue cloths on the lower shelf.',
    view='side', gate='a steel cart of surgical tools')
add('med-cabinet', 'med-cabinet', 'steel medicine cabinet', [36, 16, 72], 'wall', aspect='portrait', room='clinic',
    design='A tall steel MEDICINE CABINET: a dented off-white steel cupboard with two glass doors (the glass painted OPAQUE pale blue-grey) behind which stand rows of '
           'chunky brown and white bottles and boxes, a drawer section below with a padlock. NO cross, NO medical symbol, no labels.',
    view='wall', gate='a medicine cabinet with glass doors and bottles')
add('cyberware-rack', 'cyberware-rack', 'wall rack of cybernetic limbs', [60, 14, 72], 'wall', aspect='landscape', room='clinic',
    design='A wall RACK OF SPARE CYBERNETIC PARTS: a sturdy steel pegboard frame on which hang two chunky chrome-and-black robotic ARMS and one robotic LEG, a '
           'shelf below with a glowing cyan artificial eye in a glass dish (painted opaque) and coils of thick cable; the limbs stout and toy-like, plainly mechanical.',
    view='wall', gate='a wall rack holding robotic arms and a robotic leg')
# ---------------- corporate lobby (its street wall is glass: walls.js PANELS) ----------------
add('wall-glass-curtain--drywall', 'wall-glass-curtain', 'office tower glass wall section', W, 'kit', family='drywall', aspect='portrait',
    design='A floor-to-ceiling GLASS WALL section of a corporate office tower lobby: ONE tall pane of OPAQUE painted glass (soft blue-grey with pale diagonal '
           'reflection streaks and a faint cyan tint) held in a slim frame of dark gunmetal mullions down both sides, a dark steel sill at the bottom and a dark '
           'steel transom band at the top. No door, no handle.',
    gate='a tall glass curtain-wall panel in a dark metal frame')
add('reception-desk', 'reception-desk', 'corporate reception desk', [120, 36, 44], 'floor', aspect='landscape', room='lobby', flags='lit',
    design='A long CORPORATE RECEPTION DESK: a sweeping slab of glossy-looking (painted matte) dark charcoal with a white stone top, a glowing cyan light strip '
           'running along its front near the floor, two slim flat screens glowing pale blue on the counter, a blank raised panel at one end (no words, no logo).',
    view='side', gate='a long corporate reception desk')
add('turnstile-gate', 'turnstile-gate', 'row of security turnstiles', [96, 30, 40], 'floor', aspect='landscape', room='lobby', flags='lit',
    design='A ROW OF THREE SECURITY TURNSTILES of an office lobby: four waist-high chunky brushed-steel pedestals side by side with thick opaque blue-grey glass '
           'flaps between them, each pedestal topped by a small glowing green reader pad.',
    view='side', gate='a row of office security turnstiles')
add('sculpture-abstract', 'sculpture-abstract', 'abstract lobby sculpture', [48, 48, 96], 'floor', aspect='portrait', room='lobby',
    design='A big ABSTRACT CORPORATE SCULPTURE: a fat polished-chrome ribbon twisted into an open loop, standing on a squat square black stone plinth. '
           'The ribbon is THICK (a foot across), smooth and continuous; no figure, no face, no words.',
    gate='an abstract chrome sculpture on a plinth')
add('planter-modern', 'planter-modern', 'square concrete planter with a small tree', [36, 36, 66], 'floor', aspect='portrait', room='lobby',
    design='A square smooth pale-grey CONCRETE PLANTER box with a small sculpted ornamental tree growing from it: a short thick trunk and a round, clipped, '
           'chunky ball of dark green leaves.',
    gate='a concrete planter with a small clipped tree')
add('lobby-bench', 'lobby-bench', 'long leather lobby bench', [84, 30, 18], 'floor', aspect='landscape', room='lobby',
    design='A long low LOBBY BENCH: a thick black leather cushion buttoned in a grid, on a plain chunky chrome frame with square legs.',
    view='side', gate='a long low padded bench')
# ---------------- server room ----------------
add('server-rack', 'server-rack', 'server rack cabinet', [24, 42, 84], 'floor', aspect='portrait', room='server', flags='lit',
    design='A tall black SERVER RACK CABINET: a heavy upright box with a front door of dark perforated steel (painted as a dense dot pattern), behind it rows '
           'of stacked server units showing many small glowing BLUE and GREEN status lights, a fat bundle of grey cables rising out of its top.',
    gate='a tall server rack with glowing status lights')
add('server-rack--s2', 'server-rack', 'open server rack', [24, 42, 84], 'floor', shape='s2', aspect='portrait', room='server', flags='lit',
    design='An OPEN-FRAME SERVER RACK: a tall black steel frame with no door, packed with stacked grey and black server units, each with rows of small glowing '
           'AMBER and GREEN lights, thick bundles of orange and blue cables looping down one side.',
    gate='an open server rack full of glowing servers and cables')
add('cooling-unit', 'cooling-unit', 'data-centre air conditioner', [72, 36, 78], 'wall', aspect='landscape', room='server', flags='lit',
    design='A big DATA-CENTRE AIR CONDITIONER cabinet: a wide pale-grey steel box with large slatted grilles across its front, a small glowing blue control screen '
           '(no numbers) and chunky square vents on its top.',
    view='side', gate='a large data-centre air-conditioning cabinet')
add('terminal-desk', 'terminal-desk', 'workstation desk with three screens', [72, 30, 48], 'wall', aspect='landscape', room='server', flags='lit',
    design='A HACKER WORKSTATION DESK: a heavy dark steel desk carrying three chunky glowing screens side by side (pale green and cyan glowing blocks of abstract '
           'bars, NO text and no numbers), a fat keyboard, a boxy computer tower with a glowing vent, an empty coffee cup and a coil of thick cable.',
    view='side', gate='a desk with three glowing computer screens')
# ---------------- noodle bar ----------------
add('noodle-counter', 'noodle-counter', 'street-food noodle counter', [96, 30, 44], 'floor', aspect='landscape', room='noodle', flags='lit',
    design='A small NOODLE BAR COUNTER: a chunky dented stainless-steel counter seen from the customer side, two big steaming stockpots and a wok on burners '
           'at its back edge, a tall stack of plain white bowls, a jar of chopsticks, a little glowing amber light strip under the counter top; a short '
           'red-painted board along the top front edge (blank, no words).',
    view='side', gate='a steel street-food noodle counter with steaming pots')
add('vending-machine', 'vending-machine', 'drinks vending machine', [40, 34, 76], 'wall', aspect='portrait', room='noodle', flags='lit',
    design='A tall DRINKS VENDING MACHINE: a chunky boxy cabinet painted faded red, its whole front one OPAQUE painted glass window lit from inside showing rows '
           'of colourful cans and bottles, a blank glowing panel and a chunky slot at the bottom. No words, no numbers, no logos.',
    gate='a glowing drinks vending machine')
add('sign-neon--s2', 'sign-neon', 'wall-mounted neon sign', [36, 4, 28], 'wall', shape='s2', aspect='landscape', room='noodle', flags='lit',
    design='A NEON SIGN for a noodle bar wall: the outline of a steaming NOODLE BOWL with two chopsticks, drawn in FAT glowing warm-orange tube (as thick as a '
           'thumb, bulging), three wavy steam lines above it in glowing cyan tube, mounted on a chunky black backboard plate with a narrow dark edge. No words, no letters.',
    view='wall', gate='a neon sign shaped like a noodle bowl')
add('sign-neon--s3', 'sign-neon', 'wall-mounted neon sign', [36, 4, 28], 'wall', shape='s3', aspect='landscape', room='talisman', flags='lit',
    design='A NEON SIGN for a fictional magic-supply shop wall: the outline of a chunky laboratory FLASK drawn in FAT glowing violet tube (as thick as a thumb, '
           'bulging), with a wavy green liquid line inside, mounted on a chunky black backboard plate with a narrow dark edge. No words, no letters, no symbols.',
    view='wall', gate='a neon sign shaped like a flask')
# ---------------- capsule hotel ----------------
add('capsule-pod', 'capsule-pod', 'stack of two sleeping capsules', [48, 84, 84], 'wall', aspect='portrait', room='capsule', flags='lit',
    design='A CAPSULE HOTEL BLOCK: two moulded off-white fibreglass sleeping capsules stacked one on the other. Each capsule is a LONG rounded tube-like box, '
           'about 7 ft long and only 4 ft wide and 3.5 ft tall, so the whole block is clearly LONGER than it is wide; a round-cornered open hatch at ONE short end '
           'of each capsule shows a softly glowing warm interior with a thin mattress and a pillow, a chunky short steel step ladder at that end up to the top '
           'capsule. Seen from the side so the full 7-ft length of the capsules shows.',
    view='side', gate='two stacked capsule-hotel sleeping pods')
add('locker-bank', 'locker-bank', 'row of steel lockers', [72, 18, 72], 'wall', aspect='landscape', room='capsule',
    design='A ROW OF FOUR TALL STEEL LOCKERS standing side by side: one SHALLOW flat-fronted steel cabinet only 18 in deep, 6 ft tall and 6 ft wide (taller than it '
           'is deep by four times), with four tall narrow dented grey-blue doors with vent slots at the top, chunky handles and small padlocks, all doors shut. '
           'Seen straight from the front, a little from above.',
    view='wall', gate='a row of tall steel lockers')
# ---------------- gang hideout (its lock-up is a chain-link cage) ----------------
add('fence-chain-link', 'fence-chain-link', 'chain-link fence section', [60, 6, 96], 'kit', aspect='portrait', room='hideout', kit='leaf',
    design='ONE 5-ft SECTION OF CHAIN-LINK FENCE standing upright, on its own: two THICK galvanised steel posts at its two ends (4 in across) with round caps, a '
           'thick top rail between them, and between the posts a taut panel of chain-link mesh painted as a dense silvery-grey diamond pattern with dark gaps '
           'between the wires; a little rust near the bottom. Nothing else: no ground, no base.',
    view='wall', gate='a section of chain-link fence between two posts')
add('gate-chain-link', 'gate-chain-link', 'chain-link gate', [60, 6, 96], 'kit', aspect='portrait', room='hideout', kit='leaf',
    design='ONE CHAIN-LINK FENCE GATE on its own: a rectangular frame of THICK galvanised steel tube with a diagonal brace, filled with chain-link mesh painted as '
           'a dense silvery-grey diamond pattern with dark gaps between the wires, a chunky latch and a heavy padlock on a short loop of fat chain on one side. '
           'Nothing else: no posts, no ground.',
    view='wall', gate='a chain-link gate with a padlock')
add('sofa-salvaged', 'sofa-salvaged', 'battered old sofa', [84, 36, 32], 'floor', aspect='landscape', room='hideout',
    design='A BATTERED OLD SOFA: a sagging three-seat couch in faded mustard-brown fabric, torn cushions patched with silver tape, one arm scorched, a crumpled '
           'grey blanket thrown over its back.',
    view='side', gate='a battered old sofa with taped cushions')
add('oil-drum-fire', 'oil-drum-fire', 'burning oil drum', [24, 24, 38], 'floor', aspect='portrait', room='hideout', flags='lit',
    design='A RUSTED OIL DRUM BRAZIER: an old steel drum, rust-brown and soot-black, punched with a ring of ragged holes glowing orange from the fire inside, '
           'glowing embers and chunky charred wood at its open top (no tall flames).',
    gate='a rusty oil drum with a fire glowing inside')
add('mattress-floor', 'mattress-floor', 'mattress on the floor', [40, 76, 10], 'floor', aspect='landscape', room='hideout',
    design='A worn MATTRESS lying flat on the floor: a single striped blue-and-grey mattress with a stain, a crumpled khaki blanket and a squashed pillow on it.',
    view='side', gate='a mattress on the floor with a blanket')
add('motorbike', 'motorbike', 'street motorbike', [30, 84, 46], 'floor', aspect='landscape', room='hideout',
    design='A chunky near-future STREET MOTORBIKE parked on its kickstand: an angular black-and-magenta fairing over a fat engine, FAT tyres, a glowing cyan '
           'headlight strip, stubby handlebars. No badges, no words, no numbers.',
    view='side', gate='a motorbike')
add('gear-case-stack', 'gear-case-stack', 'stack of hard equipment cases', [40, 28, 36], 'floor', room='hideout',
    design='A STACK OF HARD EQUIPMENT CASES: three chunky black and olive-green plastic hard-shell cases with ribbed sides, fat latches and handles, piled one on another.',
    gate='a stack of hard plastic equipment cases')
add('weapon-locker', 'weapon-locker', 'open weapons locker', [36, 20, 72], 'wall', aspect='portrait', room='hideout',
    design='A tall OPEN STEEL WEAPONS LOCKER: a dark green steel cabinet with one door swung open showing two chunky stubby rifles standing in a rack and a shelf '
           'of olive ammunition boxes; dents and chipped paint.',
    view='wall', gate='an open steel locker with rifles inside')
# ---------------- talismonger (a magic shop of the city) ----------------
add('curio-shelf', 'curio-shelf', 'crammed shelf of magical curios', [60, 16, 84], 'wall', aspect='portrait', room='talisman',
    design='A tall dark-wood SHOP SHELF CRAMMED WITH MAGICAL CURIOS: chunky glass jars of coloured powders and dried roots, bundles of herbs, small animal skulls '
           'and antlers, crystals, stubby candles, a few fat old books; a string of small glowing violet bulbs along the top. No symbols, no writing, no labels.',
    view='wall', gate='a shelf crammed with jars, bones, crystals and herbs')
add('display-counter-glass', 'display-counter-glass', 'glass-topped shop display counter', [72, 26, 40], 'floor', aspect='landscape', room='talisman',
    design='A SHOP DISPLAY COUNTER: a dark-wood cabinet with a glass top and glass front (the glass painted OPAQUE, soft blue-grey) showing chunky polished '
           'stones, crystal points, smooth coloured glass spheres and plain wooden shapes with no carvings, markings or symbols, on velvet; a small brass bell and an old brass scale on top.',
    view='side', gate='a glass-topped shop counter showing stones and charms')
add('herb-drying-rack', 'herb-drying-rack', 'standing rack of drying herbs', [48, 24, 72], 'floor', aspect='portrait', room='talisman',
    design='A free-standing HERB DRYING RACK: a stout wooden frame with two thick crossbars from which hang many plump bundles of drying herbs, flowers and '
           'garlic, tied with string, a basket at its foot.',
    gate='a wooden rack hung with bundles of drying herbs')
add('crystal-display', 'crystal-display', 'big crystal cluster on a stand', [24, 24, 40], 'floor', aspect='portrait', room='talisman', flags='lit',
    design='A big CRYSTAL CLUSTER on a stand: a chunky cluster of violet and pale-blue crystal points glowing softly from within, set on a squat carved dark-wood stand.',
    gate='a glowing crystal cluster on a wooden stand')
# ---------------- rigger's garage ----------------
add('drone-parked', 'drone-parked', 'quadcopter drone on its case', [36, 36, 16], 'floor', room='rigger', flags='lit',
    design='A chunky QUADCOPTER DRONE resting on its open hard case: a matte grey body with orange stripes, four FAT round rotor guards (rings) at its corners, '
           'a stubby camera pod underneath with a glowing red lens.',
    gate='a quadcopter drone on its case')
add('workbench-garage', 'workbench-garage', 'garage workbench', [84, 30, 72], 'wall', aspect='landscape', room='rigger',
    design='A heavy GARAGE WORKBENCH: a thick steel-topped bench with a chunky vice at one end, a pegboard back panel hung with fat spanners, hammers and coils of '
           'cable, a half-built drone part and an open laptop glowing blue on the bench, drawers below.',
    view='side', gate='a garage workbench with a pegboard of tools')
add('tool-chest-rolling', 'tool-chest-rolling', 'rolling tool chest', [36, 20, 44], 'wall', room='rigger',
    design='A red ROLLING TOOL CHEST: a chunky steel cabinet of many shallow drawers with fat chrome handles on four castors, a small top box with its lid open '
           'showing tools.',
    gate='a red rolling tool chest')
add('engine-hoist', 'engine-hoist', 'shop engine hoist', [36, 72, 72], 'floor', aspect='landscape', room='rigger',
    design='A yellow SHOP ENGINE HOIST: a sturdy floor crane of THICK square steel tube on fat wheels, its boom arm raised, a short fat chain hanging from the end '
           'holding a chunky car engine block.',
    view='side', gate='a yellow engine hoist holding an engine')
add('car-sedan--s2', 'car-sedan', 'four-door sedan car', [72, 180, 56], 'floor', shape='s2', aspect='landscape', room='rigger',
    design='A parked FOUR-DOOR SEDAN of the near future: a long, low, ANGULAR boxy body in dark gunmetal grey with flat facets, a thin glowing cyan light bar across '
           'its front and a red one across its back, dark opaque windows, fat tyres. A stout toy-like miniature car. No badges, no plates, no words, no numbers.',
    view='side', gate='an angular boxy sedan car')
# ---------------- safehouse ----------------
add('safe-floor', 'safe-floor', 'heavy steel floor safe', [24, 24, 30], 'floor', room='safehouse',
    design='A HEAVY STEEL SAFE: a squat dark grey-green steel box with rounded edges, a big chunky dial and a fat spoked handle on its door, thick hinges.',
    gate='a heavy steel safe')
# ---------------- rooftop ----------------
add('hvac-unit', 'hvac-unit', 'rooftop air-conditioning unit', [60, 96, 48], 'floor', aspect='landscape', room='rooftop',
    design='A big ROOFTOP AIR-CONDITIONING UNIT: a long boxy beige-grey sheet-metal cabinet with louvred side panels and TWO big round fan grilles on its top, '
           'a thick duct leaving one end, rust streaks.',
    view='side', gate='a rooftop air-conditioning unit with two fans on top')
add('water-tank-roof', 'water-tank-roof', 'rooftop water tank', [96, 96, 168], 'floor', aspect='portrait', room='rooftop',
    design='A classic ROOFTOP WATER TANK: a big round tank of weathered vertical wooden staves bound with dark steel hoops, a shallow cone roof, standing on a '
           'stout steel stand of THICK legs and cross braces, a chunky ladder up one side.',
    gate='a wooden rooftop water tank on a steel stand')
add('satellite-dish', 'satellite-dish', 'satellite dish on a frame', [48, 48, 60], 'floor', room='rooftop',
    design='A chunky SATELLITE DISH: a big round pale-grey dish tilted toward the sky with a fat arm holding its receiver, on a sturdy steel frame weighted down '
           'with grey concrete blocks.',
    gate='a satellite dish on a weighted frame')
add('roof-access-hut', 'roof-access-hut', 'stairwell bulkhead on a roof', [96, 72, 108], 'floor', aspect='landscape', room='rooftop', flags='lit',
    design='A ROOF ACCESS HUT (the top of a stairwell standing on a flat roof): a small boxy concrete-block building with a flat roof edged in tar, a grey steel '
           'door with a push bar on its front, a caged bulkhead lamp glowing warm over the door, a vent pipe on its roof.',
    view='side', gate='a small concrete stairwell hut with a steel door')
add('antenna-mast', 'antenna-mast', 'rooftop antenna mast', [30, 30, 144], 'floor', aspect='portrait', room='rooftop', flags='lit',
    design='A ROOFTOP ANTENNA MAST: a tall triangular lattice tower of THICK red-and-white steel members (5 in thick), stubby panel antennas strapped near its top, '
           'a small glowing red light at its tip, a heavy square base plate.',
    gate='a red-and-white lattice antenna mast')
add('roof-vent', 'roof-vent', 'cluster of roof vents', [36, 24, 36], 'floor', room='rooftop',
    design='A CLUSTER OF ROOF VENTS: two fat mushroom-capped sheet-metal vents and one short wide pipe stack with a rain cap, on a small square curb, dull galvanised grey.',
    gate='a cluster of rooftop vent pipes')
add('parapet-roof-low', 'parapet-roof-low', 'low concrete roof parapet section', [60, 12, 42], 'kit', aspect='landscape', room='rooftop', kit='leaf',
    design='ONE 5-ft SECTION OF A LOW CONCRETE ROOF PARAPET on its own: a long low wall of weathered grey concrete, about 3 ft tall, capped with a slightly '
           'wider pale coping stone, rust and rain streaks down its face. Both ends are clean flat vertical cuts so copies butt end to end. Nothing else: no roof, no ground.',
    view='wall', gate='a low concrete wall section with a coping stone')
add('billboard-roof', 'billboard-roof', 'rooftop billboard screen', [180, 36, 144], 'floor', aspect='landscape', room='rooftop', flags='lit',
    design='A big ROOFTOP BILLBOARD SCREEN: one wide flat glowing screen panel showing only a soft abstract magenta-to-cyan glow (no picture, no words, no '
           'letters, no logo), framed in thick dark steel, held up on a chunky steel scaffold of THICK square beams and cross braces with a short catwalk.',
    view='side', gate='a rooftop billboard screen on a steel scaffold')
# ---------------- shared: a wall screen, a wall-mounted strip light ----------------
add('video-screen', 'video-screen', 'wall-mounted big flat screen', [72, 6, 42], 'wall', aspect='landscape', room='lobby', flags='lit',
    design='A big WALL-MOUNTED FLAT SCREEN: a wide thin black screen with a chunky dark frame, glowing with a soft abstract blue-and-magenta gradient (no '
           'picture, no words, no letters, no numbers), a stout bracket behind it.',
    view='wall', gate='a big glowing wall screen')
add('light-wall-strip', 'light-wall-strip', 'caged wall strip light', [48, 8, 10], 'wall', aspect='landscape', room='hideout', flags='lit',
    design='A WALL-MOUNTED STRIP LIGHT: a chunky long steel bulkhead box holding one fat glowing white fluorescent tube behind a protective cage of THICK steel bars, '
           'two stout brackets at its ends.',
    view='wall', gate='a caged strip light for a wall')

(B / 'assets.json').write_text(json.dumps({'batch': 'cyberpunk-02', 'assets': A}, indent=1) + '\n')
print(len(A), 'specs ->', B / 'assets.json')
