#!/usr/bin/env python3
"""Write assets.json for the vehicles batch (2026-11-07): Harry's "a few more vehicle options" from his Simplified Shadowrun 2
sheet (projects/dnd/SimplifiedShadowrun2v1.4.pdf, vehicles and drones): helicopters, an armoured van, a police cruiser, an
armoured SUV, quadcopter drones, a hexapod gun platform, two RC rovers. Generic names only: no setting's brand names, no
licence implied. Text-only prompts in the house template (D, heroic hand-painted), the cyberpunk pack's wording
(../2026-11-07-cyberpunk-rooms/tools/make_specs.py). Trademark rule: no words, numbers, logos, badges, brand names or
recognisable real product designs on anything.
Sizes are real-world inches, W x D x H, with the long axis D (the sprawl cars' convention: car-sedan 72x180x56).
    python3 tools/make_specs.py            -> assets.json"""
import json
from pathlib import Path
B = Path(__file__).resolve().parent.parent

INTRO = ('Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art, for a gritty NEAR-FUTURE CITY setting '
         '(cyberpunk: worn concrete, chrome, improvised tech, glowing screens and neon): the same chunky storybook miniature style the game uses '
         'for its fantasy props, applied to a near-future vehicle. A stout, toy-like tabletop miniature with exaggerated chunky proportions.')
HOUSE = ('Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR, '
         'no photorealism. Glass is painted OPAQUE (soft blue-grey with a pale highlight), never see-through. '
         'Exactly one complete object centered with generous clear margin, no scene or additional objects, no people, no pilot, no driver, no creatures. '
         'NO text, NO letters, NO numbers, NO logos, NO badges, NO emblems, NO brand names, NO stickers, NO number plates and no recognisable real product design anywhere.')
PAL = ('Palette: muted, softened city colours (warm and cool greys, gunmetal, brushed steel, faded teal, mustard, brick red, navy) with '
       'small glowing accents of cyan, magenta or amber where the vehicle has lights or screens; avoid an all-grey result.')
VIEW = {'top': 'Three-quarter front view from ABOVE (camera elevation 35 degrees), so the front and the top are both visible; the whole object fits in the frame.',
        'side': 'Three-quarter view from ABOVE (camera elevation 35 degrees) showing the long side and the top; the whole vehicle fits in the frame.',
        'wall': 'Seen from the front at a three-quarter angle from slightly below and to one side (camera elevation -10 degrees), as if looking up at it on a wall; the whole piece and its wall bracket fit in the frame.',
        'desk': 'Three-quarter front view from ABOVE (camera elevation 45 degrees), as it would be seen lying on a desk; the whole object fits in the frame.',
        'high': 'Three-quarter view from HIGH ABOVE (camera elevation 50 degrees) showing the long side and the whole top, so the rotor disc is clearly seen; the whole aircraft, rotor tips included, fits in the frame.'}
TAIL = 'Genuinely transparent background, no floor, no ground, no landing pad and no cast shadow. Thick reconstructible parts; no wires, cables, antennas, thin rods, thin poles or isolated floating components.'

A = []
def add(id, obj, desc, size, place, *, design, view='side', aspect='landscape', gate=None, room='', flags='', pack='vehicles', intro=None):
    body = (f'{intro or INTRO} ONE {desc}. {design} Real-world size about {size[0]} in wide x {size[1]} in long x {size[2]} in tall: keep these proportions. '
            f'{PAL} {HOUSE} {VIEW[view]} {TAIL}')
    A.append(dict(id=id, object=obj, shape='', family='', lane='3d', route='trellis', size=size, place=place, aspect=aspect, room=room,
                  prompt=body, gate=dict(desc=gate or desc), flags=flags, pack=pack))


# ---------------- aircraft (oversize: 6-9 squares across; the rotor is the widest part) ----------------
ROTOR = ('The main rotor is FOUR BROAD, THICK, flat paddle blades (each as wide as a plank and 3 in thick) crossing in an X over the cabin on a fat hub, '
         'parked still; the tail rotor is a chunky little ducted fan in the tail fin.')
