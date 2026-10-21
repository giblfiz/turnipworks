#!/usr/bin/env python3
"""Farmstead type (HUT), batch hut-01 (2026-10-12): the signature pieces its rooms lacked, and the wattle-and-daub wall kit.
In the dungeon batch's format (experiments/2026-10-11-types/dun/build_spec.py, whose prompt scaffolding is copied below).
Writes assets.json for tools/gen.py and prompts/<id>.spec.md. Groups: p1 = independent pieces; sib1 = the wall pieces painted
FROM the accepted plain wall plate. Provenance: text prompts and our own style reference only.
Every sku was checked against tools/spawn-tuner/data/library.json on main and the in-flight batches' assets.json (2026-10-12):
spinning-wheel and cradle are in another batch and are NOT made here.     python3 build_spec.py
"""
import json, sys
from collections import Counter
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
MAIN = Path("<repo>")
sys.path.insert(0, str(ROOT / "src"))
import catalog_tool as ct
STYLE = (ROOT / "style/heroic-handpainted.object.md").read_text()
STYLE_REF = str(MAIN / "style-references/heroic-handpainted-tavern-v1.png")
roles = {}
for p in sorted((ROOT / "catalog").glob("*.catalog.md")):
    roles.update(ct.parse_catalog(p)[0])
LIB_ROLES = set(json.loads((MAIN / "tools/spawn-tuner/data/library.json").read_text())["objects"])

HEAD = "Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset:"
NOBASE = (" It stands on nothing: NO ground disc, NO floor patch, NO rubble, NO base slab or platform under it that the real object would not have."
          " The background is flat chroma blue, so the object itself has NO blue anywhere (no blue cloth, paint, gems or glass).")
NOBLUE = " The background is flat chroma blue, so the object itself has NO blue anywhere (no blue cloth, paint, gems or glass)."
UNLIT = (" It is UNLIT and cold: NO flame, NO glow, NO embers, NO smoke, NO baked light; wicks are dark, torch heads charred, logs cold with grey ash."
         " The game adds the fire.")
STONE = (" The stone must not be one flat grey mass: give it carved mouldings and relief, visible separate blocks with recessed joints,"
         " and colour variation from block to block (blue-grey, warm grey, a little ochre, a touch of moss), so that every face is fully painted.")
ROCKY = (" The stone must not be one flat grey mass: broad chiselled planes, deep readable carving and colour variation (slate grey, warm grey-brown,"
         " a little ochre, a touch of moss green), so that every face is fully painted.")
CHUNKY = " Every bar, shaft, chain link and strap is deliberately THICK and toy-like (as thick as a wrist), with nothing thin or wiry, so that it reconstructs in 3D."
MOOD = " Farm mood: warm, worn, home-made; matte surfaces with a strong, simple silhouette that reads from far above."
WALLTAIL = (" Nothing else: NO floor, NO ground, NO base slab or platform under it, NO roof, NO corner return, NO torch, banner, furniture or decoration attached."
            " Both side edges are clean flat vertical cuts so that copies butt together into a longer wall. Seen from its broad side, three-quarter view from slightly above."
            " Keep the WHOLE object well inside the frame with a generous margin." + NOBLUE)
PANEL = "an upright kit panel about 5 ft wide x 9 ft tall x 1 ft thick, almost twice as tall as wide"
TALL = (" It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end)."
        " It must NOT be square and must NOT be wider than it is tall.")
CUTROCK = ("LIVING ROCK, hewn by hand: ONE continuous dark grey-brown rock face with NO blocks, NO courses and NO mortar joints anywhere, covered in"
           " diagonal chisel and pick marks in broad overlapping strokes, with a few natural fissures and small ledges, lighter worked planes that catch the"
           " light, and damp green-black staining over the lowest foot")
