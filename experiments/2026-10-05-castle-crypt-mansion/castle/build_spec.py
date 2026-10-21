#!/usr/bin/env python3
"""Castle type (2026-10-05, batch castle-crypt-mansion): every NEW mesh the castle rooms want, in the yard batch's format
(experiments/2026-10-05-yard-props/build_spec.py). Writes assets.json for src/plate_gate_batch.py.
Rooms: great-hall, throne-room, armoury, barracks, castle-kitchen, chapel, dungeon, gatehouse, courtyard (see rooms.json).
Groups: p1/p2/p3 = independent pieces by priority; sib1/sib2/sib3 = painted FROM the accepted plate of a parent in the
p group of the same priority (wall pieces from the wall, shape variants from the first, an open twin from its closed twin).
Extra fields per asset (ignored by the runner): prio, rooms, bench, hung, light, twin_of, route, note.
    python3 build_spec.py
"""
import json, sys
from collections import Counter
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src"))
import catalog_tool as ct
STYLE = (ROOT / "style/heroic-handpainted.object.md").read_text()
STYLE_REF = str(ROOT / "style-references/heroic-handpainted-tavern-v1.png")
DRESSED = str(ROOT / "experiments/2026-10-01-walls/inputs/wall-straight--dressed-stone--s2.jpg")
roles = {}
for p in sorted((ROOT / "catalog").glob("*.catalog.md")):
    roles.update(ct.parse_catalog(p)[0])

HEAD = "Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset:"
NOBASE = (" It stands on nothing: NO ground disc, NO floor patch, NO rubble, NO base slab or platform under it that the real object would not have."
          " The background is flat chroma blue, so the object itself has NO blue anywhere (no blue cloth, paint, gems or glass).")
NOBLUE = " The background is flat chroma blue, so the object itself has NO blue anywhere (no blue cloth, paint, gems or glass)."
UNLIT = (" It is UNLIT and cold: NO flame, NO glow, NO embers, NO smoke, NO baked light; wicks are dark, torch heads charred, logs cold with grey ash."
         " The game adds the fire.")
STONE = (" The stone must not be one flat grey mass: give it carved mouldings and relief, visible separate blocks with recessed joints,"
         " and colour variation from block to block (blue-grey, warm grey, a little ochre, a touch of moss), so that every face is fully painted.")
CHUNKY = " Every bar, shaft, chain link and strap is deliberately THICK and toy-like (as thick as a wrist), with nothing thin or wiry, so that it reconstructs in 3D."
WALLTAIL = (" Nothing else: NO floor, NO ground, NO base slab or platform under it, NO roof, NO corner return, NO torch, banner, furniture or decoration attached."
            " Both side edges are clean flat vertical cuts so that copies butt together into a longer wall. Seen from its broad side, three-quarter view from slightly above."
            " Keep the WHOLE object well inside the frame with a generous margin." + NOBLUE)
ROUGH = ("ROUGH CASTLE STONE: big, roughly squared blocks of uneven sizes laid in wavering courses, with smaller rubble stones packed between them and wide,"
         " deep, pale lime-mortar joints; a course of the biggest blocks along the bottom. Colours vary from block to block: blue-grey, warm grey, ochre-brown,"
         " with a little moss low down and soot staining high up. Clearly rougher and heavier than neat ashlar")
PANEL = "an upright kit panel about 5 ft wide x 9 ft tall x 1 ft thick, almost twice as tall as wide"
MATCH_WALL = ("The supplied image is the existing plain wall section of this same castle: {what}. The new piece must look cut from the same wall:"
              " the SAME stones, block sizes, mortar joints, colours, overall size and proportions (" + PANEL + "), painting style and camera angle."
              " Change ONLY what is described below.\n\n")
MATCH_SET = ("The supplied image is an accepted piece of the same set: {what}. The new piece must look made by the same hands:"
             " the SAME materials, colours, thicknesses, level of wear, painting style and camera angle. Change ONLY what is described below.\n\n")
EDIT = ("Edit task. The supplied image shows {what} in the Turnip Works hand-painted house style. Show the SAME object: identical materials, colours,"
        " fittings, proportions and painting style, from the same three-quarter camera. Do not redesign it. Change ONLY its state:\n\n")

assets = []
def add(sku, obj, prio, subject, design, desc, must=(), must_not=(), *, size=None, parent=None, what="", mode="set", rooms=(),
        bench=(), hung=False, light=None, twin_of=None, route="trellis", base=True, ref=None, note=None, wall=False):
    role = roles[obj]
    w, d, h = size or role["size"]
    tail = WALLTAIL if wall else ((NOBASE if base else NOBLUE)
            + " Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.")
    detail = f"{design} Real-world size about {w:g} in wide x {d:g} in deep x {h:g} in tall: keep these proportions." + (UNLIT if light else "") + tail
    prompt = STYLE.format(subject=subject, detail=detail)
    refs, gate_refs = [STYLE_REF], []
    must, must_not = list(must), list(must_not)
    if parent or ref:
        pp = ref or str(HERE / "inputs" / f"{parent}.jpg")
        lead = {"wall": MATCH_WALL, "set": MATCH_SET, "open": EDIT}[mode].format(what=what)
        prompt = prompt.replace(HEAD, lead + "Create a single asset in the Turnip Works house style (heroic hand-painted):")
        refs, gate_refs = [pp], [pp]
        must.append("it is the SAME object as the REFERENCE, only in its other state (the described change is the intended difference)" if mode == "open"
                    else f"materials, colours and painting match the REFERENCE ({what}); the described change is the intended difference")
    if not wall and base:
        must_not.append("a ground disc, floor patch or base slab under the object that the real object would not have")
    if light:
        must_not.append("a painted flame, glow or embers (it must be unlit)")
    a = {"id": sku, "object": obj, "group": (f"sib{prio}" if parent else f"p{prio}"), "source": "generate", "lane": "3d", "subject": subject,
         "size": [w, d, h], "prompt": prompt, "refs": refs, "gate_refs": gate_refs, "gate": {"desc": desc, "must": must, "must_not": must_not},
         "prio": prio, "rooms": list(rooms), "bench": list(bench), "route": route}
    if wall: a["generation"] = "kit"
    if hung: a["hung"] = True
    if light: a["light"] = light
    if twin_of: a["twin_of"] = twin_of
    if note: a["note"] = note
    assets.append(a)

ALLWALL = ["armoury", "barracks", "castle-kitchen", "dungeon", "gatehouse"]
WM = ["one single upright wall section, taller than it is wide", "rough stone blocks of uneven sizes with visible mortar joints"]
WN = ["a floor, base slab, roof or corner return", "a torch, banner, ring or any fitting attached to the wall", "neat identical bricks"]
RW = "a wall of rough castle stone, big uneven blocks with wide pale mortar joints"

# ---------------------------------------------------------------- wall kit: family castle-rough (prio 1)
add("wall-straight--castle-rough", "wall-straight", 1, "a straight wall section of rough castle stone",
    f"ONE plain straight wall section, {PANEL}, built of {ROUGH}. The top edge is one level line and the bottom edge sits flat. The front face is the room-facing side.",
    "a plain upright wall section of rough, uneven castle stone blocks", WM, WN + ["a window, slit or door"], wall=True, rooms=ALLWALL)
add("wall-straight--castle-rough--s2", "wall-straight", 1, "a second straight wall section of rough castle stone",
    "The same plain wall with a DIFFERENT layout of blocks, so that two sections side by side do not read as copies: one very large block low on the left, a patch of small"
    " rubble repair high on the right, and two small square putlog holes (shallow dark recesses, not through-holes) at two-thirds height. Same height, thickness, level top and flat bottom.",
    "a plain upright wall section of rough castle stone with a different block layout", WM, WN + ["a window, slit or door"],
    wall=True, parent="wall-straight--castle-rough", what=RW, mode="wall", rooms=ALLWALL)
add("wall-window-small--castle-rough", "wall-window-small", 1, "a rough castle stone wall section with an arrow slit",
    "The same wall with ONE ARROW SLIT (an arrow loop) in the middle: a tall, narrow, cross-shaped opening right through the wall, the vertical slot about 6 in wide and 4 ft tall with a short"
    " horizontal cross-slot a third of the way down, its sill about 3 ft above the bottom. On this room-facing side the slit sits at the back of a deep SPLAYED embrasure: a recess about"
    " 2.5 ft wide at the wall face that narrows to the slit, framed by a few bigger dressed blocks and a flat sill stone. You can see the blue background through the slit. No shutter, no glass, no bars.",
    "a wall section of rough castle stone with one tall narrow cross-shaped arrow slit set in a splayed recess",
    WM + ["exactly one tall, narrow slit opening (an arrow loop), much taller than wide", "the slit sits in a wider recess that narrows toward it"],
    WN + ["a wide window, shutters or glass", "a door", "more than one opening"],
    wall=True, parent="wall-straight--castle-rough", what=RW, mode="wall", rooms=ALLWALL,
    note="the family's window piece: role wall-window-small ('shuttered or slit window') so the wall engine picks it up with no new code; it has NO open twin (a slit has no shutter)")
add("wall-doorway--castle-rough", "wall-doorway", 1, "a rough castle stone wall section with an empty arched door opening",
    "The same wall with an EMPTY door-sized opening through it, starting at the very bottom: about 3.5 ft wide and 7 ft tall, centred, with a low round-arched head built of big"
    " wedge-shaped dressed stones and plain dressed jamb stones. NO door leaf, NO threshold step, NO hinges. About 9 in of wall remains on each side and rough stone runs unbroken above"
    " the arch. You can see straight through the opening to the blue background.",
    "a wall section of rough castle stone with one empty arched door opening through it (no door leaf)",
    WM + ["one door-sized opening that reaches the bottom of the wall, with NO door in it (you can see through)", "stone continues above the opening"],
    WN + ["a door leaf filling the opening", "a window"], wall=True, parent="wall-straight--castle-rough", what=RW, mode="wall", rooms=ALLWALL)
add("door-reinforced--leaf", "door-reinforced", 1, "a heavy iron-banded castle door leaf, without a frame",
    "ONLY the door leaf, with NO frame, NO wall and NO arch round it: a thick door of wide vertical oak planks with a round-arched top, bound by three broad dark iron straps that end in"
    " chunky strap hinges on the left edge, studded with big square nail heads, with one heavy iron ring handle and a big lock plate on the right. Closed, flat, seen from its broad side.",
    "a heavy plank door leaf with a round-arched top, iron straps and studs, with no frame round it",
    ["one door leaf only", "iron straps or bands across the planks"], ["a stone or timber frame, arch or wall round the door", "two leaves"],
    size=(40, 4, 84), rooms=ALLWALL + ["courtyard"],
    note="leaf-only sku like door-plank--leaf: it rotates to open, so it needs no open twin; fits wall-doorway--castle-rough and wall-doorway--dressed-stone")

