#!/usr/bin/env python3
"""Write assets.json for the modhalls lane (2026-11-07): the Modern genre's corridors (Harry: "definitely modern hallways as
well"): an apartment-building hallway, an office corridor, a hotel corridor and a service corridor. Only what the library
lacks is generated: doors, the carpet runner, plants, the water cooler, the vending machine, the lockers, the fluorescent
tubes, the bench, boxes and bins are reused (LAB_NOTES.md has the reuse list).
Text-only prompts in the house template (D, heroic hand-painted) applied to contemporary objects, as the modrooms lane wrote
them (../2026-11-07-modrooms/tools/make_specs.py). Plates come from Gemini's image tool through agy-run (Codex's image quota
is gone until Nov 11, fal is empty), on a flat chroma-blue ground, matted locally by BiRefNet (tools/plates_agy.py).
Trademark rule: no words, numbers, logos, brand names or recognisable real product designs on anything.
    python3 tools/make_specs.py            -> assets.json"""
import json
from pathlib import Path
B = Path(__file__).resolve().parent.parent

INTRO = ('Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art, for a MODERN CITY setting '
         '(present day): the same chunky storybook miniature style the game uses for its fantasy props, applied to a modern object.')
HOUSE = ('Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR, '
         'no photorealism. Glass is painted OPAQUE (soft blue-grey with a pale highlight), never see-through. '
         'Exactly one complete object centered with generous clear margin, no scene or additional objects, no people or creatures. '
         'NO text, NO letters, NO numbers, NO logos, NO brand names, NO stickers and no recognisable real product design anywhere.')
PAL = {'hall': ('Palette: warm present-day interior colours (warm white and cream paint, brushed steel, warm wood, a muted teal, terracotta or '
                'deep green accent); shade light colours with soft blue-grey and warm cream so the form reads, never flat pure white.'),
       'hotel': ('Palette: a hotel\'s warm colours (cream linen, warm walnut, brushed brass, deep burgundy or forest-green accents, polished steel); '
                 'avoid an all-grey or all-beige result.'),
       'service': ('Palette: back-of-house colours (battleship grey and dull green painted steel, galvanised zinc, a safety-yellow or red accent, '
                   'grime at the edges, chipped paint); avoid an all-grey result: warm brown grime and pale worn edges.')}
VIEW = {'top': 'Three-quarter front view from ABOVE (camera elevation 35 degrees), so the front and the top are both visible; the whole object fits in the frame.',
        'wall': 'Seen from its broad room-facing side at a slight three-quarter angle from slightly above (camera elevation 15 degrees); the whole piece fits in the frame.',
        'side': 'Three-quarter view from ABOVE (camera elevation 35 degrees) showing the long side and the top; the whole object fits in the frame.'}
TAIL = ('Background: perfectly uniform solid flat chroma blue (#0000FF) edge to edge, no floor, no ground, no cast shadow, no vignette; '
        'the object itself has no saturated blue anywhere and reflects no blue light. Thick reconstructible parts; no wires, cables, thin rods, thin poles or isolated floating components.')

A = []
def add(id, obj, desc, size, place, *, design, pal, view='top', aspect='square', room='', gate=None, flags='', hung=False):
    body = (f'{INTRO} ONE {desc}. {design} Real-world size about {size[0]} in wide x {size[1]} in deep x {size[2]} in tall: keep these proportions. '
            f'{PAL[pal]} {HOUSE} {VIEW[view]} {TAIL}')
    rec = dict(id=id, object=obj, shape='', family='', lane='3d', route='trellis', size=size, place=place, aspect=aspect, room=room,
               prompt=body, gate=dict(desc=gate or desc), flags=flags)
    if hung: rec['hung'] = True
    A.append(rec)