MATCH_WALL = ("The supplied image is the existing plain wall section of this same dungeon: {what}. The new piece must look cut from the same wall:"
              " the SAME rock, chisel marks, colours, overall size and proportions (" + PANEL + "), painting style and camera angle."
              " Change ONLY what is described below.\n\n")
MATCH_SET = ("The supplied image is an accepted piece of the same set: {what}. The new piece must look made by the same hands:"
             " the SAME materials, colours, thicknesses, level of wear, painting style and camera angle. Change ONLY what is described below.\n\n")
EDIT = ("Edit task. The supplied image shows {what} in the Turnip Works hand-painted house style. Show the SAME object: identical materials, colours,"
        " fittings, proportions and painting style, from the same three-quarter camera. Do not redesign it. Change ONLY its state:\n\n")

assets = []
def add(sku, obj, prio, subject, design, desc, must=(), must_not=(), *, size=None, parent=None, what="", mode="set", rooms=(),
        bench=(), hung=False, light=None, twin_of=None, route="trellis", base=True, ref=None, note=None, wall=False, kit=None, opening=None):
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
    a = {"id": sku, "object": obj, "group": (f"sib{prio}" if parent or ref else f"p{prio}"), "source": "generate", "lane": "3d", "subject": subject,
         "size": [w, d, h], "prompt": prompt, "refs": refs, "gate_refs": gate_refs, "gate": {"desc": desc, "must": must, "must_not": must_not},
         "prio": prio, "rooms": list(rooms), "bench": list(bench), "route": route}
    if obj in LIB_ROLES and not wall: a["tier"] = "hut"   # a sku under a role the library already has: exclusive to the farm rooms (none in this batch)
    if wall: a["generation"], a["family"], a["kit"] = "kit", "wattle-daub", "wall"
    if kit: a["kit"] = kit
    if opening: a["opening"] = opening
    if hung: a["hung"] = True
    if light: a["light"] = light
    if twin_of: a["twin_of"] = twin_of
    if note: a["note"] = note
    assets.append(a)


SOLID = " Paint the straw / hay / thatch as ONE smooth, flat, solid surface with a few broad painted strands and soft clumps: NO loose stalks, NO fuzz, NO wisps sticking out, NO fine fibres."
STOUT = " Every pole, rail, leg and handle is deliberately THICK and toy-like (as thick as a wrist), with nothing thin or wiry, so that it reconstructs in 3D."
COT, KIT, LOFT, CEL, BYRE, COOP, STY, BARN, GRAN, DAIRY, GARD, FIELD, ORCH, YARD = ("hut-cottage", "hut-kitchen", "hut-loft", "hut-cellar", "hut-byre", "hut-coop", "hut-pigsty", "hut-barn",
    "hut-granary", "hut-dairy", "hut-garden", "hut-field", "hut-orchard", "hut-farmyard")

# ================================================================ wall kit: family wattle-daub (the humble house wall)
W0 = "wall-straight--wattle-daub"
WD = ("WATTLE AND DAUB: a thick coat of lumpy hand-smoothed daub, lime-washed a warm CREAM-OCHRE, cracked in a loose net of fine dark cracks and stained damp grey-brown over the lowest foot;"
      " in TWO places (one fist-sized high on the left, one the size of a dinner plate low on the right) the daub has fallen away and shows the WATTLE behind it: a basket-weave of thick"
      " brown hazel rods woven over upright stakes. A rough, slightly crooked dark-brown TIMBER SILL BEAM about 8 in tall runs along the very bottom and a matching WALL PLATE beam along the very top."
      " NO other timbers: NO posts, NO studs, NO diagonal braces (it is NOT a half-timbered wall)")
