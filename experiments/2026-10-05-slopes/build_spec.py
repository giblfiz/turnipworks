#!/usr/bin/env python3
"""Slope-kit pilot (Harry 2026-10-05): placeable SLOPE PROPS that connect flat 5-ft terraces so the land reads as a
rolling hill instead of stacked blocks. One ground family: grassy earth with some exposed rock, colour-matched to the
game's own grass ground (ref/grass-ground.jpg = tools/spawn-tuner/assets/flat/floor-grass.webp tiled 2x2).
Writes assets.json for src/plate_gate_batch.py (run through gen.py: plates from the FREE Codex image route).
    python3 build_spec.py
"""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent
REF = str(HERE / "ref/grass-ground.jpg")
STYLE = """Geometry: one solid, chunky landform with broad soft shapes; rocks are big rounded blocks, not gravel; no thin or fragile parts; no overhangs. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights, low-frequency surface detail, mostly matte. The grass is a short, calm, even lawn painted as a soft surface (no individual tall blades sticking up).
Avoid: trees, bushes, flowers, mushrooms, fences, signs, buildings, people, animals; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, black outlines, hard cel-shading bands, comic inking, flat vector art, text, logos.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, perfectly uniform solid chroma-blue background, no horizon, no sky, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no additional loose objects. The blue background is a removable mask and must not reflect blue light onto the asset."""
MATCH = """The supplied image is the game's flat grass ground seen from straight above. This terrain piece will sit ON that ground, so every grassy surface of the piece must be the SAME grass: the same green hue, brightness and saturation, the same calm short-lawn texture and the same painting style, so that the piece blends into the ground with no visible colour change. Exposed rock is a neutral warm grey; exposed earth is a mid brown."""
TAIL = """ This is a single freestanding terrain piece, like a wargaming terrain model: its underside is perfectly FLAT and it sits directly on the ground. NO base slab, NO plinth, NO platform, NO board and NO rim under or around it: where the slope meets the ground it simply thins out to nothing (a feather edge). NO trees, NO bushes, NO sky, NO water. Keep the WHOLE object well inside the frame with a generous margin."""
def prompt(subject, design):
    return f"Create a new single asset in the Turnip Works house style (heroic hand-painted): {subject}.\n\n{MATCH}\n\n{STYLE}\n\nSpecific design: {design}{TAIL}\n"
NOT = ["a tree, bush or building", "a separate base slab, plinth or board under the terrain", "sky, horizon or a ground plane around it"]
GRASS = "the grass colour is close to the REFERENCE grass (similar green hue and brightness; a slope seen in 3D instead of a flat top-down texture is the intended difference)"
def A(id, subject, design, desc, must, must_not=(), dims=None):
    return {"id": id, "object": id, "family": "grassy-earth", "group": "kit", "source": "generate", "lane": "3d", "generation": "kit",
            "subject": subject, "dims_ft": dims, "prompt": prompt(subject, design), "refs": [REF], "gate_refs": [REF],
            "gate": {"desc": desc, "must": list(must) + [GRASS], "must_not": NOT + list(must_not)}}
