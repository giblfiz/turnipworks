#!/usr/bin/env python3
"""Cave-wall pilot (Harry + Fauna 2026-10-05): a cave's wall is a row of generated ROCK CHUNKS placed along the room's
boundary so that they OVERLAP, not a kit of pieces butted edge to edge. One stone family: grey-brown limestone, damp,
a little moss low down. Writes assets.json for src/plate_gate_batch.py (through gen.py: plates from the FREE Codex
image route). The first accepted plate (cave-wall-plain-a) is the colour and texture reference for all the others.
    python3 build_spec.py
"""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent
STYLE_REF = str(HERE.parents[1] / "style-references/heroic-handpainted-multilevel-dungeon-v1.png")
FIRST = HERE / "inputs/cave-wall-plain-a.jpg"
STYLE = """Geometry: one solid, chunky, fused mass of rock with broad soft shapes: big rounded bulges and blocky facets, a few deep chunky cracks; no gravel, no thin spikes, no fragile parts, nothing hanging in mid-air. Every part thick enough to reconstruct as 3D geometry.
Material: grey-brown limestone cave rock (warm grey with brown and ochre staining), slightly damp, with a little dull green moss only near the bottom. The same rock all over, no other materials.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights, low-frequency surface detail, mostly matte.
Avoid: stalactites or stalagmites as separate spikes, crystals, mushrooms, plants other than a little moss, water, torches, bones, built masonry or bricks, people, animals; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, black outlines, hard cel-shading bands, comic inking, flat vector art, text, logos.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from the front-left and slightly above, so the FRONT face, one SIDE and a little of the TOP are all clearly visible and evenly lit; clear space around every edge; perfectly uniform solid chroma-blue background, no horizon, no sky, no floor plane, no cast shadow, neutral even lighting with no colored light casts and no dark shadowed side, no environment, no additional loose objects. The blue background is a removable mask and must not reflect blue light onto the asset."""
MATCH_FIRST = "The supplied image is only a guide to the Turnip Works house painting style (heroic hand-painted); do not copy its content."
MATCH_REST = "The supplied image is ANOTHER PIECE OF THE SAME SET, already made. The new piece must be the SAME rock: the same grey-brown limestone colours, brightness and saturation, the same amount of moss, the same painting style, the same size of bulges and cracks, the same lighting and the same camera angle, so that the two pieces placed side by side look like one continuous rock wall. It is a DIFFERENT shape, described below; do not copy the reference's silhouette."
TAIL = """ This is a single freestanding piece of terrain, like a wargaming scenery model of a section of cave wall: its underside is perfectly FLAT and it stands directly on the ground. NO base slab, NO plinth, NO floor, NO ground around it. The BACK is rougher and roughly flat (it will be pushed against solid rock and never seen). Keep the WHOLE object well inside the frame with a generous margin."""
def prompt(subject, design, first):
    return f"Create a new single asset in the Turnip Works house style (heroic hand-painted): {subject}.\n\n{MATCH_FIRST if first else MATCH_REST}\n\n{STYLE}\n\nSpecific design: {design}{TAIL}\n"
NOT = ["a separate base slab, plinth, floor or ground under or around the rock", "built masonry, bricks or cut stone blocks", "separate hanging stalactites or thin spikes", "several separate loose rocks instead of one fused mass"]
SAME = "the rock's colour, brightness and painting style are close to the REFERENCE (a different silhouette is intended)"
def A(id, subject, design, desc, must, must_not=(), dims=None):
    first = id == "cave-wall-plain-a"
    ref = STYLE_REF if first else str(FIRST)
    return {"id": id, "object": id, "family": "limestone-cave", "group": "first" if first else "rest", "source": "generate", "lane": "3d", "generation": "kit",
            "subject": subject, "dims_ft": dims, "prompt": prompt(subject, design, first), "refs": [ref], "gate_refs": [] if first else [ref],
            "gate": {"desc": desc, "must": list(must) + ([] if first else [SAME]), "must_not": NOT + list(must_not)}}