RW = "a wall of cracked cream-ochre lime-washed daub between a dark timber sill beam at the bottom and a wall-plate beam at the top, with two small patches where the woven wattle shows"
WM = ["one single upright wall section, clearly taller than it is wide", "pale cracked plaster or daub as the main surface", "a dark timber beam along the bottom and along the top"]
WN = ["a floor, base slab, roof, thatch or corner return", "a torch, shelf, tool or any fitting attached to the wall", "diagonal braces or a grid of exposed timber framing", "stone blocks or bricks"]
add(W0, "wall-straight", 1, "a straight wattle-and-daub wall section of a peasant cottage",
    f"ONE plain straight wall section, {PANEL}, of {WD}. The top edge is one level line and the bottom edge sits flat; the two side edges are clean vertical cuts through the daub." + TALL,
    "a plain upright wall section of cracked pale daub with a timber beam at the bottom and at the top", WM, WN + ["a window or door"], wall=True, opening="solid", rooms=[COT, KIT])
add(W0 + "--s2", "wall-straight", 1, "a second wattle-and-daub wall section",
    "The same plain wall with a DIFFERENT pattern, so that two sections side by side do not read as copies: ONE larger patch of exposed woven wattle (about 1.5 ft across) at mid height on the LEFT,"
    " a long crack running from the top beam down to the middle, and a broad paler patch of newer daub on the right where it was mended. Same height, thickness, beams, level top, flat bottom and"
    " clean vertical side cuts." + TALL,
    "a plain upright wall section of cracked pale daub with one patch of exposed woven wattle, a timber beam at the bottom and at the top", WM, WN + ["a window or door"],
    wall=True, opening="solid", parent=W0, what=RW, mode="wall", rooms=[COT, KIT])
add("wall-window-small--wattle-daub", "wall-window-small", 1, "a wattle-and-daub wall section with a small shuttered window opening",
    "The same wall with ONE small window at head height, centred (its sill about 4 ft above the bottom): a plain rectangular opening about 2 ft wide and 2 ft tall, framed by four rough"
    " dark-brown timbers, with THREE stout upright wooden bars in it and NO glass; a plank SHUTTER hangs open flat against the wall on its left side. You can see through the opening between"
    " the bars to the blue background. Same height, thickness, beams, level top, flat bottom and clean vertical side cuts." + TALL,
    "an upright wall section of cracked pale daub with one small square window opening with wooden bars and an open plank shutter",
    WM + ["one small window opening at head height that you can see through"], WN + ["glass panes", "a door"], wall=True, opening="window", parent=W0, what=RW, mode="wall", rooms=[COT, KIT])
add("wall-doorway--wattle-daub", "wall-doorway", 1, "a wattle-and-daub wall section with an empty door opening",
    "The same wall with an EMPTY door-sized opening through it, starting at the very bottom: about 3.5 ft wide and 6.5 ft tall, centred, framed by two rough dark-brown timber door posts and a"
    " timber lintel (the sill beam is cut away across the opening). NO door leaf, NO hinges, NO step. About 9 in of daub wall remains on each side and a band of daub and the wall-plate beam,"
    " 2 ft tall in all, run unbroken above the opening. It is still ONE slab of the same wall with a hole through it, and its outer outline is the same plain rectangle as the plain wall."
    " You can see straight through the opening to the blue background." + TALL,
    "a wall section of cracked pale daub with one empty timber-framed door opening through it (no door leaf)",
    ["one upright rectangular slab of wall, clearly taller than it is wide, pierced by a door opening (narrow strips of wall beside the opening and a band above it are expected)",
     "pale daub with timber beams", "one door-sized opening that reaches the bottom of the wall, with NO door in it (you can see through)", "wall continues above the opening"],
    WN + ["a door leaf filling the opening", "a window"], wall=True, opening="door", parent=W0, what=RW, mode="wall", rooms=[COT, KIT])