IRON = "dark forged iron with a little rust-brown and worn bright edges"
add("cell-bars", "cell-bars", 1, "a wall panel of iron prison bars",
    f"A prison cell front as ONE flat upright panel, about 5 ft wide x 9 ft tall and only 4 in thick: a heavy rectangular frame of flat iron bar all round, filled with SIX round vertical bars"
    f" evenly spaced, tied by TWO flat horizontal straps that the bars pass through, at one third and two thirds of the height. {IRON.capitalize()}. You can see the blue background between the bars."
    " Both side edges are the flat frame bars, so panels butt together." + CHUNKY,
    "a tall flat panel of vertical iron prison bars in an iron frame", ["vertical bars with gaps you can see through", "taller than wide"],
    ["a door or gate leaf in it", "stone wall around it", "a lock"], size=(60, 4, 108), rooms=["dungeon"], base=False,
    note="RISK: a grid of bars. If TRELLIS fuses or drops bars, re-roll with FIVE thicker bars; last resort route hunyuan-mv")
add("door-cell-bars", "door-cell-bars", 1, "a prison cell front with a barred door in it",
    f"A prison cell front as ONE flat upright panel, about 5 ft wide x 9 ft tall and 4 in thick, the SAME construction as a plain bar panel (a heavy flat iron frame all round, round vertical bars,"
    f" flat horizontal straps, {IRON}), but with a BARRED DOOR in the middle: a door leaf about 3 ft wide and 6.5 ft tall, starting at the bottom, made of the same bars in its own flat iron frame,"
    " hung on two big knuckle hinges on its left and closed against a big box lock with a keyhole plate on its right. Fixed bars fill the strip either side of the door and the panel above it."
    " The door is CLOSED. You can see the blue background between the bars." + CHUNKY,
    "a tall flat panel of iron prison bars with a closed barred door in the middle", ["vertical iron bars you can see through", "a distinct door leaf with hinges and a lock, closed"],
    ["stone wall around it", "a solid plank door"], size=(60, 4, 108), rooms=["dungeon"], base=False,
    note="in a p group (not painted from cell-bars) because it is the parent of its own open twin; the text repeats the bar-panel construction so the two match")
add("door-cell-bars-open", "door-cell-bars-open", 1, "the same cell front with its barred door swung open",
    "The barred door leaf is swung fully OPEN toward the viewer, about 100 degrees on its left-hand hinges, so it stands out from the panel and the doorway is clear:"
    " you can walk through it and see the blue background through the empty door opening. The fixed bars, frame and lock box stay exactly as they are.",
    "a tall panel of iron prison bars whose barred door stands open, leaving a clear doorway", ["the door leaf is swung open and the doorway is clear"],
    ["a closed door", "stone wall around it"], size=(60, 36, 108), parent="door-cell-bars", what="a prison cell front of iron bars with a closed barred door", mode="open",
    twin_of="door-cell-bars", bench=["hinge"], rooms=["dungeon"], base=False)
add("portcullis--castle-rough", "portcullis", 1, "a castle gate arch with its portcullis down",
    f"A GATE PANEL of a castle wall, about 10 ft wide x 9 ft tall x 2 ft thick, built of {ROUGH}. Through its middle runs a gate passage about 7 ft wide and 8 ft tall with a low pointed arch of"
    " big dressed wedge stones, starting at the very bottom. The passage is CLOSED by a PORTCULLIS hanging in a slot just behind the arch face: a heavy grille of FIVE thick square oak verticals"
    " shod with pointed iron spikes at the bottom and FOUR thick horizontals, the crossings clamped with big square iron plates, the squares of the grille about 14 in across. The spikes rest on"
    " the ground line. You can see the blue background through the grille. About 1.5 ft of wall each side of the arch, and wall above it to a level top." + CHUNKY,
    "a section of rough stone castle wall with one arched gateway closed by a heavy portcullis grille",
    ["an arched gate opening that reaches the bottom", "a grille of crossing vertical and horizontal bars filling the opening", "spiked bottom ends on the grille"],
    ["plank gate leaves", "battlements, towers or a roof on top", "a drawbridge"], size=(120, 24, 108), wall=True, rooms=["gatehouse", "courtyard"],
    note="TWO cells wide (like door-barn-double). In a p group because it is the parent of the raised twin; the stone text is the castle-rough wall text so it matches the family")
add("portcullis-raised--castle-rough", "portcullis-raised", 1, "the same castle gate arch with its portcullis raised",
    "The portcullis is RAISED: the grille has been drawn straight up into the wall, so that only its lowest 1.5 ft, the bottom horizontal with its row of iron-shod spikes, still hangs down"
    " inside the head of the arch like a row of teeth. The whole gate passage below is clear: you can see the blue background straight through it. The wall and arch stay exactly as they are.",
    "a section of rough stone castle wall with an open arched gateway and only the spiked bottom of a raised portcullis showing in the arch head",
    ["the gateway is clear to see and walk through", "a row of spikes or grille ends hanging in the top of the arch"], ["a grille filling the whole opening", "plank gate leaves"],
    size=(120, 24, 108), wall=True, parent="portcullis--castle-rough", what="a castle gate arch closed by a portcullis", mode="open",
    twin_of="portcullis--castle-rough", bench=["hinge"], rooms=["gatehouse", "courtyard"],
    note="bench: not a hinge but a vertical slide; the Alignment Bench item is that the arch of the twin sits exactly on the arch of the closed mesh")
add("city-wall--castle-rough", "city-wall", 1, "a section of castle curtain wall with battlements",
    f"ONE straight section of a castle courtyard's curtain wall, about 5 ft wide x 11 ft tall x 2.5 ft thick, built of {ROUGH}. The top is a BATTLEMENT: a projecting moulded string course,"
    " then a parapet with ONE full square merlon in the middle and half an open crenel gap at each side (so that sections side by side make a regular row of merlons), each merlon with a sloped"
    " cap stone. Below the parapet the wall is plain. The bottom sits flat.",
    "a tall section of rough stone castle wall topped with a battlement (a merlon and gaps)", ["a notched battlement top: at least one raised merlon with a gap beside it", "taller than wide"],
    WN[:2] + ["a door, gate or window", "a round tower"], size=(60, 30, 132), wall=True, rooms=["courtyard"],
    note="the courtyard's EDGE piece (stands on the yard's open edges where the inn yard has a fence); role city-wall at courtyard scale (11 ft, not the catalog's 25-ft town wall). NOT the roof-level battlement: that is the vertical kit's wall-crenellated--dressed-stone")
add("city-wall-turret--castle-rough", "city-wall-turret", 1, "a square corner turret of a castle curtain wall",
    "ONLY a single square corner TURRET of the same curtain wall, standing alone: about 4 ft square and 13 ft tall, a little taller and thicker than the wall, the same projecting string course"
    " near the top, crowned with FOUR small corner merlons with sloped caps, and one small cross-shaped arrow slit recess (a shallow dark recess, not a through-hole) on the front face.",
    "a single square stone turret with a battlemented top, standing alone", ["one compact square tower-like block, much taller than wide", "a notched battlement top"],
    ["wall sections attached at the sides", "a conical roof", "a door"], size=(48, 48, 156), parent="city-wall--castle-rough",
    what="a castle curtain wall of rough stone with a battlement", mode="set", rooms=["courtyard"], base=False)

# ---------------------------------------------------------------- focal pieces (prio 1)
HALL, THR, ARM, BAR, KIT, CHA, DUN, GATE, YARD = "great-hall", "throne-room", "armoury", "barracks", "castle-kitchen", "chapel", "dungeon", "gatehouse", "courtyard"
add("fireplace-grand", "fireplace-grand", 1, "a huge hooded castle fireplace",
    "A great hall fireplace that stands against a wall, flat-backed, about 9 ft wide and 8 ft tall: two stout carved stone jambs like short clustered columns, a massive moulded stone lintel,"
    " and above it a tall sloping stone HOOD that tapers upward, carved with a big blank shield in a round wreath and a band of chunky leaf carving. The fire opening is wide and deep, dark"
    " with soot, holding two big iron firedogs and a stack of three thick cold logs on grey ash. A raised hearth stone projects a little in front." + STONE,
    "a very large stone fireplace with a tall sloping hood above a wide dark fire opening holding cold logs",
    ["a wide fire opening at the bottom", "a tall hood or chimney breast above it", "wider than a doorway"], ["a wall section extending beyond the fireplace", "text or a detailed coat of arms"],
    rooms=[HALL, THR], light="fireplace", bench=["fire"])
add("table-feast", "table-feast", 1, "a very long great-hall feast table",
    "A lord's high table, VERY long and narrow, about 14 ft long, 3 ft deep and waist high: a thick top of three massive oak planks with breadboard ends, carried on THREE heavy carved trestle"
    " supports (each a broad shaped slab with a pierced trefoil) joined by one long low stretcher beam pegged through them. Warm honey-brown oak, darker at the feet. Nothing on it.",
    "a very long, narrow, heavy wooden table on three trestle supports, with nothing on it", ["clearly much longer than it is deep (at least four times)", "a bare table top"],
    ["chairs or benches", "a tablecloth, food, cups or candles on it"], rooms=[HALL])
add("dais", "dais", 1, "a low stone dais of two steps",
    "A raised stone platform for a throne or high table: a low, wide, rectangular block about 9 ft by 14 ft and 16 in high in all, made as TWO broad steps (the lower step projecting about"
    " 14 in on the front and both short sides, the back edge flush and straight to stand against a wall). Each step has a rounded moulded nosing. The top is paved in big square slabs in two"
    " alternating tones with a darker border band; the risers show carved quatrefoil panels. Nothing stands on it. Seen from above at a steep three-quarter angle so the top is clear." + STONE,
    "a low, wide rectangular stone platform of two shallow steps with a paved top and nothing on it", ["low and wide (far wider than tall)", "one or two steps round the front", "an empty top"],
    ["a throne, altar, rail or carpet on it", "a tall plinth"], rooms=[HALL, THR, CHA], base=False,
    note="things stand ON it (throne, high table, altar): the solver must treat its top as a floor 16 in up. It is itself a platform, so the no-base rule does not apply")
add("throne", "throne", 1, "a carved wooden throne with a high back",
    "A king's throne: a massive oak seat with a very tall, straight back that rises to a pointed gable with two chunky corner finials, the back panel carved with a big blank shield under a"
    " trefoil arch; solid panelled sides rising into thick arm rests that end in carved round knobs; a burgundy cushion on the seat and a burgundy padded panel in the back; a low footboard"
    " in front, part of the throne. Touches of worn gilding on the carving edges.",
    "a tall-backed carved wooden throne with arm rests and a red cushion", ["one seat with a back much taller than the seat is wide", "arm rests"],
    ["a person or crown on it", "a dais or steps under it", "a canopy on posts"], rooms=[THR, HALL])
