#!/usr/bin/env python3
"""Wizard's tower (2026-10-11): every NEW mesh the wizard / alchemist tower room types want. Writes assets.json (and
prompts/) in the yard batch's format for tools/gen.py (src/plate_gate_batch.py). Nothing here calls an image model.
The helpers (base_record, add, twin, wall) are the mansion's (experiments/2026-10-05-castle-crypt-mansion/mansion).

Groups say WHEN a plate can be painted, prio how much the piece matters:
  p1 / p2 / p3   independent pieces (style reference only)
  sib1 / sib2    painted FROM the accepted plate of a p1 / p2 piece (a wall's window and doorway, a second shape)
Design rules of this batch (Harry's task note + the crypt's lessons):
  - TABLE SCALE: every piece is a background prop read from a tabletop camera: big silhouette, strong colour blocks.
  - GLASS IS PAINTED OPAQUE AND STOUT: thick-walled flasks and jars in solid colour, never see-through, never thin tubes.
  - ARCANE ICONOGRAPHY STAYS OFF walls and furniture (a "flavors" system is coming: moon-cult, devil-cult dressings):
    no runes, stars, moons, pentagrams or sigils carved or painted on anything here. The ritual circle and the star
    chart are separate flat props (flats.json).
Extra fields (the runner ignores them): prio, rooms, bench, hung, light, twin_of, tier, route, parent.
    python3 build_spec.py
"""
import json, sys
from pathlib import Path
from collections import Counter
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src"))
import catalog_tool as ct
STYLE = (ROOT / "style/heroic-handpainted.object.md").read_text()
STYLE_REF = str(ROOT / "style-references/heroic-handpainted-tavern-v1.png")
INTRO = "Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset:"
assert INTRO in STYLE
roles = {}
for p in sorted((ROOT / "catalog").glob("*.catalog.md")):
    roles.update(ct.parse_catalog(p)[0])

NOBLUE = " The background is flat chroma blue, so the object itself has NO blue anywhere (no blue cloth, flowers, china or glass)."
NOBASE = " It stands on nothing: NO floor, NO rug or carpet, NO ground, NO base slab, platform or plinth under it that the real object would not have." + NOBLUE
LEAFY = (" Foliage is painted as a FEW big solid masses with broad leaf shapes on their surface, never as separate thin leaves, fronds or twigs;"
         " no gaps in the foliage that you can see the background through, no stray leaves or petals floating free.")
UNLIT = " It is UNLIT: the candles are plain cream wax with dark wicks, NO flames, NO glow, NO smoke."
DRY = " It is DRY and EMPTY: NO water painted anywhere, the basin is a clean, clearly hollow stone bowl (the game adds the water)."
MATCH = {
 "suite": ("The supplied image is the first piece of a matching set of furniture ({what}). The new piece belongs to the SAME set: the SAME wood and wood colour,"
           " the same carving motifs and leg shape, the same fabric, colours, fittings, painting style and camera angle. It is a DIFFERENT piece of furniture,"
           " described below: do not copy the shape of the piece in the supplied image.\n\n"),
 "same": ("The supplied image is the first version of this kind of object ({what}). Make a SECOND, clearly different design of the same kind of object that would"
          " stand in the same room: the SAME materials, colours, level of ornament, painting style and camera angle, but a different shape as described below.\n\n"),
 "kit": ("The supplied image is an existing straight section of this same {what}. The new piece must look built from the same {what}: the SAME materials, colours,"
         " thicknesses, height, painting style and camera angle. Change ONLY what is described below.\n\n"),
}
assets = []


def base_record(sku, obj, group, prio, rooms, subject, size, prompt, refs, gate_refs, desc, must, must_not, extra):
    rec = {"id": sku, "object": obj, "group": group, "source": "generate", "lane": "3d", "subject": subject, "size": [float(v) for v in size],
           "prompt": prompt, "refs": refs, "gate_refs": gate_refs,
           "gate": {"desc": desc, "must": list(must), "must_not": list(must_not)},
           "prio": prio, "rooms": list(rooms), "bench": list(extra.pop("bench", [])), "route": extra.pop("route", "trellis")}
    rec.update(extra)
    assets.append(rec)


def add(sku, obj, group, prio, rooms, subject, design, desc, must=(), must_not=(), size=None, parent=None, what="", match="suite",
        base=True, leafy=False, parent_path=None, **extra):
    role = roles[obj]
    w, d, h = size or role["size"]
    detail = (f"{design} Real-world size about {w:g} in wide x {d:g} in deep x {h:g} in tall: keep these proportions."
              + (LEAFY if leafy else "") + (NOBASE if base else NOBLUE)
              + " Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.")
    prompt = STYLE.format(subject=subject, detail=detail)
    refs, gate_refs = [STYLE_REF], []
    must, must_not = list(must), list(must_not)
    if parent:
        assert group.startswith("sib"), sku
        pp = parent_path or str(HERE / "inputs" / f"{parent}.jpg")
        prompt = prompt.replace(INTRO, MATCH[match].format(what=what) + "Create a single asset in the Turnip Works house style (heroic hand-painted):")
        refs, gate_refs = [pp], [pp]
        must.append({"suite": f"wood, fabric and colours match the REFERENCE piece of the {what} (it is a different piece of furniture: the shape is the intended difference)",
                     "same": f"materials and colours match the REFERENCE {what} (a different shape is the intended difference)",
                     "kit": f"materials, colours and height match the REFERENCE {what} section (the described change is the intended difference)"}[match])
        extra["parent"] = parent
    if base:
        must_not.append("a floor, rug, ground patch or base slab under the object")
    base_record(sku, obj, group, prio, rooms, subject, (w, d, h), prompt, refs, gate_refs, desc, must, must_not, extra)


def twin(sku, obj, closed, prio, rooms, opened, desc, must=(), must_not=(), size=None, group="sib2", **extra):
    """The OPEN state of an accepted closed piece: an edit of that piece's own plate (catalog/objects-open-states.catalog.md)."""
    role = roles[obj]
    w, d, h = size or role["size"]
    pp = str(HERE / "inputs" / f"{closed}.jpg")
    prompt = ("Edit task. The supplied image shows one object in the Turnip Works hand-painted house style. Show the SAME object: identical materials, colours, carving,"
              " fittings, proportions and painting style. Do not redesign it.\n\n" + opened +
              " Thick, chunky doors and flaps so the open shape reconstructs cleanly in 3D. Camera: the same three-quarter view from slightly above as in the supplied image."
              " Exactly one object, centred, whole and well inside the frame, on a perfectly uniform solid chroma-blue background: no floor, no shadow, no other objects."
              " The object itself has NO blue anywhere.\n")
    base_record(sku, obj, group, prio, rooms, f"the open state of {closed}", (w, d, h), prompt, [pp], [pp], desc,
                list(must) + ["it is the SAME object as the REFERENCE (same materials, colours, proportions), only opened"], list(must_not),
                {**extra, "twin_of": closed, "parent": closed, "bench": ["hinge"]})


# ---------------------------------------------------------------------------------------------------------------
# WALL KIT. 5 ft wide x 9 ft tall x 1 ft thick panels seen from the broad (room) side. Names: <object>--<family>[--sN].
WSTYLE = """Geometry: stout, miniature-compatible proportions; thick mouldings, stones and glazing bars; broad soft bevels; deep readable carving rather than fine detail; sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Avoid: invented handles, ring pulls, levers, knobs, hooks or pegs sticking out of the wall; pictures, mirrors, lamps, curtains or furniture on the wall; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, seen from the front at a slight three-quarter angle from slightly above{same}, clear space around every edge, perfectly uniform solid chroma-blue background, no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. The blue background is a removable mask and must not reflect blue light onto the asset; the wall itself has NO blue anywhere; where the wall has a real hole, the blue background shows through it."""
WTAIL = (" ONE single straight wall section standing upright, a tall narrow panel about 5 ft wide x 9 ft tall x 1 ft thick (almost twice as tall as wide)."
         " Nothing else: NO floor, NO ground, NO base slab or platform under it, NO ceiling, NO roof, NO corner return, NO furniture, pictures or decorations attached."
         " Both side edges are clean flat vertical cuts with nothing sticking out past them, and every horizontal moulding (skirting, rail, cornice) runs level from edge to edge at the"
         " same height, so that copies placed side by side make one continuous wall. The front face is the room-facing side; the back face is the same stone, plain."
         " Keep the WHOLE object well inside the frame with a generous margin.")