add('helicopter', 'helicopter', 'light passenger helicopter, parked', [324, 372, 108], 'floor', view='high', room='rooftop',
    design='A sleek corporate LIGHT PASSENGER HELICOPTER parked on its skids: a rounded egg-shaped cabin with a big opaque blue-grey wraparound windscreen and a '
           'sliding side door, painted deep navy with a broad pearl-white belly and one thin glowing cyan stripe down its side, a slim tail boom ending in a '
           'swept tail fin, two fat tubular landing skids. ' + ROTOR,
    gate='a parked light helicopter seen from above')
add('helicopter-gunship', 'helicopter-gunship', 'armed attack helicopter gunship, parked', [432, 528, 144], 'floor', view='high', room='rooftop',
    design='A menacing near-future ATTACK HELICOPTER GUNSHIP of no real make, parked on chunky wheels: a narrow armoured fuselage of flat angular slabs in matte '
           'charcoal and dark olive grey, a stepped two-seat cockpit (one seat behind the other) under faceted opaque dark canopies, short stub wings on each side '
           'carrying fat rocket pods and boxy missile racks, a heavy rotary cannon in a turret under the nose, armoured engine housings, a long tail boom with '
           'a swept fin, small amber warning lights. ' + ROTOR,
    gate='an attack helicopter gunship with stub wings and weapons, seen from above')

# ---------------- road vehicles (the sprawl cars' scale: stout toy proportions, a 15-17 ft body) ----------------
add('car-police', 'car-police', 'police patrol cruiser car, parked', [72, 180, 60], 'floor', room='street',
    design='A parked POLICE PATROL CRUISER: a chunky four-door sedan painted in the classic black-and-white police scheme (black bonnet, roof and boot, white '
           'doors), a fat roof LIGHT BAR glowing red at one end and blue at the other, a heavy black steel push bar on the front bumper, a spotlight by the '
           'driver\'s mirror, dark opaque windows, fat tyres. Absolutely NO words, NO star, NO shield, NO badge, NO crest and NO numbers on the doors or anywhere: plain panels.',
    gate='a black-and-white police car with a roof light bar')
add('suv-armoured', 'suv-armoured', 'armoured corporate SUV, parked', [80, 200, 76], 'floor', room='street',
    design='A parked ARMOURED CORPORATE SUV: a huge boxy four-door sport-utility vehicle in glossless jet black with thick slab-sided armoured doors, small '
           'deep-set dark opaque windows, a heavy reinforced front bumper and grille guard, run-flat tyres on fat black wheels, a thin cool-white light strip '
           'across the front. Sinister, expensive, bulletproof.',
    gate='a big black armoured SUV')
add('van-armoured', 'van-armoured', 'armoured van, an armoured personnel carrier on six wheels, parked', [96, 240, 108], 'floor', room='street',
    design='A parked ARMOURED VAN, a tough wheeled ARMOURED PERSONNEL CARRIER: a tall slab-sided box of thick riveted armour plates in drab dark green-grey with '
           'rust-brown scuffs, a short sloped armoured nose with a heavy ram bar, narrow slit windows behind armoured shutters, a roof hatch with a small '
           'armoured gun shield, big rear double doors, SIX fat off-road tyres in two axles at the back and one at the front, amber marker lights.',
    gate='a six-wheeled armoured van or armoured personnel carrier')

# ---------------- drones (the rigger's toys; drone-parked is the cyberpunk pack's quadcopter on its case) ----------------
add('drone-quad-light', 'drone-quad-light', 'small armed quadcopter drone', [24, 24, 10], 'floor', view='top', aspect='square', room='rigger',
    design='A SMALL ARMED QUADCOPTER DRONE resting on four stubby landing feet: a compact rounded body in scuffed white and safety orange, four FAT round '
           'rotor guards (thick rings with chunky propellers inside) at its corners, a single glowing red camera eye at the front, and a chunky black handgun '
           'clamped under its belly on a fat mount, its muzzle pointing forward.',
    gate='a small quadcopter drone with a pistol under it')
