#!/usr/bin/env python3
"""A railing for the hole a stair cuts in a STONE building's floor (2026-10-06; Harry: "I think we do need them, but
just as a normal kind of furniture that gets placed by default"). The library had the inn's timber railing (good for
timber buildings) and the mansion's marble balustrade (Gemini, blind, in a castle room: "squashed and chunky ... heavy
and low"; the pawn behind it "difficult to see clearly"). This writes assets.json for ONE piece, `railing-iron`: a plain
wrought-iron section, 5 ft long and 3 ft high, a square post at each end, painted with the crypt's iron gate as reference.
    python3 build_spec.py
    python3 ../2026-10-05-log-cabin/gen.py . --workers 1   # free Codex image route + gates
"""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent
MAIN = Path("<repo>")  # (reference plates are git-ignored images: they live in the main tree)
REF = str(MAIN / "experiments/2026-10-05-castle-crypt-mansion/crypt/inputs/crypt-gate-iron.jpg")
STYLE = """Geometry: stout, miniature-compatible proportions; thick functional parts; broad soft bevels; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every bar thick enough to reconstruct as 3D geometry (each upright bar about as thick as a thumb at this scale, never hair-thin).
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Avoid: multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, black outlines, hard cel-shading bands, comic inking, flat vector art, hair-thin fragile parts, text, logos, emblems, shields, crests.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, perfectly uniform solid chroma-blue background, no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. The blue background is a removable mask and must not reflect blue light onto the asset; the blue must show THROUGH the gaps between the bars."""
MATCH = """The supplied image is an existing wrought-iron gate from the same world: dark, slightly blue-grey forged iron with soft painted highlights. The new piece is a LOW RAILING made by the same smith in the same dark forged iron and the same painting style. It is NOT a gate and NOT a copy of the supplied image."""
DESIGN = """One straight section of low wrought-iron railing, the kind that guards the open edge of a stairwell: about 5 ft long and 3 ft high, so it is clearly LONGER than it is tall (about 5 : 3), and thin (a few inches deep). A square iron post with a small plain cap at each end; a flat top rail and a bottom rail a hand's width above the ground running between the posts; between the rails seven or eight plain square upright bars, evenly spaced, with clear open gaps between them wider than the bars. One small forged collar on each bar is the only ornament. No panel, no mesh, no scrollwork filling the gaps: you can see straight through it."""
TAIL = """ Nothing else: NO floor, NO ground, NO base slab or platform under it, NO wall, NO stairs, NO hinges, NO latch, NO spikes or spear points on top, NO corner return. It stands directly on the feet of its two end posts. Keep the WHOLE object well inside the frame with a generous margin."""
PROMPT = f"Create a new single asset in the Turnip Works house style (heroic hand-painted): a straight section of low wrought-iron stair railing.\n\n{MATCH}\n\n{STYLE}\n\nSpecific design: {DESIGN}{TAIL}\n"
assets = [
  {"id": "railing-iron", "object": "railing-iron", "family": "", "source": "generate", "lane": "3d", "generation": "kit",
   "subject": "a straight section of low wrought-iron stair railing",
   "prompt": PROMPT, "refs": [REF], "gate_refs": [REF],
   "gate": {"desc": "one straight low section of dark wrought-iron railing: two end posts, a top and a bottom rail, plain upright bars with open gaps between them",
            "must": ["one single straight railing section, clearly longer than it is tall", "open gaps between the upright bars (the background shows through)",
                     "a post at each end", "dark forged iron, in the painting style of the REFERENCE gate (a low railing instead of a tall gate is the intended difference)"],
            "must_not": ["a tall gate or door, hinges or a latch", "a solid panel, a mesh or scrollwork closing the gaps", "a floor, base slab or platform", "a corner or an L-shaped return", "spikes or spear points along the top"]}},
]
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets: (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(assets), "assets")
