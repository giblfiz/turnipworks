#!/usr/bin/env python3
"""Write assets.json for the modrooms lane (2026-11-07): three more rooms for the Modern genre (Harry: "we probably also need a
lux apartment option, and definitely need bathroom and fire escape"). The penthouse (City; its corp-exec twin in Cyberpunk),
the bathroom and the public restroom (City), the fire escape (City). Only what the library lacks is generated: sofa, lamp,
plants, sculpture, screen, glass wall, stools, brick walls are reused (DESIGN.md has the reuse list).
Text-only prompts in the house template (D, heroic hand-painted) applied to contemporary objects, as the sprawl and
cyberpunk lanes wrote them (../2026-11-07-cyberpunk-rooms/tools/make_specs.py).
Trademark rule: no words, numbers, logos, brand names or recognisable real product designs on anything.
    python3 tools/make_specs.py            -> assets.json"""
import json
from pathlib import Path
B = Path(__file__).resolve().parent.parent

INTRO = ('Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art, for a MODERN CITY setting '
         '(present day to near future): the same chunky storybook miniature style the game uses for its fantasy props, applied to a modern object.')
HOUSE = ('Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR, '
         'no photorealism. Glass and mirrors are painted OPAQUE (soft blue-grey with a pale highlight), never see-through. '
         'Exactly one complete object centered with generous clear margin, no scene or additional objects, no people or creatures. '
         'NO text, NO letters, NO numbers, NO logos, NO brand names, NO stickers and no recognisable real product design anywhere.')
PAL = {'lux': ('Palette: rich, softened luxury colours (warm cream, oatmeal, walnut brown, charcoal, brushed brass, deep emerald or navy accents, '
               'pale veined marble); avoid an all-grey or all-beige result.'),
       'bath': ('Palette: clean bathroom colours (warm white porcelain, chrome, pale grey, a soft teal or sage accent, warm wood where named); '
                'shade the whites with soft blue-grey and warm cream so the form reads, never flat pure white.'),
       'street': ('Palette: gritty city colours (black and rust-brown painted steel, weathered red brick, grime, warm grey concrete) with chips of '
                  'old paint; avoid an all-black result: the steel reads as dark warm brown-black with pale worn edges.')}
VIEW = {'top': 'Three-quarter front view from ABOVE (camera elevation 35 degrees), so the front and the top are both visible; the whole object fits in the frame.',
        'wall': 'Seen from its broad room-facing side at a slight three-quarter angle from slightly above (camera elevation 15 degrees); the whole piece fits in the frame.',
        'side': 'Three-quarter view from ABOVE (camera elevation 35 degrees) showing the long side and the top; the whole object fits in the frame.'}
TAIL = 'Genuinely transparent background, no floor, no ground and no cast shadow. Thick reconstructible parts; no wires, cables, thin rods, thin poles or isolated floating components.'
PANEL = ('ONE single straight wall section standing upright, about 5 ft wide x 9 ft tall x 1 ft thick. It is a TALL, NARROW upright slab, almost '
         'TWICE as tall as it is wide (portrait format, like a wide door standing on end). It must NOT be square and must NOT be wider than it is tall. '
         'Nothing else: NO floor, NO ground, NO base slab under it, NO ceiling, NO corner return, NO furniture, NO fixture. Both side edges are clean, '
         'flat, vertical cuts and the top is one level line, so this piece butts against copies of itself to make a longer wall.')

A = []
def add(id, obj, desc, size, place, *, design, pal, view='top', aspect='square', family='', shape='', gate=None, room='', kit=None, flags='', hung=False):
    if place == 'kit' and kit == 'wall':
        body = (f'{INTRO} {design} {PANEL} Real-world size about {size[0]} in wide x {size[1]} in deep x {size[2]} in tall: '
                f'keep these proportions. {PAL[pal]} {HOUSE} {VIEW["wall"]} {TAIL}')
    else:
        body = (f'{INTRO} ONE {desc}. {design} Real-world size about {size[0]} in wide x {size[1]} in deep x {size[2]} in tall: keep these proportions. '
                f'{PAL[pal]} {HOUSE} {VIEW[view]} {TAIL}')
    rec = dict(id=id, object=obj, shape=shape, family=family, lane='3d', route='trellis', size=size, place=place, aspect=aspect, room=room,
               prompt=body, gate=dict(desc=gate or desc), flags=flags)
    if hung: rec['hung'] = True
    if kit == 'wall': rec.update(kit='wall', opening='solid')
    if kit == 'leaf': rec.update(kit='leaf')
    A.append(rec)