add('drone-quad-heavy', 'drone-quad-heavy', 'big armed combat quadcopter drone', [48, 48, 20], 'floor', view='top', aspect='square', room='rigger',
    design='(2026-11-07 re-plate: the first mesh read blind as a "spider drone": its struts looked like legs) A BIG ARMOURED COMBAT QUADCOPTER DRONE with NO legs and NO landing struts, as if hovering: a heavy flat body of gunmetal armour plates with yellow-and-black '
           'hazard stripes at the edges, four FAT shrouded rotors (thick round ducts) on stout arms, a cluster of three glowing cyan sensor lenses at the front, '
           'and a chunky submachine-gun turret with a fat drum magazine slung under its belly, barrel forward.',
    gate='a big armed quadcopter drone with a gun turret under it')
add('drone-hexapod', 'drone-hexapod', 'six-legged walking gun platform robot', [64, 80, 56], 'floor', view='top', aspect='landscape', room='rigger',
    design='A SIX-LEGGED WALKING GUN PLATFORM, a robot the size of a small car: a low armoured oval body in olive drab and gunmetal, six THICK jointed legs (fat '
           'armoured knees, broad round feet, three each side) standing it about a metre high, a squat swivel turret on its back carrying a chunky machine gun with a '
           'thick barrel, a row of glowing red sensor eyes on its front.',
    gate='a six-legged robot walker with a gun turret')
add('drone-rover-arm', 'drone-rover-arm', 'remote-control rover with a manipulator arm', [30, 40, 30], 'floor', view='top', aspect='square', room='rigger',
    design='A REMOTE-CONTROL ROVER CAR WITH A ROBOT ARM: a low boxy six-wheeled chassis in mustard yellow and grey with FAT knobbly rubber tyres, a stubby camera '
           'head with a glowing green lens, and a THICK three-jointed manipulator arm folded on its top ending in a chunky two-finger gripper claw.',
    gate='a small wheeled rover robot with a gripper arm')
add('drone-rover-sentry', 'drone-rover-sentry', 'armed remote-control sentry car', [32, 44, 32], 'floor', view='top', aspect='square', room='rigger',
    design='An ARMED REMOTE-CONTROL SENTRY CAR: a low wedge-shaped four-wheeled armoured buggy in gunmetal and brick red with FAT off-road tyres, slanted armour '
           'plates over the wheels, and a chunky swivel turret on top carrying a stubby machine gun with a thick barrel and a box magazine, one glowing amber sensor eye.',
    gate='a small armed robot car with a gun turret')

# ---------------- Harry 2026-11-07 (added to this batch): "for modern, we need security cameras for the wall. Also a bunch of desk
# debris (laptop, CRT, mouse, donut)". Small things are CHUNKY (the house's small props read at table distance), pack `desk`.
DESK = ('Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art, for a MODERN-DAY OFFICE and city setting '
        '(cubicles, fluorescent light, cheap plastic, a little worn): the same chunky storybook miniature style the game uses for its fantasy props, '
        'applied to an everyday modern object. A small prop made slightly CHUNKY and oversimplified so it still reads from across a game table: '
        'fat rounded edges, big simple shapes, no fiddly detail.')
D = dict(pack='desk', intro=DESK, view='desk', aspect='square', room='office')
add('camera-security', 'camera-security', 'wall-mounted security camera', [10, 18, 12], 'wall', view='wall', aspect='square', room='lobby', pack='desk', intro=DESK, flags='lit',
    design='A WALL-MOUNTED CCTV SECURITY CAMERA: a chunky rounded off-white bullet-shaped camera housing with a short sun-hood over its dark lens, a tiny glowing red '
           'light beside the lens, on a THICK grey L-shaped bracket arm that comes out from a square wall plate; the camera points forward and tilted DOWN about 30 degrees.',
    gate='a security camera on a wall bracket')
