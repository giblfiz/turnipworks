#!/usr/bin/env python3
"""A second straight plank wall (2026-10-05). With the handle wall retired and the stacked-log wall moved to its own
family, rough-timber had ONE straight piece (wall-straight--rough-timber--s2), so a long plank wall repeated it.
This writes assets.json for one sibling, wall-straight--rough-timber--s4, painted from the s2 plate as reference.
    python3 build_spec.py
    python3 ../2026-10-05-log-cabin/gen.py . --workers 1   # free Codex image route + gates
"""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
S2 = str(ROOT / "experiments/2026-10-01-walls/inputs/wall-straight--rough-timber--s2.jpg")
STYLE = """Geometry: stout, miniature-compatible proportions; thick functional parts; broad soft bevels; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Avoid: ANY handle, ring pull, lever, knob, peg, hook, bracket, strap, hinge, latch, shelf or other fitting on or sticking out of the wall; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above (the same camera as the supplied image), clear space around every edge, perfectly uniform solid chroma-blue background, no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. The blue background is a removable mask and must not reflect blue light onto the asset."""
MATCH = """The supplied image is the existing plain wall section of this same building: a wall of VERTICAL rough-sawn planks in honey-brown wood with a timber brace. The new piece is the NEXT section of the same wall, standing beside it: the SAME vertical rough-sawn planks, the same board width and number of boards, the same honey-brown wood colour, the same overall size, proportions (a tall narrow upright panel about 5 ft wide x 9 ft tall x 1 ft thick, almost twice as tall as wide), the same thickness, painting style and camera angle. It must NOT be a copy: change the knots, the grain, the nail pattern and the bracing as described below, so the two pieces side by side read as one wall that does not repeat."""
DESIGN = """Vertical rough-sawn planks, honey-brown, with a DIFFERENT brace arrangement from the supplied image: two plain horizontal timber rails (one low, about 2 ft up; one high, about 7 ft up) lying flat against the planks and running the full width, and NO diagonal brace. A few large knots in different places from the supplied image, one plank slightly darker, flat iron nail heads where the rails cross the planks. The rails are thick squared timber, flush and flat, not shelves: NOTHING protrudes from the wall beyond the rails' own thickness. No handles, hooks, pegs, rings, hinges, latches, brackets or fittings of any kind."""
TAIL = """ Nothing else: NO floor, NO ground, NO base slab or platform under it, NO roof, NO corner return, NO door, NO window, NO furniture or decorations attached. Both side edges are clean straight vertical cuts so pieces butt together into a longer wall. It stands directly on its bottom edge with no footing. Keep the WHOLE object well inside the frame with a generous margin."""
PROMPT = f"Create a new single asset in the Turnip Works house style (heroic hand-painted): full-height wall segment of vertical planks with two horizontal rails.\n\n{MATCH}\n\n{STYLE}\n\nSpecific design: {DESIGN}{TAIL}\n"
assets = [
  {"id": "wall-straight--rough-timber--s4", "object": "wall-straight", "family": "rough-timber", "source": "generate", "lane": "3d", "generation": "kit",
   "subject": "full-height wall segment of vertical planks with two horizontal rails",
   "prompt": PROMPT, "refs": [S2], "gate_refs": [S2],
   "gate": {"desc": "one upright wall section of vertical rough-sawn honey-brown planks, braced with plain timber rails, with nothing attached to it",
            "must": ["the wall is built of VERTICAL planks (not horizontal logs or boards)", "one single upright wall section, clearly taller than it is wide",
                     "plank colour, board width and painting style match the REFERENCE wall (a different brace arrangement and different knots are the intended difference)",
                     "both side edges are straight vertical cuts"],
            "must_not": ["a handle, lever, ring, peg, hook, bracket, hinge or any fitting on or sticking out of the wall", "a door or a window", "a floor, base slab, roof or corner return", "a shelf or ledge sticking out"]}},
]
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets: (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(assets), "assets")