# ---------------- penthouse (luxury apartment): glass walls, the sectional, the island, the piano ----------------
add('sofa-sectional', 'sofa-sectional', 'big L-shaped sectional sofa', [108, 84, 32], 'floor', pal='lux', aspect='landscape', room='penthouse',
    design='A big modern L-SHAPED SECTIONAL SOFA: a long low run of deep cream-oatmeal cushions with a chaise end turning the corner, plump square back '
           'cushions, a few emerald and rust throw pillows and a folded charcoal throw blanket, on short dark walnut block feet.',
    gate='an L-shaped sectional sofa')
add('lounge-chair', 'lounge-chair', 'designer lounge chair with ottoman', [34, 54, 34], 'floor', pal='lux', aspect='landscape', room='penthouse',
    design='A modern LOUNGE CHAIR WITH ITS OTTOMAN: a deep reclined armchair of tan-brown leather cushions in a curved walnut shell on a stout five-spoke '
           'dark metal swivel base, its matching footstool set in front of it.',
    view='side', gate='a leather lounge chair with a footstool')
add('kitchen-island', 'kitchen-island', 'marble-topped kitchen island', [96, 40, 38], 'floor', pal='lux', aspect='landscape', room='penthouse',
    design='A modern KITCHEN ISLAND: a long block of handleless dark-navy cabinets under a thick pale veined-marble worktop that overhangs one long side '
           '(a breakfast bar), a small round brass sink near one end, a fruit bowl and a vase of white flowers on top.',
    view='side', gate='a kitchen island with a marble top')
add('kitchen-run-lux', 'kitchen-run-lux', 'luxury fitted kitchen run along a wall', [120, 26, 84], 'wall', pal='lux', aspect='landscape', room='penthouse',
    design='A LUXURY FITTED KITCHEN RUN against a wall: a long row of handleless dark-navy base cabinets under a pale marble worktop with a built-in black '
           'glass hob, a marble backsplash, a tall built-in pantry column with a steel oven stack at one end, two floating walnut shelves with pale dishes.',
    view='wall', gate='a long fitted kitchen with an oven column')
add('bar-cart', 'bar-cart', 'brass bar cart with decanters', [30, 18, 34], 'floor', pal='lux', aspect='landscape', room='penthouse',
    design='A two-tier BAR CART: a brushed-brass frame on two chunky wheels with two smoked-glass trays (painted opaque), on top three chunky crystal '
           'decanters of amber and ruby drinks and a cluster of short glasses, an ice bucket and a stack of folded napkins below.',
    gate='a brass drinks trolley with decanters')
add('art-canvas', 'art-canvas', 'large abstract painting on a deep canvas', [60, 4, 42], 'wall', pal='lux', aspect='landscape', room='penthouse', hung=True,
    design='A LARGE ABSTRACT PAINTING on a deep gallery canvas in a thin dark wood float frame: bold soft-edged colour fields of deep teal, ochre and '
           'terracotta with one pale sweep across them, thick visible brush texture. Purely abstract shapes: no figures, no faces, no writing, no signature.',
    view='wall', gate='a big framed abstract painting')
add('bed-platform', 'bed-platform', 'low king-size platform bed', [80, 88, 36], 'floor', pal='lux', aspect='landscape', room='penthouse',
    design='A low modern KING-SIZE PLATFORM BED: a wide dark walnut platform frame, a tall padded charcoal-grey upholstered headboard, crisp white duvet '
           'folded back with a pale emerald throw across the foot, four plump pillows; a small walnut nightstand built into each side of the headboard.',
    gate='a low king-size bed with an upholstered headboard')