WNOT = ["a floor, base slab, ceiling or corner return", "a picture, mirror, lamp, curtain or furniture on the wall", "blue or see-through glass"]

FAMILIES = {}


def wall(sku, obj, group, prio, fam, subject, design, desc, must, must_not=(), parent=None, parent_path=None, size=(60, 12, 108), **extra):
    f = FAMILIES.get(fam, {})
    if parent:
        intro = (f"Create a new single asset in the Turnip Works house style (heroic hand-painted): {subject}.\n\n"
                 f"The supplied image is the existing plain wall section of this same room. The new piece must look cut from the same wall: the SAME materials and colours,"
                 f" the same courses, bands and mouldings at the SAME heights, the same overall size and proportions, painting style and camera angle. Change ONLY what is described below.")
        pp = parent_path or str(HERE / "inputs" / f"{parent}.jpg")
        refs, gate_refs = [pp], [pp]
        must = list(must) + ["materials, colours and the heights of the horizontal mouldings match the REFERENCE wall (the described change is the intended difference)"]
        extra["parent"] = parent
    else:
        intro = f"Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new single asset: {subject}."
        refs, gate_refs = [STYLE_REF], []
    prompt = f"{intro}\n\n{WSTYLE.format(same=' (the same camera as the supplied image)' if parent else '')}\n\nSpecific design: {design}{WTAIL}\n"
    base_record(sku, obj, group, prio, extra.pop("rooms", f.get("rooms", [])), subject, size, prompt, refs, gate_refs, desc,
                ["one single upright wall section, taller than it is wide"] + list(must), WNOT + list(must_not),
                {**extra, "family": fam, "generation": "kit"})




LAB, STUDY, SUMMON, OBS, SCRY, STORE, SHOP, BED, MENAG, STAIR, WORK = ("wiz-lab", "wiz-study", "wiz-summoning", "wiz-observatory", "wiz-scrying", "wiz-store",
                                                                       "wiz-apothecary", "wiz-bedchamber", "wiz-menagerie", "wiz-stair", "wiz-workshop")
ALLTOWER = [LAB, STUDY, SUMMON, OBS, SCRY, STORE, BED, MENAG, STAIR, WORK]
PLAIN = " It carries NO runes, NO stars, NO moons, NO magic symbols, NO letters or writing anywhere: plain craftsmanship only."
GLASS = (" All glass is painted as THICK-walled, OPAQUE, solid-coloured glass (deep green, amber, plum-red, ochre), like glazed pottery with one soft highlight:"
         " NOT see-through, NOT blue, no thin tubes or stems; necks, spouts and stoppers are as thick as a thumb.")
CHUNKY = " Every bar, ring, rod, leg and strap is deliberately THICK and toy-like (as thick as a wrist), with nothing thin or wiry, so that it reconstructs in 3D."
UNLITF = " It is UNLIT and cold: NO flame, NO glow, NO embers, NO smoke, NO baked light."
BRASS = "warm brass with ochre shadows and worn bright edges"

# ---------------------------------------------------------------------------------------------------------------
# WALL KIT: family `tower-stone`. 5 ft wide x 9 ft tall x 1 ft thick panels seen from the broad (room) side.
TS_WHAT = "tower stone wall"
TS_DESC = ("large, neatly squared blocks of warm honey-buff sandstone laid in NINE level courses of two or three blocks each, with thin pale mortar joints; a few blocks are a"
           " mauve-grey or a rosier buff for variety, and their faces are softly tooled, not rough. ONE band course of darker plum-grey slate, a single thin course, runs level across"
           " the whole width at about 3 ft above the floor, and a plain rounded stone string moulding in the same plum-grey runs level across near the very top. No plinth, no"
           " carvings, no arrow slit")
TS_SHORT = "a wall of warm buff stone blocks in level courses with a darker plum-grey band course low down and a moulding near the top"
TS_MUST = ["squared stone blocks in level courses", "a darker horizontal band or moulding running across the wall"]
P = "wall-straight--tower-stone"
wall(P, "wall-straight", "p1", 1, "tower-stone", f"{TS_WHAT} section", f"A wall of {TS_DESC}." + PLAIN, TS_SHORT, TS_MUST, ["a window", "a door or opening", "runes or symbols"], rooms=ALLTOWER)
wall(P + "--s2", "wall-straight", "sib1", 1, "tower-stone", f"second version of the {TS_WHAT} section",
     f"The same wall: {TS_DESC}. Painted again by hand with small natural differences: the vertical joints fall in different places, two different blocks carry the mauve-grey tint,"
     " and one block near the bottom has a small worn chip. The band course and the top moulding are at exactly the same heights." + PLAIN,
     TS_SHORT, TS_MUST, ["a window", "a door or opening", "runes or symbols"], parent=P, rooms=ALLTOWER)
wall("wall-doorway--tower-stone", "wall-doorway", "sib1", 1, "tower-stone", f"{TS_WHAT} section with an empty arched door opening",
     "The same wall with an EMPTY door-sized opening through it, starting at the very bottom: about 3.3 ft wide and 7 ft tall, centred left to right, with a ROUND-ARCHED top turned in"
     " plum-grey wedge stones and plain dressed buff jamb stones. NO door leaf, NO threshold step, NO hinges. About 10 in of wall remains on each side and the stone courses and the"
     " top moulding run unbroken above the arch (the band course stops at the jambs). You can see straight through the opening to the blue background." + PLAIN,
     f"{TS_SHORT}, with one empty round-arched door opening through it (no door leaf)",
     ["one door-sized opening that reaches the bottom of the wall, with NO door in it (you can see through)", "wall continues above the opening"],
     ["a door leaf filling the opening", "a window"], parent=P, rooms=ALLTOWER)
wall("wall-window-small--tower-stone", "wall-window-small", "sib1", 1, "tower-stone", f"{TS_WHAT} section with a tall narrow tower window",
     "The same wall with ONE tall, narrow tower window, centred left to right: a lancet about 1.8 ft wide x 4.5 ft tall with a POINTED-arched top, its sloping stone sill about 3.5 ft"
     " above the floor (just above the band course, which runs unbroken under it). The window is framed in plain plum-grey dressed stone and is CLOSED by leaded glass: a lattice of"
     " THICK dark lead bars in a diamond pattern, about five diamonds across; the panes are opaque, painted a pale warm amber-cream like daylight on old glass (NOT blue, NOT"
     " see-through). No shutters, no curtains, no coloured picture in the glass." + PLAIN,
     f"{TS_SHORT}, with one tall narrow pointed-arched window of diamond leaded glass",
     ["exactly one tall narrow window, clearly taller than wide, roughly centred", "the window is glazed with a lattice of thick dark bars and is closed"],
     ["more than one window", "a door", "curtains or shutters", "a pictorial stained-glass scene"], parent=P, rooms=ALLTOWER,
     note="the family's window piece (role wall-window-small); no open twin in this batch: a leaded lancet does not open")
wall("wall-shop-window--half-timber", "wall-shop-window", "sib1", 1, "half-timber", "half-timbered wall section with a shop display window",
     "The same half-timbered wall (dark oak posts and beams with cream plaster panels) with ONE wide shop DISPLAY WINDOW in it, centred left to right: the window is about 3.6 ft wide x"
     " 3.6 ft tall, its bottom about 2.5 ft above the floor, and it PROJECTS about 6 in from the wall as a shallow box bay on a thick oak stall board with two stout oak brackets under"
     " it and a little sloping oak hood above. The window is glazed with twelve small square panes (four across, three high) in THICK dark oak glazing bars; the panes are opaque,"
     " painted a pale warm amber-cream (NOT blue, NOT see-through), and behind the bottom row of panes stands a painted row of five fat bottles and jars in plum-red, moss green and"
     " ochre, as dark solid silhouettes on the pane. Oak posts frame the wall section left and right as in the supplied image. No sign, no lettering, no door." + PLAIN,
     "a half-timbered wall section with one wide projecting shop window of many small panes, bottles showing in it",
     ["one wide window of many small panes in thick bars, roughly centred", "dark timber framing with pale plaster"],
     ["a door", "lettering or a shop sign", "more than one window"], parent="wall-straight--half-timber",
     parent_path=str(ROOT / "experiments/2026-10-01-walls/inputs/wall-straight--half-timber.jpg"), size=(60, 15, 108), rooms=[SHOP], opening="panel", kit="wall",
     note="a special panel (walls.js PANELS) on the apothecary's outside walls: 18 in thick, the room face stays flush")
