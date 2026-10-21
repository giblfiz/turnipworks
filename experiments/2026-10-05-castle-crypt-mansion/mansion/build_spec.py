#!/usr/bin/env python3
"""Mansion (2026-10-05): every NEW mesh the mansion room types want. Design only: this writes assets.json (and
prompts/) in the yard batch's format (experiments/2026-10-05-yard-props/build_spec.py) for src/plate_gate_batch.py.
Nothing here calls an image model.

Groups say WHEN a plate can be painted, prio says how much the piece matters:
  p1 / p2 / p3   independent pieces (style reference only)
  sib1           painted FROM the accepted plate of a p1 piece (a wall's window and doorway from the wall, a suite
                 from its first piece, a second shape from the first)
  sib2           painted from the accepted plate of a p2 piece, OR from a sib1 plate (the open twin of a window or
                 cupboard that is itself a sibling: two steps deep, so it must run after sib1 is accepted)
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
WSTYLE = """Geometry: stout, miniature-compatible proportions; thick mouldings, rails and glazing bars; broad soft bevels; deep readable carving rather than fine detail; sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Avoid: invented handles, ring pulls, levers, knobs, hooks or pegs sticking out of the wall; pictures, mirrors, lamps, curtains or furniture on the wall; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, seen from the front at a slight three-quarter angle from slightly above{same}, clear space around every edge, perfectly uniform solid chroma-blue background, no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. The blue background is a removable mask and must not reflect blue light onto the asset; the wall itself has NO blue anywhere; where the wall has a real hole, the blue background shows through it."""
WTAIL = (" ONE single straight wall section standing upright, a tall narrow panel about 5 ft wide x 9 ft tall x 1 ft thick (almost twice as tall as wide)."
         " Nothing else: NO floor, NO ground, NO base slab or platform under it, NO ceiling, NO roof, NO corner return, NO furniture, pictures or decorations attached."
         " Both side edges are clean flat vertical cuts with nothing sticking out past them, and every horizontal moulding (skirting, rail, cornice) runs level from edge to edge at the"
         " same height, so that copies placed side by side make one continuous wall. The front face is the room-facing side; the back face is plain smooth cream render."
         " Keep the WHOLE object well inside the frame with a generous margin.")
FAMILIES = {
 "noble-panel": {"rooms": ["entrance-hall", "dining-room", "library"],
   "what": "oak-panelled wall",
   "desc": ("dark oak wainscot panelling from the floor up to about 6 ft (two thirds of the height): a deep skirting board, then TWO tiers of raised rectangular panels,"
            " three panels across, capped by a thick moulded plate rail; above the rail smooth warm cream plaster up to a small moulded cream cornice at the very top."
            " The oak is a deep warm brown with honey highlights on the panel edges, not black"),
   "short": "a wall of dark oak panelling to two thirds of its height with cream plaster above",
   "must": ["dark wood panelling covers the lower half or more of the wall", "pale plaster above the panelling"],
   "s2": "The panelling is laid out differently: in each tier ONE wide central panel flanked by two narrow upright panels, and the top tier's central panel carries a simple carved lozenge. Everything else is the same."},
 "noble-paper": {"rooms": ["drawing-room", "master-bedroom", "ballroom"],
   "what": "wallpapered wall",
   "desc": ("a low dado about 3 ft high of cream-painted wood panelling (a skirting board, three plain raised panels across, a moulded chair rail on top); above the chair rail,"
            " WALLPAPER up to a small moulded cream cornice at the very top: a soft sage-green ground with a large damask pattern of darker moss-green leafy medallions"
            " arranged in THREE vertical columns of four, picked out with thin ochre lines. The side edges fall in the plain ground between columns, never through a medallion"),
   "short": "a wall with patterned sage-green damask wallpaper above a low cream-painted panelled dado",
   "must": ["patterned wallpaper covers the upper two thirds of the wall", "a low pale panelled dado with a rail below the wallpaper"],
   "s2": "The same wall painted again by hand: the same paper, dado and cornice at the same heights, with small natural differences: the medallions are drawn a little differently (some with a small ochre flower at the centre) and the paper is very slightly faded toward the top. Everything else is the same."},
 "conservatory": {"rooms": ["conservatory"],
   "what": "glasshouse wall",
   "desc": ("a knee-high plinth wall (about 2 ft) of warm red-brown brick with a cream stone coping; above it a glasshouse screen of THICK cream-painted glazing bars:"
            " three tall panes across, divided once by a horizontal bar at about 7 ft, with three small round-arched panes above that bar under a stout cream top rail."
            " The panes are opaque frosted glass painted pale mint-cream with soft cream streaks (NOT blue and NOT see-through)"),
   "short": "a glasshouse wall: a low brick plinth carrying tall cream-framed panes of pale frosted glass",
   "must": ["a low brick base", "the wall above the base is mostly large pale glass panes in thick pale glazing bars"],
   "s2": "The middle tall pane is a hinged ventilator: it has its own thicker cream frame and a chunky brass stay at the bottom, and a little green climbing plant is painted on the INSIDE of the left pane as a solid leafy mass. Everything else is the same."},
}
WNOT = ["a floor, base slab, ceiling or corner return", "a picture, mirror, lamp, curtain or furniture on the wall", "blue or see-through glass"]


def wall(sku, obj, group, prio, fam, subject, design, desc, must, must_not=(), parent=None, parent_path=None, size=(60, 12, 108), **extra):
    f = FAMILIES.get(fam, {})
    if parent:
        intro = (f"Create a new single asset in the Turnip Works house style (heroic hand-painted): {subject}.\n\n"
                 f"The supplied image is the existing plain wall section of this same room. The new piece must look cut from the same wall: the SAME materials and colours,"
                 f" the same skirting, rail and cornice at the SAME heights, the same overall size and proportions, painting style and camera angle. Change ONLY what is described below.")
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


for fam, f in FAMILIES.items():
    p = f"wall-straight--{fam}"
    wall(p, "wall-straight", "p1", 1, fam, f"{f['what']} section", f"A wall with {f['desc']}.", f["short"], f["must"], ["a window", "a door or opening"])
    wall(p + "--s2", "wall-straight", "sib1", 1, fam, f"second version of the {f['what']} section", f"The same wall: {f['desc']}. {f['s2']}", f["short"], f["must"],
         ["a window", "a door or opening"], parent=p)
    arch = "glazing bars" if fam == "conservatory" else "a moulded architrave"
    wall(f"wall-doorway--{fam}", "wall-doorway", "sib1", 1, fam, f"{f['what']} section with an empty door opening",
         f"The same wall with an EMPTY door-sized opening through it, starting at the very bottom: about 3 ft wide and 7 ft tall, centred left to right, NO door leaf, NO threshold step."
         f" The opening is framed by {arch} of the wall's own woodwork with a small flat cornice over it, and it has plain reveals a foot deep. About 1 ft of wall remains on each side"
         f" and the wall continues unbroken above the opening up to the cornice. You can see straight through the opening to the blue background.",
         f"{f['short']}, with one empty door-sized opening through it (no door leaf)",
         ["one door-sized opening that reaches the bottom of the wall, with NO door in it (you can see through)", "wall continues above the opening"],
         ["a door leaf filling the opening", "a window"], parent=p, bench=[])
    if fam == "conservatory":
        continue
    under = ("the oak panelling is cut round its lower half and the bottom tier of panels runs unbroken under the sill" if fam == "noble-panel" else "the sill sits on the chair rail and the cream dado runs unbroken under it")
    wsku = f"wall-window-small--{fam}"
    wall(wsku, "wall-window-small", "sib1", 1, fam, f"{f['what']} section with a tall mansion window",
         f"The same wall with ONE tall mansion window, centred left to right: the opening about 3 ft wide x 5 ft tall, its sill about 3 ft above the floor and its head about 1 ft below the cornice;"
         f" {under}. A broad moulded wooden architrave frames it and a thick sill projects a little. The window is CLOSED by a pair of tall glazed casement leaves meeting in the middle,"
         f" each leaf one pane wide and four panes tall in THICK glazing bars. The panes are opaque, painted a pale warm cream-grey like bright daylight on glass (NOT blue, NOT see-through)."
         f" No curtains, no shutters, no flower box.",
         f"{f['short']}, with one tall closed window of small panes in thick glazing bars",
         ["exactly one tall window, clearly taller than wide, roughly centred", "the window is glazed with several panes in thick glazing bars and is closed"],
         ["more than one window", "a door", "curtains or shutters"], parent=p)
    base_record(f"wall-window-small-open--{fam}", "wall-window-small-open", "sib2", 2, f["rooms"], f"the same {f['what']} window with its casements open", (60, 24, 108),
                "Edit task. The supplied image shows a wall section with a tall glazed mansion window in the Turnip Works hand-painted house style. Show the SAME object: identical wall,"
                " mouldings, colours, window frame, proportions (about 5 ft wide x 9 ft tall x 1 ft thick) and painting style. Do not redesign it.\n\nShow this same wall with its two glazed"
                " casement leaves swung fully OPEN toward the viewer, each standing out at a right angle from the wall at its own side of the window, hinged on the window frame. The window"
                " opening is now clear: you can see straight through it to the blue background. Keep the wall section identical. Thick, chunky casement leaves so the open shape reconstructs"
                " cleanly in 3D; their panes stay opaque pale cream-grey. Camera: the same three-quarter view from slightly above as in the supplied image.\n\n" + WSTYLE.format(same=" (the same camera as the supplied image)") + "\n",
                [str(HERE / "inputs" / f"{wsku}.jpg")], [str(HERE / "inputs" / f"{wsku}.jpg")],
                f"{f['short']}, with one tall window whose two glazed leaves are swung OPEN, the opening clear",
                ["one single upright wall section, taller than it is wide", "the window's leaves are OPEN and the opening is clear (you can see through it)",
                 "it is the SAME object as the REFERENCE (same wall, colours, frame, proportions), only with the window opened"],
                WNOT[:2] + ["a closed window", "a door"], {"family": fam, "generation": "kit", "twin_of": wsku, "parent": wsku, "bench": ["hinge"]})

# the existing noble-interior family (cream plaster over a honey wainscot: experiments/2026-10-01-walls) has a wall and a window but no doorway of its own
wall("wall-doorway--noble-interior", "wall-doorway", "sib1", 1, "noble-interior", "plaster-and-wainscot wall section with an empty door opening",
     "The same wall (smooth warm cream plaster above a honey wood wainscot with a simple dado rail) with an EMPTY door-sized opening through it, starting at the very bottom:"
     " about 3 ft wide and 7 ft tall, centred left to right, NO door leaf, NO threshold step. A plain honey wood architrave frames the opening. About 1 ft of wall remains on each side"
     " and the plaster continues unbroken above the opening. You can see straight through the opening to the blue background.",
     "a wall of cream plaster over a honey wood wainscot with one empty door-sized opening through it (no door leaf)",
     ["one door-sized opening that reaches the bottom of the wall, with NO door in it (you can see through)", "wall continues above the opening"],
     ["a door leaf filling the opening", "a window"], parent="wall-straight--noble-interior",
     parent_path=str(ROOT / "experiments/2026-10-01-walls/inputs/wall-straight--noble-interior.jpg"), rooms=["servants-kitchen", "entrance-hall"])

# --- door leaves (leaf only, like experiments/2026-10-01-doors: the engine hangs and rotates them)
LEAF = (" ONLY the door leaf itself, as if lifted off its hinges: NO door frame, NO jambs, NO lintel, NO surrounding wall, NO threshold. Standing upright, closed and flat,"
        " seen from the front at a slight angle; the edges of the door are the edges of the object.")
add("door-panelled--leaf", "door-panelled", "p1", 1, ["entrance-hall", "drawing-room", "dining-room", "library", "master-bedroom"], "a six-panel polished mansion door leaf",
    "A tall single door of polished dark walnut-brown wood about 3 in thick, with SIX deep raised panels in a thick frame (two small square panels at the top, two tall panels in the middle,"
    " two medium panels at the bottom) and ONE chunky round brass knob on a small brass plate at mid height on the right. No ironwork, no studs, no ring." + LEAF,
    "a tall single wooden door leaf with six raised panels and one brass knob, without a frame", ["one door leaf with raised panels", "no door frame or wall around it"],
    ["iron straps, studs or a ring handle", "a door frame, wall or threshold", "two door leaves"], bench=["hinge"], piece="leaf")
add("door-double-grand--fine-leaf", "door-double-grand", "sib1", 1, ["entrance-hall", "ballroom", "dining-room"], "a pair of tall panelled mansion door leaves",
    "Two tall matching door leaves side by side and touching in the middle (a closed double door), together about 6 ft wide and 10 ft tall, each leaf with FOUR deep raised panels"
    " one above the other in a thick frame, a carved leafy moulding along the top rail, and one chunky round brass knob beside the meeting edge at mid height. No ironwork, no studs." + LEAF,
    "a closed pair of tall wooden door leaves with raised panels and brass knobs, without a frame", ["two matching leaves meeting in the middle", "raised panels"],
    ["iron straps, studs or ring pulls", "a door frame, wall or threshold"], parent="door-panelled--leaf", what="polished walnut door", match="kit", bench=["hinge"], tier="fine", piece="leaf")
add("door-glazed--leaf", "door-glazed", "p2", 2, ["conservatory", "garden"], "a glazed garden door leaf",
    "A tall single cream-painted door about 3 in thick: the upper two thirds glazed with THICK cream glazing bars making two columns of three panes, the panes opaque frosted glass painted"
    " pale mint-cream (NOT blue, NOT see-through); the lower third one deep raised panel; one chunky round brass knob at mid height on the right." + LEAF,
    "a tall single cream door leaf with glass panes in its upper part and a panel below, without a frame", ["one door leaf", "several glass panes in thick glazing bars in the upper part"],
    ["a door frame, wall or threshold", "blue glass"], bench=["hinge"], piece="leaf")

# ---------------------------------------------------------------------------------------------------------------
# FOCAL PIECES
ALL_FINE = ["drawing-room", "dining-room", "library", "master-bedroom"]
add("fireplace-marble", "fireplace-marble", "p1", 1, ALL_FINE, "a carved marble chimneypiece with a gilt overmantel mirror",
    "A grand drawing-room fireplace as ONE flat-backed wall piece, tall and narrow. BOTTOM half: a chimneypiece of creamy white marble with soft grey-ochre veins: two stout carved"
    " console jambs, a deep frieze with one carved shell in the middle, a thick projecting mantel shelf, and a wide square firebox lined with dark sooty brick, EMPTY (no fire, no logs, no grate)."
    " A marble hearth slab the width of the chimneypiece lies in front, only a few inches proud. TOP half, standing on the mantel shelf and the same width as the frieze: a tall overmantel mirror"
    " in a THICK carved gilt frame with a scrolled crest; the mirror glass is painted a soft pale silver-grey with two broad cream reflection streaks (NOT blue). Nothing on the mantel shelf.",
    "a white marble fireplace with an empty firebox and a tall gilt-framed mirror standing on its mantel", ["an open, empty firebox", "a mantel shelf", "a gilt-framed mirror above the mantel"],
    ["a fire, flames or glowing embers", "candlesticks, clocks or vases on the mantel", "a wall around it"], base=False, bench=["fire"], light="fireplace")
add("fireplace-marble--s2", "fireplace-marble", "sib1", 2, ["library", "dining-room", "master-bedroom"], "a dark green marble chimneypiece with a carved overmantel panel",
    "The same massing (a chimneypiece below, an overmantel of the same width above, flat-backed, the same height), but: the chimneypiece is deep moss-green marble with cream veins,"
    " with plain square jambs and a frieze of three carved rosettes; the overmantel is NOT a mirror but a tall dark oak panel in a thick carved oak frame, holding a carved oval wreath of leaves in relief."
    " The firebox is empty, lined with dark sooty brick. Nothing on the mantel shelf.",
    "a dark green marble fireplace with an empty firebox and a tall carved wooden overmantel panel above it", ["an open, empty firebox", "a mantel shelf", "a tall panel above the mantel"],
    ["a fire, flames or glowing embers", "objects on the mantel", "a mirror"], parent="fireplace-marble", what="marble fireplace", match="same", base=False, bench=["fire"], light="fireplace")

SUITE = "burgundy drawing-room suite"
add("sofa", "sofa", "p1", 1, ["drawing-room", "ballroom"], "a three-seat upholstered sofa with a carved walnut frame",
    "A noble drawing-room sofa for three: a carved dark walnut show-wood frame with a gently serpentine top rail carrying one carved shell in the middle, out-scrolled arms, and SIX short"
    " cabriole legs ending in chunky pad feet. Upholstered in deep burgundy damask with a soft tone-on-tone leaf pattern: a padded back, padded arms and ONE long fat seat cushion with broad"
    " piping; a row of big brass nail heads along the frame. Two small ochre bolster cushions, one at each arm. Long and low.",
    "a three-seat sofa upholstered in burgundy with a carved dark wood frame and short curved legs", ["one long seat with a back and two arms", "burgundy upholstery", "a visible carved wooden frame"],
    ["a person", "a blanket draped over it", "a side table"])
for sku, obj, subj, des, dsc, mst, size, extra in [
 ("chair-upholstered--fine--s1", "chair-upholstered", "a matching upholstered armchair",
  "The suite's armchair for one: a wide low seat, padded back with the same serpentine carved top rail and shell, out-scrolled padded arms, four short cabriole legs, one fat seat cushion.",
  "an armchair upholstered in burgundy with a carved dark wood frame", ["one seat with a back and two arms"], (30, 30, 40), {"tier": "fine"}),
 ("chair-upholstered--fine--s2", "chair-upholstered", "a matching high-backed wing chair",
  "The suite's fireside wing chair: a TALL padded back with two forward-curving wings at head height, low rolled arms, a deep seat cushion, four short cabriole legs. Taller than the armchair.",
  "a tall wing-backed armchair upholstered in burgundy with dark wood legs", ["one seat with a tall back and side wings"], (30, 32, 46), {"tier": "fine"}),
 ("settee", "settee", "a matching two-seat settee",
  "The suite's settee for two: like the sofa but only two thirds as long, with an upright padded back whose top rail rises in TWO gentle humps (a double chair-back), open carved arms"
  " with small padded elbow rests, six cabriole legs, one seat cushion.",
  "a two-seat settee upholstered in burgundy with a carved dark wood frame and open arms", ["a seat for two with a back and arms", "clearly shorter than a three-seat sofa"], None, {}),
 ("footstool--fine", "footstool", "a matching upholstered footstool",
  "The suite's footstool: a small low rectangular stool with a fat domed burgundy damask top edged with brass nails, on four tiny cabriole legs of the same walnut. No back, no arms.",
  "a small low upholstered footstool in burgundy on four short dark wood legs", ["low and small, no back"], (20, 15, 13), {"tier": "fine"}),
 ("daybed--fine", "daybed", "a matching chaise longue",
  "The suite's chaise longue (a daybed): a long low couch for one person lying down, with a high padded scrolled head end at ONE end only, a low padded back rail running half its length,"
  " no foot end, one long fat seat cushion and one round bolster at the head, on six short cabriole legs.",
  "a long low chaise longue upholstered in burgundy with one raised scrolled end and dark wood legs", ["long and low", "a raised head rest at one end only"], (72, 28, 34), {"tier": "fine"}),
 ("bench-upholstered--s2", "bench-upholstered", "a matching long upholstered bench",
  "The suite's bench: a long backless seat for three, a fat burgundy damask cushion top edged with brass nails on a carved walnut frame with six short cabriole legs. No back, no arms.",
  "a long backless upholstered bench in burgundy on short dark wood legs", ["long, low and backless"], None, {}),
 ("table-round-small--fine", "table-round-small", "a matching round tripod table",
  "The suite's occasional table, all wood, NO fabric: a round dark walnut top with a small raised piecrust rim on one THICK turned central column that ends in three stout out-curving cabriole feet. Nothing on it.",
  "a small round dark wood table on one central column with three curved feet", ["a round top", "a single central column with three feet"], (30, 30, 29), {"tier": "fine"}),
]:
    add(sku, obj, "sib1", 2, ["drawing-room"] + (["master-bedroom", "ballroom"] if obj in ("daybed", "bench-upholstered", "footstool") else ["library"] if "s2" in sku else []),
        subj, des, dsc, mst, ["a person", "objects on it"], size=size, parent="sofa", what=SUITE, **extra)

DINING = "mahogany dining suite"
add("table-feast--fine", "table-feast", "p1", 1, ["dining-room"], "a long polished mahogany dining table",
    "A long noble dining table to seat twelve: one thick polished red-brown mahogany top with rounded corners and a moulded edge, about 12 ft long and under 4 ft wide, carried on THREE stout"
    " turned pedestal columns in a row down the middle, each column ending in four out-curving legs with brass caps. A band of paler inlaid wood runs round the top near the edge."
    " COMPLETELY BARE: nothing on it, no cloth. Very long and low.",
    "a very long polished dark red-brown wooden dining table on turned pedestals, with nothing on it", ["one long table top, several times longer than wide", "nothing on the table"],
    ["chairs", "plates, candles, food or a tablecloth", "a rough plank trestle table"], size=(144, 44, 30), tier="fine")
for n, des, dsc in (("s1", "an upright back with a pierced vase-shaped central splat between two posts and a curved top rail with small ears", "a pierced splat back"),
                    ("s2", "an upright back of THREE thick vertical bars under a straight top rail with a carved shell", "a back of vertical bars"),
                    ("s3", "a padded oval back panel covered in the same moss-green leather in a thick mahogany frame", "a padded oval back")):
    add(f"chair-plain--fine--{n}", "chair-plain", "sib1", 1 if n == "s1" else 3, ["dining-room"], "a matching mahogany dining chair",
        f"A dining side chair of the same suite, no arms: {des}; a drop-in seat pad of moss-green leather edged with big brass nails; front legs turned like the table's columns, back legs plain and raked; thick stretchers.",
        f"a dark red-brown wooden dining chair without arms, with {dsc} and a green seat pad", ["one chair with four legs and a back", "no arms"], ["a person", "a rough rustic chair"],
        size=(20, 20, 40), parent="table-feast--fine", what=DINING, tier="fine")
add("sideboard", "sideboard", "sib1", 2, ["dining-room", "ballroom"], "a matching mahogany sideboard",
    "The dining suite's sideboard: a long waist-high serving cabinet with a thick flat top with a low brass gallery rail along the back, a bowed centre section with two wide drawers over an"
    " open knee space, and a square cupboard with one panelled door and a chunky round brass knob at each end, on six short turned legs. All doors shut. Nothing on top.",
    "a long waist-high dark red-brown sideboard with cupboard doors at the ends and drawers in the middle", ["long and low, a flat serving top", "cupboard doors and drawers on the front"],
    ["objects on top", "open doors"], parent="table-feast--fine", what=DINING, bench=["hinge"])
twin("sideboard-open", "sideboard-open", "sideboard", 3, ["dining-room"],
     "Show this same sideboard with its two end cupboard doors swung fully OPEN to about 100 degrees, showing clearly hollow, EMPTY cupboards with one shelf each. The drawers stay shut. Nothing on top.",
     "the same long sideboard with both end cupboard doors open and the cupboards empty", ["both cupboard doors are open", "the cupboards are empty"], ["closed doors", "objects inside or on top"])
add("cabinet-china", "cabinet-china", "sib1", 2, ["dining-room", "drawing-room"], "a matching tall china cabinet",
    "The dining suite's display cabinet, tall and shallow: a base cupboard with two panelled doors and brass knobs; above it an upper part with two doors glazed in a THICK grid of mahogany"
    " glazing bars (two panes wide, three tall each); behind the bars three shelves crowded with chunky cream, ochre and burgundy china plates and jugs, painted on as a solid mass"
    " (the glass is not see-through and NOT blue); a moulded cornice with a small swan-neck pediment on top. All doors shut.",
    "a tall dark wood cabinet with glazed upper doors showing shelves of china and solid doors below", ["taller than wide", "upper doors with glazing bars and china behind them"],
    ["open doors", "blue china or glass"], parent="table-feast--fine", what=DINING, bench=["hinge"])
twin("cabinet-china-open", "cabinet-china-open", "cabinet-china", 3, ["dining-room"],
     "Show this same cabinet with its two UPPER glazed doors swung fully OPEN to about 100 degrees, so the three shelves of chunky china plates and jugs are seen directly, and the lower doors still shut.",
     "the same tall cabinet with its two upper glazed doors open, china on the shelves", ["the upper doors are open", "shelves with china are visible inside"], ["all doors closed"])

BED = "walnut state-bedroom suite"
add("bed-canopy--state", "bed-canopy", "p1", 1, ["master-bedroom"], "a lord's state bed with a carved tester and heavy hangings",
    "A grand four-poster state bed, bigger and richer than an inn bed: four THICK turned and carved dark walnut posts carrying a deep carved wooden tester (a flat roof) with a moulded cornice and"
    " a short scalloped valance of moss-green and gold damask all round; a tall carved headboard with one big shell; heavy moss-green damask curtains gathered and tied back to all four posts"
    " as fat solid columns of cloth; a deep mattress with a cream linen sheet turned over a burgundy and gold quilted coverlet, two fat cream pillows and one round burgundy bolster. A low carved footboard."
    " The space under the tester is open so the bed is visible from the side and from above the foot.",
    "a large four-poster bed with a wooden canopy roof, green curtains tied to the posts and a burgundy coverlet", ["four posts carrying a canopy", "a made bed with pillows", "curtains tied back at the posts"],
    ["a person", "curtains drawn closed hiding the bed", "blue fabric"], size=(72, 90, 96))
add("table-vanity--fine", "table-vanity", "sib1", 2, ["master-bedroom"], "a matching dressing table with a mirror",
    "The bedroom suite's dressing table, in the same carved dark walnut: a kneehole table with three small drawers with round brass knobs across the front, on four turned legs, carrying an upright"
    " oval mirror in a thick carved walnut frame between two small turned posts; the mirror glass a soft pale silver-grey with cream streaks (NOT blue). A strip of the same moss-green damask hangs as a short skirt below the top at the sides. Nothing on the table.",
    "a dark wood dressing table with drawers and an upright oval mirror on top", ["a table with drawers", "an upright mirror fixed on top"], ["a stool or chair", "bottles or brushes on it"],
    size=(42, 20, 62), parent="bed-canopy--state", what=BED, tier="fine")
add("commode", "commode", "sib1", 2, ["master-bedroom", "drawing-room"], "a matching bow-fronted chest of drawers",
    "The bedroom suite's chest of drawers, in the same carved dark walnut: waist high, with a gently bowed front of THREE wide deep drawers, each with two chunky brass drop handles on round"
    " back plates and a brass keyhole plate, a thick moulded top, canted carved corners and four short bracket feet. All drawers shut. Nothing on top.",
    "a waist-high dark wood chest of three wide drawers with brass handles", ["three wide drawers one above the other", "brass handles"], ["open drawers", "objects on top"],
    parent="bed-canopy--state", what=BED)

MUSIC = ["ballroom", "drawing-room"]
add("harpsichord", "harpsichord", "p1", 1, MUSIC, "a harpsichord on a turned stand",
    "A noble harpsichord seen so that its WING shape is clear: a long, narrow, flat case about 7.5 ft long, straight on the left side and curving in on the right to a narrow tail (like a small"
    " grand piano), with its LID CLOSED and flat. The case is painted deep moss green with gilt bands and panels; the lid top carries a painted garland of cream and ochre flowers. At the wide"
    " end a short keyboard of chunky cream and dark keys shows under a small folded-back front flap. It rests on a separate-looking but joined stand of SIX stout turned dark walnut legs tied by low stretchers.",
    "a long wing-shaped keyboard instrument with its lid closed, painted green and gold, on turned wooden legs", ["a long wing-shaped or tapering case, longer than wide", "a keyboard at the wide end", "legs"],
    ["a person", "a raised open lid on a prop stick", "a stool", "sheet music or a candlestick on it", "a modern black grand piano"])
add("chandelier-grand", "chandelier-grand", "p1", 1, ["ballroom", "entrance-hall", "drawing-room", "dining-room"], "a crystal chandelier",
    "A grand crystal chandelier that hangs from a ceiling, built CHUNKY: a short thick gilt stem with a small gilt ceiling rose at the very top; a wide gilt ring carrying EIGHT thick S-curved"
    " gilt arms, each ending in a gilt drip pan and one stout cream candle; and between and below the arms the crystal: fat faceted drops and swags fused into solid tiers, like an upside-down"
    " wedding cake of pale cream-white and soft ochre crystal narrowing to one big faceted ball at the bottom. NO thin chains or loose strings: every crystal touches its neighbours."
    " Wider than it is tall." + UNLIT,
    "a wide hanging chandelier of gilt arms with candles and tiers of chunky pale crystal drops", ["a ring of several candle arms", "tiers of crystal drops under the arms", "candles without flames"],
    ["flames or glowing light", "a ceiling or beam it hangs from", "blue or see-through crystal", "thin dangling chains"], bench=["fire"], light="chandelier")
add("chandelier-grand--s2", "chandelier-grand", "sib1", 2, ["drawing-room", "dining-room", "library", "master-bedroom"], "a smaller six-arm crystal chandelier",
    "A smaller, taller-looking chandelier of the same family: a thick gilt baluster stem with a small ceiling rose, SIX thick S-curved gilt arms with drip pans and stout cream candles,"
    " and just ONE tier of fat faceted crystal drops fused in a ring below the arms, with one big faceted pear drop at the bottom. NO thin chains." + UNLIT,
    "a hanging chandelier with six gilt candle arms and one ring of chunky crystal drops", ["several candle arms round a central stem", "candles without flames"],
    ["flames or glowing light", "a ceiling it hangs from", "thin dangling chains"], size=(44, 44, 44), parent="chandelier-grand", what="crystal chandelier", match="same", bench=["fire"], light="chandelier")

BOOKS = ("packed tight with rows of chunky books with thick spines in burgundy, moss green, ochre and cream, a few with gilt bands and NO lettering, painted as solid rows"
         " (a few books leaning, one or two lying flat)")
LIB = "dark oak library fittings"
add("bookshelf--fine--s1", "bookshelf", "p1", 1, ["library", "drawing-room"], "a tall dark oak library bookcase full of books",
    f"A tall noble bookcase to stand against a wall, flat-backed: dark fumed oak with a moulded cornice carrying a carved leaf band, FIVE open shelves {BOOKS}, fluted pilasters down both"
    " sides, and a closed base cupboard with two panelled doors and small brass knobs on a plain plinth. About 4 ft wide and 8 ft tall.",
    "a tall dark wood bookcase with shelves full of books over a base cupboard", ["several shelves full of books", "taller than wide"], ["text on the books", "a ladder", "empty shelves"],
    size=(48, 16, 96), tier="fine")
add("bookshelf--fine--s2", "bookshelf", "sib1", 2, ["library"], "a second tall oak library bookcase",
    f"The same bookcase with a different arrangement: FOUR taller shelves {BOOKS}, the middle shelf holding instead a row of three chunky leather boxes and a small cream bust-shaped"
    " bookend block; the base is two wide drawers with brass drop handles instead of cupboard doors. Same cornice, pilasters, height and width.",
    "a tall dark wood bookcase with shelves full of books over base drawers", ["several shelves full of books", "taller than wide"], ["text on the books", "a ladder"],
    size=(48, 16, 96), parent="bookshelf--fine--s1", what="oak library bookcase", match="same", tier="fine")
add("bookshelf--fine--s3", "bookshelf", "sib1", 3, ["library", "master-bedroom"], "a low oak dwarf bookcase",
    f"A LOW bookcase of the same family, only chest high: TWO open shelves {BOOKS}, the same fluted pilasters at the sides, a thick moulded top like a counter with nothing on it, on a plain plinth. Wider than tall.",
    "a low chest-high dark wood bookcase with two shelves of books", ["shelves full of books", "low: wider than it is tall"], ["text on the books", "objects on top"],
    size=(54, 15, 42), parent="bookshelf--fine--s1", what="oak library bookcase", match="same", tier="fine")
add("bookcase-ladder", "bookcase-ladder", "sib1", 1, ["library"], "a double-width library bookcase with a rolling ladder",
    f"The library's great bookcase, as ONE object: twice as wide as the single bookcase and taller (about 8 ft wide and 9 ft tall), in the same dark oak with the same cornice and pilasters,"
    f" divided by a central pilaster into two bays of SIX shelves each, {BOOKS}, over a continuous base of four panelled cupboard doors. A thick brass rail runs across the front just under the cornice,"
    " and a library LADDER leans against it: two THICK oak stiles and seven thick flat rungs, hooked over the rail at the top and standing on two small wheels on the ground about 2 ft out"
    " from the base, set a little left of centre. The ladder is deliberately heavy and chunky.",
    "a very wide tall dark wood bookcase full of books with a ladder leaning against its front", ["two bays of shelves full of books", "one ladder leaning against the bookcase"],
    ["text on the books", "a person", "a free-standing step ladder apart from the bookcase"], parent="bookshelf--fine--s1", what=LIB, match="kit")

GARDEN_STONE = "weathered cream-grey limestone with soft ochre lichen patches and a little moss in the hollows"
add("fountain-courtyard", "fountain-courtyard", "p1", 1, ["garden"], "a tiered stone garden fountain",
    f"A formal garden fountain of {GARDEN_STONE}: a big round ground basin about 8 ft across with a thick moulded kerb wall knee high; from its centre a stout carved baluster stem carrying"
    " a wide shallow scalloped bowl, then a thinner stem carrying a smaller bowl, topped by a carved pineapple finial. Three tiers in all, each clearly smaller than the one below." + DRY,
    "a three-tier stone fountain: a wide round ground basin with two smaller bowls on a central stem above it", ["a wide round basin at the bottom", "at least two tiers of bowls on a central stem"],
    ["water, spray or blue colour", "a statue of a person or animal", "paving or grass around it"], base=False, bench=["water"])
add("gazebo", "gazebo", "p1", 1, ["garden"], "a small open garden pavilion",
    f"A small round garden temple (a gazebo), built CHUNKY: a low round stone floor of two steps, about 11 ft across; SIX stout plain round columns of {GARDEN_STONE} standing on the floor's"
    " edge, with simple moulded capitals; a thick round stone entablature ring on top of the columns; and a shallow DOME roof of grey-green weathered copper in broad ribbed segments with a small"
    " ball finial. Completely open between the columns: no walls, no railings, no bench, nothing inside; the blue background shows through between the columns.",
    "a small round open pavilion: a ring of stone columns on a stepped floor carrying a domed roof", ["a ring of columns with open gaps between them", "a domed roof", "a stepped round floor"],
    ["walls or railings between the columns", "furniture or a statue inside", "a person", "thin lattice or ironwork"], base=False,
    note="open structure: if TRELLIS fills the gaps or loses columns, re-run on hunyuan-mv")
add("table-pedestal-round", "table-pedestal-round", "p1", 1, ["entrance-hall", "library", "drawing-room"], "a big round hall table on a carved pedestal",
    "A big round centre table for an entrance hall: a thick polished dark walnut top about 4.5 ft across with a band of paler inlay near the moulded edge and a faint inlaid star in the middle,"
    " on ONE massive carved baluster pedestal that spreads into a three-cornered platform base on three chunky scrolled paw feet. COMPLETELY BARE: nothing on it.",
    "a big round dark wood table on a single thick central pedestal with three feet, nothing on it", ["a round top", "one central pedestal"], ["objects on the table", "chairs", "four separate legs"])
add("palm-potted--s1", "palm-potted", "p1", 1, ["conservatory", "entrance-hall", "ballroom", "drawing-room"], "a tall potted palm",
    "A big conservatory palm in a pot: a large round glazed pot in deep moss green with an ochre rim band, standing on its own flat bottom; from it one stout, scaly brown trunk about 3 ft tall"
    " carrying a fountain-shaped crown of SEVEN to NINE broad, THICK arching fronds, each frond one solid leaf-shaped blade with chunky notched edges and a thick midrib (not thin separate leaflets). About 8 ft tall in all.",
    "a tall palm with a short trunk and broad arching fronds growing in a big green glazed pot", ["a pot", "a crown of broad arching fronds"], ["thin wispy fronds", "blue pot", "more than one plant"], leafy=True)
add("palm-potted--s2", "palm-potted", "sib1", 3, ["conservatory", "ballroom"], "a low bushy fan palm in a pot",
    "A shorter, bushier palm of the same family in the same kind of glazed pot, but ochre with a moss-green band: NO tall trunk, a clump of TEN broad round FAN-shaped leaves on thick stalks"
    " rising straight from the pot, each fan one solid pleated blade. About 5 ft tall and as wide.",
    "a low bushy palm with round fan-shaped leaves in a glazed pot", ["a pot", "fan-shaped leaves"], ["thin wispy fronds", "blue pot"], size=(48, 48, 60),
    parent="palm-potted--s1", what="potted palm", match="same", leafy=True)
add("plant-stand-tiered", "plant-stand-tiered", "p1", 1, ["conservatory"], "a stepped plant stand crowded with potted plants",
    "A conservatory plant theatre as ONE object: a stout cream-painted wooden stand of THREE deep steps rising toward the back like a short staircase, with solid side cheeks,"
    " every step crowded with terracotta pots that touch each other: red geraniums, cream and ochre primulas, a small round fern, trailing ivy spilling over the front of the top step, and two"
    " taller leafy plants at the back corners. Plants painted as chunky solid mounds. About 4.5 ft wide and tall.",
    "a three-step wooden plant stand crowded with flowering and leafy plants in terracotta pots", ["a stepped stand", "many potted plants on the steps"], ["blue flowers or pots", "a wall or glass behind it"], leafy=True)
add("planter-topiary--s1", "planter-topiary", "p1", 1, ["garden", "conservatory", "entrance-hall", "ballroom"], "a clipped spiral topiary in a stone pot",
    "A clipped box topiary in a square carved limestone pot on four small ball feet: a short straight trunk, then dense dark green foliage clipped into a fat SPIRAL cone of three and a half"
    " turns, like a soft-serve swirl, ending in a small ball on top. The spiral is one solid chunky shape. About 4 ft tall.",
    "a clipped spiral-shaped green shrub in a square stone pot", ["a pot", "foliage clipped into a spiral or cone shape"], ["flowers", "loose natural branches"], leafy=True)
add("planter-topiary--s2", "planter-topiary", "p3", 3, ["garden", "conservatory", "entrance-hall"], "a clipped ball topiary standard in a terracotta pot",
    "A clipped topiary standard (a lollipop tree) in a big round terracotta pot with a rolled rim and one raised band: a straight THICK bare trunk about 2 ft tall carrying one big dense, perfectly"
    " round ball of dark green foliage, with a second much smaller ball sitting on top of it. About 4.5 ft tall.",
    "a clipped ball-shaped green shrub on a bare trunk in a round terracotta pot", ["a pot", "a round ball of foliage on a trunk"], ["flowers"], size=(24, 24, 54), leafy=True)
add("planter-topiary--s3", "planter-topiary", "p3", 3, ["garden"], "a clipped tiered topiary in a lead-grey planter",
    "A clipped yew topiary in a square warm-grey planter box with panelled sides: dense dark green foliage clipped into THREE stacked round tiers like a cake stand, each tier a thick disc clearly"
    " smaller than the one below, with a short thick trunk showing between them and a small cone on top. About 5 ft tall.",
    "a clipped green shrub of three stacked round tiers in a square grey planter", ["a planter box", "foliage clipped into separate stacked tiers"], ["flowers"], size=(26, 26, 60), leafy=True)
GILT = "cream-and-gilt ballroom furniture"
add("mirror-pier-gilt", "mirror-pier-gilt", "p1", 1, ["ballroom", "entrance-hall", "drawing-room", "dining-room"], "a tall gilt-framed pier mirror",
    "A tall, narrow wall mirror (a pier glass), flat-backed and chunky: a THICK carved and gilded frame about 5 in deep, upright rectangular with a round-arched top, crowned by a carved gilt"
    " crest of a shell between two leafy scrolls, and with a small leafy apron at the bottom. The mirror glass is ONE plain surface painted a soft pale silver-grey with two broad diagonal"
    " cream reflection streaks (NOT blue, no image reflected in it). It hangs on a wall: NO wall shown, no table under it.",
    "a tall narrow mirror in a thick ornate gilt frame with a carved crest on top", ["a tall upright mirror", "a thick gilded frame"], ["a wall", "a table or candle arms attached", "blue glass", "a face or room reflected"],
    hung=True)
add("table-console", "table-console", "sib1", 2, ["entrance-hall", "ballroom", "drawing-room"], "a matching gilt console table with a marble top",
    "The console table that stands under the pier mirror, in the same carved and gilded wood: a half-oval top of thick creamy white marble with grey-ochre veins, flat along the back (it stands"
    " against a wall), on a deep gilt frieze carved with the same shell and leafy scrolls, carried by TWO stout scrolled front legs and two plain back legs, tied by a low shaped gilt stretcher with a small carved urn in the middle. Nothing on top.",
    "a gilt wall table with a pale marble top on scrolled legs", ["a marble top with a flat back edge", "gilded carved legs"], ["a mirror attached above it", "objects on top"],
    parent="mirror-pier-gilt", what=GILT)
add("statue-garden--s1", "statue-garden", "p1", 1, ["garden", "conservatory"], "a classical garden statue on a plinth",
    f"A formal garden statue of {GARDEN_STONE}, carved in a simple, chunky, slightly worn way: an idealised classical figure in long heavy draped robes, standing calmly and holding a sheaf of"
    " wheat against one shoulder, the other hand gathering the drapery; the face plain, serene and generic with softened features. It stands on its own tall square plinth with a moulded cap"
    " and base and a blank sunk panel on the front (NO inscription). The figure is a STONE CARVING, all one stone colour. About 7.5 ft tall with the plinth.",
    "a weathered stone statue of a robed standing figure on a tall square plinth", ["a single stone figure, all in stone colour", "a square plinth under it"],
    ["a living, coloured person", "text or an inscription", "wings", "a weapon"], base=False)
add("statue-garden--s2", "statue-garden", "sib1", 2, ["garden"], "a second classical garden statue on a plinth",
    "A companion statue in the same weathered stone on the same kind of plinth: a different draped classical figure, this one pouring from a big stone jar held on the hip (the jar is empty,"
    " no water), head turned to one side, more moss on the shoulders. Again a plain generic face and NO inscription.",
    "a weathered stone statue of a robed figure holding a jar, on a tall square plinth", ["a single stone figure, all in stone colour", "a square plinth under it"],
    ["a living, coloured person", "text or an inscription", "water"], parent="statue-garden--s1", what="stone garden statue", match="same", base=False)

# ---------------------------------------------------------------------------------------------------------------
# FURNITURE (prio 2)
add("table-card", "table-card", "p2", 2, ["drawing-room", "library"], "a square card table",
    "A square drawing-room card table of dark walnut: a thick top covered in moss-green baize inside a broad polished wooden border with a shallow round dished counter well at each corner,"
    " a plain frieze with one small drawer and brass knob, on four stout tapering legs with spade feet. COMPLETELY BARE: no cards, no coins.",
    "a square dark wood table with a green cloth playing surface", ["a square top", "a green cloth panel on the top"], ["cards, coins or objects on it", "chairs"])
add("table-games", "table-games", "p2", 2, ["drawing-room", "library"], "a small games table with a chequer board and pieces",
    "A small square games table of dark walnut on one thick turned column with four out-curving feet: the top is an inlaid chequer board of cream and dark red-brown squares (8 by 8) inside a"
    " plain border, with a mid-game set of CHUNKY turned pieces standing on it, cream on one side and dark burgundy on the other, about a dozen of each, simple pawn and tower shapes, big enough to read from above.",
    "a small square table whose top is a chequer board with game pieces standing on it", ["a chequered square board on the table top", "game pieces on the board"], ["chairs", "a person", "blue pieces"])
add("table-billiards", "table-billiards", "p2", 2, ["drawing-room", "library"], "a billiard table",
    "A heavy billiard table about 9 ft long and 5 ft wide: a flat bed of moss-green baize inside THICK padded green cushions and a broad polished dark mahogany top rail with small inlaid cream"
    " diamonds, six pockets (four corners, two sides) as chunky dark leather cups, a deep panelled mahogany body, and SIX massive turned bulbous legs. On the cloth: three big balls"
    " (one cream, one red, one ochre) and TWO thick cues lying flat side by side near one cushion. Nothing else.",
    "a large billiard table with a green cloth bed, wooden rails with pockets and thick turned legs, with a few balls and cues on it", ["a long rectangular green playing surface with raised cushions", "pockets", "thick legs"],
    ["a person", "a lamp hanging over it", "blue cloth or balls", "a cue rack"])
add("clock-longcase", "clock-longcase", "p2", 2, ["entrance-hall", "library", "dining-room"], "a tall longcase clock",
    "A tall longcase (grandfather) clock of dark walnut, flat-backed: a square plinth base with a raised panel, a long narrow trunk with one tall arched door, and a wider hood on top with"
    " two small turned columns, an arched cornice and three chunky brass ball finials. The dial is a round cream face in a brass ring with TWELVE plain brass dots instead of numerals (NO numbers, NO text)"
    " and two thick dark hands. About 7 ft tall, narrow.",
    "a tall narrow wooden longcase clock with a round dial near the top", ["tall and narrow", "a round clock dial with hands near the top"], ["numerals or text on the dial", "a wall"])
LEATHER = "oak-and-green-leather library furniture"
add("desk-partners", "desk-partners", "p2", 2, ["library"], "a big pedestal desk with a green leather top",
    "A big library partners' desk of dark fumed oak: a thick rectangular top inset with a panel of moss-green leather with a thin gilt tooled border, over a frieze of three drawers,"
    " on TWO deep pedestals of three drawers each (drawers on the front; panelled cupboard doors on the back) with an open kneehole between them, on plain plinths. Chunky brass drop handles. COMPLETELY BARE top.",
    "a large dark wood desk with a green leather top on two drawer pedestals with a kneehole between", ["a rectangular top with a green inset", "two pedestals of drawers with a gap between"],
    ["a chair", "papers, books, lamps or an inkwell on it", "open drawers"])
add("table-library", "table-library", "sib2", 2, ["library"], "a matching long library table",
    "The library's long reading table of the same suite: a thick top about 7 ft long inset with the same moss-green leather and gilt border, over a shallow frieze with four drawers a side,"
    " carried on TWO broad carved end supports shaped like lyres, joined by one thick low stretcher. COMPLETELY BARE top.",
    "a long dark wood table with a green leather top on two solid end supports", ["a long rectangular top with a green inset", "two end supports joined by a stretcher"],
    ["chairs", "books or objects on it"], parent="desk-partners", what=LEATHER)
add("chair-upholstered--fine--s3", "chair-upholstered", "sib2", 2, ["library", "drawing-room"], "a matching green leather wing chair",
    "The library's reading chair of the same suite: a deep, high-backed wing armchair covered all over in moss-green leather with DEEP button tufting on the inside back, fat rolled arms,"
    " a thick loose seat cushion, rows of big brass nails along the arm fronts and the base, on four short turned dark oak legs with brass castors.",
    "a high-backed wing armchair in buttoned green leather with brass nails", ["one seat with a tall back, wings and rolled arms", "green leather"], ["a person", "a blanket or book on it"],
    size=(32, 34, 46), parent="desk-partners", what=LEATHER, tier="fine")
add("desk-bureau", "desk-bureau", "p2", 2, ["drawing-room", "master-bedroom", "library"], "a fall-front writing bureau, closed",
    "A lady's writing bureau of dark walnut with paler inlay bands, flat-backed and CLOSED: a chest base of three wide drawers with chunky brass drop handles on four short bracket feet,"
    " and above it a SLOPING fall front (a flat panel leaning back at about 45 degrees) with a brass keyhole plate and an inlaid oval, under a narrow flat top with a low brass gallery. Nothing on top.",
    "a closed dark wood writing bureau: a sloping front panel over three drawers", ["a sloping closed front panel above drawers"], ["an open writing flap", "papers or objects on it", "a chair"], bench=["hinge"])
twin("desk-bureau-open", "desk-bureau-open", "desk-bureau", 3, ["drawing-room", "master-bedroom", "library"],
     "Show this same bureau OPEN: the sloping fall front is hinged down to lie flat and horizontal as a writing surface, resting on two thick pull-out wooden bearers, its inner face lined with"
     " moss-green leather. Behind it the interior shows: a row of small pigeonholes and four tiny drawers with brass knobs round a little central cupboard door. The pigeonholes are empty. The three drawers below stay shut.",
     "the same writing bureau with its front let down flat as a writing surface, showing pigeonholes and small drawers inside", ["the front flap is down and horizontal", "small compartments visible inside"],
     ["a closed sloping front", "papers or an inkwell", "a chair"])
add("chair-salon-gilt--s1", "chair-salon-gilt", "p2", 2, ["ballroom", "drawing-room", "entrance-hall", "conservatory"], "a cream-and-gilt ballroom side chair",
    "A light but sturdy ballroom side chair, no arms: the frame painted cream with gilded mouldings, an OVAL padded back in a thick moulded frame with a small carved gilt ribbon bow on top,"
    " a round padded seat, both covered in moss-green silk with a small ochre sprig pattern, on four THICK straight fluted tapering legs with gilt collars.",
    "a cream and gold side chair without arms, with an oval padded back and a green seat", ["one chair with four legs and a back", "no arms", "pale painted frame with gilding"], ["a person", "a dark rustic chair"])
add("chair-salon-gilt--s2", "chair-salon-gilt", "sib2", 3, ["ballroom", "drawing-room"], "a second cream-and-gilt ballroom side chair",
    "A companion chair of the same set with a different back: a SQUARE padded back panel with a straight top rail carrying a small carved gilt wreath, and a square padded seat; same cream"
    " and gilt frame, same moss-green silk, same thick fluted legs.",
    "a cream and gold side chair without arms, with a square padded back and a green seat", ["one chair with four legs and a back", "no arms"], ["a person"],
    parent="chair-salon-gilt--s1", what=GILT)
add("bench-upholstered--s1", "bench-upholstered", "sib2", 2, ["ballroom", "entrance-hall"], "a matching cream-and-gilt long bench",
    "The set's long wall bench (a banquette): a backless seat for three, a thick moss-green silk cushion top with the same ochre sprig, on a cream-painted and gilded frame with a fluted"
    " frieze and SIX thick fluted tapering legs. No back, no arms.",
    "a long backless bench with a green cushion top on a cream and gold frame", ["long, low and backless"], ["a person", "objects on it"], parent="chair-salon-gilt--s1", what=GILT)
add("stool-upholstered", "stool-upholstered", "sib2", 3, ["ballroom", "drawing-room", "master-bedroom"], "a matching small upholstered stool",
    "The set's music stool: a small rectangular seat for one with a fat moss-green silk cushion top with the same ochre sprig, on a cream-painted and gilded frame with four thick fluted"
    " tapering legs joined by an X stretcher. No back, no arms.",
    "a small backless stool with a green cushion top on a cream and gold frame", ["small and backless, seat height"], ["a person"], parent="chair-salon-gilt--s1", what=GILT)
add("candelabra-standing--s1", "candelabra-standing", "p2", 2, ["ballroom", "entrance-hall", "dining-room", "drawing-room"], "a tall gilt floor candelabrum",
    "A tall floor-standing candle stand (a torchere), built CHUNKY: a heavy three-sided gilt base on three paw feet, a THICK carved gilt baluster column about 4 ft tall, and on top a tight crown"
    " of FIVE short thick S-curved arms (four round one in the middle) each with a gilt drip pan and a stout cream candle. About 5 ft tall." + UNLIT,
    "a tall gilt floor-standing candle stand with five candles on top", ["one tall column on a heavy base", "several candles at the top, without flames"], ["flames or glow", "thin wiry arms"],
    bench=["fire"], light="candle")
add("candelabra-standing--s2", "candelabra-standing", "sib2", 3, ["ballroom", "library", "master-bedroom"], "a second floor candelabrum in dark bronze",
    "A plainer companion: the same height and build, but in dark brown bronze with gilt collars, a round stepped base, a fluted column, and THREE thick arms with drip pans and stout cream candles." + UNLIT,
    "a tall dark metal floor-standing candle stand with three candles on top", ["one tall column on a heavy base", "candles at the top, without flames"], ["flames or glow"],
    parent="candelabra-standing--s1", what="floor candelabrum", match="same", bench=["fire"], light="candle")
add("sconce-candle-triple--fine", "sconce-candle-triple", "p2", 2, ["ballroom", "drawing-room", "dining-room", "entrance-hall", "master-bedroom", "library"], "a gilt three-arm wall sconce with a mirror back",
    "A noble wall sconce (a girandole), flat-backed and chunky: an upright oval back plate of mirror glass (soft pale silver-grey with a cream streak, NOT blue) in a THICK carved gilt frame"
    " with a ribbon bow on top, and from its bottom THREE short thick S-curved gilt arms, each with a drip pan and a stout cream candle. NO wall shown." + UNLIT,
    "a gilt wall sconce with an oval mirrored back plate and three candle arms", ["three candle arms", "a flat back plate", "candles without flames"], ["flames or glow", "a wall", "blue glass"],
    size=(18, 9, 26), hung=True, bench=["fire"], light="candle", tier="fine")
add("harp", "harp", "p2", 2, MUSIC, "a standing concert harp",
    "A standing harp, built CHUNKY so it reconstructs: a THICK fluted gilt column at the front with a carved gilt capital, a heavy curved gilt neck across the top, and a deep, broad"
    " soundbox body of warm honey wood sloping back to a solid base with four small feet. The strings are painted as a SOLID flat panel of fine cream and ochre vertical stripes filling"
    " the triangle between column, neck and soundbox (not separate thin strings, not see-through).",
    "a tall standing harp with a gilt column and a wooden soundbox", ["a triangular harp frame: column, curved neck and sloping soundbox", "the string area is filled, not empty"],
    ["a person", "a stool", "separate thin loose strings", "a see-through gap where the strings are"], note="thin: the string panel must be solid")
add("pedestal-display--marble", "pedestal-display", "p2", 2, ["entrance-hall", "ballroom", "drawing-room", "conservatory"], "a marble display pedestal",
    "A plain waist-high display pedestal: a round fluted column of creamy white marble with soft grey veins on a square moulded base, with a square moulded cap whose top is flat and EMPTY (the game stands a vase or bust on it).",
    "a waist-high fluted pale marble column pedestal with a flat empty top", ["one short column with a flat top", "nothing standing on it"], ["a vase, bust or object on top", "a broken ruin"], base=False)
add("statue-bust--s1", "statue-bust", "p2", 2, ["entrance-hall", "library", "ballroom", "drawing-room"], "a marble bust on a column plinth",
    "A portrait bust as a STONE CARVING, all one creamy white marble colour: the head and draped shoulders of an idealised, generic classical figure with a laurel wreath, plain serene softened"
    " features (no recognisable person), on a small round socle, standing on its own tall slim square plinth of darker moss-green marble with a moulded cap and base. NO inscription. About 4.5 ft tall in all.",
    "a white stone bust of a head and shoulders on a tall slim dark plinth", ["a carved head-and-shoulders bust, all stone coloured", "a tall plinth under it"],
    ["a living, coloured person", "text or an inscription", "a full-length statue"], base=False)
add("statue-bust--s2", "statue-bust", "sib2", 3, ["library", "entrance-hall"], "a second marble bust on a column plinth",
    "A companion bust on the same kind of plinth, but the plinth is a round fluted half-column of warm ochre marble, and the bust is a different generic classical head: bare-headed, with"
    " short curled hair and a folded cloak on one shoulder, turned slightly to the side. All stone coloured, NO inscription.",
    "a white stone bust of a head and shoulders on a tall round plinth", ["a carved head-and-shoulders bust, all stone coloured", "a tall plinth under it"],
    ["a living, coloured person", "text or an inscription"], parent="statue-bust--s1", what="marble bust", match="same", base=False)
add("urn-decorative--porcelain", "urn-decorative", "p2", 2, ["entrance-hall", "ballroom", "drawing-room", "dining-room"], "a tall decorative porcelain urn",
    "A tall floor-standing covered urn of glazed porcelain: a swelling baluster body in deep burgundy with a broad cream band painted with ochre and moss-green leafy scrolls, two THICK gilt"
    " scroll handles joined solidly to the shoulders, a domed lid with a gilt pine-cone knob, on a round gilt foot. About 3 ft tall.",
    "a tall burgundy and cream covered urn with two gilt handles", ["a vase-shaped body with a lid", "two handles"], ["flowers in it", "blue glaze", "a pedestal under it"])
add("urn-decorative--floor-vase", "urn-decorative", "p3", 3, ["entrance-hall", "conservatory", "drawing-room"], "a big open floor vase with dried grasses",
    "A big open floor vase of glazed pottery in moss green with ochre drip glaze round the shoulder, a tall ovoid body with a flared neck and NO handles, holding a fat solid sheaf of cream"
    " pampas plumes and ochre dried grasses painted as one chunky mass. About 3.5 ft tall with the grasses.",
    "a big green floor vase holding a sheaf of cream dried grasses", ["a tall vase", "a mass of dried plumes rising from it"], ["blue glaze", "thin separate stalks"], size=(18, 18, 42), leafy=True)
add("trade-globe-terrestrial", "trade-globe-terrestrial", "p2", 2, ["library", "drawing-room"], "a floor globe in a wooden stand",
    "A library floor globe: a big sphere about 18 in across painted as an old map in PARCHMENT cream, ochre and moss green (sea areas cream, land areas ochre and green, NO blue, NO text),"
    " held in a thick brass meridian ring and a broad flat horizon ring of dark walnut, carried on FOUR stout turned legs joined by low cross stretchers.",
    "a large map globe in cream and ochre set in a wooden floor stand with turned legs", ["a sphere", "a stand with legs holding it at waist height"], ["blue seas", "text or lettering"])
add("fern-potted", "fern-potted", "p2", 2, ["conservatory", "entrance-hall", "drawing-room"], "a big fern in a pot on a short stand",
    "A big Boston fern as ONE object: a low round terracotta pot sitting on a short, stout three-legged dark wood stand about 1.5 ft high; from the pot a full, round mound of arching fronds"
    " spilling down over the pot, each frond a broad solid blade with scalloped edges and a thick midrib. The mound is one chunky mass about 2.5 ft across.",
    "a full bushy fern in a terracotta pot standing on a short wooden stand", ["a pot on a stand", "a mound of arching fronds"], ["thin wispy fronds", "blue pot"], leafy=True)
add("citrus-tree-tub", "citrus-tree-tub", "p2", 2, ["conservatory", "garden"], "an orange tree in a square wooden tub",
    "A small orange tree in an orangery tub: a square cream-painted wooden planter box with panelled sides, a chunky ball finial on each of its four corner posts and two iron bands;"
    " from it a straight THICK trunk carrying a dense round ball of glossy dark green leaves studded with a dozen big bright oranges set INTO the surface of the leaf mass (chunky, half-embedded). About 5.5 ft tall.",
    "a small round-headed orange tree with oranges, growing in a square cream wooden tub", ["a square planter box", "a round leafy head with orange fruit"], ["blue pot or flowers", "fruit hanging on thin stalks"], leafy=True)
add("bench-potting", "bench-potting", "p2", 2, ["conservatory"], "a potting bench with pots and a soil bin",
    "A gardener's potting bench as ONE object, flat-backed: a stout waist-high table of thick honey-coloured planks with a raised board along the back and both ends, and above the back a single"
    " thick shelf on two solid brackets. On the bench top: a heap of dark soil at one end, a stack of five terracotta pots, two pots with small seedlings, a chunky wooden trug. On the shelf:"
    " a row of four small pots and a fat ball of twine. Under the bench a slatted shelf with a big sack and a bucket. Everything chunky and touching the bench.",
    "a wooden potting bench with terracotta pots, soil and a shelf above", ["a work table with a raised back", "terracotta pots on it"], ["a person", "thin loose tools scattered apart", "blue objects"], leafy=True)
add("craft-wicker-chair", "craft-wicker-chair", "p2", 2, ["conservatory", "garden"], "a wicker conservatory armchair",
    "A conservatory armchair woven of THICK honey-coloured wicker: a round barrel shape with a high curved back flowing into rolled arms, a solid woven skirt down to the ground (no thin legs),"
    " the weave painted as chunky basketwork bands, with one fat round seat cushion in moss green with cream stripes.",
    "a rounded woven wicker armchair with a green seat cushion", ["a chair with a curved back and arms", "woven basketwork surface"], ["a person", "thin spindly legs", "blue cushion"])
add("fountain-wall", "fountain-wall", "p2", 2, ["conservatory", "garden"], "a wall fountain with a shell basin",
    f"A wall fountain of {GARDEN_STONE}, flat-backed and standing on the ground against a wall: an upright arched back slab carved with a big scallop shell niche and, in the middle,"
    " a round carved rosette boss with a short thick spout; below it a deep half-round basin on a stout carved baluster foot." + DRY + " NO wall shown.",
    "a stone wall fountain: an arched carved back slab with a spout over a half-round basin on a foot", ["an upright back slab", "a basin below a spout"], ["water or blue colour", "an animal or face spouting", "a wall"],
    base=False, bench=["water"], size=(34, 20, 60))
add("urn-garden--s1", "urn-garden", "p2", 2, ["garden", "conservatory"], "a stone garden urn of flowers on a pedestal",
    f"A formal garden urn of {GARDEN_STONE}: a wide shallow fluted urn bowl on a short stem with two small solid scroll handles, standing on its own square pedestal with a moulded cap and base"
    " and a plain sunk panel. The urn is planted with a full dome of red geraniums and cream flowers with trailing green ivy over the rim, painted as one chunky mass. About 4.5 ft tall.",
    "a stone urn on a square pedestal, planted with red and cream flowers", ["a stone urn bowl on a pedestal", "flowers growing from the urn"], ["blue flowers", "text on the pedestal"], base=False, leafy=True)
add("urn-garden--s2", "urn-garden", "p3", 3, ["garden"], "a tall lidded stone garden urn on a pedestal",
    f"A formal garden finial urn of {GARDEN_STONE}: a tall, narrow covered urn with a swag of carved drapery round its body and a pointed lid with a flame-shaped knob, NO plants,"
    " on a tall round pedestal with a moulded cap and base, moss on the shoulders. About 5 ft tall.",
    "a tall lidded stone urn on a round pedestal", ["a covered stone urn", "a pedestal under it"], ["flowers", "text"], size=(22, 22, 60), base=False)
add("bench-garden", "bench-garden", "p2", 2, ["garden", "conservatory"], "a stone garden bench with a curved back",
    f"A formal garden seat of {GARDEN_STONE}: a thick stone seat slab about 5.5 ft long on two massive carved scroll supports with lion-paw feet, with a low solid stone back that curves gently"
    " and ends in two scrolled arm blocks. A little moss on the back. Nothing on it.",
    "a stone garden bench with a low solid back and scrolled end supports", ["a long stone seat", "a low back"], ["a person", "cushions or objects on it", "a wooden slatted bench"], base=False)
add("sundial", "sundial", "p2", 2, ["garden"], "a sundial on a stone baluster",
    f"A garden sundial: a waist-high carved baluster pedestal of {GARDEN_STONE} on a square two-step base (its own base), with a thick round stone cap carrying a brass dial plate"
    " engraved with plain radiating lines (NO numerals, NO text) and a THICK triangular brass gnomon fin standing up from the middle.",
    "a waist-high stone pedestal with a round brass dial and a triangular fin on top", ["a pedestal", "a flat round dial on top with an upright triangular fin"], ["numerals or text", "a birdbath bowl"], base=False)
add("lily-pond", "lily-pond", "p2", 2, ["garden"], "a low round stone-kerbed garden pool",
    f"A formal round garden pool about 9 ft across and only a foot high: a broad, thick moulded kerb ring of {GARDEN_STONE} with four small carved shell blocks spaced round it, enclosing"
    " a shallow flat stone-paved bed. In the very middle a low stone boss like a flattened ball." + DRY + " Low and wide, like a big shallow dish.",
    "a wide, very low round stone pool basin with a thick kerb, empty", ["a round kerb ring much wider than it is tall", "an empty flat bed inside"], ["water, lilies or blue colour", "a tall fountain", "grass or paving around it"],
    base=False, bench=["water"])
add("balustrade-stone", "balustrade-stone", "p2", 2, ["garden"], "a section of stone balustrade",
    f"A terrace balustrade of {GARDEN_STONE}, waist high: a thick plain plinth course at the bottom, SEVEN fat vase-shaped balusters evenly spaced with half a gap at each end, and a broad"
    " moulded handrail on top. This is ONE straight 5-ft section of a longer run: both side ends are clean, flat, vertical cuts through plinth and rail with nothing sticking out past them,"
    " and the rail is one level height from end to end, so copies placed end to end make one continuous run. Seen from its broad side.",
    "one straight section of waist-high stone balustrade: a row of fat balusters between a plinth and a handrail", ["a row of balusters", "a continuous top rail and bottom plinth", "longer than tall"],
    ["a tall pier or post at the end", "steps", "an urn on top"], base=False, generation="kit")
add("balustrade-stone-pier", "balustrade-stone-pier", "sib2", 3, ["garden"], "a square balustrade pier with a ball finial",
    "ONLY a single square pier of the same balustrade, standing alone: the same plinth course and the same handrail moulding carried round all four sides at the SAME heights, a plain sunk"
    " panel on each face, and on top a stone ball finial on a short neck. About 14 in square and a little taller than the balustrade with its ball.",
    "a single square stone pier with a ball on top, standing alone", ["exactly one square pier", "a ball finial on top"], ["balusters or rail sections attached at the sides", "a lantern"],
    parent="balustrade-stone", what="stone balustrade", match="kit", base=False, generation="kit")
add("flowerbed--parterre", "flowerbed", "p2", 2, ["garden"], "a round formal parterre flowerbed",
    "A ROUND formal flowerbed about 6 ft across and a foot and a half high: a low clipped box-hedge ring as the border (a thick solid dark green rim), filled with flowers planted in"
    " clear rings: an outer ring of cream, a middle ring of red, and an ochre-yellow dome at the centre, with green leaves, painted as chunky clustered blooms in one solid mass. Low and wide.",
    "a low round flowerbed bordered by a clipped hedge ring and filled with rings of red, cream and yellow flowers", ["round and low, clearly much wider than tall", "a green hedge border round the flowers"],
    ["blue flowers", "a tall plant, tree or statue", "a stone or plank border"], size=(72, 72, 18), base=False, leafy=True)
add("wine-bin-arched", "wine-bin-arched", "p2", 2, ["wine-cellar"], "brick wine bins with laid bottles",
    "A cellar wine bin as ONE flat-backed block of old warm red-brown brick with pale mortar, about 5 ft wide and 4.5 ft tall: THREE deep round-arched pigeonholes side by side at the bottom"
    " and a thick stone shelf slab on top. Each arch is stacked full with wine bottles lying on their sides, ends outward, as a solid honeycomb of chunky dark green and brown bottle bottoms"
    " and a few cream-waxed corks. A little dust and one small blank wooden bin tag (NO text) hanging by each arch.",
    "a block of brick with three arched niches full of wine bottles lying on their sides", ["brick arches", "stacked bottles filling the niches"], ["text or numbers", "blue glass", "barrels"])

# ---------------------------------------------------------------------------------------------------------------
# SMALLS AND VARIANTS (prio 3)
S3 = "p3"
add("fire-screen", "fire-screen", S3, 3, ["drawing-room", "master-bedroom", "library"], "an embroidered fire screen",
    "A drawing-room fire screen: an upright rectangular panel in a THICK carved dark walnut frame with a scrolled crest, standing on two broad trestle feet; the panel is tapestry-work showing"
    " a big basket of red, cream and ochre flowers on a moss-green ground (no figures, no text). Thick enough to stand.",
    "an upright framed needlework panel of flowers standing on two feet", ["one upright framed panel on feet"], ["a fireplace", "blue flowers"])
add("clock-mantel", "clock-mantel", S3, 3, ["drawing-room", "library", "master-bedroom"], "a small mantel clock",
    "A small mantel clock: a chunky arched case of dark walnut with gilt mouldings on four gilt ball feet, a round cream dial in a brass ring with twelve plain brass dots instead of numerals"
    " (NO numbers) and two thick dark hands, and a little brass carrying loop cast solid on the top.",
    "a small arched wooden mantel clock with a round dial", ["a round dial with hands"], ["numerals or text"])
add("tea-service-tray", "tea-service-tray", S3, 3, ["drawing-room", "conservatory", "master-bedroom"], "a tea tray with a teapot, cups and cakes",
    "A tea service as ONE chunky object: an oval silver tray with a raised rim and two solid handles, carrying a fat round cream china teapot with an ochre band, a small matching milk jug,"
    " three cups on saucers and a plate with a pile of small golden cakes, all touching each other and the tray.",
    "an oval tray carrying a teapot, a jug, cups and a plate of cakes", ["a tray", "a teapot and cups on it"], ["blue china", "a table under it"])
add("centerpiece-epergne", "centerpiece-epergne", S3, 3, ["dining-room"], "a silver table centrepiece piled with fruit",
    "A dining-table centrepiece (an epergne), built CHUNKY: a heavy silver stand with a thick central stem carrying one big shallow silver bowl on top, heaped with a solid pyramid of fruit"
    " (red apples, golden pears, green grapes, an orange) and a few leaves, and three smaller silver dishes on short thick arms round the stem, each holding a few sweets or nuts. Warm grey silver with cream highlights.",
    "a silver stand with a big bowl of fruit on top and smaller dishes round its stem", ["a central stand with a bowl of fruit on top"], ["candles", "blue or purple fruit", "thin wiry arms"])
add("candelabra--fine--s2", "candelabra", S3, 3, ["dining-room", "ballroom", "drawing-room"], "a five-branch silver table candelabrum",
    "A tall silver table candelabrum, built CHUNKY: a round stepped foot, a thick baluster stem, and FIVE short thick arms (four round one raised in the middle) each with a drip pan and a stout cream"
    " candle. Warm grey silver with cream highlights. About 20 in tall." + UNLIT,
    "a silver table candelabrum with five candles", ["one stem with several candle arms", "candles without flames"], ["flames or glow", "thin wiry arms"], size=(14, 14, 20),
    bench=["fire"], light="candle", tier="fine")
# goblet-silver and platter-silver are the castle batch's (same objects): reused, not specified twice
SILVER = "warm grey polished silver with soft cream highlights and a little engraved leaf border"
for sku, subj, des, dsc, mst in [
 ("plate-silver", "a silver dinner plate", f"A round silver dinner plate with a broad flat rim and a raised moulded edge, in {SILVER}. Empty, seen from above at an angle.", "a round silver plate, empty", ["one round plate"]),
 ("platter-silver-domed", "a silver platter with a domed cover", f"An oval silver serving platter with a big domed cover (a cloche) sitting on it, the dome with a chunky leaf-shaped handle on top, in {SILVER}.", "an oval silver platter covered by a big dome with a knob", ["a domed cover on a platter"]),
 ("tray-silver", "a silver serving tray", f"A rectangular silver serving tray with rounded corners, a raised pierced-looking (but solid) gallery rim and two thick loop handles cast solid at the ends, in {SILVER}. Empty.", "an empty rectangular silver tray with two handles", ["one flat tray with a rim"]),
 ("pitcher-silver", "a silver wine ewer", f"A tall silver ewer: a pear-shaped body on a round foot, a broad pouring lip, a hinged domed lid and one THICK scroll handle joined solidly top and bottom, in {SILVER}.", "a tall silver jug with a lid and one handle", ["one jug with a handle and a spout"]),
 ("cutlery-set-silver", "a silver place setting of cutlery", f"A place setting of cutlery as ONE chunky object: a thick silver knife, fork and spoon lying side by side and touching, on a folded cream linen napkin, in {SILVER}. Deliberately thick and toy-like.", "a knife, fork and spoon side by side on a folded napkin", ["a knife, a fork and a spoon together"]),
 ("decanter-crystal", "a crystal decanter of wine", "A heavy cut-crystal decanter: a squat faceted body with deep diamond cuts, a short neck and a big faceted ball stopper, three-quarters full of deep burgundy wine; the glass above the wine pale cream-white (NOT blue).", "a faceted glass decanter with a ball stopper, holding dark red wine", ["one bottle-shaped decanter with a stopper"]),
]:
    add(sku, sku, S3, 3, ["dining-room"] + (["ballroom", "wine-cellar"] if sku in ("tray-silver", "decanter-crystal") else []) + (["servants-kitchen"] if sku in ("platter-silver-domed", "tray-silver") else []),
        subj, des, dsc, mst, ["blue colour", "food on it", "a table under it"])
add("library-steps", "library-steps", S3, 3, ["library"], "a short flight of library steps",
    "A piece of library furniture: THREE thick solid wooden steps like a tiny staircase, in dark fumed oak, each tread covered with moss-green leather edged in brass nails, with solid panelled"
    " sides and one stout turned post with a ball top rising from the top step as a hand-hold. About 3 ft tall to the ball.",
    "a small three-step wooden library stair with green treads and a hand post", ["three steps", "one upright post"], ["a tall ladder", "books on it"])
for sku, subj, des, dsc, mst in [
 ("book-stack", "a stack of books", "A neat stack of FIVE chunky closed books of different sizes lying flat, biggest at the bottom, bound in burgundy, moss green, ochre and cream leather with thick raised bands and gilt lines, NO lettering; the top book slightly askew.", "a stack of several closed leather-bound books", ["several books stacked flat"]),
 ("book-open", "an open book", "One big thick book lying OPEN flat: cream pages curving up from the gutter on both sides with faint ochre ruled lines and one small red initial block (NO readable text), thick burgundy leather covers showing at the edges, and a moss-green ribbon marker across the page.", "one open book lying flat", ["one open book with two page spreads"]),
 ("book-pile-floor", "a heap of books on the floor", "A big untidy floor pile of about FIFTEEN chunky books as ONE solid heap: two leaning stacks slumped together, some books open face-down, in burgundy, moss green, ochre and cream leather, NO lettering. About 2 ft high and wide.", "an untidy heap of many books", ["a pile of many books"]),
 ("books-row-bookends", "a short row of books between bookends", "A short row of SIX chunky upright books in burgundy, moss green, ochre and cream leather with gilt bands (NO lettering), held between two heavy bookends, each a solid cream marble block with a small carved scroll.", "a row of upright books between two bookend blocks", ["upright books in a row", "a bookend at each end"]),
]:
    add(sku, sku, S3, 3, ["library"] + (["drawing-room", "master-bedroom"] if sku in ("book-stack", "book-open") else []), subj, des, dsc, mst, ["text or lettering", "blue covers", "a table or shelf under it"])
add("inkwell-quill", "inkwell-quill", S3, 3, ["library", "drawing-room"], "an inkstand with a quill",
    "A desk inkstand as ONE chunky object: a small rectangular brass tray on four ball feet holding a squat round glass inkwell with a brass lid (the ink black) and a matching pounce pot,"
    " with ONE fat cream goose-feather quill lying along the tray's front groove, its feather broad and solid.",
    "a small brass inkstand with an inkwell and a feather quill lying on it", ["an inkwell", "one feather quill"], ["paper or text", "blue ink or glass"])
add("telescope", "telescope", S3, 3, ["library"], "a brass telescope on a tripod stand",
    "A library telescope, built CHUNKY: a THICK brass tube about 3 ft long, wider at the front, with two raised collars and a short eyepiece, tilted upward on a stout brass fork mount atop"
    " a tripod of THREE thick turned dark walnut legs joined by a small round shelf halfway down.",
    "a brass telescope tube mounted on a three-legged wooden stand", ["a tube tilted upward", "a tripod of three legs"], ["thin spindly legs", "a person"])
add("mirror-standing--fine", "mirror-standing", S3, 3, ["master-bedroom"], "a cheval dressing mirror",
    "A tall cheval mirror in carved dark walnut: an upright oval mirror in a THICK moulded frame with a small carved shell on top, pivoted between two stout turned posts on a trestle base"
    " with four out-curving feet and a low stretcher. The glass is a soft pale silver-grey with two broad cream streaks (NOT blue, nothing reflected).",
    "a tall oval mirror swinging between two posts on a footed stand", ["an upright mirror", "a stand with two posts and feet"], ["blue glass", "a person or room reflected"], tier="fine")
add("washstand--fine", "washstand", S3, 3, ["master-bedroom"], "a marble-topped washstand with a basin and jug",
    "A noble washstand as ONE object: a small dark walnut cabinet with one drawer and one panelled door with brass knobs, on four short turned legs, with a thick cream marble top and a low"
    " marble splash-back; standing on the top, joined to it, a wide cream china wash basin with an ochre band and a matching tall jug sitting IN the basin. A folded cream towel hangs over a thick rail at one side.",
    "a small wooden washstand with a marble top carrying a china basin and jug", ["a cabinet with a pale top", "a basin and jug on top"], ["water", "blue china", "a mirror"], tier="fine")
add("screen-folding--fine", "screen-folding", S3, 3, ["master-bedroom", "drawing-room"], "a painted three-leaf folding screen",
    "A dressing screen of THREE tall hinged leaves standing in a shallow zigzag: each leaf a THICK dark walnut frame with an arched top, filled with a panel painted with flowering branches,"
    " red and cream blossoms and ochre birds-of-paradise leaves on a deep moss-green ground (no figures, no creatures, no text); small brass hinges; no feet, the leaves stand on their own bottom edges.",
    "a three-panel folding screen painted with flowering branches on green", ["three upright panels joined in a zigzag"], ["blue paint", "people or animals in the painting"], tier="fine")
add("jewelry-box", "jewelry-box", S3, 3, ["master-bedroom"], "a jewellery casket",
    "A small jewellery casket: a rectangular box of dark walnut with a gently domed lid, bound with chunky gilt corner mounts and a gilt lock plate, standing on four small gilt paw feet, CLOSED,"
    " with a cushion of burgundy velvet showing as a thin line at the lid's edge and one fat rope of cream pearls draped solidly over the lid.",
    "a small closed wooden jewellery box with gilt mounts and a string of pearls on its lid", ["a small lidded box"], ["an open lid", "blue gems"])
add("perfume-bottles", "perfume-bottles", S3, 3, ["master-bedroom"], "a tray of perfume bottles",
    "A dressing-table group as ONE chunky object: a small oval gilt tray carrying FOUR stout scent bottles that touch each other: one squat round rose-pink bottle with a faceted ball stopper,"
    " one tall ochre-amber bottle with a pointed stopper, one cream bottle with a gilt cap and a fat silk-covered squeeze bulb, and one small moss-green pot with a domed lid.",
    "a small tray with several little coloured perfume bottles", ["several small bottles grouped on a tray"], ["blue glass", "a mirror"])
add("gown-on-form", "gown-on-form", S3, 3, ["master-bedroom"], "a ball gown on a dressmaker's form",
    "A noble ball gown displayed on a HEADLESS dressmaker's form: a padded cream linen torso form with a turned wooden neck knob (no head, no arms, no face), wearing a gown of burgundy silk"
    " with a fitted bodice, puffed elbow sleeves hanging empty and solid, cream lace at the neckline and a wide full skirt that reaches the ground all round as one solid bell shape trimmed"
    " with an ochre embroidered hem band. The skirt hides the stand.",
    "a burgundy gown with a wide skirt on a headless dressmaker's form", ["a dress with a full skirt reaching the ground", "no head"], ["a person, head, face or hands", "blue fabric"])
add("hall-stand", "hall-stand", S3, 3, ["entrance-hall"], "a hall stand with coats and sticks",
    "An entrance-hall stand as ONE flat-backed object in dark walnut: a tall back board with a carved crest, a small round mirror in the middle (pale silver-grey glass, NOT blue) ringed by SIX"
    " chunky turned coat pegs; on the pegs, one heavy moss-green cloak and one burgundy coat hanging as solid masses and a wide-brimmed ochre hat; at the bottom a small box seat with an open-topped"
    " stick well at one side holding three THICK walking sticks and a furled cream umbrella bundled together.",
    "a tall wooden hall stand with pegs, hanging coats, a small mirror and a holder of walking sticks", ["a tall back board with pegs", "coats or hats hanging on it"], ["a person", "blue cloth or glass", "thin wiry hooks"])
add("plant-pot--s1", "plant-pot", S3, 3, ["conservatory", "drawing-room"], "a potted geranium",
    "A terracotta flowerpot with a rolled rim on a matching saucer, holding a full round mound of red geranium flowers and scalloped green leaves painted as one chunky mass, wider than the pot.",
    "a terracotta pot with a mound of red flowers and green leaves", ["a pot", "a plant growing in it"], ["blue flowers or pot"], size=(9, 9, 12), leafy=True)
add("plant-pot--s2", "plant-pot", S3, 3, ["conservatory", "drawing-room", "master-bedroom"], "a potted orchid",
    "A glazed cream china pot with an ochre band holding an orchid built CHUNKY: three broad thick strap leaves at the base and ONE thick arching stem carrying five big cream-and-rose"
    " blooms that touch each other in a solid spray, tied to one stout stake.",
    "a cream pot holding an orchid with a spray of pale pink flowers", ["a pot", "a spray of large flowers on a stem"], ["blue flowers or pot", "thin wispy stems"], size=(9, 9, 16), leafy=True)
add("birdbath", "birdbath", S3, 3, ["garden", "conservatory"], "a stone birdbath",
    f"A garden birdbath of {GARDEN_STONE}: a wide, shallow round bowl with a thick rolled rim on a stout carved baluster stem with a round moulded foot (its own foot). A little moss on the rim." + DRY + " NO birds.",
    "a shallow round stone bowl on a waist-high stem", ["a wide shallow bowl", "a single stem and foot"], ["water or blue colour", "a bird"], base=False, bench=["water"])
add("bush-rose--s1", "bush-rose", S3, 3, ["garden", "conservatory"], "a rose bush in bloom",
    "A formal garden rose bush with no pot: a dense, rounded dome of dark green leaves reaching the ground all round, covered with about TWENTY big deep red roses set INTO the surface"
    " of the leaf mass (chunky, half-embedded, each a simple swirled rosette).",
    "a round leafy bush covered with big red roses", ["a compact leafy bush", "red rose flowers on it"], ["a pot or planter", "blue flowers", "a trellis"], leafy=True)
add("bush-rose--s2", "bush-rose", S3, 3, ["garden"], "a standard rose tree in bloom",
    "A standard rose (a small rose tree) with no pot: one straight THICK stem about 2.5 ft tall tied to a stout wooden stake, carrying a dense round ball of dark green leaves covered with big"
    " cream and blush-pink roses set INTO the leaf mass (chunky, half-embedded). The stem ends in a flat cut at the bottom. About 4.5 ft tall.",
    "a small round-headed rose tree on a single stem, covered with cream and pink roses", ["a round head of leaves and roses on one bare stem"], ["a pot or planter", "blue flowers"], size=(30, 30, 54), leafy=True)
add("bell-board-servants", "bell-board-servants", S3, 3, ["servants-kitchen"], "a board of servants' call bells",
    "A servants' bell board, flat-backed and CHUNKY: a long dark wood board with a moulded top edge carrying a row of FIVE brass bells, each a fat round bell hanging from a THICK coiled"
    " brass spring (a solid curled bracket) with a round brass boss above it, and under each bell a small blank cream enamel plate (NO text, NO numbers). It hangs high on a wall: NO wall shown.",
    "a wooden board with a row of five brass bells hanging from curled brackets", ["a long board", "a row of several bells"], ["text or numbers", "a wall", "thin wires or cords"], hung=True)

# --- second shapes of focal pieces and the suites' companions
add("table-feast--fine--s2", "table-feast", "sib1", 2, ["dining-room"], "a shorter oval mahogany dining table",
    "A SHORTER dining table of the same suite to seat six or eight: one thick polished OVAL top about 8 ft long and under 4 ft wide with the same moulded edge and inlaid band, on TWO of the same"
    " stout turned pedestal columns, each ending in four out-curving legs with brass caps. COMPLETELY BARE: nothing on it, no cloth.",
    "an oval polished dark red-brown dining table on two turned pedestals, with nothing on it", ["one oval table top, about twice as long as wide", "nothing on the table"],
    ["chairs", "plates, candles, food or a tablecloth"], size=(96, 44, 30), parent="table-feast--fine", what=DINING, tier="fine")
add("chair-armed--fine--s2", "chair-armed", "sib1", 3, ["dining-room", "library"], "a matching mahogany carver armchair",
    "The dining suite's carver for the head of the table: like the dining side chair (a pierced vase-shaped splat back with a curved eared top rail, a moss-green leather seat pad with brass nails,"
    " turned front legs) but wider, a little taller, and with two open scrolled wooden arms on curved supports.",
    "a dark red-brown wooden dining armchair with open arms and a green seat pad", ["one chair with a back and two open wooden arms"], ["a person", "a fully upholstered easy chair"],
    size=(24, 22, 42), parent="table-feast--fine", what=DINING, tier="fine")
add("table-side--fine--s2", "table-side", "sib1", 3, ["master-bedroom"], "a matching bedside cabinet",
    "The bedroom suite's bedside cabinet, in the same carved dark walnut: a small square cabinet with one shallow drawer over one panelled door, each with a small round brass knob,"
    " a thick moulded top with a low raised gallery on three sides, on four short turned legs. Nothing on top.",
    "a small square dark wood bedside cabinet with a drawer and a door", ["small and square, about knee to thigh high", "a drawer or door on the front"], ["a candle, book or objects on top"],
    size=(18, 18, 28), parent="bed-canopy--state", what=BED, tier="fine")
add("fountain-courtyard--s2", "fountain-courtyard", "sib1", 2, ["garden", "conservatory"], "a small single-bowl stone fountain",
    "A SMALLER fountain in the same stone for a small garden or the middle of a conservatory: a round ground basin only about 5 ft across with the same thick moulded kerb, and from its centre"
    " ONE stout carved baluster stem carrying ONE wide shallow scalloped bowl with a small carved bud finial in the middle. Two tiers in all." + DRY,
    "a small stone fountain: a round ground basin with one bowl on a central stem", ["a round basin at the bottom", "one bowl on a central stem above it"],
    ["water, spray or blue colour", "a statue of a person or animal"], size=(60, 60, 48), parent="fountain-courtyard", what="stone fountain", match="same", base=False, bench=["water"])
add("lamp-post-iron", "lamp-post-iron", "p2", 2, ["garden"], "a wrought-iron garden lamp post",
    "A formal garden lamp post, built CHUNKY: a THICK fluted dark green-black iron column on a wider moulded base that ends in a flat cut at the bottom, with a short cross arm (a ladder rest) near"
    " the top, carrying ONE big four-sided lantern with a pointed cap and a ball finial; the lantern's panes are opaque frosted glass painted pale cream-ochre (NOT blue, NOT see-through). UNLIT: NO flame, NO glow."
    " About 9 ft tall, slim but sturdy.",
    "a tall dark iron lamp post with one four-sided lantern on top", ["one upright column", "one lantern at the top, not glowing"], ["flames or glow", "blue glass", "several lantern arms"],
    bench=["fire"], light="lantern")

assets[:] = [a for a in assets if a]
ids = [a["id"] for a in assets]
assert len(ids) == len(set(ids)), [i for i, n in Counter(ids).items() if n > 1]
by = {a["id"]: a for a in assets}
for a in assets:
    assert a["object"] in roles and roles[a["object"]].get("size"), a["id"]
    assert a["group"] in ("p1", "p2", "p3", "sib1", "sib2"), a["id"]
    if a["group"].startswith("sib"):
        par = a["parent"]
        if par in by:  # (the noble-interior doorway's parent is an accepted plate of an older batch)
            pg = by[par]["group"]
            assert (a["group"] == "sib1" and pg == "p1") or (a["group"] == "sib2" and pg in ("p2", "sib1")), (a["id"], a["group"], par, pg)
    if a.get("twin_of"):
        assert roles[a["object"]]["open_of"] == by[a["twin_of"]]["object"], a["id"]
    if a.get("light"):
        assert "UNLIT" in a["prompt"] or a["light"] == "fireplace", a["id"]
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets:
    (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(assets), "assets", "groups", dict(sorted(Counter(a["group"] for a in assets).items())), "prio", dict(sorted(Counter(a["prio"] for a in assets).items())))
print("bench", dict(Counter(b for a in assets for b in a["bench"])), "hung", sum(1 for a in assets if a.get("hung")), "lights", sum(1 for a in assets if a.get("light")),
      "twins", sum(1 for a in assets if a.get("twin_of")), "roles", len({a["object"] for a in assets}))