# ---------------- every corridor: the wall light, the extinguisher, the exit sign ----------------
add('sconce-wall-modern', 'sconce-wall-modern', 'modern wall sconce lamp', [10, 7, 14], 'wall', pal='hall', aspect='portrait', room='corridor', hung=True, flags='lit',
    design='A modern hallway WALL SCONCE: a chunky half-cylinder shade of glowing frosted cream glass open at top and bottom, on a thick square '
           'brushed-brass back plate that mounts flat on a wall. Warm light glows from the shade.',
    view='wall', gate='a wall sconce lamp')
add('fire-extinguisher', 'fire-extinguisher', 'red fire extinguisher on a wall bracket', [10, 8, 26], 'wall', pal='service', aspect='portrait', room='corridor', hung=True,
    design='A bright red FIRE EXTINGUISHER: a stout rounded red cylinder with a chunky black handle-and-lever head and a short thick black hose '
           'tucked against its side, held by a flat steel wall bracket with a strap. Thick and simple.',
    view='wall', gate='a red fire extinguisher')
add('exit-sign', 'exit-sign', 'glowing green emergency exit sign box', [14, 4, 8], 'wall', pal='hall', aspect='landscape', room='corridor', hung=True, flags='lit',
    design='A glowing green EMERGENCY EXIT SIGN: a thick flat box lamp with a cream metal frame, its face glowing bright green, showing ONLY a simple white '
           'running-figure pictogram stepping toward a white doorway shape and a white arrow (pictograms only, absolutely NO letters or words).',
    view='wall', gate='a green emergency exit sign (a running-figure pictogram)')

# ---------------- apartment-building hallway: the laundry cart, the trash chute, the mailboxes ----------------
add('laundry-cart', 'laundry-cart', 'wheeled laundry hamper cart', [36, 24, 34], 'floor', pal='hall', aspect='landscape', room='apartment hallway',
    design='A wheeled LAUNDRY CART: a deep box-shaped canvas hamper of off-white canvas in a chunky grey steel frame on four stout castor wheels, '
           'heaped with folded and crumpled towels and sheets in cream, sage and pale peach.',
    view='side', gate='a laundry cart full of linen')
add('trash-chute-hatch', 'trash-chute-hatch', 'stainless steel trash chute hopper door in a wall', [20, 6, 24], 'wall', pal='service', aspect='square', room='apartment hallway', hung=True,
    design='A building\'s TRASH CHUTE HOPPER DOOR: a flat stainless-steel wall plate with a tilting square hopper door that has a chunky pull handle '
           'along its top edge, set in a thick steel frame with four bolts. It is a flat panel that mounts in a wall.',
    view='wall', gate='a trash chute hatch in a wall')
add('mailbox-bank', 'mailbox-bank', 'bank of apartment mailboxes', [36, 8, 30], 'wall', pal='hall', aspect='landscape', room='apartment hallway', hung=True,
    design='A BANK OF APARTMENT MAILBOXES: a flat brushed-brass wall cabinet holding a grid of three rows of four small mailbox doors, each with a '
           'tiny round keyhole and a blank name-card slot (no writing), in a thick bronze frame.',
    view='wall', gate='a bank of small mailbox doors')

# ---------------- office corridor: the notice board, the recycling bins ----------------
add('notice-board-cork', 'notice-board-cork', 'cork notice board with pinned papers', [48, 3, 34], 'wall', pal='hall', aspect='landscape', room='office corridor', hung=True,
    design='An office CORK NOTICE BOARD: a broad brown cork board in a thick light-oak frame, covered with pinned paper notices, flyers and sticky '
           'notes in cream, pale yellow, pale green and pink held by coloured push pins; the papers show only grey scribble lines and blocks '
           '(no readable writing at all).',
    view='wall', gate='a cork notice board with pinned papers')
add('recycling-bins', 'recycling-bins', 'row of three office recycling bins', [42, 16, 32], 'floor', pal='hall', aspect='landscape', room='office corridor',
    design='A row of THREE OFFICE RECYCLING BINS side by side: chunky rounded plastic bins in muted teal, green and charcoal grey, each with a lid that has a '
           'slot or round hole (no symbols, no writing).',
    view='side', gate='three recycling bins in a row')