by0 = {a["id"]: a for a in assets}
by0["wall-shop-window--half-timber"]["group"] = "p1"  # its parent plate is an accepted plate of an older batch: nothing to wait for
by0["wall-shop-window--half-timber"]["prompt"] = by0["wall-shop-window--half-timber"]["prompt"].replace("the back face is the same stone, plain", "the back face is plain cream plaster between the same oak posts")

LEAF = (" ONLY the door leaf itself, as if lifted off its hinges: NO door frame, NO jambs, NO lintel, NO surrounding wall, NO threshold. Standing upright, closed and flat,"
        " seen from the front at a slight angle; the edges of the door are the edges of the object.")
add("door-tower--leaf", "door-tower", "p1", 1, ALLTOWER, "a round-topped wizard's tower door leaf, without a frame",
    "A thick door of wide vertical planks of PALE silver-grey weathered oak with a ROUND-ARCHED top, about 3.3 ft wide and 7 ft tall and 4 in thick. Two long dark iron strap hinges with"
    " simple curled ends run across it, one high and one low, and ONE heavy iron ring handle hangs on a round iron plate at mid height on the right. A row of fat iron studs follows the"
    " arch." + PLAIN + LEAF,
    "a round-topped door leaf of pale vertical planks with two long iron strap hinges and a ring handle, with no frame round it",
    ["one door leaf only, with a rounded top", "iron strap hinges across the planks"], ["a stone or timber frame, arch or wall round the door", "two leaves", "runes or glowing symbols"],
    bench=["hinge"], piece="leaf", note="leaf-only sku like door-crypt--leaf: it rotates to open, so it needs no open twin; fits wall-doorway--tower-stone")

# ---------------------------------------------------------------------------------------------------------------
# LABORATORY
add("alch-athanor", "alch-athanor", "p1", 1, [LAB, WORK], "an alchemist's brick furnace (an athanor)",
    "A squat TOWER FURNACE about 2.5 ft square and 4 ft tall, built of small warm red-orange bricks with pale mortar on a slightly wider base course: a square lower firebox with ONE small"
    " round-arched stoke hole in the front (a dark sooty opening with a chunky iron door standing open beside it), a second smaller ash hole below, and on top a rounded DOME of the same"
    " brick ending in a short fat clay chimney pot. A thick iron band is strapped round the middle. Soot stains above the stoke hole." + UNLITF,
    "a small square brick furnace tower with an arched stoke hole in front and a domed top with a short chimney",
    ["built of brick", "an arched fire opening in the front", "a domed or tapering top"], ["flames, glow or smoke", "a blacksmith's anvil or bellows", "a bread oven's wide mouth"],
    bench=["fire"], light="brazier")
BENCH = ("A heavy alchemist's WORK BENCH about 6 ft long, 2.5 ft deep and 3 ft high, of thick dark oak with four fat square legs, a low shelf between the legs holding two fat stoneware"
         " jars and a wooden box, and at the BACK of the bench top an upright two-shelf rack rising another 1.5 ft, its shelves packed with a row of fat bottles and jars.")
add("alch-bench-dressed--s1", "alch-bench-dressed", "p1", 1, [LAB], "an alchemist's laboratory bench crowded with apparatus",
    BENCH + " On the bench top, big and widely spaced: at the left a large pot-bellied FLASK of deep green glass on a stout iron tripod over a squat brass burner; in the middle a big"
    " plum-red glass RETORT (a round bulb with one fat down-curved spout) on a thick wooden stand, its spout resting in a fat amber receiving jar; at the right a stone mortar with a"
    " pestle and a thick open book lying flat with cream pages." + GLASS + PLAIN,
    "a long heavy wooden work bench crowded with large coloured flasks, a retort, jars and an open book, with a rack of bottles along its back",
    ["a long wooden bench or table", "several large coloured flasks, bottles or jars standing on it"], ["food, bread or kitchen pots", "a person", "flames or glow", "runes or symbols"])
add("alch-bench-dressed--s2", "alch-bench-dressed", "sib1", 2, [LAB, WORK], "a second alchemist's laboratory bench with different apparatus",
    BENCH + " On the bench top, big and widely spaced: at the left a copper POT STILL the size of a bucket with a fat cone-shaped copper head and one thick copper pipe curving down into"
    " a squat ochre jar; in the middle THREE big round-bottomed flasks (moss green, amber, plum-red) standing in a thick wooden rack; at the right a brass balance scale with two fat"
    " pans on a chunky pillar, and a skull-sized lump of yellow sulphur in a clay dish." + GLASS + PLAIN,
    "a long heavy wooden work bench crowded with a small copper still, three large coloured flasks in a rack and a balance scale, with a rack of bottles along its back",
    ["a long wooden bench or table", "several large coloured flasks, bottles or jars standing on it"], ["food, bread or kitchen pots", "a person", "flames or glow"],
    parent="alch-bench-dressed--s1", what="alchemist's work bench", match="same")
add("alch-still-copper-large", "alch-still-copper-large", "p1", 1, [LAB, STORE], "a large copper alchemist's still",
    "A big POT STILL about 3 ft across and 5 ft tall, all of warm polished copper with riveted seams: a fat onion-shaped boiler standing on three stubby copper feet, a tall swelling"
    " helmet-shaped head on top, and ONE very thick copper swan-neck pipe (as thick as an arm) arching over and down into a stout oak cooling tub banded with iron that stands touching"
    " the boiler; a fat brass tap sticks out near the bottom of the tub. Verdigris green in the seams." + UNLITF + CHUNKY,
    "a big onion-shaped copper still with a thick swan-neck pipe running down into a wooden tub beside it",
    ["a large rounded copper vessel", "a thick pipe arching from its top to a second vessel or tub"], ["thin coiled tubing", "flames or glow", "a person"])
SHELF = ("A tall free-standing reagent SHELF UNIT of dark oak, about 4 ft wide, 1.2 ft deep and 7 ft tall, with thick uprights, a solid plank back and FIVE thick shelves,")
add("alch-reagent-shelf-tall--s1", "alch-reagent-shelf-tall", "p1", 1, [LAB, STORE, SHOP], "a tall shelf unit packed with potion bottles and reagent jars",
    SHELF + " every shelf PACKED edge to edge with fat bottles, round flasks and stoppered jars standing shoulder to shoulder in strong solid colours: plum-red, moss green, amber, ochre,"
    " cream stoneware, a few with fat cork stoppers, two big jars on the bottom shelf. The bottles are fused into the shelves as one solid mass, with no gaps behind them." + GLASS + PLAIN,
    "a tall wooden shelf unit whose five shelves are packed with rows of coloured bottles and jars",
    ["a tall shelving unit", "rows of many coloured bottles or jars on the shelves"], ["books filling the shelves", "food", "labels with writing"])
add("alch-reagent-shelf-tall--s2", "alch-reagent-shelf-tall", "sib1", 2, [LAB, STORE, SHOP], "a second tall reagent shelf unit with jars, boxes and bundles",
    SHELF + " holding a different load: the top shelf a row of cream stoneware jars with flat lids; the second a row of fat green and amber bottles; the third three big bundles of dried"
    " herbs lying on their sides and a human skull; the fourth a row of small wooden boxes and two fat plum-red flasks; the bottom shelf two wicker-wrapped demijohns and a"
    " stone mortar. Everything is fused to the shelves as one solid mass, with no gaps behind." + GLASS + PLAIN,
    "a tall wooden shelf unit loaded with stoneware jars, coloured bottles, herb bundles, boxes and a skull",
    ["a tall shelving unit", "jars and bottles on the shelves"], ["books filling the shelves", "labels with writing"],
    parent="alch-reagent-shelf-tall--s1", what="reagent shelf unit", match="same")