add("armor-stand--s1", "armor-stand", 1, "a suit of plate armour on a wooden stand",
    "A full harness of plate armour displayed on a stand, as tall as a man: a great helm with a narrow eye slit, a rounded breastplate with a skirt of plates, big pauldrons, arm pieces hanging"
    " at the sides with gauntlets, and leg plates down to pointed sabatons, all in steel-grey with warm bronze edging. The armour is EMPTY and hangs on a stout wooden post with a short cross bar,"
    " standing on a thick cross-shaped wooden foot that shows between the feet. Arms close to the body, legs together: one compact upright mass.",
    "an empty suit of plate armour with a helmet, standing upright on a wooden stand", ["helmet, body armour and leg armour", "arms held close to the body"],
    ["a face, skin or eyes (it must be empty)", "a weapon or shield in the hands", "a cape"], rooms=[ARM, THR, HALL])
ARMSET = "a suit of armour displayed on a wooden stand with a cross-shaped foot"
add("armor-stand--s2", "armor-stand", 1, "a mail hauberk and kettle helm on a wooden stand",
    "A DIFFERENT, plainer harness on the same kind of stand: a long shirt of mail (painted as a solid surface with a broad ring pattern, not separate rings) under a burgundy-and-cream"
    " quartered surcoat belted at the waist, a wide-brimmed kettle helm on top, and NO leg armour: below the hem the wooden post and its cross-shaped foot are plain to see.",
    "a mail shirt with a cloth surcoat and a wide-brimmed helmet on a wooden stand", ["a helmet on top", "the wooden post and foot visible below the armour"],
    ["a face or skin", "a weapon or shield", "blue cloth"], parent="armor-stand--s1", what=ARMSET, rooms=[ARM, BAR, GATE])
add("armor-stand--s3", "armor-stand", 1, "a half armour on a T-shaped stand",
    "A DIFFERENT harness on the same kind of stand: only a breastplate with a fluted skirt, two pauldrons and an open-faced helmet with a nose bar and a short crest, on a T-shaped wooden"
    " post; no arms, no legs. A round shield with a big iron boss hangs on the front of the post below the breastplate. Steel-grey with a moss-green painted shield rim.",
    "a breastplate, shoulder pieces and open helmet on a T-shaped wooden stand with a round shield hung below", ["a helmet on top", "a breastplate", "the wooden post and foot visible"],
    ["a face or skin", "full leg armour"], parent="armor-stand--s1", what=ARMSET, rooms=[ARM, GATE])
add("weapon-rack--s1", "weapon-rack", 1, "a wall rack of swords and axes",
    "A weapon rack that stands on the floor against a wall, flat-backed, about 4 ft wide and 5 ft tall: two stout oak end posts on sledge feet joined by a notched top rail and a bottom board"
    " with sockets, holding a row of SIX weapons upright, points down: three arming swords with simple cross guards, two bearded hand axes and one mace. The weapons stand side by side, touching"
    " the rails, and a plank back board fills the rack behind them so that nothing is seen through it." + CHUNKY,
    "a wooden rack holding a row of upright swords and axes", ["a wooden rack frame", "several weapons standing upright in a row"], ["a person", "weapons lying loose on the ground"],
    rooms=[ARM, BAR, GATE])
RACKSET = "an oak weapon rack with end posts, a notched top rail and a plank back board"
add("weapon-rack--s2", "weapon-rack", 1, "a wall rack of polearms",
    "The same kind of rack, but TALLER (about 4 ft wide and 7.5 ft tall) and holding FIVE polearms upright, butts down: two halberds, a glaive, a bill hook and a spear, their thick ash"
    " shafts side by side against the plank back board, the blades fanned slightly at the top and overlapping one another.",
    "a tall wooden rack holding a row of upright polearms (halberds and spears)", ["long-shafted weapons standing upright in a rack", "taller than wide"],
    ["swords only", "a person"], size=(48, 12, 90), parent="weapon-rack--s1", what=RACKSET, rooms=[ARM, GATE, YARD])
add("weapon-rack--s3", "weapon-rack", 1, "a wall rack of shields and maces",
    "The same kind of rack with a different load: the top rail carries THREE heater shields hung side by side (burgundy, moss green and cream, each with a plain broad stripe, no emblems),"
    " and below them a row of four maces and war hammers stands upright in the bottom board.",
    "a wooden rack with three shields hung along the top and a row of maces and hammers below", ["three shields in a row", "short hafted weapons below"],
    ["emblems, animals or text on the shields", "blue shields"], parent="weapon-rack--s1", what=RACKSET, rooms=[ARM, BAR])
add("pew--s1", "pew", 1, "a church pew",
    "A long oak bench pew, about 8 ft long: a plank seat, a solid panelled back to shoulder height with a moulded top rail, and two thick shaped END boards with carved poppy-head finials"
    " (a chunky fleur-de-lis knob on each). A low kneeling board runs along the floor in front, joined to the ends. Warm honey-brown oak. Empty.",
    "a long wooden church pew with a panelled back and carved end boards", ["a long bench with a back", "solid end boards"], ["cushions, books or people", "separate chairs"], rooms=[CHA])
PEWSET = "an oak church pew with a panelled back and carved end boards"
add("pew--s2", "pew", 1, "a church pew with square ends",
    "The same pew with DIFFERENT ends: plain square-topped end boards, each carved with one deep pointed-arch panel, no finials; the back has an open row of five thick turned spindles under the top rail.",
    "a long wooden church pew with square carved end boards", ["a long bench with a back", "solid end boards"], ["cushions, books or people"], parent="pew--s1", what=PEWSET, rooms=[CHA])
add("pew--s3", "pew", 1, "a short church pew with a book ledge",
    "A SHORTER pew from the same church, about 5.5 ft long, the same ends and panelled back, with a sloping book ledge fixed along the back of its top rail and two burgundy kneeling"
    " cushions lying on the kneeling board.",
    "a shorter wooden church pew with carved end boards and two red kneeling cushions", ["a bench with a back", "solid end boards"], ["people", "blue cushions"],
    size=(66, 24, 36), parent="pew--s1", what=PEWSET, rooms=[CHA])
add("rack-torture", "rack-torture", 1, "a torture rack",
    "A dungeon rack: a long, heavy, table-high oak frame about 7 ft long and 3 ft wide, with a plank bed, a thick wooden ROLLER across each end, the roller at the head turned by a big"
    " four-spoke capstan handle on one side with an iron ratchet wheel, and thick ropes ending in iron-bound leather cuffs lying on the bed from each roller. Four stout square legs with"
    " stretchers. Dark stained wood, black iron. EMPTY: nobody on it." + CHUNKY,
    "a long heavy wooden rack table with a roller and spoked handle at the end and ropes with cuffs on the bed", ["a long low table-like frame", "a roller or winch with a spoked handle at one end"],
    ["a person or body", "blood"], rooms=[DUN])
add("iron-maiden", "iron-maiden", 1, "an iron maiden, closed",
    "An iron maiden standing upright, CLOSED: a tall, hollow iron cabinet about 6.5 ft tall, shaped like a rounded standing coffin that widens at the shoulders and narrows to the foot, made of"
    " riveted iron plates with broad bands, with a simple mask-like head (two eye slits and a nose ridge, no mouth) under a rounded cap. The front is two tall doors meeting in the middle, shut,"
    " with three big hinges down each side and a heavy hasp and padlock at the centre. It stands on a thick square iron foot plate that is part of it. Dark iron with rust-brown streaks.",
    "a tall closed iron cabinet shaped like a standing figure, with a mask-like head, banded doors and a lock", ["a tall upright iron case, taller than a man", "closed front doors with hinges"],
    ["open doors or spikes showing", "a person", "blood"], rooms=[DUN], base=False)
add("iron-maiden-open", "iron-maiden-open", 1, "the same iron maiden with its doors open",
    "Both front doors are swung fully OPEN to the sides, about 110 degrees, so the inside is plain to see: a dark, EMPTY, hollow body-shaped cavity, and rows of short, thick, blunt-looking"
    " cone spikes on the inner faces of both doors and on the back of the cavity. The head, body shell, hinges and foot plate stay exactly as they are. Nobody inside, no blood.",
    "a tall iron cabinet shaped like a standing figure with both front doors open, showing an empty hollow inside lined with spikes",
    ["both doors open", "an empty hollow interior", "spikes on the inside of the doors"], ["closed doors", "a person or body", "blood"],
    size=(60, 34, 78), parent="iron-maiden", what="a closed iron maiden", mode="open", twin_of="iron-maiden", bench=["hinge"], rooms=[DUN], base=False,
    note="if TRELLIS closes the cavity, re-route hunyuan-mv (hollow shell with open doors)")
add("training-dummy--s1", "training-dummy", 1, "a straw training dummy on a post",
    "A soldier's practice dummy: a stout square post on a heavy cross-shaped timber foot, carrying a fat sackcloth body stuffed with straw (straw bursting from two slashes), a round sack head"
    " with NO face, and one thick wooden cross-arm through the shoulders; a battered round wooden shield is tied to one end of the arm and an old kettle helm sits on the head. Rope lashings.",
    "a straw-stuffed practice dummy on a wooden post with a cross arm, a shield and an old helmet", ["a stuffed sack body on a post", "a wooden foot or post reaching the ground"],
    ["a painted face", "a real person", "a sword stuck in it"], rooms=[YARD, BAR])
add("archery-target--s1", "archery-target", 1, "a straw archery butt on a stand",
    "An archery butt: a thick round disc of tightly coiled straw rope, about 3 ft across and 8 in thick, its face covered with a painted cloth of concentric rings (cream outer, burgundy,"
    " then an ochre-gold centre), leaning back on a stout wooden A-frame easel of three thick legs. THREE fat arrows with cream fletchings stick out of the face near the centre.",
    "a round straw archery target with coloured rings on a three-legged wooden stand, with a few arrows in it", ["a round target face with concentric rings", "a wooden stand"],
    ["blue rings", "a bow or a person"], size=(40, 30, 54), rooms=[YARD])