# ---------------- hotel corridor: the room service cart, the ice machine, the luggage cart, the housekeeping cart ----------------
add('room-service-cart', 'room-service-cart', 'hotel room service cart', [36, 22, 32], 'floor', pal='hotel', aspect='landscape', room='hotel corridor',
    design='A hotel ROOM SERVICE CART: a wheeled table draped in a crisp white tablecloth hanging nearly to the floor, on top two big domed silver '
           'cloches, a single flower in a small vase, a folded napkin and a teapot. Small castor wheels peek below the cloth.',
    view='side', gate='a room service cart with silver cloches')
add('ice-machine', 'ice-machine', 'hotel ice machine', [30, 30, 66], 'wall', pal='hotel', aspect='portrait', room='hotel corridor',
    design='A hotel corridor ICE MACHINE: a tall chunky brushed-steel cabinet, its upper half the boxy ice maker with grille vents, its lower half a '
           'storage bin whose big flip-up door is propped OPEN showing a heap of glistening white ice cubes with a steel scoop on them; a small drip tray. Stout, boxy, rounded edges.',
    gate='an ice machine (its bin of ice cubes open)')
add('luggage-cart', 'luggage-cart', 'brass hotel luggage trolley with suitcases', [44, 24, 72], 'floor', pal='hotel', aspect='portrait', room='hotel corridor',
    design='A hotel BELLHOP LUGGAGE TROLLEY: a carpeted burgundy base platform on four stout wheels with a thick polished-brass arched frame over it, '
           'loaded with three stacked suitcases (forest green, tan leather, burgundy) and a garment bag. The brass arch is thick and chunky.',
    view='side', gate='a luggage trolley with suitcases')
add('housekeeping-cart', 'housekeeping-cart', 'hotel housekeeping cart', [54, 22, 44], 'floor', pal='hotel', aspect='landscape', room='hotel corridor',
    design='A hotel HOUSEKEEPING CART: a long wheeled cart with shelves of neatly stacked white towels and folded sheets, a canvas linen bag hanging '
           'at one end, a caddy of spray bottles and toilet rolls on top (bottles with no labels), on four castor wheels.',
    view='side', gate='a housekeeping cart with towels and linen')

# ---------------- service / maintenance corridor: the pipes, the mop bucket, the breaker panel ----------------
add('pipe-run-wall', 'pipe-run-wall', 'run of pipes along a wall', [60, 10, 30], 'wall', pal='service', aspect='landscape', room='service corridor', hung=True,
    design='A RUN OF EXPOSED PIPES mounted along a wall: three thick horizontal pipes stacked one above another (a dull green one, a rusty red-brown '
           'one, a galvanised grey one), with chunky flanged joints, two red round valve wheels and thick wall brackets holding them. One straight '
           'section that can repeat end to end.',
    view='wall', gate='pipes running along a wall with valves')
add('mop-bucket', 'mop-bucket', 'janitor mop bucket with wringer and mop', [20, 16, 40], 'floor', pal='service', aspect='portrait', room='service corridor',
    design='A janitor\'s MOP BUCKET: a big safety-yellow wheeled plastic bucket with a chunky grey press wringer on top and a mop with a thick wooden '
           'handle standing in it, its grey string head in the bucket; small black castor wheels.',
    gate='a yellow mop bucket with a mop')
add('breaker-panel', 'breaker-panel', 'electrical breaker panel on a wall', [20, 6, 30], 'wall', pal='service', aspect='portrait', room='service corridor', hung=True,
    design='An ELECTRICAL BREAKER PANEL: a flat grey-painted steel box mounted on a wall, its hinged door swung half open to show two columns of '
           'black breaker switches, two thick grey conduit pipes running up out of its top, a small yellow warning triangle with a lightning '
           'bolt pictogram (no words).',
    view='wall', gate='an electrical breaker panel')

(B / 'assets.json').write_text(json.dumps({'batch': 'modhalls-01', 'assets': A}, indent=1) + '\n')
print(len(A), 'specs ->', B / 'assets.json')