add("apothecary-drawers", "apothecary-drawers", "p1", 1, [STORE, SHOP, LAB], "an apothecary's chest of many small drawers",
    "A big apothecary DRAWER CABINET of warm honey oak that stands against a wall, about 5 ft wide, 1 ft deep and 6 ft tall: a grid of THIRTY small square drawers (six across, five high),"
    " each with one fat round brass knob in its middle and a small blank cream card in a brass holder; under them a base of two wide deep drawers; on top a flat cornice carrying three"
    " fat stoneware jars with lids. The drawer fronts are clearly raised from the frame." + PLAIN,
    "a tall wide wooden cabinet whose front is a grid of many small square drawers with round knobs, jars standing on top",
    ["a grid of many small drawers covering the front"], ["writing on the labels", "open drawers", "books"])
add("alch-homunculus-vat", "alch-homunculus-vat", "p2", 2, [LAB, WORK], "a tall glass growing-vat in a brass frame",
    "A tall cylindrical VAT about 2.5 ft across and 5 ft tall: a fat cylinder of thick glass painted as OPAQUE murky moss-green liquid with a paler green highlight down one side and a few"
    " fat pale bubbles painted on it, held between a heavy riveted brass base drum with three stubby feet and a domed brass lid with a fat valve wheel on top; three thick brass straps"
    " run up the sides, and one arm-thick copper pipe curves from the lid down to the base. Nothing is visible inside the liquid." + PLAIN + CHUNKY,
    "a tall green glass tank cylinder held between a riveted brass base and a domed brass lid with a valve wheel",
    ["a tall upright cylinder of green glass or liquid", "metal base and metal lid"], ["a creature, body or face inside", "see-through or blue glass", "glow"])
add("alch-cauldron-bubbling-green", "alch-cauldron-bubbling-green", "p2", 2, [LAB, STORE], "a cauldron full of thick green brew",
    "A fat black iron CAULDRON about 2.2 ft across with a thick rolled rim, two stout ring lugs and three stubby feet, FULL to just under the rim with a thick, opaque, bright moss-green"
    " brew whose surface is painted with a few big round bubbles and a paler swirl. A fat wooden stirring paddle leans in it, its handle resting on the rim. Soot on the belly." + UNLITF,
    "a round black iron cauldron on three short feet, filled with thick green liquid, a wooden paddle in it",
    ["a round dark cauldron", "green liquid filling it"], ["flames or logs under it", "glow or steam", "a tripod of poles"])
add("alch-specimen-jar-large", "alch-specimen-jar-large", "p2", 2, [LAB, STORE, WORK], "a big floor-standing specimen jar",
    "A big squat storage JAR about 1.3 ft across and 2.5 ft tall made of glazed STONEWARE POTTERY (not glass): a fat-bellied pot with a shiny amber-ochre glaze that runs darker brown"
    " toward the foot, two stubby lug handles on the shoulders, and a fat rolled neck sealed by a cream waxed-cloth cover tied round with thick cord. Moulded in low relief round the"
    " belly is ONE fat coiled tentacle shape in a darker brown glaze. A blank cream tag hangs from the cord. It stands directly on its own flat foot." + PLAIN,
    "a large amber-brown glazed pottery jar with a tied cloth cover and two small lug handles",
    ["one large jar or pot, taller than wide", "a cloth cover tied over its mouth"], ["writing on the tag", "a face or body"])
add("alch-carboy-wicker", "alch-carboy-wicker", "p3", 3, [LAB, STORE, SHOP], "a wicker-wrapped demijohn",
    "A fat round DEMIJOHN bottle about 16 in across and 22 in tall: the round belly is wrapped in a thick basket of woven honey-coloured wicker with two stout wicker handles, and a short"
    " fat neck of opaque dark green glass sticks out of the top with a big cork in it." + GLASS,
    "a big round bottle in a woven wicker basket jacket with a short green neck and a cork", ["a round bottle wrapped in wickerwork"], ["several bottles", "blue glass"])

# ---------------------------------------------------------------------------------------------------------------
# STUDY / LIBRARY
add("spellbook-lectern", "spellbook-lectern", "p1", 1, [STUDY, SUMMON, WORK], "a heavy lectern holding a huge open book",
    "A massive reading LECTERN about 4 ft tall of dark carved oak: a thick octagonal column on a wide stepped foot, carrying a big sloping desk with a deep lip, and lying open on the"
    " desk ONE HUGE BOOK, as wide as the whole lectern (about 2.3 ft across when open), with thick cream pages fanned on both sides, a plum-red leather cover showing at the edges with"
    " fat brass corner pieces, and a wide burgundy ribbon marker hanging over the front. A fat brass candle cup with an unlit cream candle stands on one top corner of the desk. The"
    " pages are BLANK cream with only a few soft grey lines, no writing or symbols." + PLAIN,
    "a tall dark wooden lectern on a column with one very large open book lying on its sloping top",
    ["a lectern or reading stand", "a large open book on it"], ["glow, sparkles or floating book", "chains", "readable writing or symbols"], bench=["fire"], light="candle")
add("scroll-rack", "scroll-rack", "p1", 1, [STUDY, WORK, OBS], "a pigeonhole rack stuffed with scrolls",
    "A wall-standing SCROLL RACK of honey oak about 3.3 ft wide, 1.2 ft deep and 4 ft tall: a grid of SIXTEEN deep diamond-shaped pigeonholes (a diagonal lattice of thick boards in a"
    " thick square frame) on a low plinth, every pigeonhole stuffed with two or three fat rolled SCROLLS of cream parchment whose round ends stick out toward the viewer, some tied with"
    " burgundy or moss-green ribbon; four more fat scrolls and a brass scroll case lie on the flat top." + PLAIN,
    "a wooden rack of diamond-shaped pigeonholes stuffed with rolled parchment scrolls, their round ends showing",
    ["a grid or lattice of pigeonholes", "rolled scrolls in the holes"], ["wine bottles", "books filling it", "writing"])
add("staff-rack", "staff-rack", "p2", 2, [STUDY, WORK, STAIR], "a wall rack of wizard's staves",
    "A stout wall-standing STAFF RACK of dark oak about 3.3 ft wide, 10 in deep and 6 ft tall: a thick back board with a heavy floor trough at the bottom and a notched rail near the top,"
    " holding FOUR fat wizard's staves upright side by side, each as thick as a wrist and touching the back board along its whole length: one of gnarled pale wood ending in a knot"
    " holding a fist-sized amber crystal; one straight dark staff with a brass ball; one twisted root staff with a curled crook; one capped with a moss-green crystal in a brass claw." + PLAIN + CHUNKY,
    "an upright wooden rack holding four thick wizard's staves side by side, crystals and knobs on their tops",
    ["several long staves standing upright in a rack"], ["swords, spears or axes", "glow", "a person"])
BOOKC = ("A wizard's BOOKCASE of dark oak that stands against a wall, about 3.3 ft wide, 1.2 ft deep and 6.5 ft tall, with thick uprights, a solid back and five thick shelves, crammed and"
         " untidy:")
add("bookshelf--arcane", "bookshelf", "p2", 2, [STUDY, BED, OBS, STAIR], "a wizard's crammed, untidy bookcase",
    BOOKC + " fat books in burgundy, moss, ochre and plum bindings standing and leaning, some stacked flat on their sides, with rolled scrolls pushed in on top of them; among the"
    " books on different shelves a human skull, a fat amber bottle, a brass hourglass and a fist-sized crystal; a heap of scrolls and one fat book lie on the top. Everything is fused"
    " to the shelves as one solid mass." + GLASS + PLAIN,
    "a tall dark bookcase crammed untidily with coloured books, scrolls and a few curios such as a skull and a bottle",
    ["a bookcase full of books", "it is untidy: leaning or stacked books, scrolls or odd objects among them"], ["neat identical rows only", "writing"], tier="wizard")
