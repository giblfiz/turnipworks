#!/usr/bin/env python3
"""Log-cabin wall style (Harry 2026-10-05): the pieces that match the stacked-log wall
experiments/2026-10-01-walls `wall-straight--rough-timber--s3` (wall family 'log-cabin' in the tuner).
Writes assets.json for src/plate_gate_batch.py (run through gen.py: plates from the FREE Codex image route).
    python3 build_spec.py
"""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
S3 = str(ROOT / "experiments/2026-10-01-walls/inputs/wall-straight--rough-timber--s3.jpg")
STYLE = """Geometry: stout, miniature-compatible proportions; thick functional parts and rails; broad soft bevels; where the object genuinely has handles, hinges or fittings, make them chunky, but NEVER add handles, rings, loops, straps or fittings the real object would not have; deep readable carving rather than fine detail; slightly exaggerated, sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Avoid: invented handles, ring pulls, levers, knobs or pegs sticking out of the wall; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above (the same camera as the supplied image), clear space around every edge, perfectly uniform solid chroma-blue background, no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. The blue background is a removable mask and must not reflect blue light onto the asset; where the wall has a real hole, the blue background shows through it."""
MATCH = """The supplied image is the existing plain wall section of this same building: a wall of HORIZONTAL stacked round logs with pale chinking between them. The new piece must look cut from the same wall: the SAME log diameter and number of log courses, the same warm orange-honey log colour, the same pale chinking lines, the same rounded log ends at both side edges, the same overall size, proportions (a tall narrow upright panel about 5 ft wide x 9 ft tall x 1 ft thick, almost twice as tall as wide), painting style and camera angle. Change ONLY what is described below."""
TAIL = """ Nothing else: NO floor, NO ground, NO base slab or platform under it, NO roof, NO corner return, NO furniture or decorations attached, NO vertical planks. Both side edges are clean vertical cuts with the round log ends showing, so this piece butts against the plain log wall pieces to make a longer wall. It stands directly on its bottom log with no footing. Keep the WHOLE object well inside the frame with a generous margin."""
def prompt(subject, design):
    return f"Create a new single asset in the Turnip Works house style (heroic hand-painted): {subject}.\n\n{MATCH}\n\n{STYLE}\n\nSpecific design: {design}{TAIL}\n"
COMMON_MUST = ["the wall is built of HORIZONTAL stacked round logs (not vertical planks or boards)", "one single upright wall section, taller than it is wide"]
COMMON_NOT = ["a floor, base slab, roof or corner return", "a handle, lever, ring or peg sticking out of the wall", "vertical plank walling"]
assets = [
  {"id": "wall-window-small--log-cabin", "object": "wall-window-small", "family": "log-cabin", "group": "closed", "source": "generate", "lane": "3d", "generation": "kit",
   "subject": "stacked-log wall segment with a small shuttered window",
   "prompt": prompt("stacked-log wall segment with a small shuttered window",
     "The same stacked round-log wall with ONE small square window at chest height (its centre about 5 ft above the bottom, the opening about 2 ft x 2 ft, centred left to right). The logs are cut cleanly around it and a simple, stout square frame of squared timber lines the opening. The window is CLOSED by a pair of plain plank shutters that sit inside the frame, each on two chunky iron strap hinges; no glass, no bars, no flower box. The logs run unbroken above and below the window."),
   "refs": [S3], "gate_refs": [S3],
   "gate": {"desc": "a wall section of horizontal stacked round logs with one small square window at chest height, closed by a pair of wooden shutters in a simple timber frame",
            "must": COMMON_MUST + ["exactly one small square window, roughly in the middle of the wall's height or a little above", "the window has a timber frame and a pair of wooden shutters", "log colour, log thickness and chinking match the REFERENCE wall (the REFERENCE has no window: the window is the intended difference)"],
            "must_not": COMMON_NOT + ["more than one window", "a door"]}},
  {"id": "wall-doorway--log-cabin", "object": "wall-doorway", "family": "log-cabin", "group": "closed", "source": "generate", "lane": "3d", "generation": "kit",
   "subject": "stacked-log wall segment with an empty door opening",
   "prompt": prompt("stacked-log wall segment with an empty door opening",
     "The same stacked round-log wall with an EMPTY door-sized opening through it, starting at the very bottom: about 3 ft wide and 7 ft tall, centred left to right, NO door leaf, NO threshold step. A stout frame of squared timber (two posts and a lintel) lines the opening, and the cut log ends butt against the posts. About 1 ft of log wall remains on each side of the opening and two or three full log courses run unbroken above the lintel. You can see straight through the opening to the blue background."),
   "refs": [S3], "gate_refs": [S3],
   "gate": {"desc": "a wall section of horizontal stacked round logs with one empty door-sized opening through it (no door leaf), framed in squared timber",
            "must": COMMON_MUST + ["one door-sized opening that reaches the bottom of the wall, with NO door in it (you can see through)", "logs continue above the opening", "log colour, log thickness and chinking match the REFERENCE wall (the REFERENCE has no opening: the doorway is the intended difference)"],
            "must_not": COMMON_NOT + ["a door leaf filling the opening", "a window"]}},
  {"id": "wall-window-small-open--log-cabin", "object": "wall-window-small-open", "family": "log-cabin", "group": "open", "source": "generate", "lane": "3d", "generation": "kit",
   "subject": "the same log wall window with its shutters open",
   "prompt": "Edit task. The supplied image shows a stacked-log wall section with a small shuttered window in the Turnip Works hand-painted house style. Show the SAME object: identical logs, log count, colours, chinking, timber frame, iron hinges, proportions (about 5 ft wide x 9 ft tall x 1 ft thick) and painting style. Do not redesign it.\n\nShow this same wall with its two window shutters swung fully OPEN, folded back flat against the log wall to the left and right of the window on the near (front) face. The window opening is now clear: you can see straight through it to the blue background. Keep the wall section identical. Thick, chunky shutters so the open shape reconstructs cleanly in 3D. Camera: the same three-quarter view from slightly above as in the supplied image.\n\n" + STYLE + "\n",
   "refs": [str(HERE / "inputs/wall-window-small--log-cabin.jpg")], "gate_refs": [str(HERE / "inputs/wall-window-small--log-cabin.jpg")],
   "gate": {"desc": "a wall section of horizontal stacked round logs with one small square window whose pair of wooden shutters is swung fully OPEN, the opening clear",
            "must": COMMON_MUST + ["the window's shutters are OPEN and the opening is clear (you can see through it)", "it is the SAME object as the REFERENCE (same logs, colours, frame, proportions), only with the shutters opened"],
            "must_not": COMMON_NOT + ["closed shutters", "a door"]}},
]
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets: (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(assets), "assets")