add('dining-set-lux', 'dining-set-lux', 'long stone dining table with six chairs', [96, 66, 32], 'floor', pal='lux', aspect='landscape', room='penthouse',
    design='A modern DINING SET as ONE piece: a long thick pale-stone table top on two chunky dark walnut slab legs, six curved upholstered dining chairs in '
           'warm grey fabric tucked in around it (three along each long side), a low bowl of greenery in the middle of the table.',
    gate='a long dining table with six chairs')
add('piano-grand', 'piano-grand', 'black grand piano', [60, 78, 40], 'floor', pal='lux', aspect='landscape', room='penthouse',
    design='A GLOSS-BLACK GRAND PIANO painted in soft matte gradients: the curved body with its lid propped open on its stick, the keyboard of chunky white '
           'and black keys at the straight end, three stout turned legs on brass casters, a padded black bench before the keys.',
    view='side', gate='a black grand piano with its lid open')
# ---------------- bathroom (and the public restroom) ----------------
add('wall-tiled--drywall', 'wall-tiled', 'bathroom wall tiled in white subway tiles', [60, 12, 108], 'kit', pal='bath', aspect='portrait', family='drywall', room='bathroom', kit='wall',
    design='A BATHROOM WALL section: its face tiled floor to ceiling in chunky white glazed rectangular subway tiles in a brick pattern with soft grey grout '
           'lines, a band of small sage-green tiles at waist height, a dark grey tiled skirting at the bottom, the plaster top edge painted pale grey.',
    gate='a wall section tiled in white tiles')
add('toilet', 'toilet', 'white porcelain toilet', [20, 28, 30], 'wall', pal='bath', room='bathroom',
    design='A modern WHITE PORCELAIN TOILET: a rounded bowl with its seat and lid down, a chunky square cistern behind it with a chrome flush button on top, '
           'a fat foot curving to the floor.',
    gate='a toilet')
add('sink-vanity', 'sink-vanity', 'bathroom vanity unit with a basin', [36, 22, 34], 'wall', pal='bath', aspect='landscape', room='bathroom',
    design='A BATHROOM VANITY: a sturdy two-door cabinet of pale oak with a white stone top holding one round white basin and a chunky chrome mixer tap, '
           'a soap bottle and a folded hand towel beside the basin.',
    gate='a bathroom sink on a cabinet')
add('mirror-bathroom', 'mirror-bathroom', 'bathroom mirror with a light bar', [30, 4, 36], 'wall', pal='bath', aspect='portrait', room='bathroom', hung=True, flags='lit',
    design='A BATHROOM WALL MIRROR: a rectangular mirror (painted opaque pale blue-grey with a soft diagonal highlight) in a chunky chrome frame, a short '
           'glowing warm-white light bar across its top, a small glass shelf under it with a toothbrush cup.',
    view='wall', gate='a bathroom mirror with a light over it')
add('bathtub', 'bathtub', 'white enamel bathtub', [60, 30, 24], 'wall', pal='bath', aspect='landscape', room='bathroom',
    design='A white enamel BATHTUB: a deep rectangular tub with a thick rounded rim, its outer side panelled in white tile, filled with pale blue water and '
           'a little white foam, chunky chrome taps at one end, a folded towel draped over the rim.',
    view='side', gate='a bathtub')
add('shower-stall', 'shower-stall', 'glass-walled shower cubicle', [36, 36, 84], 'floor', pal='bath', aspect='portrait', room='bathroom',
    design='A square SHOWER CUBICLE: a white tiled back wall with a big round chrome shower head, two glass side walls (painted opaque pale blue-grey with '
           'highlights) in thick chrome frames, one glass door, a shallow white shower tray; open at the top.',
    gate='a glass shower cubicle')
add('towel-rail', 'towel-rail', 'heated towel rail with towels', [24, 5, 32], 'wall', pal='bath', aspect='portrait', room='bathroom', hung=True,
    design='A chunky chrome HEATED TOWEL RAIL ladder hung on the wall, two thick folded towels draped over its bars, one teal and one white.',
    view='wall', gate='a towel rail with towels')