add("bookshelf--arcane--s2", "bookshelf", "sib2", 3, [STUDY, BED, OBS, STAIR], "a second crammed wizard's bookcase",
    BOOKC + " a DIFFERENT arrangement: the top two shelves tight rows of fat books in plum, ochre and moss bindings with one gap where three books lean; the middle shelf a row of scroll"
    " ends, a small brass telescope lying down and a stuffed owl-shaped lump of cream feathers; the lower shelves huge thick folio volumes lying flat in stacks, and a fat potted fern"
    " at one end. A fat open book lies face down on the top." + GLASS + PLAIN,
    "a tall dark bookcase crammed with coloured books, big flat folios and a few curios",
    ["a bookcase full of books"], ["writing"], parent="bookshelf--arcane", what="wizard's bookcase", match="same", tier="wizard")
add("cabinet-curios", "cabinet-curios", "p2", 2, [STUDY, STORE, SHOP, WORK], "a cabinet of curiosities",
    "A tall CABINET OF CURIOSITIES of dark oak that stands against a wall, about 4 ft wide, 1.3 ft deep and 6.7 ft tall: an open grid of TWELVE deep square pigeonholes (three across, four"
    " high) with thick dividers over a base of two cupboard doors with fat brass knobs. Each pigeonhole holds ONE big bold object that nearly fills it: a skull with a horn, a huge"
    " spiral seashell, a cluster of plum-coloured crystals, a fat green jar, a stuffed cream-feathered bird shape, a big speckled egg on a ring, a coiled dried snake, a red coral"
    " branch as a solid lump, a brass hourglass, a giant tooth, an ochre geode, a bundle of big feathers." + GLASS + PLAIN,
    "a tall dark cabinet of open square pigeonholes, each holding a different curiosity such as a skull, a shell, crystals or a jar",
    ["a cabinet with a grid of open compartments", "different odd objects in the compartments"], ["books filling it", "writing"])
add("armillary-great", "armillary-great", "p1", 1, [OBS, STUDY, STAIR], "a floor-standing armillary sphere",
    f"A big ARMILLARY SPHERE about 3.5 ft across and 5.5 ft tall, of {BRASS}: FOUR very thick flat brass rings (each as broad as a hand and an inch thick) nested inside one another at"
    " different tilts to make an open globe, with one thick tilted axis rod through the middle carrying a solid ochre ball the size of a melon at the centre; the globe sits in a heavy"
    " brass half-ring cradle on a fat turned dark-wood column with a wide three-footed base. Only four rings, bold and simple, with clear gaps between them." + PLAIN + CHUNKY,
    "a large open globe made of several thick brass rings round a central ball, standing on a turned wooden column",
    ["an open sphere of several rings", "a stand or column under it"], ["a solid map globe", "thin wire rings", "writing or symbols"])
add("alch-formula-chalkboard", "alch-formula-chalkboard", "p3", 3, [STUDY, LAB, OBS], "a standing slate board on an easel",
    "A big SLATE BOARD in a thick honey-oak frame, about 4 ft wide and 3 ft tall, standing on a stout A-frame easel of thick oak legs so that the whole thing is about 6 ft tall and 2 ft"
    " deep, with a chunky chalk ledge along the bottom of the board holding a fat cloth and three fat sticks of chalk. The slate is dark charcoal grey with pale chalk smears and a few"
    " loose chalk circles, triangles and connecting lines drawn boldly on it like a geometry diagram: NO letters, NO numbers, NO magic symbols.",
    "a dark slate board in a wooden frame on an A-frame easel, with pale chalk diagrams on it",
    ["a dark board on a wooden easel or legs"], ["letters, numbers or writing", "a painting of a scene"])

# ---------------------------------------------------------------------------------------------------------------
# SUMMONING CHAMBER / ENCHANTER'S WORKSHOP
add("elemental-brazier", "elemental-brazier", "p1", 1, [SUMMON, WORK, SCRY], "a tall bronze ritual brazier",
    "A tall ritual BRAZIER about 3 ft high of dark bronze with green verdigris in the hollows: a wide, deep, round fire BOWL with a thick rolled rim and three fat lion-paw lugs, carried"
    " on three thick outward-curving legs that end in heavy clawed feet and are tied together by a fat bronze ring halfway down. The bowl is filled level with cold grey ash and a few"
    " lumps of black charcoal." + UNLITF + PLAIN + CHUNKY,
    "a tall dark bronze brazier: a deep round bowl on three thick curved legs with clawed feet",
    ["a round bowl on tall legs"], ["flames, glow or smoke", "runes or symbols"], bench=["fire"], light="brazier")
PYL = ("A standing FOCUS PYLON about 5 ft tall and 1.6 ft across: a thick four-sided pillar of dark grey-green stone that tapers a little toward the top, bound by two fat bronze bands,"
       " standing on its own slightly wider squared foot (part of the pillar, not a slab), and gripped in a heavy bronze four-claw socket on its top")
add("arcane-pylon--s1", "arcane-pylon", "p1", 1, [SUMMON, WORK], "a standing stone pylon topped with a large crystal",
    PYL + " ONE big pointed CRYSTAL as long as a forearm, a fat six-sided prism of opaque amethyst-plum colour with pale lilac facets. The stone faces are plain and smooth." + UNLITF + PLAIN,
    "a waist-thick stone pillar with bronze bands, a large pointed purple crystal held in a claw on its top",
    ["an upright pillar or post", "a large crystal on top of it"], ["glow, sparks or beams", "runes or carved symbols", "a lamp or torch flame"])
add("arcane-pylon--s2", "arcane-pylon", "sib1", 2, [SUMMON, WORK], "a second stone pylon topped with a cluster of crystals",
    PYL + " a CLUSTER of three fat pointed crystals of opaque warm amber-orange with pale honey facets, the middle one tallest. This pillar is a little shorter and has ONE bronze band and a"
    " chipped corner. The stone faces are plain and smooth." + UNLITF + PLAIN,
    "a waist-thick stone pillar with a bronze band, a cluster of amber crystals held on its top",
    ["an upright pillar or post", "crystals on top of it"], ["glow, sparks or beams", "runes or carved symbols"], parent="arcane-pylon--s1", what="crystal pylon", match="same")
add("portal-arch", "portal-arch", "p1", 1, [WORK, SUMMON], "a free-standing stone portal arch",
    "A free-standing stone ARCHWAY about 5 ft wide, 2 ft deep and 8.7 ft tall, EMPTY (you see the blue background straight through it): two massive square piers of pale grey-buff stone"
    " blocks, each on a fat moulded foot, carrying a thick ROUND arch of big wedge-shaped stones with a larger keystone; the opening is about 3.5 ft wide and 7 ft tall. Set into the"
    " face of the arch stones are seven fat round bosses of dull bronze, and one fist-sized amethyst-plum crystal is set in the keystone. Two shallow stone steps, the full width of the"
    " arch and part of it, lead up to the opening on the front. Moss in the joints. Nothing fills the opening." + UNLITF + PLAIN,
    "a heavy free-standing stone archway with nothing in its opening, round bosses on the arch and a crystal in its keystone",
    ["a free-standing arch with an open passage through it"], ["a door or gate in the opening", "a glowing or swirling surface in the opening", "a wall continuing beside it", "runes or symbols"],
    base=False, size=(56, 22, 92))  # (the catalog line is 10 ft tall and scalable: 92 in + the solver's 15% size variety stays under the 9-ft ceiling)
