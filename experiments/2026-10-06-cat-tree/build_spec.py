#!/usr/bin/env python3
"""Cat tree (2026-10-06): one prop a playtester asked for at the table. Writes assets.json for gen.py (free Codex plate)."""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
STYLE = (ROOT / "style/heroic-handpainted.object.md").read_text()
STYLE_REF = str(ROOT / "style-references/heroic-handpainted-tavern-v1.png")
subject = "a cat tree (cat climbing furniture)"
design = ("A piece of pet furniture for cats to climb, about 5 ft tall, on one square wooden base board that sits flat on the floor. "
          "From the base rise two FAT upright posts tightly wrapped in thick coils of honey-coloured sisal rope (scratching posts). "
          "They carry three broad, thick, rounded platforms at different heights, covered in plush moss-green carpet, the top one a shallow padded perch with a raised rim. "
          "At the bottom, on the base, sits a small boxy cubby house covered in burgundy carpet with ONE large round door hole in its front. "
          "One short thick cord with a chunky cream pom-pom ball hangs from the edge of a middle platform. "
          "Everything is chunky and sturdy: thick platforms, thick posts, no thin parts. NO cat or any animal on it. "
          "Real-world size about 34 in wide x 34 in deep x 60 in tall: keep these proportions, clearly taller than wide. "
          "It stands on nothing: NO floor patch, NO rug, NO ground disc, NO shadow blob under it. "
          "The background is flat chroma blue, so the object itself has NO blue anywhere. "
          "Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.")
a = {"id": "cat-tree", "object": "cat-tree", "group": "main", "source": "generate", "lane": "3d", "subject": subject, "size": [34, 34, 60],
     "prompt": STYLE.format(subject=subject, detail=design), "refs": [STYLE_REF], "gate_refs": [],
     "gate": {"desc": "a cat tree: cat climbing furniture, a tower of carpeted platforms on rope-wrapped posts with a small cubby house",
              "must": ["at least two platforms at different heights", "at least one post wrapped in rope", "a cubby or box with a round door hole", "taller than it is wide", "the whole object is in frame"],
              "must_not": ["a cat or any animal", "a floor patch, rug, ground disc or shadow blob under the object", "a real tree with leaves"]}}
# second plate (not meshed yet): the first mesh modelled the plush carpet as loose flakes, which fall apart at the 5,000-face game tier
FELT = (" IMPORTANT: every carpeted surface is SMOOTH, short, felt-like carpet painted as one flat solid surface with a few broad brush strokes:"
        " NO fluffy fur, NO plush pile, NO fuzzy or tufted edges, NO loose fibres; platforms are thick solid discs with clean rounded edges, like upholstered wooden boards."
        " The pom-pom is a smooth solid ball. The base board is solid opaque honey-coloured wood.")
b = {**a, "id": "cat-tree-felt", "group": "felt", "prompt": STYLE.format(subject=subject, detail=design + FELT),
     "gate": {**a["gate"], "must": a["gate"]["must"] + ["carpeted surfaces look smooth and solid, not fluffy or furry"]}}
# third plate: designed for the TABLE CAMERA first. The felt mesh is solid but from steeply above its platforms stack into one
# disc over the posts and the cubby ("a pawn", "an ornate table", "a two-tiered stand"). Every part must show from above.
design3 = ("A piece of pet furniture for cats to climb, about 5 ft tall, DESIGNED TO BE RECOGNISED FROM STEEPLY ABOVE (a tabletop game camera looking about 50 degrees down). "
           "One square wooden base board, honey-coloured solid wood, flat on the floor. In the MIDDLE of the base stands ONE very FAT upright post tightly wrapped in thick coils of pale sisal rope, the tallest part of the object. "
           "THREE thick round platforms stick out from the post on short thick arms like a spiral staircase: a low one to the left, a middle one to the right, the top one toward the back, at clearly different heights, "
           "STAGGERED so that NO platform sits over another: seen from directly above all three discs and the rope post between them are fully visible, like three leaves round a stem. "
           "Each platform is a thick solid disc covered in smooth moss-green felt with a raised cream rim and ONE big cream PAW-PRINT shape (a pad and four toes) sewn flat on its top face. "
           "At the FRONT corner of the base, with NOTHING above it, sits a small burgundy felt cubby house shaped like a wedge: its front face leans back, so its ONE large dark ROUND door hole faces upward and outward and is plainly visible from above. "
           "TWO toys hang on short thick cords from the edges of two different platforms: a chunky cream ball and a chunky orange fish shape, hanging clear of everything else. "
           "Every carpeted surface is SMOOTH short felt painted as one flat solid surface: NO fluffy fur, NO plush pile, NO fuzzy or tufted edges. Everything is chunky and sturdy, no thin parts. NO cat or any animal on it. "
           "Real-world size about 44 in wide x 44 in deep x 60 in tall. "
           "CAMERA: unlike the usual plate, show it from HIGH ABOVE, a three-quarter view looking about 45 degrees down, so the tops of all three platforms, the paw prints, the rope post and the cubby's round door are all seen at once. "
           "It stands on nothing: NO floor patch, NO rug, NO ground disc, NO shadow blob under it. "
           "The background is flat chroma blue, so the object itself has NO blue anywhere. "
           "Show exactly this one object and nothing else, whole and well inside the frame.")
c = {**a, "id": "cat-tree-stagger", "group": "stagger", "size": [44, 44, 60], "prompt": STYLE.format(subject=subject, detail=design3),
     "gate": {"desc": "a cat tree: cat climbing furniture with staggered round platforms on a fat rope-wrapped post and a small cubby house, seen from high above",
              "must": ["three platforms at different heights that do NOT sit directly over one another (the top face of each is visible)", "one fat post wrapped in rope, visible between the platforms",
                       "a cubby or box whose round door hole is visible and not covered by a platform", "at least one hanging toy", "carpeted surfaces look smooth and solid, not fluffy or furry", "the whole object is in frame"],
              "must_not": ["a cat or any animal", "a floor patch, rug, ground disc or shadow blob under the object", "a real tree with leaves", "platforms stacked in one column over each other"]}}
(HERE / "assets.json").write_text(json.dumps({"assets": [a, b, c]}, indent=1) + "\n")
print(a["prompt"][-900:])
