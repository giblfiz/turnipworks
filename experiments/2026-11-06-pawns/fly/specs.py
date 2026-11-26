#!/usr/bin/env python3
"""assets.json for the flying alts: one prompt per flier, built from its STANDING spec's style text (everything before
"Pose:"), its own standing plate attached as the reference, and a flying pose written here.
    python3 specs.py         -> assets.json"""
import json, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from common import *

# the flying pose, per kind of body
HORIZ = ("FLYING, seen in mid-air: its body roughly LEVEL (horizontal, head a little raised), its two WINGS SPREAD WIDE and raised in a strong "
         "up-stroke (a clear V seen from the front), each wing drawn as ONE thick solid opaque shape (thick like a wargaming miniature's cast wing, "
         "with chunky ribs or big solid feathers, never a thin translucent membrane). Its legs tucked up under the body, the tail streaming out "
         "straight behind, slightly curved.")
BIRD = ("FLYING, seen in mid-air: the body level, the head forward, both WINGS SPREAD WIDE in a strong up-stroke (a clear V from the front), each wing "
        "drawn as ONE thick solid shape with a few big chunky feathers (no single thin feathers sticking out), the legs and talons tucked up under the "
        "body, the tail fanned behind.")
HOVER = ("FLYING, hovering in mid-air: the body upright, both WINGS SPREAD WIDE and raised high behind its shoulders (a clear V seen from the front), "
         "each wing ONE thick solid opaque shape (thick like a wargaming miniature's cast wing, chunky ribs or big solid feathers, never a thin "
         "translucent membrane). Its legs hanging relaxed below with the toes pointed DOWN, clear of any floor: it is airborne.")
D = {
    'foe-dragon-wyrmling': (HORIZ, ''), 'foe-dragon-young-black': (HORIZ, ''), 'foe-dragon-young-green': (HORIZ, ''),
    'foe-dragon-young-red': (HORIZ, ''), 'foe-dragon-young-white': (HORIZ, ''),
    'foe-wyvern': (HORIZ, 'A wyvern has NO front legs: its arms ARE its wings. Its two hind legs tucked back under it, its barbed sting at the end of the tail.'),
    'foe-griffon': (HORIZ, 'The eagle front talons and the lion hind legs tucked under the body; the tufted lion tail behind.'),
    'foe-hippogriff': (HORIZ, 'The eagle front talons and the horse hind legs with hooves tucked under the body; the horse tail streaming behind.'),
    'foe-pegasus': (HORIZ, 'A winged horse in flight: the front legs folded up at the knee, the hind legs trailing, the mane and tail as thick solid shapes. No rider, no saddle.'),
    'foe-manticore': (HORIZ, 'The lion legs tucked under; the spiked tail arched up over its back.'),
    'foe-chimera': (HORIZ, 'All THREE heads (lion in the middle, horned goat on the left shoulder, red dragon on the right) clearly visible; the legs tucked under.'),
    'foe-couatl': ("FLYING, seen in mid-air: the great feathered serpent's body in a loose S-curve through the air (no coils on any floor), its two feathered WINGS SPREAD WIDE from just behind its head in a strong up-stroke, each wing ONE thick solid shape of big chunky feathers.", ''),
    'foe-giant-wasp': ("FLYING, seen in mid-air: the body level, its two pairs of WINGS SPREAD out to the sides and raised, drawn as thick solid opaque pale cream shapes (not see-through), its six thick legs hanging down below the body, the sting curled under.", ''),
    'foe-stirge': ("FLYING, seen in mid-air: the fat body level, its leathery WINGS SPREAD out to the sides as thick solid shapes, its four little legs hanging below, the thick proboscis pointing forward.", ''),
    'foe-giant-eagle': (BIRD, ''), 'beast-hawk': (BIRD, ''), 'beast-owl': (BIRD, ''), 'beast-raven': (BIRD, ''),
    'foe-giant-bat': ("FLYING, seen in mid-air: the furry body level, its leathery bat WINGS SPREAD WIDE (a clear V from the front), each wing ONE thick solid shape with thick finger-ribs (never a thin membrane), the clawed feet tucked behind.", ''),
    'foe-angel': (HOVER, 'It still holds its sword, now raised in both hands in front of it, the blade pointing up; the robe hangs straight below, bare feet showing under it.'),
    'foe-harpy': (HOVER, 'Its arms ARE its wings. The big taloned bird legs hang below, the talons open.'),
    'foe-gargoyle': (HOVER, 'Its stone wings spread like stone slabs; its clawed hands held out in front, ready to grab.'),
    'foe-imp': (HOVER, 'The barbed tail hanging below it in a loose curl.'),
    'foe-pixie': (HOVER, 'Its butterfly wings spread out to both sides as two thick solid opaque cream-and-ochre shapes; it still holds its thorn sword in the right hand.'),
    'foe-succubus': (HOVER, 'Her bat wings spread wide behind her; her hands empty, held out a little to her sides; the tail hanging below.'),
    'foe-mephit': (HOVER, 'Its little stone bat wings spread wide; the tail hanging below.'),
    'foe-homunculus': (HOVER, 'It still holds its big brass key against its chest with both hands.'),
    'foe-kobold-winged': (HOVER, 'It still holds its big round rock above its head in both hands, ready to drop it; the tail hanging straight down below.'),
    'foe-vulture-demon': (HOVER, 'The bird legs with big clawed feet hang below; the long arms with talons held out in front.'),
}
SAME = ("The supplied image is THIS SAME CREATURE'S OWN STANDING FIGURE, already made in this set. Make a second figure of the SAME individual: "
        "the SAME painting style and paint scheme, the same colours and markings, the same head, horns, face and proportions, the same chunkiness "
        "and level of detail, the same lighting and the same flat blue background. Only the POSE changes: now it is FLYING.")