add("enchanting-table", "enchanting-table", "p1", 1, [WORK], "an enchanter's work table",
    "A massive ENCHANTER'S TABLE about 4 ft wide, 2.5 ft deep and 2.8 ft high: a thick slab top of dark green-black stone with a polished bevelled edge, on a heavy carved base of dark oak"
    " with four fat legs like upturned claws and a low shelf. Sunk in the middle of the top is a shallow round bronze dish holding ONE fist-sized amethyst-plum crystal on a small bronze"
    " stand; at one end lies a thick closed book with a plum-red cover and brass clasps, at the other a fat brass candlestick with an unlit cream candle, a short wand of pale wood and a"
    " heap of three loose gems (amber, green, red). A deep-plum velvet cloth with a plain gold-ochre border hangs over one end." + PLAIN,
    "a heavy dark table with a stone top, a large purple crystal on a stand in the middle of it, a thick book, a candlestick and gems",
    ["a sturdy table", "a crystal or orb displayed on it"], ["glow or sparkles", "a floating book", "runes or symbols", "food"], bench=["fire"], light="candle")
add("crystal-formation--s1", "crystal-formation", "p2", 2, [WORK, SUMMON, SCRY], "a large cluster of crystals growing from rock",
    "A big natural CRYSTAL FORMATION about 3 ft across and 4 ft tall: seven fat six-sided pointed crystals of opaque amethyst-plum with pale lilac facet highlights, the tallest in the"
    " middle and the others leaning outward, growing as ONE solid fused mass out of a low lump of rough dark grey rock that is part of the object." + UNLITF + CHUNKY,
    "a cluster of big pointed purple crystals growing out of a lump of dark rock", ["several large pointed crystals joined in one cluster"], ["glow", "blue crystals", "loose separate shards"],
    size=(36, 36, 48))
add("crystal-glowing", "crystal-glowing", "p3", 3, [WORK, SUMMON, SCRY, STUDY], "a small cluster of amber crystals",
    "A small CRYSTAL CLUSTER about 1.5 ft across and 2 ft tall: four fat six-sided pointed crystals of opaque warm amber-orange with pale honey facets, fused together at the bottom in a"
    " knob of dark rock." + UNLITF + CHUNKY,
    "a small cluster of pointed amber-orange crystals on a knob of rock", ["pointed crystals joined in one cluster"], ["glow", "blue crystals"])

# ---------------------------------------------------------------------------------------------------------------
# OBSERVATORY
add("telescope-great", "telescope-great", "p1", 1, [OBS], "a great brass telescope on a heavy mount",
    f"A GREAT TELESCOPE about 7 ft long: a very fat tapering tube of {BRASS}, as thick as a barrel at the big end and as a thigh at the eyepiece, bound by three dark iron bands, tilted"
    " steeply UPWARD at about 45 degrees. It rests in a massive fork of dark oak beams on a heavy square oak carriage with four small solid wooden wheels; a fat brass hand-wheel and a"
    " toothed quarter-circle arc of brass sit at the side of the fork, and a small two-step oak stool is built onto the carriage under the eyepiece end. The carriage is about 4 ft wide"
    " and the whole thing is about 7.5 ft tall." + PLAIN + CHUNKY,
    "a very large brass telescope tube pointing up at an angle, carried on a heavy wooden wheeled mount",
    ["a large telescope tube tilted upward", "a heavy stand or carriage under it"], ["a cannon with a fuse or cannonballs", "a thin tripod", "a person"])
add("orrery", "orrery", "p2", 2, [OBS, STUDY], "a brass orrery on a pedestal",
    f"A mechanical ORRERY about 3 ft across and 4 ft tall, of {BRASS}: a fat round drum-shaped base case with a toothed edge on a turned dark-wood pedestal column with a wide foot; from"
    " the middle of the drum rises a thick post carrying a big golden-ochre SUN ball the size of a melon, and around it FIVE planet balls of different sizes and colours (burgundy,"
    " moss green, cream, amber, plum) each on its own very thick curved brass arm at a different height and distance, like a candelabrum. One fat brass crank handle on the drum." + PLAIN + CHUNKY,
    "a brass machine on a pedestal with a large central ball and several smaller coloured balls on thick arms round it",
    ["a central ball with several smaller balls on arms around it"], ["thin wire arms", "a map globe", "candles or flames"])

# ---------------------------------------------------------------------------------------------------------------
# SCRYING ROOM
add("scrying-pool", "scrying-pool", "p1", 1, [SCRY], "a round stone scrying basin",
    "A big round SCRYING BASIN about 4 ft across and 2.5 ft high, carved from pale grey-buff stone: a wide, shallow, clearly HOLLOW bowl with a broad flat rim a hand wide, carried on a"
    " fat fluted drum pedestal with a moulded foot that is part of the piece. Eight fat round bosses of dull bronze are set at even spacing round the outside of the rim, and the inside"
    " of the bowl is a darker smooth charcoal-grey stone." + DRY + PLAIN,
    "a wide shallow round stone basin, empty and hollow, on a thick pedestal",
    ["a wide round bowl or basin on a pedestal", "the bowl is empty and hollow"], ["water painted in it", "a fountain spout or statue", "glow", "runes or symbols"], bench=["water"])
add("orb-socket-pedestal", "orb-socket-pedestal", "p1", 1, [SCRY, STUDY, WORK], "a great crystal ball on a pedestal",
    "A waist-high PEDESTAL about 1.5 ft across and 3.4 ft tall overall: a fat twisted column of dark oak on a wide round stepped foot, carrying a heavy bronze cup of three thick claws, and"
    " held in the claws ONE great CRYSTAL BALL the size of a pumpkin (about 14 in across), painted as OPAQUE milky pearl-white glass with soft swirls of pale lilac and grey inside and one"
    " soft highlight. A deep-plum velvet cloth with a gold-ochre fringe is draped over the top of the column under the claws." + UNLITF + PLAIN,
    "a large milky-white crystal ball held in bronze claws on top of a waist-high wooden pedestal",
    ["a large round ball on top of a pedestal or stand"], ["glow or sparkles", "a see-through or blue ball", "a map globe", "a face in the ball"])
add("pillows-cushions", "pillows-cushions", "p3", 3, [SCRY, BED], "a pile of big floor cushions",
    "A low PILE of five big plump floor CUSHIONS about 3 ft wide and 1.5 ft high, heaped together as one solid mass: two large square ones underneath in deep burgundy and plum velvet,"
    " a round moss-green one, an ochre bolster and a small cream one on top, each with fat piped edges and a fat tassel at one corner. Plain cloth, no patterns or symbols.",
    "a heap of several plump cushions in burgundy, plum, green and ochre", ["several cushions piled together"], ["a bed or sofa under them", "a person or animal"], smooth=True)

# ---------------------------------------------------------------------------------------------------------------
# STORE / APOTHECARY SHOP
add("alch-counter-apothecary", "alch-counter-apothecary", "p1", 1, [SHOP], "an apothecary's shop counter",
    "A long apothecary's SHOP COUNTER about 8 ft long, 2.3 ft deep and 3.2 ft high, of warm honey oak: a thick polished top on a panelled front of five raised panels with a moulded"
    " plinth, the back open with one shelf. Standing ON the counter, big and widely spaced: at one end a big brass BALANCE SCALE with two fat pans on a chunky pillar; in the middle a"
    " row of four fat apothecary JARS with domed lids (cream stoneware with one broad plain band each in plum-red, moss green, ochre, burgundy; NO labels); then a large stone mortar"
    " with a pestle; at the other end a slanted little display stand holding six fat potion bottles in red, green and amber." + GLASS + PLAIN,
    "a long panelled wooden shop counter with a brass balance scale, a row of lidded jars, a mortar and potion bottles standing on it",
    ["a long counter", "jars or bottles and a scale standing on it"], ["beer taps, tankards or barrels", "food", "writing or labels", "a person"])
add("alch-sign-apothecary", "alch-sign-apothecary", "p2", 2, [SHOP], "an apothecary's hanging shop sign",
    "A hanging SHOP SIGN about 22 in wide and 22 in tall: a thick dark iron wall bracket (a stout bar with one fat curled brace under it) from which hangs, on two fat iron links, a thick"
    " carved wooden board cut in the SHAPE of a big mortar bowl with a pestle sticking out of it at an angle, painted cream with moss-green and ochre shading and a dark outline rim cut"
    " into the wood. NO letters." + CHUNKY,
    "a wooden sign shaped like a mortar and pestle hanging from an iron wall bracket", ["a hanging sign in the shape of a bowl with a pestle"], ["letters or words"], hung=True, base=False)