add("cook-hearth-spit--great", "cook-hearth-spit", 1, "a great castle kitchen hearth with a roasting spit",
    "A castle kitchen's cooking hearth, flat-backed to stand against a wall, about 11 ft wide and 7.5 ft tall: a broad, low, segmental stone arch on two massive stone piers, spanning a deep"
    " fire recess big enough to roast an ox, with a sloping stone hood above. In the recess: a raised brick hearth with a long bed of cold logs and grey ash, two tall iron cob-irons with"
    " hooks carrying ONE long thick iron spit across the whole width with a big crank wheel at one end, a deep iron drip tray under the spit, and at one side a swinging iron crane with a"
    " round black pot hanging from it on a thick hook. The spit is BARE (no meat). Soot-blackened inside." + STONE,
    "a very wide stone kitchen fireplace with a long iron roasting spit across the fire recess and a hanging pot", ["a wide arched fire recess", "a long horizontal spit across it", "much wider than tall or about as wide as tall"],
    ["meat or an animal on the spit", "a cook"], size=(132, 48, 90), rooms=[KIT], light="fireplace", bench=["fire"],
    note="a large-scale variant sku of the existing role cook-hearth-spit (6 ft): this one is 11 ft, the kitchen's focal piece")
add("cauldron-crane", "cauldron-crane", 1, "a great cauldron hanging from a timber crane",
    "A free-standing kitchen crane with a cauldron: a heavy timber gallows, one thick upright post on a broad cross-shaped foot with two braces, and a thick horizontal arm at head height"
    " braced by a curved strut, from which a HUGE round-bellied black iron cauldron (about 3 ft across, three stubby feet, two ring lugs) hangs on a very thick short chain and hook, its"
    " feet just above a low square hearth of four big kerb stones holding cold logs and ash, which is part of the piece. The cauldron is empty and dark inside.",
    "a big black cauldron hanging by a chain from a wooden crane arm over a low stone hearth", ["one large round cauldron", "a post with an arm that the cauldron hangs from"],
    ["food or liquid in the cauldron", "a tripod of three poles"], rooms=[KIT, YARD], light="fireplace", bench=["fire"], base=False)
add("windlass", "windlass", 1, "a gatehouse windlass",
    "The winch that raises a portcullis: a heavy oak frame of two A-shaped side trestles on sledge feet, carrying a thick horizontal wooden DRUM wound with several turns of very thick chain,"
    " with a big FOUR-spoke capstan wheel of thick turned handles at each end of the drum, an iron ratchet wheel and pawl at one side, and the chain's end running up a short way to a big"
    " iron ring. Dark oak, black iron." + CHUNKY,
    "a heavy wooden winch: a horizontal drum wound with chain between two trestles, with spoked handle wheels at the ends", ["a horizontal drum or roller in a frame", "spoked turning handles"],
    ["a well or bucket", "a person"], size=(60, 36, 44), rooms=[GATE])

# ---------------------------------------------------------------- prio 2: furniture and fittings
add("throne--s2", "throne", 2, "a carved stone throne",
    "An ancient STONE seat of kings: a massive block-built throne with a tall back ending in a round-headed top carved with a plain sun disc, thick slab arm rests whose fronts are carved as"
    " chunky scrolls, and a burgundy cushion on the seat with a fur pelt thrown over one arm. A single low stone step in front is part of the throne." + STONE,
    "a massive stone throne with a tall back, slab arm rests and a red cushion", ["one seat with a tall back", "made of stone"], ["a person", "animal heads or creatures carved on it"], rooms=[THR])
add("dais--s2", "dais", 2, "a small square stone dais of one step",
    "A small raised stone platform for a single throne or an altar: a low square slab about 9 ft by 9 ft and 8 in high, ONE step, with a rounded moulded nosing on three sides and a straight"
    " back edge, the top paved in big square slabs with a darker border band. Nothing on it. Seen from above at a steep three-quarter angle." + STONE,
    "a low square stone platform of one step with a paved top and nothing on it", ["low and wide (far wider than tall)", "an empty top"], ["a throne, altar or carpet on it"],
    size=(110, 110, 8), rooms=[THR, CHA], base=False)
add("chair-armed--high-seat", "chair-armed", 2, "a lord's high-backed chair",
    "The lord's chair at a high table: a heavy oak box chair with a tall panelled back carved with linenfold, a flat moulded cresting, solid panelled sides as arm rests, and a moss-green"
    " cushion on the seat. Taller and grander than a common armchair, plainer than a throne.",
    "a heavy wooden armchair with a tall panelled back and a green cushion", ["one chair with arm rests and a tall back"], ["a throne with a pointed gable", "a person"],
    size=(28, 24, 58), rooms=[HALL])
add("pillar-round", "pillar-round", 2, "a round stone column",
    "A stout round castle column, 10 ft tall: a moulded base on a square plinth block, a thick drum-built shaft with visible joints between the drums, and a broad cushion capital carved with"
    " chunky scallops under a square abacus slab. The plinth and abacus are part of the column." + STONE,
    "a tall round stone column with a moulded base and a carved capital", ["one round column, much taller than wide", "a wider capital at the top"], ["an arch or beam on top", "a statue"],
    rooms=[HALL, THR, CHA], base=False)
add("brazier-large", "brazier-large", 2, "a big bowl brazier",
    "A great hall brazier: a wide, shallow, hammered iron bowl about 3 ft across with a rolled rim and four ring handles, on a squat stand of four thick splayed legs joined by a ring,"
    " the bowl heaped with cold black charcoal and grey ash.",
    "a wide iron fire bowl on a low four-legged stand, filled with cold charcoal", ["a wide bowl on legs", "charcoal or ash in the bowl"], ["a tripod of three long thin legs"],
    rooms=[HALL, THR, YARD, GATE], light="brazier", bench=["fire"])
add("chandelier-ring--great", "chandelier-ring", 2, "a great iron wheel chandelier",
    "A great hall wheel chandelier, about 6 ft across: TWO concentric flat iron rings joined by eight thick spokes to a central hub, carrying sixteen fat cream candles in drip pans round"
    " the outer ring and eight round the inner one, hung from the hub and four points of the outer ring by very thick chains that meet at one big ring a short way above." + CHUNKY,
    "a large round iron chandelier of two rings with many unlit candles, hung on thick chains", ["a horizontal ring or wheel with candles round it", "chains meeting above"],
    ["a single small ring with four candles"], size=(72, 72, 40), rooms=[HALL, THR], light="chandelier", bench=["fire"],
    note="ceiling-hung; a bigger variant sku of the existing chandelier-ring (40 in)")
add("heraldic-shield--s1", "heraldic-shield", 2, "a carved coat-of-arms plaque",
    "A wall plaque: a big heater-shaped shield carved in wood and painted in two fields, burgundy and cream divided by a broad diagonal ochre band, with a thick moulded gilt rim, mounted"
    " on a dark oak back board shaped like a shield a little bigger. Flat-backed. NO animals, NO text, NO emblems.",
    "a painted shield-shaped wall plaque divided into plain coloured fields", ["shield shape", "plain colour fields only"], ["animals, letters or emblems", "blue paint", "a wall"],
    rooms=[HALL, THR, BAR], hung=True)
add("heraldic-shield--s2", "heraldic-shield", 2, "a coat-of-arms plaque with crossed swords",
    "A wall trophy of arms: a painted heater shield, moss green with a broad cream chevron and a gilt rim, mounted in front of TWO thick crossed swords whose hilts show above and points below"
    " the shield, all fixed to a round dark oak back board. Flat-backed. NO animals, NO text.",
    "a painted shield in front of two crossed swords on a round wooden board", ["a shield", "two crossed swords behind it"], ["animals, letters or emblems", "blue paint", "a wall"],
    size=(30, 5, 36), rooms=[HALL, ARM, GATE], hung=True)
add("banner-pole--s1", "banner-pole", 2, "a standing banner on a pole",
    "A free-standing heraldic banner, 9 ft tall: a thick turned wooden pole with a gilt spear-shaped finial, standing in a heavy round iron-bound wooden foot, with a short cross bar near"
    " the top from which a long, heavy, swallow-tailed cloth banner hangs straight down, burgundy with a broad cream stripe down the middle and a gold fringe, painted as ONE thick stiff"
    " slab of cloth with a few deep folds. NO emblem, NO text.",
    "a tall pole on a round foot with a long red and cream banner hanging from a cross bar", ["a pole with a foot", "a hanging cloth banner"], ["emblems, animals or text", "blue cloth", "a person"],
    rooms=[THR, HALL, YARD], note="RISK: cloth; asked for as one thick slab. catalog gen is `thin`")
add("banner-pole--s2", "banner-pole", 2, "a standing war banner on a pole",
    "A free-standing banner, 9 ft tall: a thick wooden pole with a gilt ball finial in a heavy square stone foot block, carrying a square banner fixed along the pole's top third and held"
    " out by a top cross bar, quartered moss green and ochre with a gold fringe, painted as ONE thick stiff slab of cloth with two deep folds. NO emblem, NO text.",
    "a tall pole in a square foot block with a square green and ochre banner", ["a pole with a foot", "a cloth banner"], ["emblems, animals or text", "blue cloth"],
    rooms=[THR, GATE, YARD])
add("faldstool", "faldstool", 2, "a folding X-frame stool",
    "A courtier's faldstool: an X-frame stool of two pairs of thick curved crossed legs joined by turned stretchers, the tops ending in small carved knobs, with a thick burgundy leather sling"
    " seat stretched between them and a fringed edge.", "a stool with crossed X-shaped legs and a red sling seat", ["X-crossed legs", "no back"], ["a back rest", "blue cloth"], rooms=[THR, HALL])
add("grindstone", "grindstone", 2, "a treadle grindstone",
    "An armourer's grindstone: a thick round sandstone wheel, 2 ft across, on an iron axle in a sturdy oak trestle frame, with a wooden treadle board below linked to a crank on the axle"
    " by a thick rod, and a small wooden water trough under the wheel. A sword blade is NOT included.", "a round stone grinding wheel mounted upright in a wooden frame with a foot treadle",
    ["one upright stone wheel in a frame"], ["a person", "a mill"], rooms=[ARM, YARD])
add("arrow-barrel", "arrow-barrel", 2, "a barrel full of arrows",
    "A small oak barrel with two iron hoops, open at the top and packed full with a tight sheaf of arrows standing points down, so that a dense, domed mass of cream and burgundy fletchings"
    " fills the top like a bunch of flowers. The arrows are painted as one solid bundle, not as separate thin shafts.",
    "a small barrel packed with arrows, their feathered ends bunched at the top", ["a barrel", "a dense bunch of arrow fletchings at the top"], ["a bow", "blue feathers"], rooms=[ARM, GATE, YARD])
add("mil-shield-stack", "mil-shield-stack", 2, "a stack of round shields leaning together",
    "FIVE round wooden shields leaning one against the next in a slanting stack like tipped plates, each with a big iron boss and an iron rim, painted in plain halves and quarters of"
    " burgundy, cream, moss green and ochre. They touch and overlap as one solid group.", "several round shields leaning against one another in a stack", ["several round shields overlapping"],
    ["emblems or animals", "blue paint"], rooms=[ARM, BAR, YARD])
