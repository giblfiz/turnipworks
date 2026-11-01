#!/usr/bin/env python3
"""Round 3 (Harry 2026-10-29: "let's get those new icons to match the charcoal ones we use everywhere else"): every ring
command audit.py found with no painting. Writes plan-round3.json (pictures to paint) and aliases-round3.json (commands
that take an existing painting, the 10-15 sharing rule: never two pictures side by side in one arc).

Prompt templates are the 10-15 ones (generic, condition, roof material), with ONE change: instead of "text-only, no
references" the generation is given three of our own charcoal paintings as STYLE references (10-15's own method for
its upright repair), and the prompt says so.
"""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent

GROUND = {'charcoal': 'Centered on a dark charcoal circular ground, quiet thin slate rim.',
          'parchment': 'Centered on a warm pale parchment circular ground, quiet thin antique brass rim; ivory shapes instead dark slate for strong contrast.'}
REF = ("Style reference: the attached images are our own earlier Turnip Works ring icons from this same set; match their "
       "circular ground, rim, painted brushwork, bevels, lighting and palette exactly, as if painted by the same artist in the "
       "same sitting. Do not copy their subjects. No third-party references.")
def generic(m, s):
    return (f"Use case: stylized-concept. Paint exactly ONE original Turnip Works fantasy tabletop UI pictogram: {m} Heroic hand-painted "
            f"style D: chunky miniature-safe forms, broad soft bevels, matte painted gradients, restrained brushwork, no glossy plastic. "
            f"{GROUND[s]} Straight-on circular badge, subject fills 80 percent of the disc, outer disc fills 94 percent of square canvas. "
            f"Light from upper left. Palette: warm ochre wood, muted teal, ivory, slate, red only for danger or pin. Must read at 31 pixels: "
            f"extremely simple silhouette, thick features, generous negative space, no tiny detail. Transparent outside the circle, preserve "
            f"actual alpha. No text, lettering, numbers, watermark, decorative flourishes, extra symbols, or scene. {REF}")
def cond(m, s, word, key):
    g = ('Center on a dark charcoal circular ground with a quiet thin slate rim.' if s == 'charcoal' else
         'Center on a pale warm parchment circular ground with a quiet thin antique brass rim; use dark outlines for strong contrast.')
    return (f"Use case: stylized-concept. Paint exactly ONE original Turnip Works tabletop condition pictogram for {word}: {m} Dominant "
            f"subject colour key: {key}; keep this colour strongly visible, not just a tiny accent. Heroic hand-painted style D, chunky matte "
            f"painted forms, broad soft bevels, restrained brushwork. {g} Upper-left light. Straight-on circular badge; outer circle fills 94 "
            f"percent of square canvas, pictogram fills 80 percent of disc. Readable at31px and smaller: bold silhouette, thick features, "
            f"generous negative space, absolutely no tiny detail. Native transparent alpha outside the circle. No text, lettering, numbers, "
            f"watermark, decorative flourishes or extra scene. Our own design, no trademarked game iconography. {REF}")
def roofopt(m, s, what, key):
    g = ('Centered on a dark charcoal circular ground with quiet thin slate rim.' if s == 'charcoal' else
         'Centered on a warm pale parchment circular ground with quiet thin antique brass rim; dark outlines for strong contrast.')
    return (f"Use case: stylized-concept. Paint exactly ONE original Turnip Works fantasy tabletop {what} option pictogram: {m} Dominant "
            f"colour: {key}. Roof only, no whole house, no walls, no decorative architecture. Heroic hand-painted style D: chunky "
            f"miniature-safe forms, broad soft bevels, matte painted gradients and restrained brushwork. {g} Upper-left light. Straight-on "
            f"circular badge; subject fills80percent of disc; outer disc fills94percent of square canvas. Must read at31px: thick forms, "
            f"simple countable rows, broad negative space. Distinguish this option from sibling options by shape and structure, not only "
            f"colour. Native transparent alpha outside circle. No text, lettering, numbers, watermark, extra symbols, tiny detailing or "
            f"scene. {REF}")