# ================================================================ dairy
add("butter-churn", "butter-churn", 1, "an upright wooden butter churn with its plunger",
    "A tall, slightly tapering churn of pale scrubbed wooden staves bound by THREE broad dark iron hoops, wider at the bottom than the top, with a round wooden lid and a THICK plunger pole standing"
    " up through the middle of the lid, ending in a plain round knob. A smear of pale cream at the lid." + STOUT + MOOD,
    "an upright stave-built wooden butter churn with a plunger pole standing out of its lid", ["a tall narrow wooden stave vessel with hoops", "one thick pole standing out of the top"],
    ["a barrel lying on its side", "a crank handle or wheel"], size=(16, 16, 42), rooms=[DAIRY, KIT, COT])
add("rural-milk-churn-tall", "rural-milk-churn-tall", 1, "a pair of tall wooden milk pails with lids",
    "TWO tall coopered milk pails standing side by side and touching: each of pale scrubbed staves with two broad hoops, narrowing a little to the top, with a thick rope-grip handle"
    " stave rising each side; one has its round wooden lid on, the other is OPEN and FULL to the brim with WHITE milk." + MOOD,
    "two tall wooden stave pails side by side, one open and full of white milk", ["two tall narrow wooden vessels standing together", "white milk visible in the open one"],
    ["metal milk cans", "a spilled puddle"], size=(26, 15, 26), rooms=[DAIRY, BYRE, KIT])
add("cheese-press", "cheese-press", 1, "a wooden screw cheese press with a cheese under it",
    "A heavy farmhouse cheese press: a low thick table-like base on four stout legs, two thick upright posts carrying a heavy cross-beam, and ONE fat wooden screw through the middle of the beam"
    " pressing a round wooden follower down on a pale YELLOW drum of cheese wrapped in white cloth, which sits in a shallow wooden tray with a whey spout. A second round yellow cheese sits on the"
    " base beside it." + STOUT + MOOD,
    "a wooden press with two posts, a cross-beam and one big screw pressing down on a round yellow cheese", ["two upright posts and a cross-beam with a central screw", "a round pale-yellow cheese under the press"],
    ["grapes or apples (it is not a wine press)", "a barrel body", "a metal wheel"], size=(34, 22, 46), rooms=[DAIRY])
# ================================================================ coop
add("nest-box-row", "nest-box-row", 1, "a row of three hens' nest boxes with eggs",
    "A hen-house nest box unit: ONE long plain plank box on four short stout legs, divided into THREE open-topped, open-fronted compartments side by side by plank partitions, with a low"
    " front lip. Each compartment is lined with a round NEST of golden straw, and in each nest lie THREE large pale cream-white EGGS, clearly visible FROM ABOVE. A sloping plank at the back." + SOLID + MOOD,
    "a wooden unit of three nest compartments in a row, each with a straw nest and pale eggs", ["three compartments side by side", "straw nests", "pale eggs clearly visible in the nests"],
    ["a hen or any bird", "a closed lid hiding the nests", "a cupboard with doors"], size=(54, 20, 30), rooms=[COOP])
add("chicken-perch-ladder", "chicken-perch-ladder", 1, "a hen-house roost: a sloping frame of thick perches",
    "A hen roost: a SLOPING ladder-like frame leaning back, made of two thick side rails standing on stout feet with a prop behind, and FIVE thick round PERCH poles running across it like"
    " widely spaced rungs, each as thick as a wrist, worn pale, with white droppings streaked on the lower rails and a board under it speckled white. A few white and brown FEATHERS lie on the perches."
    + STOUT + MOOD,
    "a sloping wooden frame with several thick horizontal perch poles, like a wide leaning ladder", ["two side rails with several thick round crossbars", "it leans / slopes and stands on its own"],
    ["a hen or any bird", "a thin ladder with thin rungs", "a staircase with flat treads"], size=(50, 34, 44), rooms=[COOP])
add("egg-basket", "egg-basket", 1, "a shallow basket full of eggs",
    "A wide, shallow, round wicker basket with a thick plaited rim and one stout hoop handle, lined with golden straw and heaped with about TWELVE large pale cream-white and light brown eggs."
    + SOLID + MOOD,
    "a round shallow wicker basket full of pale eggs", ["a wicker basket", "many pale eggs heaped in it"], ["a hen", "a cloth covering the eggs", "fruit or bread"], size=(16, 16, 11), rooms=[COOP, KIT, COT])