WALL = "one tall solid mass of natural grey-brown rock, like a section of cliff or cave wall, taller than it is deep"
assets = [
 A("cave-wall-plain-a", "section of natural cave wall, plain bulging face",
   "A wall-height slab-like mass of natural limestone: about 7 ft wide, 10 ft tall and 3.5 ft deep (a thick upright slab, clearly taller than wide and much wider than deep). The FRONT face bulges irregularly in three or four big rounded swellings with shallow hollows between them and a couple of chunky vertical cracks. The top is an uneven, roughly level broken edge. The two side ends are irregular, rounded rock (not flat cuts).",
   "a tall upright slab-like chunk of natural grey-brown cave rock with an irregular bulging front", [WALL], [], [7, 3.5, 10]),
 A("cave-wall-plain-b", "wide section of natural cave wall, plain bulging face",
   "A wall-height mass of natural limestone, WIDER than the reference: about 8 ft wide, 9 ft tall and 4 ft deep. The front face is made of big overlapping rounded rock bulges stacked like risen dough, with horizontal bedding lines running across it and one deep diagonal crack. The top is uneven and roughly level. Both side ends are rounded rock.",
   "a wide upright chunk of natural grey-brown cave rock with a bulging, layered front", [WALL], [], [8, 4, 9]),
 A("cave-wall-ledge", "section of cave wall with a rock ledge",
   "A wall-height mass of natural limestone about 7 ft wide, 10 ft tall and 4 ft deep. About 3 ft above the ground a chunky natural rock LEDGE (a shelf about 1.5 ft deep and 5 ft long, thick and solid) sticks out from the front face; above the ledge the wall rises nearly vertical with rounded bulges. Moss on the ledge's top.",
   "a tall chunk of natural cave rock wall with a thick rock ledge or shelf sticking out of its front, low down", [WALL, "a clear horizontal ledge or shelf on the front face"], [], [7, 4, 10]),
 A("cave-wall-crack", "section of cave wall with a deep crack and niche",
   "A wall-height mass of natural limestone about 6 ft wide, 10 ft tall and 3.5 ft deep. A deep, dark vertical CRACK runs up the middle of the front face from the ground, widening at the bottom into a shallow alcove or niche about 2 ft wide and 4 ft tall (a hollow in the rock, closed at the back: you cannot see through it). Bulging rock on both sides of the crack.",
   "a tall chunk of natural cave rock wall with a deep vertical crack that widens into a small niche near the ground", [WALL, "a deep vertical crack or niche in the front face that does NOT go through to the other side"], ["a hole or arch you can see through"], [6, 3.5, 10]),
 A("cave-wall-overhang", "section of cave wall leaning in at the top",
   "A wall-height mass of natural limestone about 7 ft wide, 10 ft tall. It LEANS FORWARD: the base is about 3 ft deep and the upper part swells out toward the viewer in a heavy rounded overhang, so the top is about 5 ft deep and hangs about 2 ft further forward than the foot, like the start of a cave roof. The overhang is one thick solid bulge of rock, not a thin shelf.",
   "a tall chunk of natural cave rock wall whose upper part bulges or leans forward over its base (an overhang)", [WALL, "the upper part overhangs / leans forward beyond the base"], [], [7, 5, 10]),
 A("cave-rubble-low", "low pile of fallen cave rock",
   "A LOW pile of fallen limestone blocks and boulders fused into one solid heap: about 6 ft wide, 3 ft deep and only 4 ft tall (much wider than tall). Five to seven big chunky rounded boulders (each 1.5 to 3 ft across) piled against each other, higher at the back, with moss between them. No loose pebbles.",
   "a low fused heap of big grey-brown boulders, wider than it is tall", ["a low heap of several big boulders fused into one pile, wider than tall"], ["a tall wall or pillar"], [6, 3, 4]),
 A("cave-corner-column", "thick natural rock column",
   "A thick natural rock COLUMN or buttress, like a fat flowstone pillar: about 4.5 ft across in both directions and 10 ft tall, roughly round in plan, lumpy and bulging all the way round, a little wider at the foot and at the top than in the middle, with vertical flowstone ribs and a couple of horizontal cracks. The top is a rough, roughly level broken end.",
   "a thick, lumpy natural rock column or pillar, about twice as tall as it is wide, roughly round", ["one thick column / pillar of natural rock, round-ish in plan, clearly taller than wide"], ["a thin spike or stalagmite coming to a point", "a carved or built column"], [4.5, 4.5, 10]),
 A("cave-wall-arch", "section of cave wall with a tunnel mouth",
   "A wall-height mass of natural limestone about 9 ft wide, 10 ft tall and 3.5 ft deep, with a natural TUNNEL MOUTH through the middle of it: an irregular arch-shaped opening about 4 ft wide and 7 ft tall that starts AT THE GROUND (no sill, no threshold) and goes right through the rock from front to back, so the blue background is visible through it. A person could walk through. Thick rock legs about 2.5 ft wide on each side of the opening and a thick rock lintel about 3 ft tall above it. The opening is rough and natural, not carved.",
   "a tall chunk of natural cave rock wall with one natural arch-shaped opening (a tunnel mouth) going right through it at ground level",
   [WALL, "one arch-shaped opening that goes all the way THROUGH the rock (the background is visible through it) and reaches the ground"], ["a built or carved doorway with cut stone blocks", "a door or gate in the opening"], [9, 3.5, 10]),
]
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets: (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(assets), "assets")