add("mil-crossbow-rack", "mil-crossbow-rack", 2, "a wall rack of crossbows",
    "A wall-hung rack: a thick oak back board about 4 ft wide with a row of FOUR stout pegs pairs, carrying four crossbows hung side by side by their stirrups, stocks down, each with a"
    " thick wooden tiller and a short, thick steel bow; a narrow shelf along the bottom holds a box of bolts. Flat-backed, everything touching the board." + CHUNKY,
    "a wooden wall board with four crossbows hung in a row", ["a back board", "several crossbows side by side"], ["a wall", "a person"], rooms=[ARM, GATE], hung=True,
    note="hung: catalog depth is 10 in, over isHung's 8 in size test, so the id needs adding to HUNG_IDS")
add("mil-spear-tripod", "mil-spear-tripod", 2, "spears stacked in a tripod",
    "SIX thick-shafted spears stacked upright as a cone, butts spread on the ground in a ring and the shafts crossing and bound together two thirds of the way up with a broad leather strap,"
    " the leaf-shaped iron heads fanning out above; a kettle helm hangs on the binding and a round shield leans against the butts, touching them." + CHUNKY,
    "a cone of spears leaning together and tied near the top, with a helmet and a shield", ["several spears leaning together into a cone", "tied where they cross"], ["a tent", "a person"],
    size=(36, 36, 90), rooms=[GATE, YARD, ARM], note="RISK: thin shafts; catalog gen is `thin`. The shafts are asked for very thick")
add("smith-helm-row-shelf", "smith-helm-row-shelf", 2, "a wall shelf of helmets",
    "A wall-hung shelf: a thick oak plank about 4 ft long on three chunky shaped brackets, with a plank back, carrying a row of FIVE identical steel kettle helms side by side, brims touching.",
    "a wooden wall shelf with a row of identical steel helmets", ["a shelf on brackets", "a row of helmets"], ["a wall", "faces"], rooms=[ARM, BAR, GATE], hung=True,
    note="hung: depth 12 in, needs adding to HUNG_IDS")
add("mil-armor-repair-bench", "mil-armor-repair-bench", 2, "an armourer's repair bench",
    "A heavy oak work bench with a thick top and a lower shelf, about 5 ft long: on the top a breastplate lying on its back, a heap of mail (a solid lump with a ring pattern), a small bench"
    " anvil stake set in the top, a hammer, pincers and a wooden bowl of rivets; on the shelf a helmet and a folded leather apron. Everything touches the bench.",
    "a sturdy work bench with a breastplate, a heap of mail, a small anvil and tools on it", ["a work bench or table", "pieces of armour on it"], ["a person", "a forge fire"], rooms=[ARM])
add("mil-wasters-rack", "mil-wasters-rack", 2, "a rack of wooden practice swords",
    "A low floor rack against a wall, flat-backed: two short oak posts and two notched rails with a plank back, holding a row of SIX thick WOODEN practice swords (wasters) upright, points"
    " down, all pale honey wood with fat round pommels, plus two small round wicker bucklers hung on the end posts." + CHUNKY,
    "a wooden rack holding a row of wooden practice swords", ["a rack", "several wooden swords upright in a row"], ["steel blades", "a person"], rooms=[YARD, BAR])
add("mil-pavise", "mil-pavise", 2, "a standing pavise shield",
    "A crossbowman's pavise: a tall, convex, rectangular wooden shield about 4 ft high with a raised central rib from top to bottom, painted in two plain halves, burgundy and cream, with an"
    " iron edge, standing upright on the ground propped by ONE thick wooden strut hinged to its back.", "a tall rectangular shield standing upright on the ground, propped by a strut behind",
    ["a tall rectangular shield", "it stands by itself on a prop"], ["emblems or animals", "blue paint", "a person"], rooms=[GATE, YARD, ARM])
add("mil-footlocker", "mil-footlocker", 2, "a soldier's footlocker, closed",
    "A soldier's footlocker, CLOSED: a low, plain pine chest about 2.5 ft long with a flat lid, dovetailed corners, two iron corner straps, a hasp with a small padlock and rope loop"
    " handles at the ends, a painted cream band round the middle.", "a low plain wooden chest with a flat lid, closed", ["a low box with a flat lid, shut"], ["an open lid", "a rounded lid"], rooms=[BAR])
add("mil-footlocker-open", "mil-footlocker-open", 2, "the same footlocker with its lid open",
    "The flat lid is swung fully OPEN, standing up and leaning a little back on its hinges. Inside: a folded burgundy blanket, a pair of boots lying on their sides, a tin plate and cup,"
    " filling the box to just below the rim.", "a low wooden chest with its flat lid open, a folded blanket and boots inside", ["the lid open", "things inside the box"], ["a closed lid", "blue cloth"],
    size=(30, 20, 28), parent="mil-footlocker", what="a closed soldier's footlocker", mode="open", twin_of="mil-footlocker", bench=["hinge"], rooms=[BAR])
add("mil-helmet-peg-rack", "mil-helmet-peg-rack", 2, "a wall peg rail with helmets and gear",
    "A wall-hung peg rail: a thick oak board about 4 ft long with FIVE fat turned pegs, carrying two steel kettle helms, a rolled burgundy cloak, a sword belt with a scabbard, and a"
    " leather satchel, all hanging close against the board. Flat-backed.", "a wooden wall peg rail hung with helmets, a cloak and a belt", ["a board with pegs", "at least one helmet hanging"],
    ["a wall", "blue cloth"], rooms=[BAR, GATE], hung=True, note="hung: depth 10 in, needs adding to HUNG_IDS")
add("cauldron-huge", "cauldron-huge", 2, "a huge cauldron on legs",
    "A castle kitchen's stock cauldron: a HUGE round-bellied black iron pot about 3.3 ft across and 3 ft tall with a flared rim, two thick ring lugs and three stout legs with paw feet,"
    " filled nearly to the brim with a thick ochre-brown pottage with chunks of turnip and carrot showing; a long wooden paddle stands in it, leaning on the rim.",
    "a very large black cauldron on three legs, full of thick stew, with a long paddle in it", ["one big round pot on legs"], ["a fire under it", "a person"], rooms=[KIT])
add("pig-on-spit", "pig-on-spit", 2, "a whole pig roasting on a spit",
    "A spit roast as one piece, about 6 ft long: two stout forked iron stands on spreading feet carry a long, thick iron spit with a crank handle at one end, and on the spit a whole"
    " roasted pig, golden-brown and glazed, trussed with thick cord, an apple in its mouth. Underneath, a long low bed of cold charcoal and ash edged with a row of kerb stones, joined to"
    " the stands. This is cooked FOOD, not a live animal.", "a whole roast pig on a long spit between two stands over a bed of cold coals", ["a pig-shaped roast on a horizontal spit", "two supports"],
    ["a live animal", "flames"], rooms=[KIT, HALL, YARD], light="fireplace", bench=["fire"], base=False)
add("trade-butcher-hooks-rail", "trade-butcher-hooks-rail", 2, "a hanging rail of meat hooks with joints",
    "A ceiling-hung larder rail, about 5 ft long: one thick iron bar hanging from two short thick chains, with FIVE fat S-hooks, carrying a ham, a side of bacon, a string of fat sausages,"
    " a plucked goose and a bunch of onions, hanging close together and touching one another as one mass.", "an iron bar hung on two chains with hams, sausages and a plucked bird hanging from hooks",
    ["a horizontal bar", "several pieces of meat hanging from it"], ["a live animal", "a person"], size=(60, 14, 40), rooms=[KIT],
    note="ceiling-hung over the kitchen aisles (the solver already hangs hams and kettles there). catalog gen is `thin`: loaded with meat on purpose so the hooks are not bare")
add("lectern", "lectern", 2, "a reading lectern",
    "A chapel lectern, chest high: a heavy turned oak column on a broad round moulded foot, carrying a steeply sloping book desk with a ledge, its sides carved with pierced trefoils,"
    " and a big closed book with a burgundy leather cover and brass clasps lying on the desk.", "a tall wooden reading stand with a sloping top and a closed book on it",
    ["a sloping desk on a single column", "a book on it"], ["text on the book", "a person", "an eagle or other creature"], rooms=[CHA],
    note="GENERIC religious id (shared with the crypt)")
add("font-holy", "font-holy", 2, "a stone baptismal font",
    "A chapel font, waist high: a thick octagonal stone bowl carved with a pointed-arch panel on each face, on a stout octagonal stem with a moulded base and a single octagonal step that"
    " is part of the font, closed by a low conical oak lid with an iron ring handle on top." + STONE, "a waist-high octagonal stone font with a wooden lid",
    ["a bowl on a stem", "eight-sided or round"], ["water", "a person"], rooms=[CHA], note="GENERIC religious id (shared with the crypt); lidded so no water surface is needed", base=False)
add("prayer-candle-rack", "prayer-candle-rack", 2, "a votive candle rack",
    "A votive candle stand: a stout iron frame on four legs carrying THREE stepped tiers of shallow trays, each tier holding a row of six fat cream candles of different heights standing in"
    " drip pans, with a small locked offering box fixed to the front of the frame." + CHUNKY, "an iron stand with three stepped rows of unlit candles",
    ["rows of candles in tiers", "a stand with legs"], ["a single candlestick"], rooms=[CHA], light="candle", bench=["fire"], note="GENERIC religious id")
add("candelabra-standing--iron", "candelabra-standing", 2, "a tall floor candelabra",
    "A tall iron floor candelabrum, 5 ft high: a thick twisted iron stem on a heavy tripod foot of three scrolled legs, branching at the top into FIVE thick curved arms in one flat fan,"
    " each ending in a wide drip pan with one fat cream candle." + CHUNKY, "a tall iron floor candle stand with five unlit candles on branching arms",
    ["one tall stem on a foot", "several candles at the top"], ["a table candlestick"], rooms=[CHA, THR, HALL], light="candle", bench=["fire"],
    note="GENERIC id (set tags CRY, NOB, TEM): the plain iron one; the mansion may add a gilt sku of the same role. catalog gen is `thin`")
add("rite-altar-emblem-stand", "rite-altar-emblem-stand", 2, "a faith emblem on a tall stand",
    "A processional emblem: a thick turned wooden staff, 6 ft tall, in a heavy round stone foot, topped with a big gilt SUN DISC with eight short thick triangular rays and a plain raised"
    " ring in the middle. No cross, no text, no face on the sun.", "a tall staff in a round foot topped with a golden sun disc", ["a disc with rays on top of a staff", "a heavy foot"],
    ["a cross", "a face on the sun", "text"], rooms=[CHA], note="GENERIC religious id")