# ================================================================ pigsty
add("pigsty", "pigsty", 1, "a low pigsty shelter with its little walled yard",
    "A small farm PIGSTY in one piece, about 9 ft square and low: at the back a squat SHELTER 4 ft tall with thick rough fieldstone walls and a single-pitch roof of heavy weathered"
    " planks, with one low square doorway (dark inside) facing the front; in front of it a little YARD enclosed by a rough fieldstone wall only 2.5 ft tall on three sides, with one gap closed"
    " by a stout plank hurdle; inside the yard the ground is churned DARK BROWN MUD with a heap of golden straw by the doorway and a short thick wooden feeding TROUGH against the wall,"
    " full of pale swill. EMPTY of animals." + SOLID + ROCKY.replace("The stone must not be one flat grey mass:", "The stone must not be one flat grey mass: rounded field stones,"),
    "a low stone pigsty: a squat roofed shelter with a low doorway and a small low-walled muddy yard with a trough", ["a small low roofed shelter with a dark doorway", "a low wall enclosing a small muddy yard in front of it", "a feeding trough"],
    ["a pig or any animal", "a tall house with windows", "a well"], size=(110, 110, 50), base=False, rooms=[STY, YARD], note="the mud yard floor is its own (base=False)")
# ================================================================ field, yard, garden, orchard
add("haystack-field", "haystack-field", 1, "a big round farm haystack",
    "A large round HAYSTACK built for the winter: a fat drum of golden hay about 7 ft across with slightly bulging sides, topped by a neat rounded CONE of darker, combed thatch to shed the"
    " rain, with a thick straw-rope net of four ropes over the cone weighted by FOUR stones hanging at the eaves, and a short stout pole sticking out of the very top." + SOLID + MOOD,
    "a large round haystack with a conical thatched top", ["a big round stack of golden hay", "a rounded cone top"], ["a hay bale (rectangular, bound)", "a hut with a door", "a cart"],
    size=(84, 84, 108), rooms=[FIELD, YARD, BARN])
add("rural-grain-stook", "rural-grain-stook", 1, "a stook of wheat sheaves stood up to dry",
    "A harvest STOOK: SIX fat sheaves of golden wheat stood on end and leaning together in a tent shape, heads up, each sheaf bound round its waist by a thick twisted straw band; the heavy"
    " ears of grain bunch together at the top in a darker gold; the butts splay out at the ground." + SOLID + MOOD,
    "several bound sheaves of golden wheat standing on end and leaning together in a tent shape", ["bound sheaves of golden grain standing upright together", "ears of grain at the top"],
    ["a round haystack", "a rectangular bale", "a scarecrow"], size=(40, 36, 52), rooms=[FIELD, BARN, GRAN])
add("scarecrow-post", "scarecrow-post", 1, "a farm scarecrow on its post",
    "A field SCARECROW: a thick fence-post upright with a thick cross-pole for arms, wearing a ragged brown sackcloth coat patched in ochre and dull red, stuffed fat with straw that bulges"
    " at the cuffs and neck; the head is a pale TURNIP-coloured stuffed sack with a stitched grin and two dark button eyes under a battered wide-brimmed straw hat. Arms straight out. It stands"
    " on its ONE thick post, which ends in a short cross-foot of two stout timbers." + SOLID + STOUT + MOOD,
    "a scarecrow: a straw-stuffed figure in ragged clothes with arms straight out on a post, with a hat", ["a human-shaped stuffed figure with arms out sideways on a single post", "a hat", "straw showing"],
    ["a living person", "a crow or bird", "a pumpkin head with a carved glowing face", "blue clothes"], size=(52, 16, 80), rooms=[FIELD, GARD])
