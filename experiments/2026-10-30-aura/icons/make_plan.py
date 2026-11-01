#!/usr/bin/env python3
"""The aura's ring icons (2026-10-30): the 10-15 prompt templates (experiments/2026-10-29-ring-attack-target plan-round3.json),
only the metaphor differs. Writes plan.json: 10 pictures x 2 sets (charcoal, parchment).

  Aura ▸ (the list)   pawn.aura.          Aura up   pawn.aura.up      Aura down   pawn.aura.down     Aura off   pawn.aura.off
  the six colours     pawn.aura.color.<c> (gold first; the other five are EDITS of the accepted gold painting: same wisp,
                      only its hue changed, so the six read as one family that differs only in colour)
"""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent; REPO = HERE.parents[2]
PAWN = ("One muted-teal pawn silhouette (the house pawn: round head, bell body) ")
METAPHORS = {
    'pawn.aura.': PAWN + "standing inside ONE tall soft column of warm golden light that rises from a glowing ring at its feet to well above its head, three short golden sparks drifting up: a pawn's aura.",
    'pawn.aura.up': PAWN + "wreathed in tall rising tongues of warm golden flame-like light reaching above its head, beside ONE bold thick ivory UP arrow at its right: a brighter, stronger aura.",
    'pawn.aura.down': PAWN + "with only a low faint golden glow round its feet, beside ONE bold thick ivory DOWN arrow at its right: a dimmer, weaker aura.",
    'pawn.aura.off': PAWN + "with no light at all, ONE thin grey curl of smoke rising from a dark snuffed ring at its feet: the aura put out.",
}
COLOURS = [('gold', 'warm glowing gold'), ('silver', 'cool glowing silver-white'), ('blue', 'glowing sky blue'), ('green', 'glowing emerald green'), ('red', 'glowing fiery crimson red'), ('violet', 'glowing violet purple')]
WISP = "ONE big soft teardrop-shaped wisp of {c} magical flame-light rising upward, a bright pale core, two tiny sparks of the same colour beside it, floating alone: an aura of this colour."
for k, c in COLOURS: METAPHORS[f'pawn.aura.color.{k}'] = WISP.format(c=c)
KEY = {f'pawn.aura.color.{k}': c for k, c in COLOURS}
GROUND = {'charcoal': 'Centered on a dark charcoal circular ground, quiet thin slate rim.',
          'parchment': 'Centered on a warm pale parchment circular ground, quiet thin antique brass rim; ivory shapes instead dark slate for strong contrast.'}
REFS = {'pawn': ['pawn.sheet', 'pawn.give', 'pawn.eyes'], 'cond': ['pawn.cond.concentrating', 'thing.light', 'pawn.cond.stunned']}
def prompt(id, s):
    m = METAPHORS[id]
    if id.startswith('pawn.aura.color.'):
        return (f"Use case: stylized-concept. Paint exactly ONE original Turnip Works tabletop UI pictogram: {m} Dominant subject colour key: {KEY[id]}; "
                f"the whole wisp is this colour, strongly visible, not just an accent. Heroic hand-painted style D, chunky matte painted forms, broad soft bevels, "
                f"restrained brushwork. {GROUND[s]} Upper-left light. Straight-on circular badge; outer circle fills 94 percent of square canvas, pictogram fills "
                f"80 percent of disc. Readable at 31px and smaller: bold silhouette, thick features, generous negative space, absolutely no tiny detail. Native "
                f"transparent alpha outside the circle. No text, lettering, numbers, watermark, decorative flourishes or extra scene. Our own design, no trademarked "
                f"game iconography. Style reference: the attached images are our own earlier Turnip Works ring icons from this same set; match their circular ground, "
                f"rim, painted brushwork, bevels, lighting and palette exactly, as if painted by the same artist in the same sitting. Do not copy their subjects. No third-party references.")
    return (f"Use case: stylized-concept. Paint exactly ONE original Turnip Works fantasy tabletop UI pictogram: {m} Heroic hand-painted style D: chunky "
            f"miniature-safe forms, broad soft bevels, matte painted gradients, restrained brushwork, no glossy plastic. {GROUND[s]} Straight-on circular badge, "
            f"subject fills 80 percent of the disc, outer disc fills 94 percent of square canvas. Light from upper left. Palette: warm ochre wood, muted teal, ivory, "
            f"slate, warm gold light. Must read at 31 pixels: extremely simple silhouette, thick features, generous negative space, no tiny detail. Transparent outside "
            f"the circle, preserve actual alpha. No text, lettering, numbers, watermark, decorative flourishes, extra symbols, or scene. Style reference: the attached "
            f"images are our own earlier Turnip Works ring icons from this same set; match their circular ground, rim, painted brushwork, bevels, lighting and palette "
            f"exactly, as if painted by the same artist in the same sitting. Do not copy their subjects. No third-party references.")
pics = []
for s in ('charcoal', 'parchment'):
    for id in METAPHORS:
        cat = 'cond' if id.startswith('pawn.aura.color.') else 'pawn'
        pics.append({'id': id, 'title': id, 'actions': [id], 'set': s, 'alt': 0, 'metaphor': METAPHORS[id], 'prompt': prompt(id, s), 'category': cat,
                     'source': f'experiments/2026-10-30-aura/icons/sources/{s}--{id}.png',
                     'references': [f'tools/spawn-tuner/assets/ui-icons/{s}/{r}.webp' for r in REFS[cat]]})
(HERE / 'plan.json').write_text(json.dumps({'pictures': pics}, indent=1))
print(len(pics), 'pictures')