add("alch-potion-crate-straw", "alch-potion-crate-straw", "p2", 2, [STORE, SHOP, LAB], "an open crate of potion bottles packed in straw",
    "An open wooden CRATE about 20 in long, 14 in wide and 12 in high, of thick pale planks with rope handles, packed with golden straw from which stick up the fat shoulders and corked"
    " necks of NINE potion bottles in three rows: plum-red, moss green and amber. The lid leans against one side, touching it." + GLASS,
    "an open wooden crate of straw with rows of coloured corked bottles standing in it", ["an open crate or box", "several coloured bottles in it"], ["writing on the crate", "food"])

# ---------------------------------------------------------------------------------------------------------------
# BEDCHAMBER
add("bed-canopy--wizard", "bed-canopy", "p1", 1, [BED], "a wizard's curtained four-poster bed",
    "A tall four-poster BED about 5.5 ft wide, 7 ft long and 7 ft high of dark carved oak: four fat turned posts carrying a flat wooden tester roof with a deep plum-purple pelmet edged"
    " with a plain gold-ochre band; heavy deep plum-purple curtains hang at the four corners, tied back to the posts with fat gold-ochre cords, so the bed itself is open to view. A high"
    " carved headboard, a thick mattress with a deep burgundy quilted cover folded back over cream sheets, two fat cream pillows, and a moss-green blanket folded across the foot. A thick"
    " closed book lies on the cover. The cloth is PLAIN: no stars, moons or patterns." + PLAIN,
    "a tall dark wooden four-poster bed with deep purple curtains tied back at the posts and a burgundy cover",
    ["a four-poster bed with a canopy or tester", "purple or plum curtains"], ["a person", "stars, moons or patterns on the cloth"], tier="wizard", smooth=True)
add("hatstand-wizard", "hatstand-wizard", "p1", 1, [BED, STUDY], "a coat stand with a wizard's robe and pointed hat",
    "A stout wooden COAT STAND about 6.3 ft tall: a thick turned dark-oak pole on a heavy three-footed base, with four fat curved pegs near the top. Hanging from the pegs and wrapped"
    " round the pole as ONE thick solid mass is a long WIZARD'S ROBE of deep plum-purple cloth with wide sleeves and a broad plain gold-ochre hem and cuffs, reaching nearly to the floor;"
    " and perched on the very top of the pole a tall POINTED wizard's HAT of the same plum cloth with a wide floppy brim, a bent tip and a plain gold-ochre band. A gnarled wooden staff"
    " as thick as a wrist leans in against the robe, touching it along its length. The cloth is PLAIN: no stars, moons or symbols. The robe is EMPTY: no body, no face, no hands.",
    "a coat stand with a long purple robe hanging on it and a tall pointed purple hat on top",
    ["a tall pointed hat with a brim", "a long robe hanging below it on a stand"], ["a person, face or hands", "stars, moons or symbols on the cloth", "blue cloth"], smooth=True)
add("alch-familiar-perch", "alch-familiar-perch", "p2", 2, [BED, MENAG, STUDY], "a standing perch for an owl or raven",
    "A standing bird PERCH about 3.7 ft tall and 1.5 ft wide, EMPTY: a fat turned dark-oak post on a heavy round foot, with a thick T-shaped cross bar on top whose bar is wrapped in"
    " scratched tan leather; under the cross bar a shallow round brass tray (a dropping pan) is fixed to the post, and a fat brass seed cup hangs at one end of the bar." + CHUNKY,
    "an empty T-shaped wooden bird perch on a post with a round tray under the bar", ["a T-shaped perch on an upright post"], ["a bird or animal on it", "a cage"])
add("wizard-hat", "wizard-hat", "p3", 3, [BED, STUDY, SHOP], "a tall pointed wizard's hat",
    "A tall POINTED wizard's HAT about 14 in across and 20 in high, sitting on its own wide floppy brim: thick deep plum-purple felt, the cone creased and its tip bent over, with a plain"
    " gold-ochre band and a fat brass buckle. The cloth is PLAIN: no stars, moons or symbols.",
    "a tall pointed purple hat with a wide brim and an ochre band", ["a tall pointed hat with a wide brim"], ["a head or face under it", "stars or symbols", "blue cloth"], smooth=True)

# ---------------------------------------------------------------------------------------------------------------
# FAMILIARS' MENAGERIE
add("birdcage-standing", "birdcage-standing", "p1", 1, [MENAG, BED], "a tall standing birdcage",
    f"A tall floor-standing BIRDCAGE about 2.2 ft across and 6.2 ft tall overall, of {BRASS}, EMPTY: a big round cage with a domed top, made of TWELVE very thick vertical bars (each as"
    " thick as a thumb, widely spaced) between a solid deep round base tray and a thick top ring, the bars curving in over the dome to a fat ball finial with a ring; one thick horizontal"
    " band round the middle; a fat wooden perch bar across the inside and a small arched door outlined on the front. The cage sits on a stout turned dark-wood column with a wide"
    " three-footed base." + CHUNKY,
    "a tall round domed brass birdcage with thick bars, empty, on its own wooden stand", ["a domed cage of vertical bars", "a stand or column under the cage"], ["a bird or animal in it", "thin wire bars"])
add("vivarium", "vivarium", "p2", 2, [MENAG, LAB], "a planted glass tank on a stand",
    "A VIVARIUM about 4 ft wide, 1.8 ft deep and 4.7 ft tall: a long box tank with a thick dark-oak frame (fat corner posts and rails) and a hinged plank lid with two round brass"
    " grilles, standing on a stout oak table base with four fat legs and a low shelf holding a sack and a jar. The tank's panes are painted as OPAQUE pale sage-green misted glass, and"
    " painted on them as soft solid shapes seen through the mist: a mound of brown earth and grey rocks along the bottom, three fat fern clumps, a mossy branch and a fat red-capped"
    " toadstool. NO animal in it." + LEAFY + PLAIN,
    "a long wood-framed glass tank on a table stand, with ferns, rocks and a branch showing inside it",
    ["a box-shaped tank with a wooden frame", "plants or rocks showing inside"], ["an animal, snake or fish", "water filling the tank", "blue glass"])
add("animal-hutch", "animal-hutch", "p2", 2, [MENAG], "a two-tier wooden animal hutch",
    "A two-storey ANIMAL HUTCH about 4 ft wide, 2 ft deep and 4.3 ft tall of pale weathered planks on four fat legs, with a sloping plank roof that overhangs the front. Each storey has"
    " on the left a barred run front of FIVE thick wooden bars with dark shadow painted behind them and straw poking out between them along the bottom, and on the right a solid plank"
    " sleeping box with a small round entrance hole and a fat wooden turn-button. A little ramp of thick plank with cross cleats leans from the upper storey to the ground at one end,"
    " touching the hutch. EMPTY: no animal." + CHUNKY,
    "a two-tier wooden hutch on legs with barred fronts, straw showing, and a sloping roof", ["a wooden hutch or cage with bars on its front", "two tiers or compartments"], ["an animal in it", "thin wire mesh"])
add("egg-nest-great", "egg-nest-great", "p2", 2, [MENAG, WORK], "a great nest holding one huge egg",
    "A great round NEST about 2.8 ft across and 1.2 ft high, woven of very thick brown sticks and golden straw as ONE solid bowl-shaped mass with a few big cream feathers pressed into"
    " its rim, and sitting in the middle of it ONE HUGE EGG about 18 in tall, standing on its fat end: a smooth warm cream shell covered with bold rust-red and plum speckles, with one"
    " soft highlight." + CHUNKY,
    "a big round nest of sticks and straw with one very large speckled egg sitting in it", ["a nest of sticks or straw", "one large egg in it"], ["several eggs", "a bird or creature", "a crack with something hatching"])