add("plough", "plough", 1, "a heavy wooden ox plough",
    "A medieval wheeled PLOUGH standing ready: one long, THICK, slightly curved wooden beam; at the front a pair of small solid wooden wheels on a short axle; under the middle a heavy iron"
    " coulter knife and a broad iron-shod wooden SHARE with a curved wooden mould-board; at the back TWO thick curved handles rising to waist height. Dark worn oak, iron dull grey with bright"
    " worn edges, dried brown earth on the share." + STOUT + MOOD,
    "a wooden plough with a long beam, two small wheels at the front, an iron blade below and two handles at the back", ["a long beam with two handles at one end", "a ploughshare / blade under it"],
    ["an animal harnessed to it", "a cart with a load bed", "thin spindly handles"], size=(30, 100, 40), rooms=[FIELD, BARN, YARD])
add("dovecote", "dovecote", 1, "a small round stone farm dovecote",
    "A freestanding DOVECOTE: a round tower of rough pale fieldstone 5 ft across and 9 ft tall with a conical roof of weathered wooden shingles topped by a small open wooden lantern;"
    " THREE rows of small arched pigeon holes with stone landing ledges ring the upper half, streaked white below; one low plank door at the bottom." + ROCKY + MOOD,
    "a small round stone tower with a conical roof and rows of small pigeon holes", ["a round tower with a conical roof", "rows of small holes with ledges in its upper part"],
    ["a bird", "windows with glass", "a well with a bucket"], size=(60, 60, 132), rooms=[YARD, GARD])
add("beehive-skep", "beehive-skep", 1, "two straw beehive skeps on a bench",
    "TWO domed straw BEE SKEPS standing side by side on one low thick plank bench with four stout legs: each skep is a fat beehive dome of thick coiled golden straw rope (the coils clearly"
    " ringed), with one small dark arched entrance hole at the bottom front and a flat stone on top." + SOLID + MOOD,
    "two domed coiled-straw beehives side by side on a low wooden bench", ["two dome-shaped coiled straw hives", "a low bench or stand under them"], ["bees", "a wooden box hive with frames", "a basket with a handle"],
    size=(40, 18, 32), rooms=[GARD, ORCH])
add("bean-poles-wigwam", "bean-poles-wigwam", 1, "a wigwam of bean poles covered in climbing beans",
    "A garden BEAN WIGWAM: SIX very thick straight poles set in a ring 3 ft across, leaning in and lashed together at the top with a fat knot of rope, and wound round thickly with climbing"
    " bean plants: broad green leaves in solid painted masses covering the lower two thirds, with scarlet flowers and long green pods; the pole tops stand bare above the knot."
    " It grows from a round mound of dark earth." + STOUT + MOOD,
    "a cone of thick poles tied at the top and covered in green climbing plants with red flowers", ["several thick poles leaning together to a tied point", "green leafy climbing plants on them"],
    ["a tent with cloth", "a campfire tripod with a pot", "thin sticks"], size=(40, 40, 84), base=False, rooms=[GARD], note="the earth mound is its own")
# ================================================================ cellar, granary, loft
add("root-sand-box", "root-sand-box", 1, "a long box of sand with root vegetables bedded in it",
    "A root-cellar keeping box: a long, low, heavy plank box on two thick runners, three-quarters full of pale yellow SAND, with ROWS of root vegetables half-buried in the sand, tops showing:"
    " a row of ORANGE carrots, a row of dark RED beetroot, a row of pale cream-and-purple TURNIPS; a short-handled wooden scoop stuck in the sand at one end." + MOOD,
    "a long low wooden box of pale sand with rows of orange, red and pale root vegetables half-buried in it", ["a long low open wooden box", "sand in it", "rows of root vegetables showing"],
    ["a planter with green leafy plants growing", "a coffin or chest with a lid on", "fruit"], size=(52, 24, 18), rooms=[CEL])