SIDES = " The two SIDE ends are clean, flat, vertical cuts (like a slice of cake) showing a section of brown earth with a few stones, so that copies of this piece butt together side by side into a longer bank."
assets = [
 A("slope-bank-5", "straight grassy bank, 5 ft rise",
   "A straight wedge of grassy earth, like a slice of a railway embankment: footprint 10 ft wide x 9 ft deep, rising 5 ft. One long sloping grass face at about 30 degrees climbs from a feather edge at the ground in front up to a straight, level top edge at the back; the back is a flat vertical cut. The slope face is an even plane of short grass with only two or three small flat stones embedded in it. The wedge is 10 ft wide and the same cross-section along its whole width." + SIDES,
   "a straight wedge-shaped grassy bank: one even grass slope rising from the ground to a level top edge, with flat cut ends",
   ["one wedge / ramp shaped landform with a single main sloping grass face", "the top edge is straight and level"], ["a rounded hill or dome instead of a straight wedge"], [10, 9, 5]),
 A("slope-bank-10", "tall straight grassy bank, 10 ft rise",
   "A big straight wedge of grassy earth, like a slice of a tall embankment: footprint 10 ft wide x 17 ft deep, rising 10 ft. One long sloping grass face at about 30 degrees climbs from a feather edge at the ground in front up to a straight, level top edge at the back; the back is a flat vertical cut 10 ft tall. The slope is an even plane of short grass with a few flat grey stones and one small rock shelf embedded part-way up. The same cross-section along its whole 10 ft width." + SIDES,
   "a tall straight wedge-shaped grassy bank: one long even grass slope rising from the ground to a level top edge, with flat cut ends",
   ["one wedge / ramp shaped landform with a single main sloping grass face", "the top edge is straight and level"], ["a rounded hill or dome instead of a straight wedge"], [10, 17, 10]),
 A("slope-corner-out", "outside corner of a grassy bank",
   "The OUTSIDE (convex) corner piece of a grassy embankment: exactly one quarter of a low, wide cone. Footprint 9 ft x 9 ft, rising 5 ft. The high point is at one corner of the square footprint (the back corner); from there a rounded grass slope at about 30 degrees fans down and outward in a quarter circle to a feather edge at the ground. The two faces that meet at the high back corner are clean, flat, vertical cuts at right angles to each other, showing brown earth with a few stones, so straight bank pieces butt against them.",
   "a quarter-cone grassy corner piece: a rounded grass slope fanning down from one high corner, with two flat vertical cut faces meeting at that corner",
   ["a rounded slope that fans out from a high corner (quarter of a cone or mound)", "two flat cut faces at a right angle"], ["a complete round hill"], [9, 9, 5]),
 A("slope-corner-in", "inside corner of a grassy bank",
   "The INSIDE (concave) corner piece of a grassy embankment, shaped like the inside corner of an amphitheatre or a quarter of a shallow bowl. Square footprint 9 ft x 9 ft, rising 5 ft. Two grass slopes at about 30 degrees meet in a soft concave valley crease: the piece is LOW at its front corner (a feather edge at the ground) and HIGH along its two back edges, which are straight and level, 5 ft up. The two back faces are flat vertical cuts at right angles; the two narrow side ends are flat vertical cuts showing brown earth, so straight bank pieces butt against them.",
   "an inside-corner grassy bank piece: two grass slopes meeting in a concave crease, low at the front corner and high along two back edges",
   ["two sloping grass faces that meet in a concave (valley) crease", "high along two adjoining back edges, low at the opposite front corner"], ["a complete round hill", "a convex mound"], [9, 9, 5]),
 A("slope-ramp-path", "gentle grassy ramp with a worn dirt path",
   "A long, gentle ramp of grassy earth: footprint 10 ft wide x 19 ft long, rising 5 ft at a gentle 15 degrees. It climbs from a feather edge at the ground at the front to a straight level top edge at the back; the back is a flat vertical cut. A worn bare-dirt footpath about 4 ft wide, mid brown with a few flat stepping stones, runs straight up the middle of the ramp from bottom to top, with short grass on both sides. The two long sides fall away as short, steep grassy shoulders down to the ground.",
   "a long gentle wedge-shaped grassy ramp with a brown dirt footpath running up its middle",
   ["one long gently sloping ramp", "a bare dirt path running up the slope from the low end to the high end"], ["stairs made of cut stone blocks or timber", "a rounded hill or dome"], [10, 19, 5]),
 A("slope-ledges", "stepped rocky slope with flat ledges",
   "A stepped rocky hillside piece: footprint 10 ft wide x 15 ft deep, rising 10 ft. It climbs in THREE big natural steps, like giant rough stairs: each step has a broad, clearly FLAT, level grassy ledge about 10 ft wide and 5 ft deep (big enough for a person to stand on), and between the ledges are short, near-vertical risers of chunky warm-grey rock, each about 3 ft tall. Lowest ledge about 3 ft up, the middle about 6.5 ft, the top ledge 10 ft up. The back is a flat vertical cut; the two side ends are flat vertical cuts showing rock and earth.",
   "a stepped rocky hillside piece with three broad flat grassy ledges separated by short rock risers, like giant natural stairs",
   ["clearly stepped: at least two, ideally three, broad flat level ledges at different heights", "rock faces between the ledges, grass on the ledges"], ["one smooth continuous slope with no flat ledges", "built masonry stairs"], [10, 15, 10]),
 A("slope-mound", "low rounded grassy hillock",
   "A low, wide, smoothly rounded grassy hillock, the cap of a hill: roughly circular footprint about 20 ft across, only 4 ft high at its centre, like an upturned shallow saucer. Smooth short grass all over, with a small cluster of two or three half-buried rounded grey rocks off-centre. The edge thins out to nothing all the way round where it meets the ground.",
   "a low, wide, smoothly rounded grassy mound (shallow dome) with a few half-buried rocks",
   ["one low rounded dome-shaped grassy mound, much wider than it is tall"], ["a tall pointed hill or a mountain", "a cliff"], [20, 20, 4]),
 A("slope-outcrop", "rock outcrop with a flat grassy top",
   "A small cliff chunk: a blocky outcrop of warm-grey layered rock, footprint 10 ft x 10 ft and 10 ft tall, with near-vertical rock faces on all sides showing big horizontal strata and a few chunky cracks, and a clearly FLAT, level top covered in short grass (a little grass curling over the rim). Roughly square in plan with rounded corners; it stands directly on its flat underside.",
   "a blocky rock outcrop or small cliff chunk about as tall as it is wide, with near-vertical rock sides and a flat grass-covered top",
   ["near-vertical rock faces", "a flat, level top covered in grass"], ["a pointed peak or spire", "a cave or arch"], [10, 10, 10]),
 A("slope-scree", "scree and boulder apron",
   "A scree apron for the foot of a cliff: a low sloping pile of fallen warm-grey boulders and broken rock mixed with earth and tufts of short grass. Footprint 10 ft wide x 6 ft deep, 4 ft high at the back, sloping down at about 35 degrees to a feather edge at the front where a few last stones sit in the grass. The back is a flat vertical cut (it leans against a cliff). Boulders are big and chunky (1 to 3 ft across), fused into one solid pile, not loose pebbles.",
   "a low sloping pile of grey boulders and rubble with some earth and grass, higher at the back and thinning out toward the front",
   ["a sloping heap of chunky boulders / rubble fused into one pile", "noticeably lower at the front than at the back"], ["a single boulder", "a tall cliff"], [10, 6, 4]),
 A("slope-ledges-2", "stepped rocky slope with two deep flat ledges",
   "A stepped rocky hillside piece made of exactly TWO giant steps, like two huge stair treads: footprint 10 ft wide x 14 ft deep, 10 ft tall. Seen from the side it is a staircase profile with two treads. The LOWER step is a wide, perfectly flat, level grassy shelf 5 ft above the ground, 10 ft wide and 6 ft deep from front to back (deep enough for a horse to stand on). The UPPER step is another perfectly flat, level grassy shelf 10 ft above the ground, 10 ft wide and 6 ft deep. The front of each step is a near-vertical 5 ft riser of chunky warm-grey rock with a few cracks; the lowest riser stands straight on the ground. The flat grassy shelves take up most of the top view; the risers are short in plan. The back is a flat vertical cut; the two side ends are flat vertical cuts showing rock and earth.",
   "a stepped rocky terrain piece with exactly two broad, deep, flat grassy shelves (a lower and an upper) and near-vertical rock risers, like two giant stair treads",
   ["exactly two broad flat level grassy shelves at two different heights", "each shelf is deep (clearly deeper than the rock riser below it is tall is not required, but it must be a wide shelf, not a narrow lip)", "near-vertical rock risers"], ["one smooth continuous slope with no flat ledges", "three or more steps", "built masonry stairs"], [10, 18, 10]),   # prompt says 14 ft deep; shown 18 deep so each shelf holds a 5-ft base
]
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets: (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(assets), "assets")
