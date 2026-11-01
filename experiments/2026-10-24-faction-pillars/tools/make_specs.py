#!/usr/bin/env python3
"""Write assets.json: one flavor-pillar per faction (13) and the 9 missing flavor-buttress pieces. Text-only prompts in the
factions-01 house template; palettes are each faction's factions-01 corbel palette so the new pieces join their family."""
import json
from pathlib import Path
B = Path(__file__).resolve().parent.parent
PAL = {'sun': 'warm golden ochre and ivory', 'moon': 'silver and muted midnight blue', 'devils': 'brick red and dark charcoal',
       'spiders': 'deep plum and pale stone', 'dragons': 'burnt copper and deep crimson', 'skulls': 'ivory bone and charcoal',
       'tentacles': 'violet and pale mauve', 'nature': 'moss green and warm oak brown', 'sword-shield': 'silver and royal blue',
       'death': 'warm ivory and ink black', 'scales-coin': 'antique gold and deep emerald', 'forge-hammer': 'iron grey and ember orange',
       'sea-storm': 'turquoise and pearl white'}
PILLAR = {  # motif, short gate name
 'dragons': ('A single thick-bodied dragon coils in a spiral twice around the shaft, its scaly body nearly as thick as the shaft, clawed forefeet gripping the capital and its blunt horned head resting on the top edge of the capital looking outward; small folded wings lie flat against the shaft', 'a dragon coiled around it'),
 'sun': ('The capital is a large radiant round SUN FACE disc with eight short thick triangular rays, repeated on all four sides; the shaft is fluted with thick vertical grooves', 'a radiant sun face'),
 'moon': ('The capital is a broad silver CRESCENT MOON with a calm face, its two thick horns pointing up under the flat top slab; the shaft is carved with a few thick five-pointed stars', 'a crescent moon'),
 'devils': ('The shaft is ridged and spiralled like one great horn; the capital is four broad HORNED DEVIL HEADS facing outward, each with two short thick horns', 'horned devil heads'),
 'spiders': ('A crouched SPIDER with a large oval abdomen clings to the upper shaft, its eight stout bent legs wrapping around the column; a thick carved web spreads over the capital', 'a spider clinging to it'),
 'skulls': ('The capital is a ring of four large human SKULLS facing outward, large dark eye sockets and blocky teeth; the shaft is wound with thick carved crossed long bones', 'skulls'),
 'tentacles': ('Three thick OCTOPUS ARMS with large round suckers spiral up around the shaft from the base and curl over the edge of the capital', 'octopus tentacles wrapped round it'),
 'nature': ('The shaft is a living OAK TRUNK with bark, a calm green-man face carved near the top, and the capital a thick crown of broad oak leaves', 'an oak trunk with leaves (a green man)'),
 'sword-shield': ('A large HEATER SHIELD is carved on the front and back of the shaft, each over a broad vertical SWORD whose pommel meets the capital; the capital is crenellated like a castle tower', 'a sword and shield'),
 'death': ('A peaceful RAVEN with folded wings perches on top of the capital; the shaft carries a large HOURGLASS in relief and a thick carved shroud draped from the capital', 'a raven and an hourglass'),
 'scales-coin': ('The shaft is carved as a tall stack of broad thick COINS; on top of the capital stands a solid pair of balanced SCALES with broad deep pans on thick arms, no chains', 'balanced scales and coins'),
 'forge-hammer': ('The shaft is banded with thick riveted iron hoops, the capital is shaped like a broad ANVIL, and a large square-headed smith HAMMER is carved in relief down the front of the shaft', 'an anvil and a smith hammer'),
 'sea-storm': ('The shaft is carved as rising curling OCEAN WAVES wrapping around it, a stout three-pronged TRIDENT is carved in relief up the front with its prongs on the capital, and the capital is a curling wave crest', 'ocean waves and a trident'),
}
BUTTRESS = {
 'dragons': ('the arch rib is carved as one thick scaly DRAGON TAIL sweeping down onto the footing block; the pier front carries a large DRAGON HEAD in high relief with a long blunt snout and short thick horns', 'a dragon head and a dragon tail'),
 'skulls': ('the arch rib is carved as a row of thick VERTEBRAE like a giant spine; the pier front carries one large human SKULL in high relief with large dark eye sockets', 'a skull and a spine'),
 'tentacles': ('the arch rib is one great thick OCTOPUS ARM with large round suckers along its underside, its tip curling onto the footing block; two more curling arms climb the pier front', 'octopus tentacles'),
 'nature': ('the arch rib is a thick gnarled OAK BRANCH with broad leaves along it; the pier front carries a calm GREEN-MAN face framed by oak leaves', 'an oak branch and a green man'),
 'sword-shield': ('the arch rib is plain and heavy, edged with a band of small heater shields; the pier front carries a large HEATER SHIELD over a broad vertical SWORD in high relief', 'a sword and shield'),
 'death': ('the arch rib is carved as one long folded RAVEN WING of thick feathers; the pier front carries a large HOURGLASS in relief, and a raven with folded wings perches on the pier top', 'a raven and an hourglass'),
 'scales-coin': ('the arch rib is carved as a long row of broad COINS standing on edge; the pier front carries balanced SCALES above three broad coins in high relief, solid pans, no chains', 'scales and coins'),
 'forge-hammer': ('the arch rib is carved as the long thick handle of a giant smith HAMMER whose square head rests on the footing block; the pier front carries an ANVIL in high relief', 'a hammer and an anvil'),
 'sea-storm': ('the arch rib is carved as a great curling OCEAN WAVE breaking downward onto the footing block; the pier front carries a stout three-pronged TRIDENT in high relief', 'an ocean wave and a trident'),
}
HOUSE = 'Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. Exactly one complete object centered with generous clear margin, no scene or additional objects, no text, no logos, no specific published mythology or recognizable product design.'
TAIL = 'Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, delicate horns, thin spikes or isolated floating components.'
def pillar(f):
    motif, short = PILLAR[f]
    return dict(id=f'flavor-pillar--{f}-fct', object='flavor-pillar', shape=f, lane='3d', route='trellis', size=[30, 30, 120], aspect='portrait',
        prompt=('Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One free-standing architectural PILLAR (a column that holds up a ceiling), not a statue: '
                'a square stepped plinth base, one thick shaft, and a broad square capital with a completely FLAT TOP. Proportions 30 inches across and 120 inches tall: a tall column about four times as tall as it is wide. '
                f'{motif}. The motif belongs to the column itself and reads from every side and from above. Palette: {PAL[f]}. {HOUSE} '
                'Three-quarter view from ABOVE, camera elevation 35 degrees, so the flat top of the capital and the whole shaft down to the base are visible; the whole column fits in the frame. ' + TAIL),
        gate=dict(desc=f'one free-standing stone pillar (column) with a base and a capital, carved with {short}',
                  must=['a tall free-standing column or pillar with a base and a capital', f'the motif: {short}'],
                  must_not=['a statue or idol with no column', 'a wall, arch or doorway', 'several objects', 'thin spindly parts']))