add("window-stained-glass--dressed-stone", "window-stained-glass", 2, "a dressed stone wall section with a stained-glass window",
    f"The same neat coursed blue-grey stone wall, {PANEL}, with ONE tall pointed-arch WINDOW in it: the opening about 2.5 ft wide and 5.5 ft tall, its sill about 2.5 ft above the bottom,"
    " with a moulded stone frame and one stone mullion splitting it into two lancets under a small round light at the top. The window is glazed with STAINED GLASS in a chunky lead pattern of"
    " big diamonds and a border band, in burgundy red, amber gold, moss green and cream only. The glass is solid and opaque; you cannot see through it.",
    "a wall section of neat grey stone blocks with one tall pointed-arch stained-glass window in red, gold and green",
    ["one single upright wall section, taller than it is wide", "one tall pointed-arch window with coloured glass"], ["blue glass", "figures, faces or text in the glass", "a floor, base slab, roof or corner return", "a door"],
    size=(60, 12, 108), wall=True, ref=DRESSED, what="a wall of neat coursed blue-grey dressed stone blocks with thin mortar lines", mode="wall", rooms=[CHA, THR, HALL],
    note="painted from the EXISTING accepted dressed-stone wall plate (experiments/2026-10-01-walls), not from a plate in this batch, so it sits in p2. NO blue glass: the chroma key")
add("stocks", "stocks", 2, "wooden stocks",
    "Punishment stocks: two stout square oak posts on sledge feet, about 5 ft apart, holding between them two thick horizontal boards one on the other, hinged at one post and closed with a"
    " hasp and big padlock at the other, with FOUR round ankle holes cut half in each board; a low plank bench is fixed behind, joined to the posts. EMPTY.",
    "wooden stocks: two posts holding a pair of boards with round leg holes, and a low bench behind", ["two boards with round holes between two posts"], ["a person", "a tall pillory with a head hole"],
    rooms=[DUN, YARD])
add("pillory", "pillory", 2, "a standing pillory",
    "A pillory: one thick square post, 6 ft tall, on a heavy cross-shaped foot with four braces, carrying at shoulder height a pair of thick horizontal boards hinged at one end and padlocked"
    " at the other, with one big round NECK hole in the middle and a smaller WRIST hole each side. EMPTY.", "a tall post on a cross foot carrying a board with three round holes (neck and wrists)",
    ["one upright post", "a horizontal board with three holes near the top"], ["a person", "a low bench"], rooms=[DUN, YARD])
add("manacles-wall", "manacles-wall", 2, "wall manacles on a ring plate",
    "A set of prisoner's wall irons: a thick square iron back plate with four big bolt heads and a heavy staple, from which TWO short, very thick chains (four fat links each) hang down"
    " to two open hinged wrist cuffs. The chains hang straight, close together, flat against where the wall would be. Dark iron, rust-brown." + CHUNKY,
    "an iron wall plate with two short thick chains ending in wrist cuffs", ["two chains hanging from one plate", "a cuff at the end of each"], ["a wall", "a person or bones"],
    rooms=[DUN], hung=True, note="RISK: chains (catalog gen `thin`). Short and fat on purpose; if they break, re-roll with three links each")
add("brazier-irons", "brazier-irons", 2, "a brazier with branding irons",
    "A torturer's brazier, waist high: a round iron fire bowl on three thick legs, heaped with cold black coals, with FOUR thick iron branding irons and pokers standing in it with their"
    " wooden handles sticking out to one side, and a pair of heavy tongs hanging on the rim." + CHUNKY, "a round iron brazier on legs filled with cold coals, with iron rods and tongs standing in it",
    ["a fire bowl on legs", "several iron rods with handles sticking out of it"], ["a person"], rooms=[DUN], light="brazier", bench=["fire"])
add("cell-bench-plank", "cell-bench-plank", 2, "a prison cell's hanging plank bed",
    "A prisoner's plank bed that folds down from a wall: a thick slab of three planks about 6 ft long and 2 ft deep, held level by TWO very thick short chains running up from its front"
    " corners to two big iron wall rings on bolt plates, with two heavy strap hinges along its back edge; a thin straw mattress in rough sackcloth and a folded grey-brown blanket lie on it."
    " Flat-backed." + CHUNKY, "a plank bed hung level from two thick chains, with a thin mattress and a folded blanket", ["a flat plank shelf or bed", "two chains holding up its front"],
    ["legs under the bed", "a wall", "a person"], rooms=[DUN], hung=True, note="wall-hung at 18 in above the floor (mount:18); depth 24 in, needs adding to HUNG_IDS")
add("oubliette-hatch", "oubliette-hatch", 2, "an iron grate over a dungeon pit",
    "The mouth of an oubliette, seen from above at a steep angle: a square kerb of four big worn stone blocks about 4 ft across and 8 in high, framing a square pit that is pure dark shadow,"
    " closed by a heavy hinged GRATE of five thick flat iron bars crossed by two more, with a big ring handle and a padlocked hasp. Low and flat.",
    "a low square stone kerb with a heavy iron grate over a dark pit", ["low and wide", "a grid of iron bars over a dark opening"], ["a well with a wall waist high", "a bucket", "a person"],
    size=(48, 48, 8), rooms=[DUN, GATE], base=False)
add("block-headsman", "block-headsman", 2, "a headsman's block with an axe",
    "An executioner's block: a low, heavy oak block about 2 ft across with a scooped hollow for the neck in its top and a dark stained front, standing on a low square plank platform that"
    " is part of the piece, with a big, broad-bladed headsman's AXE sunk into the top of the block, its thick haft standing up at an angle, and a wicker basket standing on the platform"
    " in front, empty.", "a low wooden block with a big axe stuck in it and an empty basket beside it on a small plank platform", ["a low block", "a large axe"], ["a person, head or body", "blood"],
    rooms=[DUN, YARD], base=False)
add("table-experiment", "table-experiment", 2, "a torturer's slab table with straps",
    "A dungeon slab table, about 6.5 ft long: a thick stained oak top with a shallow gutter round the edge, on a heavy trestle base, with FOUR broad leather straps with big iron buckles"
    " lying across it (at the wrists and ankles) and an iron collar at the head end on a short thick chain; a wooden tray of chunky tools (pincers, a mallet, a saw) lies at the foot end. EMPTY.",
    "a long heavy wooden table with leather straps across it and a tray of tools at one end", ["a long table", "straps across the top"], ["a person or body", "blood"], rooms=[DUN])
add("cage-floor", "cage-floor", 2, "a standing prisoner cage",
    "A standing iron cage for a prisoner, about 4 ft square and 5.5 ft tall: a heavy flat-bar frame, a plank floor, a flat barred top with a big ring in the middle, and walls of thick"
    " vertical bars (six a side) with one horizontal band at mid height; one side is a barred door with two hinges and a padlock, CLOSED. EMPTY inside: you can see through it." + CHUNKY,
    "a square iron-barred cage as tall as a man, empty, with a closed barred door", ["a box-shaped cage of bars", "you can see through it and it is empty"], ["a person or animal inside", "a solid box"],
    size=(48, 48, 66), rooms=[DUN, YARD], route="hunyuan-mv",
    note="route hunyuan-mv: a hollow see-through box of bars on all four sides, which TRELLIS fills in or shreds from one view")
add("mil-pell", "mil-pell", 2, "a hacked wooden practice post",
    "A pell: one thick round oak post, 5.5 ft tall and 10 in thick, standing in a heavy square timber foot frame with four braces, its upper half deeply hacked and chewed by sword cuts,"
    " with pale splintered notches, and a band of thick rope wound round it at chest height.", "a single thick wooden post with sword cuts in it, on a braced timber foot",
    ["one thick upright post", "cut marks or notches on it"], ["a stuffed dummy with arms", "a person"], size=(30, 30, 66), rooms=[YARD])
add("mil-quintain", "mil-quintain", 2, "a jousting quintain",
    "A quintain: a thick post, 7 ft tall, on a heavy cross-shaped braced foot, with a thick horizontal beam pivoting on its top; one end of the beam carries a broad heater shield target"
    " painted in plain burgundy and cream halves, the other end a fat round sandbag hanging on a short, very thick rope.", "a post with a pivoting cross beam carrying a shield at one end and a hanging sandbag at the other",
    ["one post with a horizontal beam on top", "a shield at one end", "a hanging weight at the other"], ["a horse or rider", "emblems", "blue paint"], rooms=[YARD])
add("sentry-box", "sentry-box", 2, "a wooden sentry box",
    "A sentry box: a tall, narrow hut of thick vertical planks, about 3 ft square and 7.5 ft tall, open at the front with an arched head, with a steep pitched plank roof with a ball"
    " finial, a small diamond peep hole in each side and a plank floor; painted in broad diagonal stripes of burgundy and cream, worn. EMPTY and dark inside.",
    "a tall narrow wooden sentry hut with an open front and a pitched roof", ["taller than wide", "an open front", "a small roof"], ["a guard or person", "blue paint"], rooms=[GATE, YARD])
add("tourney-lists-rail", "tourney-lists-rail", 2, "a section of training-yard rail",
    "ONE straight 10-ft section of the rail round a training ground: THREE stout square posts with pyramid caps, joined by a thick top rail and a broad plank below it, the plank painted"
    " in alternating burgundy and cream blocks, worn. Both ends are flat cuts just past the end posts so that sections butt together.",
    "a straight section of wooden rail fence with three posts, a top rail and a painted plank", ["posts with a horizontal rail", "longer than tall"], ["a gate", "horses or people", "blue paint"],
    size=(120, 6, 44), rooms=[YARD])
add("gate-double-timber", "gate-double-timber", 2, "a pair of great timber gate leaves",
    "ONLY the two leaves of a castle's outer gate, closed, with NO wall or arch round them: together about 9 ft wide and 10 ft tall with a flat top, each leaf of massive vertical oak planks"
    " faced with a grid of broad iron straps and rows of big pyramid-headed studs, three huge strap hinges on each outer edge, a heavy wooden draw bar lying across both leaves in big iron"
    " brackets, and a small wicket door outlined in the right-hand leaf.", "a pair of tall, heavy, iron-studded wooden gate leaves, closed, with a bar across them",
    ["two leaves meeting in the middle", "iron studs or straps"], ["a stone arch, wall or towers round the gate", "a portcullis grille"], rooms=[YARD],
    note="leaf-only (rotates to open): the courtyard's alternative gate where the edge roll is not the portcullis panel")
add("mil-signal-beacon", "mil-signal-beacon", 2, "an iron fire-basket beacon on a pole",
    "A signal beacon, 10 ft tall: a thick timber pole with climbing pegs, stepped in a heavy cross-shaped braced foot, carrying at the top a big iron cresset basket of thick bars filled"
    " with cold split logs and pitch-black tow.", "a tall pole on a braced foot with an iron fire basket full of unlit logs at the top", ["a tall pole", "a basket of bars at the top"],
    ["a lantern with glass", "a person"], rooms=[YARD, GATE], light="brazier", bench=["fire"])