add('camera-dome', 'camera-dome', 'ceiling dome security camera', [12, 12, 8], 'ceiling', view='wall', aspect='square', room='lobby', pack='desk', intro=DESK, flags='lit',
    design='A CEILING DOME SECURITY CAMERA hanging upside down as on a ceiling: a round off-white base plate with a big smoky dark-grey half-sphere dome below it, the '
           'faint shape of a lens inside, a tiny glowing red light on the rim.',
    gate='a dome security camera')
add('laptop-open', 'laptop-open', 'open laptop computer', [14, 11, 9], 'surface', design='An OPEN LAPTOP COMPUTER: a chunky dark-grey laptop opened at a slight angle, '
    'its screen glowing a soft blue with simple pale blocks of colour (no words, no logo), a fat keyboard of big square keys and a trackpad.', gate='an open laptop', **D)
add('monitor-crt', 'monitor-crt', 'old boxy CRT computer monitor', [16, 16, 15], 'surface', design='An OLD BOXY CRT COMPUTER MONITOR: a big deep beige-grey plastic box '
    'with a slightly bulging glowing green-blue screen at its front, rounded corners, vents on top, a small round foot.', gate='an old CRT computer monitor', **D)
add('monitor-flat', 'monitor-flat', 'flat computer monitor on a stand', [22, 8, 16], 'surface', design='A FLAT COMPUTER MONITOR: a wide black flat screen with a chunky bezel, '
    'glowing a soft blue-grey with simple pale window shapes (no words), on a THICK stand and a broad flat foot.', gate='a flat computer monitor', **D)
add('keyboard', 'keyboard', 'computer keyboard', [18, 7, 2.5], 'surface', design='A COMPUTER KEYBOARD: a long chunky slab of pale grey plastic with rows of big fat '
    'square keys (blank keys, no letters), a wider space bar.', gate='a computer keyboard', **D)
add('mouse-computer', 'mouse-computer', 'computer mouse', [4, 5, 2], 'surface', design='A COMPUTER MOUSE: a fat rounded pebble-shaped grey mouse with two big buttons '
    'and a scroll wheel, a short thick stub of cord.', gate='a computer mouse', **D)
add('donut', 'donut', 'frosted donut', [5, 5, 2], 'surface', design='A FAT FROSTED DONUT: a plump golden ring doughnut with thick pink icing and bright sprinkles on top.',
    gate='a pink frosted donut', **D)
add('donut-box', 'donut-box', 'open box of donuts', [12, 12, 4], 'surface', design='AN OPEN CARDBOARD BOX OF DONUTS: a square plain white-and-pink box (no words, no logo) with '
    'its lid folded back, holding six fat donuts, pink-frosted, chocolate and plain, one missing.', gate='an open box of donuts', **D)
add('coffee-cup-paper', 'coffee-cup-paper', 'takeaway paper coffee cup', [4, 4, 6], 'surface', design='A TAKEAWAY PAPER COFFEE CUP: a fat white paper cup with a brown '
    'card sleeve and a chunky white plastic lid (no words, no logo).', gate='a takeaway coffee cup', **D)
add('desk-phone', 'desk-phone', 'office desk telephone', [8, 9, 5], 'surface', design='AN OFFICE DESK TELEPHONE: a chunky dark-grey phone base with a big keypad of fat '
    'blank buttons and a small glowing green display, the handset resting on top with a fat coiled cord.', gate='an office desk phone', **D)
add('paper-stack', 'paper-stack', 'stack of office papers and folders', [12, 10, 4], 'surface', design='A MESSY STACK OF OFFICE PAPERS AND FOLDERS: a thick pile of white paper '
    'sheets and manila and blue card folders, slightly skewed, one folder sticking out, a fat black binder clip on top (no writing).', gate='a stack of papers and folders', **D)

(B / 'assets.json').write_text(json.dumps({'batch': 'vehicles-03', 'assets': A}, indent=1) + '\n')
print(len(A), 'specs ->', B / 'assets.json')