add('toilet-stall', 'toilet-stall', 'public restroom toilet cubicle', [36, 60, 72], 'floor', pal='bath', aspect='portrait', room='restroom',
    design='ONE PUBLIC RESTROOM TOILET CUBICLE: three chunky grey-blue laminate partition walls on short chrome feet (open at the top and a gap at the floor), '
           'the front wall with its door standing half open, a white toilet visible inside against the back wall.',
    gate='a toilet cubicle with partition walls and a door')
add('sink-row', 'sink-row', 'long restroom counter with three basins', [96, 24, 34], 'wall', pal='bath', aspect='landscape', room='restroom',
    design='A long PUBLIC RESTROOM WASH COUNTER: a thick grey speckled stone counter on a plain white panelled front, three round white basins sunk in a row, '
           'a chunky chrome tap behind each, a soap dispenser between each pair.',
    view='side', gate='a counter with three sinks in a row')
add('urinal', 'urinal', 'wall urinal with a privacy divider', [24, 18, 48], 'wall', pal='bath', aspect='portrait', room='restroom',
    design='A white porcelain WALL URINAL with a chrome flush pipe above it, a chunky grey-blue laminate privacy divider panel standing out from the wall at '
           'one side of it.',
    gate='a wall urinal with a divider')

# ---------------- commercial kitchen (restaurant back-of-house; stocked mostly from the library's existing food) ----------------
add('prep-table-steel', 'prep-table-steel', 'stainless steel kitchen prep table', [72, 30, 36], 'floor', pal='bath', aspect='landscape', room='kitchen',
    design='A restaurant STAINLESS STEEL PREP TABLE: a thick brushed-steel work top with a raised back splash edge, four stout square steel legs with '
           'adjustable feet, a full steel undershelf stacked with a few white plastic food tubs with lids. The top is clear and empty.',
    view='side', gate='a stainless steel kitchen work table')
add('range-commercial', 'range-commercial', 'commercial six-burner gas range', [60, 34, 36], 'wall', pal='bath', aspect='landscape', room='kitchen', flags='lit',
    design='A restaurant COMMERCIAL GAS RANGE: a heavy brushed-steel block with six chunky cast-iron burner grates on top, one burner glowing with a ring of '
           'small blue flame, a flat griddle plate at one end, a tall steel back shelf with a row of knobs, two oven doors below with chunky bar handles.',
    gate='a big commercial kitchen stove')
add('range-hood', 'range-hood', 'stainless canopy extractor hood', [72, 42, 24], 'ceiling', pal='bath', aspect='landscape', room='kitchen',
    design='A restaurant STAINLESS CANOPY EXTRACTOR HOOD: a big wide brushed-steel box hood with sloped front, a row of baffle filter panels inside its '
           'lip and a fat square duct rising from its top.',
    view='side', gate='a steel kitchen extractor hood')
add('cooler-walkin-door', 'cooler-walkin-door', 'walk-in cooler door in its insulated front', [60, 10, 96], 'wall', pal='bath', aspect='portrait', room='kitchen',
    design='The FRONT OF A WALK-IN COOLER: a flat panel of white insulated steel sheet with a heavy thick steel door in it, a big chunky chrome latch handle, '
           'two stout hinges, a small square window (painted opaque pale blue-grey) and a thick plastic strip curtain hanging just inside the open top of the frame.',
    view='wall', gate='a walk-in fridge door')
add('dish-station', 'dish-station', 'restaurant dish pit with sink and dishwasher', [96, 30, 72], 'wall', pal='bath', aspect='landscape', room='kitchen',
    design='A restaurant DISH PIT: a long brushed-steel counter with a deep double sink and a tall curved pre-rinse spray tap, a boxy steel hood-type '
           'dishwasher in the middle with its hood lowered, a stack of grey plastic dish racks full of white plates at the far end.',
    view='side', gate='a steel dishwashing station with sinks')