add("watch-lantern-bell", "watch-lantern-bell", 2, "a watchman's alarm bell on a post",
    "An alarm bell, 7 ft tall: a stout square post on a cross-shaped foot with a curved iron bracket arm at the top, from which a big bronze bell hangs, with a thick knotted rope from"
    " its clapper down to hand height, and below the bracket an iron lantern hooked to the post, unlit.", "a post with a bracket carrying a hanging bell with a rope, and a lantern on the post",
    ["one post", "a bell hanging from an arm"], ["a bell tower", "a person"], size=(24, 14, 84), rooms=[GATE, YARD], light="lantern", bench=["fire"])
add("mil-boiling-oil-pot", "mil-boiling-oil-pot", 2, "a tipping cauldron on a gantry",
    "The gatehouse's defence cauldron: a big black iron pot about 3 ft across, hung by two trunnion pins between the two stout A-frames of a timber gantry so that it can be TIPPED, with a"
    " long iron tipping lever fixed to one side, standing over a square iron fire tray of cold coals that is part of the piece. The pot is filled to near the brim with dark, dull, thick oil.",
    "a big black pot hung on pivots in a timber frame with a tipping lever, over a tray of cold coals", ["a pot held between two frames", "a lever or handle to tip it"],
    ["flames or steam", "a person"], rooms=[GATE], light="brazier", bench=["fire"], base=False)

# ---------------------------------------------------------------- prio 3: smalls and variants
add("training-dummy--s2", "training-dummy", 3, "a man-shaped straw training dummy",
    "A second practice dummy: a post on a cross-shaped foot with a stuffed sackcloth torso and two short stuffed arms held out sideways, a sack head with NO face under an old open helmet,"
    " and an old quilted gambeson, moss green and badly slashed, laced over the body; a wooden practice sword is tied upright to one arm.",
    "a stuffed practice dummy with two short arms, an old helmet and a slashed padded jacket, on a post", ["a stuffed body on a post", "a foot or post reaching the ground"], ["a painted face", "a real person"],
    rooms=[YARD, BAR])
add("archery-target--s2", "archery-target", 3, "a square straw-bale archery butt",
    "A rougher archery butt: TWO big straw bales stacked one on the other, bound with thick cord, with a round painted cloth target face (cream, burgundy, ochre-gold centre) pinned to the"
    " front, and five fat arrows stuck in it, two of them wide of the rings in the straw.", "two stacked straw bales with a round ringed target on the front and arrows stuck in it",
    ["straw bales", "a round target face with rings"], ["blue rings", "a person"], size=(42, 24, 48), rooms=[YARD])
add("goblet", "goblet", 3, "a pewter goblet", "A stout pewter goblet: a round bowl, a short thick stem with one fat knop, and a wide foot. Dull grey with a soft sheen. Empty.",
    "a plain grey metal goblet", ["one cup on a stem with a foot"], ["liquid", "gems"], rooms=[HALL])
add("goblet-silver", "goblet-silver", 3, "a silver goblet", "A fine silver goblet: a tall tulip bowl with a band of chunky engraved leaves under the rim, a thick stem with a fluted knop, and a"
    " wide domed foot. Bright pale silver with warm reflections painted on. Empty.", "a pale silver goblet with a decorated band", ["one cup on a stem with a foot"], ["liquid", "blue gems"], rooms=[HALL, THR])
add("platter-silver", "platter-silver", 3, "a silver serving platter", "A big oval silver serving platter with a broad raised rim of chunky gadroon beading and two small scroll handles at"
    " the ends. Empty. Low and flat, seen from above at a steep angle.", "a large oval silver platter, empty", ["an oval dish, low and flat", "empty"], ["food"], rooms=[HALL])
add("salt-cellar-ship", "salt-cellar-ship", 3, "a ship-shaped salt cellar", "A nef: a table centrepiece salt in the shape of a small, fat, single-masted ship in gilt silver, with a round hull"
    " on an oval stemmed foot, a castle at bow and stern, ONE thick mast with a furled sail as a solid bundle and NO rigging lines, the open hull heaped with white salt.",
    "a small gilt ship-shaped table ornament on a foot, its hull filled with white salt", ["a ship shape on a stemmed foot"], ["thin rigging lines", "blue enamel or water"], rooms=[HALL])
add("boar-head-platter", "boar-head-platter", 3, "a roast boar's head on a platter", "A feast centrepiece: a roasted boar's head, glazed dark golden-brown, with short tusks, an apple in"
    " its mouth and a wreath of bay leaves and red berries round its neck, on an oval pewter platter. Cooked FOOD, not a live animal.", "a roasted boar's head with an apple in its mouth on a platter",
    ["a cooked boar's head", "a platter under it"], ["a whole live animal", "blue berries"], rooms=[HALL], base=False)
add("crown", "crown", 3, "a royal crown", "A king's crown: a thick gold circlet with a rolled rim top and bottom, set with big oval red and green stones, carrying eight chunky fleur-de-lis"
    " points round the top, with a burgundy velvet cap inside. No arches, no cross.", "a gold crown with points and red and green gems", ["a ring-shaped crown with raised points"], ["blue gems", "a head or cushion"],
    rooms=[THR], note="shared id with the crypt (set tag CRY)")
add("scepter", "scepter", 3, "a royal scepter", "A royal scepter lying flat: a thick gold rod about 2 ft long with three fat ring mouldings, a round grip end, and a head shaped as a chunky"
    " gold fleur-de-lis above a big round red stone. Deliberately thick and toy-like so it reconstructs in 3D.", "a short thick gold rod with an ornamental head and a red gem", ["one rod with an ornate head"],
    ["a sword", "blue gems"], rooms=[THR])
add("regalia-cushion", "regalia-cushion", 3, "a crown on a velvet cushion", "A square, plump burgundy velvet cushion with a thick gold cord edge and a fat gold tassel at each corner,"
    " with a gold crown (a circlet with eight chunky points and red and green stones) resting in the middle of it, sunk a little into the velvet.", "a gold crown resting on a square red cushion with tassels",
    ["a square cushion", "a crown on it"], ["blue velvet or gems", "a table"], rooms=[THR], base=False)
add("shield-heater", "shield-heater", 3, "a heater shield", "A knight's heater shield lying face up, slightly curved: a flat-topped shield with a pointed bottom, painted in two plain"
    " halves, burgundy and cream, with a thick iron rim and three big rivets. NO emblem.", "a single flat-topped pointed shield in two plain colours", ["one shield, pointed at the bottom"],
    ["emblems, animals or text", "blue paint"], rooms=[ARM, HALL])
add("shield-round", "shield-round", 3, "a round wooden shield", "A round wooden shield lying face up: thick planks showing as broad wedge-shaped painted sections in alternating moss green"
    " and cream, a big domed iron boss in the middle, an iron rim with rivets.", "a single round shield with a metal boss in the middle", ["one round shield", "a central boss"], ["emblems", "blue paint"],
    rooms=[ARM, BAR])
add("shield-kite", "shield-kite", 3, "a kite shield", "A tall kite shield lying face up: rounded at the top and tapering to a long point, gently curved, ochre yellow with a broad burgundy"
    " border, a small iron boss and four rivets.", "a single long kite-shaped shield, round at the top and pointed at the bottom", ["one long tapering shield"], ["emblems", "blue paint"], rooms=[ARM])
add("helm-great", "helm-great", 3, "a great helm", "A knight's great helm standing on its rim: a flat-topped steel barrel helmet with a raised brass cross-shaped reinforcing bar over the"
    " face, a narrow eye slit and a pattern of breathing holes on one cheek. EMPTY.", "a flat-topped enclosed steel helmet with an eye slit", ["one enclosed helmet"], ["a face or eyes", "plumes"], rooms=[ARM])
add("helm-open", "helm-open", 3, "an open-faced helmet", "A soldier's open-faced helmet standing on its rim: a rounded steel skull with a central ridge, a thick nose bar and a riveted brow"
    " band, with a short mail curtain (solid, with a ring pattern) at the back. EMPTY.", "a rounded steel helmet with a nose bar, empty", ["one open-faced helmet"], ["a face or head"], rooms=[ARM, BAR, GATE])
add("armor-chainmail-heap", "armor-chainmail-heap", 3, "a mail shirt in a heap", "A mail hauberk dropped in a heavy, slumped heap on the floor, one sleeve and the hem trailing out, painted"
    " as ONE solid lump of dull steel with a broad ring pattern on its surface (no separate rings), a leather belt lying across it.", "a slumped heap of chainmail with a belt on it",
    ["a low rounded heap", "a ring or mesh pattern on the surface"], ["a person or stand"], rooms=[ARM, BAR])
add("armor-breastplate", "armor-breastplate", 3, "a breastplate", "A steel breastplate standing upright on its lower edge: a rounded, ridged chest plate with a rolled neck and arm openings,"
    " a short skirt of two lames riveted below, and thick leather straps with buckles at the shoulders. EMPTY.", "a single steel chest plate standing by itself", ["one breastplate"], ["a helmet", "a body or stand"],
    rooms=[ARM])
add("crossbow", "crossbow", 3, "a crossbow", "A crossbow lying flat: a thick honey-wood tiller with a long trigger bar, a short, very thick steel bow lashed on with cord, a thick string, and"
    " an iron stirrup at the front. Deliberately thick and toy-like so it reconstructs in 3D.", "a single crossbow lying flat", ["a bow fixed crosswise on a stock"], ["a person", "a longbow"],
    rooms=[ARM, GATE])
add("sword-short", "sword-short", 3, "an arming sword", "An arming sword lying flat: a broad, thick, short steel blade with a central fuller, a straight chunky cross guard, a burgundy"
    " leather grip and a fat wheel pommel. Deliberately thick and toy-like so it reconstructs in 3D.", "a single short sword with a cross guard", ["one sword"], ["a scabbard", "two swords"], rooms=[ARM, BAR])
add("axe-hand", "axe-hand", 3, "a one-handed battle axe", "A battle axe lying flat: a thick honey-wood haft about 2.3 ft long with a leather-wrapped grip, and a chunky bearded steel head"
    " with a bright bevelled edge and a short back spike. Deliberately thick and toy-like.", "a single one-handed axe with a bearded blade", ["one axe"], ["a log or stump", "two axes"], rooms=[ARM])
add("mace-flanged", "mace-flanged", 3, "a flanged mace", "A flanged mace lying flat: a thick steel haft with a ringed grip and a wrist loop of thick leather, and a heavy head of SIX broad"
    " triangular flanges round a core, with a small top spike. Deliberately thick and toy-like.", "a single mace with a flanged metal head", ["one mace"], ["a spiked ball on a chain"], rooms=[ARM])