# (picture id, actions, category, template, metaphor, extra)
P = []
def add(pid, actions, cat, tpl, met, *extra): P.append((pid, actions, cat, tpl, met, extra))
# ---- pawns
add('pawn.eyes', ['pawn.eyes'], 'pawn', 'generic', "One big muted-teal pawn silhouette whose round head holds ONE large open ivory eye with a dark teal iris, looking straight out at the viewer: see through this pawn's eyes.")
add('pawn.choose', ['pawn.choose'], 'pawn', 'generic', "One stout muted-teal pawn standing on its round base with ONE large bold ivory checkmark floating at its upper right: choose this pawn as yours.")
add('hand.move', ['hand.move'], 'object', 'generic', "One upright ochre wooden crate at the center with FOUR thick short ivory arrows pointing outward from it, up, down, left and right: move it anywhere.")
# ---- conditions (the 10-15 colour keys stay unique: pearl, pink, violet, burnt-orange, cyan, acid-green, earth-brown, crimson, yellow, indigo, mint)
add('pawn.cond.paralyzed', ['pawn.cond.paralyzed'], 'cond', 'cond', "A close-up cartoon human head and shoulders in steel blue, stiff and frozen with wide fixed staring eyes, wrapped by TWO broad bright electric-blue lightning zigzags. Bold dark outlines, saturated colour, floating alone, no ground.", 'paralyzed', 'electric blue on steel grey')
add('pawn.cond.incapacitated', ['pawn.cond.incapacitated'], 'cond', 'cond', "TWO limp open cartoon hands in ash grey hanging straight down side by side, palms empty and fingers slack, in front of ONE broad thick dark-red X: can take no actions. Bold dark outlines, chunky shapes, floating alone, no ground.", 'incapacitated', 'ash grey')
add('pawn.cond.dead', ['pawn.cond.dead'], 'cond', 'cond', "ONE chunky rounded-top tombstone of pale blue-grey stone with ONE broad deep-black cross carved on its face, floating alone with no ground, no dirt and no grass. Bold dark outlines, simple cartoon shape.", 'dead', 'cold stone grey and black')
add('pawn.cond.concentrating', ['pawn.cond.concentrating'], 'cond', 'cond', "TWO cupped ivory cartoon hands holding up ONE big glowing sky-blue magic orb with a bright white core between them, three short sky-blue sparks around the orb: holding a spell. No face, no head. Bold dark outlines, chunky shapes, floating alone.", 'concentrating', 'glowing sky blue')
add('pawn.cond.exhaustion.up', ['pawn.cond.exhaustion.up'], 'cond', 'cond', "A tired sagging dusty-ochre human head with heavy half-shut eyelids and one large sweat drop, beside ONE bold thick dark-red PLUS sign at its right: more exhausted.", 'exhaustion (one level more)', 'dusty ochre with a dark red plus')
add('pawn.cond.exhaustion.down', ['pawn.cond.exhaustion.down'], 'cond', 'cond', "A tired sagging dusty-ochre human head with heavy half-shut eyelids and one large sweat drop, beside ONE bold thick mint-green MINUS sign at its right: less exhausted, rested.", 'exhaustion (one level less)', 'dusty ochre with a mint green minus')
add('pawn.cond.other.', [f'pawn.cond.other.{i}' for i in range(6)], 'cond', 'cond', "One blank ivory paper luggage tag on a short dark string, with ONE broad teal checkmark painted on it: a custom condition that is set.", 'a custom condition the table typed', 'ivory and teal')
add('pawn.cond.other', ['pawn.cond.other'], 'cond', 'cond', "ONE stout ochre feather quill pen writing one broad ivory stroke on a small blank parchment slip, with ONE small bold teal PLUS sign at upper right: write in a new condition. No tag, no string.", 'other (type a new condition)', 'ochre quill and teal')
# ---- holes and hills
add('hole.wider', ['hole.wider'], 'ground', 'generic', "A round dark pit hole in grey stone ground seen from slightly above, with TWO thick ivory arrows on its left and right rims pointing OUTWARD, away from the hole: make it wider.")
add('hole.narrower', ['hole.narrower'], 'ground', 'generic', "A round dark pit hole in grey stone ground seen from slightly above, with TWO thick ivory arrows on its left and right pointing INWARD toward the hole: make it narrower.")
add('room.hill.height.', ['room.hill.height.'], 'ground', 'generic', "One rounded green grassy hill mound with ONE thick ivory vertical double-headed arrow standing beside it at the right: hill height.")
add('room.hill.height.raise', ['room.hill.height.raise'], 'ground', 'generic', "One rounded green grassy hill mound with ONE large thick ivory UPWARD arrow rising straight above its top: raise the hill.")
add('room.hill.height.lower', ['room.hill.height.lower'], 'ground', 'generic', "One low flattened green grassy hill mound with ONE large thick ivory DOWNWARD arrow pressing straight down on its top: lower the hill.")
add('room.hill.height.10', ['room.hill.height.10'], 'ground', 'generic', "ONE single low grass-topped earth terrace step, a broad flat green top over one band of brown earth: a hill one storey high.")
add('room.hill.height.20', ['room.hill.height.20'], 'ground', 'generic', "TWO stacked grass-topped earth terrace steps, a smaller one on top of a broader one, each a flat green top over a band of brown earth: a hill two storeys high.")
add('room.hill.cliff', ['room.hill.cliff'], 'ground', 'generic', "One green hill whose LEFT side drops as a steep grey rock cliff face and whose RIGHT side is a soft rounded grass slope: rock sides or grass banks.")
# ---- roof materials (siblings of the 10-15 thatch / tile / slate / shingle / flat / auto)
add('roof.style.marble', ['roof.style.marble', 'building.roof.marble'], 'roof', 'roofmat', "One pitched roof wedge clad in a few very LARGE smooth polished BRIGHT WHITE MARBLE panels with bold wavy grey veins running across them; flat gleaming panels with fine straight joints, NOT overlapping shingles or slates, NOT grey or blue.", 'roof material', 'white marble')
add('roof.style.deck', ['roof.style.deck', 'building.roof.deck'], 'roof', 'roofmat', "One FLAT level roof surface seen from slightly above, made of FIVE broad parallel warm-brown wooden deck planks with dark gaps between them, a low timber lip at the front.", 'roof material', 'warm brown wood planks')
add('roof.style.flagstone', ['roof.style.flagstone', 'building.roof.flagstone'], 'roof', 'roofmat', "One FLAT level roof surface seen from slightly above, paved with five large IRREGULAR grey-beige flagstones separated by thick dark joints.", 'roof material', 'grey-beige flagstone')
add('roof.style.lead', ['roof.style.lead', 'building.roof.lead'], 'roof', 'roofmat', "One FLAT level roof surface seen from slightly above, covered in dull dark blue-grey LEAD SHEETS with three thick raised rolled seams running front to back.", 'roof material', 'dull blue-grey lead')
add('roof.style.turf', ['roof.style.turf', 'building.roof.turf'], 'roof', 'roofmat', "One FLAT level roof surface seen from slightly above, covered in a thick layer of bright GREEN GRASS TURF with a visible band of brown soil along its front edge.", 'roof material', 'green grass turf')
add('roof.style.plaster', ['roof.style.plaster', 'building.roof.plaster'], 'roof', 'roofmat', "One FLAT level roof surface seen from slightly above, of smooth bright chalky WHITE LIMEWASH plaster with a soft rounded white parapet lip.", 'roof material', 'bright chalk white')
# ---- roof edges and shapes
add('roof.edge.', ['roof.edge.'], 'roof', 'roofmat', "One flat grey stone roof slab seen from slightly above whose whole outer rim is a bold raised OCHRE border: the roof's edge.", 'roof edge', 'grey slab, ochre rim')
add('roof.edge.battlements', ['roof.edge.battlements', 'roof.battlements'], 'roof', 'roofmat', "One flat stone roof edge crowned by THREE broad square stone CRENELLATIONS with clear square gaps between them: battlements.", 'roof edge', 'pale grey stone')
add('roof.edge.parapet', ['roof.edge.parapet'], 'roof', 'roofmat', "One flat roof edge with ONE low SOLID plain stone parapet wall along it, a continuous straight top with no gaps.", 'roof edge', 'warm sandstone')
add('roof.edge.railing', ['roof.edge.railing'], 'roof', 'roofmat', "One flat roof edge with a simple warm-brown TIMBER RAILING along it: four short square posts and one thick top rail.", 'roof edge', 'warm brown timber')
add('roof.edge.none', ['roof.edge.none'], 'roof', 'roofmat', "One plain flat grey roof slab seen from slightly above with a crisp BARE edge and nothing at all standing on it.", 'roof edge', 'plain grey')
add('roof.edge.auto', ['roof.edge.auto'], 'roof', 'roofmat', "One flat grey roof slab edge with ONE large ivory five-tooth cog centered on it: the edge the building chooses.", 'roof edge', 'grey with ivory cog')
add('roof.turrets', ['roof.turrets'], 'roof', 'roofmat', "One flat roof corner with ONE small round stone corner TURRET rising from it, capped by a pointed teal conical roof.", 'roof edge', 'grey stone and teal')
add('roof.shape.', ['roof.shape.', 'building.roofShape.'], 'roof', 'roofmat', "TWO small roof silhouettes side by side: a steep pointed teal GABLE roof at left and a low flat grey slab roof at right.", 'roof shape', 'teal and grey')
add('roof.shape.gable', ['roof.shape.gable', 'building.roofShape.gable'], 'roof', 'roofmat', "One teal tiled GABLE roof seen from the front-left: two sloping sides meet at a ridge and the end is a tall flat TRIANGULAR gable wall facing the viewer.", 'roof shape', 'teal tile')
add('roof.shape.hip', ['roof.shape.hip', 'building.roofShape.hip'], 'roof', 'roofmat', "One teal tiled HIP roof seen from the front-left: FOUR sloping sides, a short ridge on top, the ends slope down too, no triangular gable wall.", 'roof shape', 'teal tile')
add('trim.reset', ['trim.reset'], 'roof', 'generic', "One small red-brick chimney on a short teal roof slope, with ONE broad ivory U-turn arrow curving back down onto it: put it back where it was.")
# ---- share
add('share.export', ['share.export'], 'object', 'generic', "One small ochre wooden crate with its lid off and ONE large thick ivory arrow rising up out of it toward the upper right: export it.")
add('share.link', ['share.link'], 'object', 'generic', "One ivory parchment sheet with ONE large thick teal chain link lying across its lower right corner: a link to share.")