POSE_TAIL = ("\nCOMPACT for a tabletop piece: the wingspan about one and a half times the body's length, the wing tips not stretched to the image edges."
             "\nNO BASE: no base, no ground disc, no plinth, no flight stand, no rod, no cloud, no rock, no perch, no patch of ground under it. It floats "
             "on the plain background touching nothing. No cast shadow and no dark blob under it.")
PRESENT = ("\n\nPresentation for image-to-3D: exactly one complete figure, centered, the WHOLE creature inside the frame including both wing tips "
           "and the tail tip, seen in a three-quarter FRONT view (turned about 30 degrees, face clearly visible) from somewhat ABOVE (about 25 degrees "
           "down), so the spread wings and the body are both clearly seen. Generous clear space around every edge, perfectly uniform solid "
           "chroma-blue background, no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts. The blue background "
           "is a removable mask and must not reflect blue light onto the figure.")


def build():
    A, S = spec(), standing()
    out = []
    for i in FLIERS:
        a, s = A[i], S[i]
        p = a['prompt']
        style = p[p.index('Geometry:'):p.index('Pose:')].strip()
        design = p.split('Specific design:')[-1].strip()
        pose, extra = D[i]
        prompt = (f"Create a new single asset in the Turnip Works house style (heroic hand-painted): a painted tabletop miniature FIGURE of {s['name'].lower()}, FLYING.\n\n"
                  f"{SAME}\n\n{style}\n\nPose: {pose} {extra}{POSE_TAIL}{PRESENT}\n\nThe creature (as it was described for its standing figure; "
                  f"ignore what that says about folded wings, standing, sitting or feet on the ground): {design}")
        out.append({'id': i, 'name': s['name'], 'group': s['group'], 'prompt': prompt, 'refs': [str(SET / 'inputs' / f'{i}.jpg')],
                    'gate': {'creature': s['name'], 'standing_blind': (s.get('gemini') or {}).get('blind')}})
    (HERE / 'assets.json').write_text(json.dumps({'assets': out}, indent=1) + '\n')
    print(len(out), 'specs')


if __name__ == '__main__':
    build()