add("rural-grain-heap-threshed", "rural-grain-heap-threshed", 1, "a heap of threshed golden grain with a shovel",
    "A big conical HEAP of clean threshed wheat grain, rich GOLDEN yellow, 4 ft across, smooth-sided like a sand pile, painted as one solid mass with a fine speckle; a broad wooden grain"
    " SHOVEL with a thick handle is stuck upright in its side and a round wooden bushel measure, full and levelled, stands at its foot." + MOOD,
    "a conical heap of golden grain with a wooden shovel stuck in it and a round wooden measure beside it", ["a smooth cone-shaped heap of golden-yellow grain", "a shovel or a measure with it"],
    ["a heap of hay or straw (stalks)", "a pile of gold coins", "a sack"], size=(50, 46, 24), base=False, rooms=[GRAN, BARN], note="the heap is its own base")
add("winnowing-basket", "winnowing-basket", 1, "a wide flat winnowing basket of grain",
    "A WINNOWING basket: a very wide, shallow, shovel-shaped tray of thick plaited pale straw-and-withy, with a raised rim round three sides and open at the front lip, two stout grip"
    " loops; it is half full of golden grain with a drift of paler chaff at the lip." + SOLID + MOOD,
    "a wide shallow shovel-shaped woven basket tray holding golden grain", ["a wide shallow woven tray, open at one side", "golden grain in it"], ["a deep round basket", "bread or fruit"],
    size=(32, 26, 8), rooms=[GRAN, BARN])
add("loft-ladder-head", "loft-ladder-head", 1, "the top of a ladder coming up through a hatch in a plank floor",
    "The way up into a loft, as ONE piece: a square frame of four thick dark timbers lying flat (a floor hatch 3 ft square) with a plank TRAPDOOR lid hinged open and leaning back on one side,"
    " and the top THREE rungs of a very thick ladder (two fat side poles, fat rungs) standing up through the hole, rising 3 ft above the frame. Inside the frame the hole is flat DARK brown-black."
    + STOUT + MOOD,
    "a square timber floor hatch with an open trapdoor lid and the top of a thick ladder standing up through it", ["a square frame / hatch lying flat", "the top of a ladder rising out of it", "an open lid"],
    ["a whole tall ladder leaning on a wall", "a well with water", "a staircase"], size=(44, 44, 40), base=False, rooms=[LOFT], note="the hatch frame is its own base")

# ---------------------------------------------------------------- checks + write
ids = [a["id"] for a in assets]
assert len(ids) == len(set(ids)), [i for i, n in Counter(ids).items() if n > 1]
live = {k["sku"] for o in json.loads((MAIN / "tools/spawn-tuner/data/library.json").read_text())["objects"].values() for k in o["skus"]}
assert not [i for i in ids if i in live], [i for i in ids if i in live]
others = set()
for f in list(MAIN.parent.glob("3d-vtt-type-*/experiments/2026-10-11-types/*/assets.json")) + list(MAIN.parent.glob("3d-vtt-type-*/experiments/2026-10-11-types/*/*/assets.json")) + list(MAIN.parent.glob("3d-vtt-wizard/experiments/2026-10-11-types/*/assets.json")):
    if "type-hut" not in str(f): others |= {a["id"] for a in json.loads(f.read_text())["assets"]}
assert not [i for i in ids if i in others], [i for i in ids if i in others]
byid = {a["id"]: a for a in assets}
for a in assets:
    assert a["object"] in roles and roles[a["object"]]["size"], a["object"]
    assert a["group"] in ("p1", "sib1") and a["group"][-1] == str(a["prio"]), a["id"]
    assert all(Path(r).exists() or r.startswith(str(HERE / "inputs")) for r in a["refs"]), (a["id"], a["refs"])
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets: (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(assets), "assets", dict(sorted(Counter(a["group"] for a in assets).items())), "| unique against", len(live), "library skus and", len(others), "in-flight skus")