# commands that take an existing painting (10-15 already shares Turn, dice and the eye across arcs the same way)
ALIASES = {'roof.turn': 'edit.rotate', 'trim.remove': 'template.remove',
           'roof.shape.flat': 'roof.style.flat', 'building.roofShape.flat': 'roof.style.flat',
           'roof.shape.auto': 'roof.style.auto', 'building.roofShape.auto': 'roof.style.auto'}
REFS = {'pawn': ['pawn.sheet', 'pawn.give', 'pawn.travel'], 'object': ['edit.rotate', 'thing.replace', 'edit.lift'],
        'cond': ['pawn.cond.stunned', 'pawn.cond.unconscious', 'pawn.cond.poisoned'], 'ground': ['room.height.taller', 'edit.lift', 'room.walls.fieldstone'],
        'roof': ['roof.style.thatch', 'roof.style.flat', 'roof.style.slate']}
BLIND = {'cond': 'Which D&D condition (or condition action) does each icon show?', 'roof': 'Which roof option (material, edge or shape) does each icon offer?'}
pics = []
for pid, actions, cat, tpl, met, extra in P:
    for s in ('charcoal', 'parchment'):
        prompt = generic(met, s) if tpl == 'generic' else cond(met, s, *extra) if tpl == 'cond' else roofopt(met, s, extra[0], extra[1])
        pics.append({'id': pid, 'title': pid, 'actions': actions, 'set': s, 'alt': 0, 'metaphor': met, 'prompt': prompt, 'category': cat,
                     'source': f'experiments/2026-10-29-ring-attack-target/sources/{s}--{pid}.png',
                     'references': [f'tools/spawn-tuner/assets/ui-icons/{s}/{r}.webp' for r in REFS[cat]]})
# ATTACK_TARGET_R3: the landed Attack / Target prompts again, with references, as *.r3 comparisons (compare_at.py)
for x in json.load(open(HERE / 'plan-additions.json'))['pictures']:
    pics.append({**x, 'id': x['id'] + '.r3', 'actions': [], 'category': 'pawn',
                 'prompt': x['prompt'].replace('Text-only original design; no third-party references.', REF),
                 'source': f"experiments/2026-10-29-ring-attack-target/sources/{x['set']}--{x['id']}.r3.png",
                 'references': [f"tools/spawn-tuner/assets/ui-icons/{x['set']}/{r}.webp" for r in ('pawn.damage', 'pawn.give', 'pawn.sheet')]})
json.dump({'pictures': pics}, open(HERE / 'plan-round3.json', 'w'), indent=1)
json.dump(ALIASES, open(HERE / 'aliases-round3.json', 'w'), indent=1)
print(len(P), 'pictures x 2 sets =', len(pics), '; aliases', len(ALIASES))