def buttress(f):
    motif, short = BUTTRESS[f]
    return dict(id=f'flavor-buttress--{f}-fct', object='flavor-buttress', shape=f, lane='3d', route='trellis', size=[30, 96, 108], aspect='landscape',
        prompt=('Use case: stylized-concept. Asset for Turnip Works, heroic hand-painted miniature game art. One architectural FLYING BUTTRESS section meant to stand against a wall, seen from the side so the whole quarter arch shows: '
                'on the right a tall upright stone pier on a moulded foot: 9 ft tall, 3 ft along the arch and only 2.5 ft thick, the TALLEST part of the piece; from the top of the pier ONE thick half arch springs out to the left and sweeps down in a quarter circle to a stout low footing block about 6 ft away, so the piece is taller than it is long, leaving a clear open space under the arch that you can see through. The whole piece is one flat-sided slab 2.5 ft thick: pier, arch and footing share the same two flat side faces, and nothing projects more than a few inches from them. It stands alone: no wall, no panels, slats or backing behind it, no second leg. '
                f'Carving, in deep relief on the flat side faces and along the arch: {motif}. Everything is very thick and blocky (the arch rib at least 1 ft thick). Palette: {PAL[f]}. {HOUSE} '
                'Seen mostly from the side (the camera 20 degrees round from square-on to the side face, elevation 20 degrees), so the full profile of pier and arch shows. ' + TAIL),
        gate=dict(desc=f'one stone flying buttress seen from the side: a tall pier and a thick arch sweeping down from it to a low block, carved with {short}',
                  must=['a tall stone pier with a thick curved arch leaning from its top down to a lower block', 'open space under the arch', f'the motif: {short}'],
                  must_not=['a whole creature statue', 'a complete round arch between two equal pillars', 'thin spindly parts']))
order = ['dragons'] + [f for f in PAL if f != 'dragons']
assets = [pillar(f) for f in order]
assets[1:1] = [buttress('dragons')]
assets += [buttress(f) for f in order[1:] if f in BUTTRESS]
(B / 'assets.json').write_text(json.dumps(dict(batch='faction-pillars-01', note='see make_specs.py', assets=assets), indent=1) + '\n')
print(len(assets), [a['id'] for a in assets][:4])