add("warhammer", "warhammer", 3, "a warhammer", "A war hammer lying flat: a thick wooden haft with two iron langets, and a compact steel head with a square four-pointed hammer face on"
    " one side and a thick curved beak on the other. Deliberately thick and toy-like.", "a single war hammer with a hammer face and a beak", ["one hammer-headed weapon"], ["a smith's sledge", "an anvil"],
    rooms=[ARM])
add("quiver-arrows", "quiver-arrows", 3, "a quiver full of arrows", "A leather quiver lying on its side: a thick tapered tube of burgundy-brown leather with a stitched seam, two broad straps"
    " and a rolled rim, packed with arrows whose cream and ochre fletchings form one solid bunch at the mouth.", "a leather quiver with a bunch of arrow feathers at its mouth", ["a tube-shaped quiver", "arrow fletchings"],
    ["a bow", "blue feathers"], rooms=[ARM, GATE, YARD])
add("mil-guard-lantern", "mil-guard-lantern", 3, "a shuttered guard's lantern", "A watchman's lantern, hand-sized: a stout cylindrical iron body with a conical vented top and a big ring"
    " handle, a hinged shutter door standing half open on one side showing a fat cream candle with a dark wick inside, and horn panes painted warm amber.", "a small iron lantern with a ring handle and a candle inside",
    ["one lantern with a handle"], ["blue glass"], rooms=[BAR, GATE, DUN], light="lantern", bench=["fire"])
add("mortar-large-stone", "mortar-large-stone", 3, "a big stone mortar with a wooden pestle", "A kitchen floor mortar: a heavy, knee-high stone bowl with thick walls and four lug"
    " handles carved on the outside, standing on its own flat bottom, with a long, thick wooden pestle standing in it and leaning on the rim." + STONE, "a heavy knee-high stone bowl with a long wooden pestle in it",
    ["a thick stone bowl", "a pestle"], ["a small table mortar"], rooms=[KIT])
add("saucepan-copper", "saucepan-copper", 3, "a copper saucepan", "A copper saucepan: a straight-sided round pan of bright warm copper with a tinned pale inside, a rolled rim and one long,"
    " thick, flat iron handle riveted on with three big rivets. Empty.", "a round copper pan with one long handle", ["one pan with one long handle"], ["food", "a lid"], rooms=[KIT])
add("fish-kettle", "fish-kettle", 3, "a long copper fish kettle", "A fish kettle: a long, narrow, round-ended copper pan about 20 in long with a loop handle at each end and a fitted flat"
    " lid with a third loop handle in the middle. Bright warm copper.", "a long narrow lidded copper pan with a handle at each end", ["a long oval lidded pan"], ["a fish", "a round pot"], rooms=[KIT])
add("chalice-altar", "chalice-altar", 3, "a gilt altar chalice", "An altar chalice: a wide, shallow gilt bowl on a thick stem with one big fluted knop set with four small red stones, on a"
    " broad six-lobed foot. Empty.", "a golden cup with a wide bowl, a knobbed stem and a lobed foot", ["one cup on a stem"], ["liquid", "blue gems", "a cross"], rooms=[CHA], note="GENERIC religious id")
add("tome-holy", "tome-holy", 3, "an illuminated holy book", "A big closed holy book lying flat: thick boards covered in burgundy leather with five big brass bosses and brass corner pieces,"
    " two heavy clasps, the page edges gilt, and a sun disc with short rays tooled in gold on the cover. NO text.", "a large closed book with a red leather cover, brass fittings and a sun sign",
    ["one closed book"], ["text or letters", "a cross"], rooms=[CHA], note="GENERIC religious id (shared with the crypt)")
add("shackles-leg", "shackles-leg", 3, "leg shackles with a ball", "A ball and chain lying on the floor: one big, pitted iron ball about 8 in across with a thick staple, FIVE very fat chain"
    " links, and a hinged iron ankle cuff lying open at the end, all touching in one short curve." + CHUNKY, "an iron ball joined by a short thick chain to an ankle cuff", ["one iron ball", "a chain", "a cuff"],
    ["a leg or person"], rooms=[DUN])
add("lever-wall", "lever-wall", 3, "a wall lever", "A wall-mounted lever: a thick rectangular iron plate with four big bolts and a slotted quadrant, and ONE stout iron lever with a round"
    " wooden grip, pulled UP, about 18 in long. Flat-backed.", "an iron wall plate with one thick lever with a round handle", ["one lever on a plate"], ["a wall", "a hand"], rooms=[GATE, DUN], hung=True)
add("stone-blocks-stack", "stone-blocks-stack", 3, "a stack of dressed stone blocks", "A mason's stack: about NINE big squared building stones stacked in three uneven courses on two thick"
    " timber bearers, one block lying askew on top with a wooden mallet and a chisel on it. Blocks in blue-grey, warm grey and ochre, tool marks as broad strokes.",
    "a stack of big squared stone blocks on timber bearers", ["several squared blocks stacked"], ["a wall with mortar", "a person"], rooms=[YARD], base=False)
add("mil-catapult-stones", "mil-catapult-stones", 3, "a pile of catapult stones", "A pyramid of about FOURTEEN roughly round stone balls, each a foot across, stacked in three layers inside a"
    " low square frame of four thick timbers that keeps them from rolling. Grey and ochre stone.", "a pyramid of round stone balls in a low timber frame", ["a heap of round stones"], ["iron cannonballs with a cannon", "a catapult"],
    rooms=[YARD, GATE], base=False)
add("mil-cheval-de-frise", "mil-cheval-de-frise", 3, "a spiked log barricade", "A cheval de frise: one thick log about 8 ft long lying horizontally at waist height, pierced through by SIX"
    " pairs of thick sharpened stakes that cross it at right angles to one another, so that it stands on the stake points like a row of X shapes. Pale sharpened points, dark weathered"
    " wood, iron bands at the log ends." + CHUNKY, "a long log bristling with crossed sharpened stakes that it stands on", ["one long horizontal log", "sharpened stakes through it in X shapes"],
    ["a fence with rails", "a person"], size=(100, 44, 42), rooms=[GATE, YARD])
add("horn-hunting", "horn-hunting", 3, "a signal horn on a wall hook", "A watchman's signal horn hanging on a wall hook: a big curved ox horn, cream darkening to brown at the tip, with a broad"
    " brass band at the mouth and another at the mouthpiece, hung by a thick burgundy cord from a chunky iron hook on a small oak back plate. Flat-backed.", "a curved horn with brass bands hanging by a cord from a hook",
    ["one curved horn", "a cord or strap"], ["a wall", "blue cord"], rooms=[GATE, BAR], hung=True)

add("table-feast--s2", "table-feast", 1, "a shorter feast table with a cloth",
    "A SHORTER table of the same make, about 10 ft long, on TWO of the same carved trestle supports, laid with a cream linen cloth that covers the top and hangs a hand's width down"
    " each long side, with a burgundy runner down the middle; the oak ends and trestles show. Nothing else on it.",
    "a long heavy wooden trestle table covered with a cream cloth and a red runner, nothing else on it", ["much longer than it is deep", "a cloth on the top"],
    ["chairs or benches", "food, cups or candles on it", "blue cloth"], size=(120, 36, 30), parent="table-feast", what="a long oak feast table on carved trestle supports", rooms=[HALL])
add("ballista", "ballista", 2, "a mounted ballista",
    "A wall-defence ballista: a giant crossbow on a heavy timber stand. A thick wooden stock about 6 ft long with a slider groove, a short, massive two-armed bow frame across its front"
    " (each arm a thick wooden limb in a rope-wound spring box), a very thick bowstring, a winch with two spoked handles at the back, and ONE big iron-headed bolt lying in the groove,"
    " all carried on a braced three-legged timber stand with a pivot." + CHUNKY,
    "a giant crossbow on a heavy wooden stand, with a big bolt in it and a winch at the back", ["a crossbow-like bow across the front of a long stock", "a heavy stand under it"],
    ["a catapult with a throwing arm", "wheels", "a person"], rooms=[YARD, GATE], note="RISK: catalog gen is `thin` (bow arms, string); asked for very thick")
add("table-kitchen-prep--great", "table-kitchen-prep", 2, "a long castle kitchen work table",
    "A castle kitchen's main work table, about 10 ft long and 3 ft deep: a very thick scrubbed pale top of two planks, scarred with knife cuts, on SIX stout square legs joined by a low"
    " slatted pot shelf, with two wide drawers with turned knobs in the frieze. Nothing on it.", "a long heavy kitchen work table with a thick top and a low shelf, nothing on it",
    ["a long table with a thick top", "a lower shelf or stretchers"], ["food, pots or tools on it", "chairs"], size=(120, 36, 34), rooms=[KIT],
    note="a long variant sku of the existing role (the kitchen's work rows use it end to end)")
add("mil-duty-roster", "mil-duty-roster", 3, "a duty roster board", "A guard room's duty board, flat-backed to hang on a wall: a framed oak board about 18 in wide and 2 ft tall with a small"
    " pitched top, its face a grid of FIVE rows of square holes holding fat coloured wooden pegs (burgundy, cream, moss green), with a row of four plain blank wooden tally tags on hooks"
    " along the bottom. NO text, NO numbers.", "a small framed wooden wall board with rows of coloured pegs and a few blank tags", ["a framed board", "rows of pegs or tags"],
    ["text, letters or numbers", "a wall", "blue pegs"], rooms=[BAR, GATE], hung=True)
add("rite-kneeler-cushion", "rite-kneeler-cushion", 3, "a kneeling cushion", "A chapel kneeler: a low, fat, rectangular cushion of burgundy cloth with a thick ochre cord edge and a plain"
    " woven diamond pattern on top, a little flattened in the middle.", "a low rectangular red cushion with a cord edge", ["one low cushion"], ["blue cloth", "tassels on a stand", "a cross"],
    rooms=[CHA], base=False, note="GENERIC religious id")

# ---------------------------------------------------------------- checks + write
ids = [a["id"] for a in assets]
assert len(ids) == len(set(ids)), [i for i, n in Counter(ids).items() if n > 1]
byid = {a["id"]: a for a in assets}
for a in assets:
    assert a["object"] in roles and roles[a["object"]]["size"], a["object"]
    if a["group"].startswith("sib"):
        par = Path(a["refs"][0]).stem
        assert par in byid and byid[par]["group"] == f"p{a['prio']}", (a["id"], par)
    if a.get("twin_of"):
        assert a["twin_of"] in byid and roles[a["object"]]["open_of"] == byid[a["twin_of"]]["object"], a["id"]
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets: (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(assets), "assets", dict(sorted(Counter(a["group"] for a in assets).items())), "prio", dict(sorted(Counter(a["prio"] for a in assets).items())))
print("bench", dict(Counter(b for a in assets for b in a["bench"])), "hung", sum(1 for a in assets if a.get("hung")), "lights", dict(Counter(a["light"] for a in assets if a.get("light"))))