add("perch-tree", "perch-tree", "p2", 2, [MENAG], "a dead tree limb set in a tub as a bird perch",
    "A PERCH TREE about 6.5 ft tall and 3.3 ft across: a bare, pale, barkless dead tree limb as thick as a thigh, set upright in a stout oak half-barrel tub filled with stones, forking"
    " into FOUR very thick stubby branches (each as thick as an arm, ending in blunt cut ends) that spread at different heights; the top of each branch is scuffed and whitened. A fat"
    " brass feeding dish is strapped to one branch and a big dark feather lies caught in a fork. NO leaves, NO twigs, NO birds." + CHUNKY,
    "a bare pale tree limb with a few thick stubby branches standing upright in a wooden tub", ["a bare branching tree limb standing upright", "a tub or barrel at its foot"], ["leaves or thin twigs", "a bird or animal on it"])

# ---------------------------------------------------------------------------------------------------------------
# SMALLS (surface pieces: a few big bold ones, since nothing smaller reads from the table)
add("alembic", "alembic", "p3", 3, [LAB, WORK], "a table-top alembic",
    "A table-top ALEMBIC about 18 in long and 2 ft tall: a fat round-bellied flask of OPAQUE deep green glass standing on a stout iron tripod over a squat brass burner, capped by a"
    " fat cone-shaped copper head from which ONE thick copper spout (thick as two thumbs) slopes down into a squat amber receiving bottle standing beside it and touching the tripod's"
    " foot ring. All on one thick round wooden board that is part of the piece." + GLASS + UNLITF,
    "a round green flask on a tripod with a cone-shaped copper cap and a thick spout running down to a small amber bottle",
    ["a round flask on a stand", "a spout or pipe leading from its top down to a second vessel"], ["thin coiled glass tubing", "flames", "blue glass"], base=False)
add("potion-bottles--s1", "potion-bottles", "p3", 3, [LAB, STORE, SHOP, WORK], "a cluster of potion bottles",
    "A tight CLUSTER of five fat potion bottles standing together and touching, about 10 in across and 9 in tall: a round plum-red one with a long neck, a squat moss-green one, a tall"
    " amber one with square shoulders, a small ochre teardrop and a cream stoneware pot, each with a fat cork or a waxed cloth cap tied with cord." + GLASS,
    "a group of five fat stoppered or capped bottles and pots in red, green, amber and cream standing together", ["several coloured bottles standing together"], ["labels with writing", "blue glass", "a rack or crate"])
add("potion-bottles--s2", "potion-bottles", "p3", 3, [LAB, STORE, SHOP, WORK], "a second cluster of potion bottles",
    "A tight CLUSTER of four big potion bottles standing together and touching, about 10 in across and 10 in tall: a big round-bellied moss-green flask with a short neck, a tall"
    " burgundy bottle with a ball stopper, a fat amber jar with a cloth cap, and a small plum heart-shaped bottle in front, each stoppered." + GLASS,
    "a group of four fat stoppered bottles and flasks in green, burgundy, amber and plum standing together", ["several coloured bottles standing together"], ["labels with writing", "blue glass"])
add("crystal-ball", "crystal-ball", "p3", 3, [SCRY, STUDY, SHOP, BED], "a crystal ball on a small stand",
    "A table-top CRYSTAL BALL about 8 in across on a low stand, 11 in tall overall: an OPAQUE milky pearl-white glass ball with soft swirls of pale lilac and grey and one soft highlight,"
    " sitting in a squat three-clawed bronze stand on a fat round dark-wood base." + UNLITF,
    "a milky-white ball sitting on a small three-clawed stand", ["a round ball on a small stand"], ["glow", "a blue or see-through ball", "a face in the ball"], size=(8, 8, 11))
add("tome-grimoire", "tome-grimoire", "p3", 3, [STUDY, SUMMON, WORK, BED], "a heavy closed grimoire",
    "A very thick closed BOOK lying flat, about 14 in long, 10 in wide and 4 in thick: a plum-red leather cover with fat brass corner pieces, two wide brass clasps across the fore-edge,"
    " thick raised bands on the spine and a big plain oval brass boss in the middle of the cover; cream page edges; a burgundy ribbon marker sticking out." + PLAIN,
    "a thick closed book with a dark red cover, brass corners and clasps, lying flat", ["one thick closed book"], ["writing, runes or a face on the cover", "glow", "an open book"])
add("scroll-pile", "scroll-pile", "p3", 3, [STUDY, OBS, WORK, SUMMON], "a pile of rolled scrolls",
    "A small PILE of six fat rolled scrolls of cream parchment lying heaped together and touching, about 12 in across and 5 in high, two tied with burgundy ribbon, one with a fat red wax"
    " seal blob, one partly unrolled showing a blank cream inside with a curled end.",
    "a heap of fat rolled parchment scrolls, some tied with red ribbon", ["several rolled scrolls heaped together"], ["writing", "a rack"])
add("mortar-pestle", "mortar-pestle", "p3", 3, [LAB, SHOP, STORE], "a stone mortar and pestle",
    "A big stone MORTAR about 8 in across and 7 in tall, a thick-walled bowl of speckled grey-green stone on a small foot, with a fat stone PESTLE standing in it and leaning on the rim,"
    " and a little heap of ochre powder painted in the bottom.",
    "a thick stone bowl with a fat stone pestle leaning in it", ["a small thick bowl with a pestle in it"], ["a wooden spoon", "food"], size=(8, 8, 8))
add("alch-hourglass-sand-colored", "alch-hourglass-sand-colored", "p3", 3, [STUDY, OBS, WORK], "a big hourglass",
    "A big HOURGLASS about 8 in across and 14 in tall: two fat glass bulbs painted as OPAQUE cream glass, the lower one filled with ochre-orange sand to half its height, held between two"
    " thick round dark-wood end plates joined by FOUR fat turned wooden posts." + GLASS,
    "an hourglass with two fat bulbs between round wooden ends joined by thick posts", ["two bulbs joined at a narrow waist, in a frame of posts"], ["glow", "blue glass", "thin rods"],
    size=(8, 8, 14))
add("alch-mandrake-pot", "alch-mandrake-pot", "p3", 3, [LAB, SHOP, MENAG], "a potted mandrake",
    "A fat terracotta flowerpot about 8 in across holding a MANDRAKE plant, 14 in tall overall: a rosette of six broad, thick, dark moss-green leaves painted as one solid tuft with two"
    " fat purple berries, and showing above the brown earth the knobbly pale tan shoulders of a fat forked root, like a lumpy turnip. NO face on the root." + LEAFY,
    "a clay flowerpot with a tuft of broad green leaves and a lumpy pale root showing above the earth", ["a plant in a pot"], ["a face on the root", "flowers in a vase"], size=(8, 8, 14))


assets[:] = [a for a in assets if a]
for a in assets:  # anything cloth, fur or feather: the crypt's lesson (woolly things come back as mush)
    if a.pop("smooth", False):
        a["prompt"] = a["prompt"].replace("Show exactly this one object", "All cloth is SMOOTH, painted as one flat solid surface with a few big soft folds, never fuzzy, furry or frayed. Show exactly this one object")
ids = [a["id"] for a in assets]
assert len(ids) == len(set(ids)), [i for i, n in Counter(ids).items() if n > 1]
by = {a["id"]: a for a in assets}
for a in assets:
    assert a["object"] in roles and roles[a["object"]].get("size"), a["id"]
    assert a["group"] in ("p1", "p2", "p3", "sib1", "sib2"), a["id"]
    if a["group"].startswith("sib"):
        pg = by[a["parent"]]["group"]
        assert (a["group"] == "sib1" and pg == "p1") or (a["group"] == "sib2" and pg in ("p2", "sib1")), (a["id"], a["group"], a["parent"], pg)
    if a.get("light"):
        assert "UNLIT" in a["prompt"] or "unlit" in a["prompt"], a["id"]
    for bad in (" rune-carved", "glowing "):
        assert bad not in a["prompt"], (a["id"], bad)
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets:
    (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(assets), "assets", "groups", dict(sorted(Counter(a["group"] for a in assets).items())), "prio", dict(sorted(Counter(a["prio"] for a in assets).items())))
print("bench", dict(Counter(b for a in assets for b in a["bench"])), "hung", sum(1 for a in assets if a.get("hung")), "lights", sum(1 for a in assets if a.get("light")),
      "roles", len({a["object"] for a in assets}))