add('pot-rack-wall', 'pot-rack-wall', 'wall rack of hanging pots and pans', [60, 14, 48], 'wall', pal='bath', aspect='landscape', room='kitchen', hung=True,
    design='A restaurant WALL POT RACK: a thick steel bar shelf fixed to the wall holding stacked steel stock pots, from its hooks below hang chunky steel '
           'saucepans, black frying pans and big ladles in a row.',
    view='wall', gate='a wall rack of hanging pots and pans')
add('shelving-wire', 'shelving-wire', 'wire shelving of dry goods', [48, 20, 72], 'wall', pal='bath', aspect='portrait', room='kitchen',
    design='A tall chrome WIRE SHELVING UNIT of four thick shelves stocked with restaurant dry goods: big plain silver catering tins, clear tubs of rice and '
           'pasta, plain white paper sacks of flour, cases of plain glass jars, rolls of paper towel. All packaging blank, no labels.',
    view='wall', gate='metal shelving stocked with kitchen supplies')
add('fridge-reach-in', 'fridge-reach-in', 'two-door steel reach-in fridge', [54, 32, 80], 'wall', pal='bath', aspect='portrait', room='kitchen', flags='lit',
    design='A restaurant REACH-IN FRIDGE: a tall boxy brushed-steel cabinet with two solid steel doors with long chunky bar handles, a small glowing blue '
           'readout panel (no digits) at the top, stout castors underneath.',
    gate='a tall steel commercial fridge')
# ---------------- fire escape (an outdoor stairwell: core/stairs.js connectors) and the elevator ----------------
add('stair-fire-escape', 'stair-fire-escape', 'steel fire-escape stair flight', [40, 110, 120], 'kit', pal='street', aspect='landscape', room='fire-escape',
    design='ONE FLIGHT OF A CITY FIRE-ESCAPE STAIR on its own: a straight steep run of open steel grating treads between two THICK flat steel stringers, a '
           'chunky steel handrail on both sides held by stout square uprights, rising one full storey from its low end to its high end. Black-brown painted '
           'steel with rust streaks and worn pale edges. Nothing else: no wall, no landing, no ground.',
    view='side', gate='a steel fire-escape stair flight with handrails')
add('ladder-fire-escape', 'ladder-fire-escape', 'steel fire-escape drop ladder', [24, 8, 120], 'wall', pal='street', aspect='portrait', room='fire-escape',
    design='A CITY FIRE-ESCAPE DROP LADDER standing upright on its own: two THICK flat steel side rails (4 in wide) joined by chunky square steel rungs, two '
           'curved steel hoops at its top, a small boxy counterweight bracket on one side. Black-brown painted steel with rust and worn pale edges.',
    view='wall', gate='a steel ladder')
add('elevator-car', 'elevator-car', 'open-topped elevator cab', [60, 60, 96], 'floor', pal='bath', room='elevator',
    design='A modern ELEVATOR CAB seen with its roof taken off: a square box of three brushed-steel walls with a chunky steel handrail round them, a dark '
           'diamond-plate steel floor, a narrow panel of round glowing buttons (no numbers) by the front, the fourth side open where its two steel '
           'sliding doors stand parted. NO roof: the inside is plainly visible from above.',
    gate='an elevator cab with no roof')
add('elevator-doors', 'elevator-doors', 'elevator landing doors in a steel frame', [60, 10, 96], 'wall', pal='bath', aspect='portrait', room='elevator',
    design='A FLAT, THIN upright wall panel only 10 in deep, seen from the front: a pair of brushed-steel ELEVATOR LANDING DOORS standing shut in a flat steel frame flush with it (no box, no cab, no depth behind it, like a door in a wall), a small glowing amber arrow lamp over them (an arrow shape '
           'only, no numbers), a chunky round call button panel on the frame at one side.',
    view='wall', gate='closed elevator doors')

(B / 'assets.json').write_text(json.dumps({'batch': 'modrooms-03', 'assets': A}, indent=1) + '\n')
print(len(A), 'specs ->', B / 'assets.json')
