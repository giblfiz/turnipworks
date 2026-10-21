#!/usr/bin/env python3
"""Mine type (2026-10-11, batch 2026-10-11-types): every NEW mesh of DESIGN.md, in the dungeon batch's format
(../dun/build_spec.py, itself the castle batch's). Writes assets.json for tools/gen.py and prompts/<id>.spec.md.
Groups: p1/p2/p3 = independent pieces by priority; sib1/sib2 = painted FROM an accepted plate: a parent in a p group of this
file, or (walls, vein slabs, the cracked timber set) the DUNGEON batch's accepted plate of the same rock / the same frame,
so the mine's walls match the dungeon's cut-rock family. Run order: p1, sib1, p2, sib2, p3.
Provenance: text prompts and our own style reference only; the only other pictures supplied are our own accepted plates.
    python3 build_spec.py
"""
import json, sys
from collections import Counter
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]                                   # the worktree
MAIN = Path("<repo>")         # binaries (style reference, accepted plates) are git-ignored: read from the main tree
sys.path.insert(0, str(ROOT / "src"))
import catalog_tool as ct
STYLE = (ROOT / "style/heroic-handpainted.object.md").read_text()
STYLE_REF = str(MAIN / "style-references/heroic-handpainted-tavern-v1.png")
DUNIN = MAIN.parent / "3d-vtt-type-dun/experiments/2026-10-11-types/dun/inputs"   # the dungeon batch's accepted plates (until it lands on main they live in its worktree)
if not DUNIN.exists(): DUNIN = MAIN / "experiments/2026-10-11-types/dun/inputs"
roles = {}
for p in sorted((ROOT / "catalog").glob("*.catalog.md")):
    roles.update(ct.parse_catalog(p)[0])
NEW_ROLES = {r for r, v in roles.items() if v["file"] == "objects-mine.catalog.md"}
for p in sorted((MAIN.parent / "3d-vtt-type-dun/catalog").glob("objects-dungeon*.catalog.md")):   # the dungeon batch's roles (shoring-timber): in its worktree until it lands
    for k, v in ct.parse_catalog(p)[0].items(): roles.setdefault(k, v)

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
MOOD = " Mine mood: worked, dusty, matte surfaces with a strong, simple silhouette that reads from far above."
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
    if obj not in NEW_ROLES: a["tier"] = "min"          # a sku under a role the library already has: exclusive to the mine rooms
    if wall: a["generation"], a["family"], a["kit"] = "kit", "mine-timbered", "wall"
    if kit: a["kit"] = kit
    if opening: a["opening"] = opening
    if hung: a["hung"] = True
    if light: a["light"] = light
    if twin_of: a["twin_of"] = twin_of
    if note: a["note"] = note
    assets.append(a)


TUN, JUN, FACE, COLL, FLOOD, SHAFT, SORT, TOOLS, MESS, POWDER, SEAM, PIT, SMELT = ("min-tunnel", "min-junction", "min-face", "min-collapsed", "min-flooded", "min-shaft-head",
    "min-sorting", "min-tool-store", "min-mess", "min-powder-store", "min-seam", "min-pithead", "min-smelter")
TIMBER = "dark weathered pit timber, roughly squared with an adze, paler cut faces and end grain, a few iron dogs (fat staples)"
IRON = "dark forged iron with a little rust-brown and worn bright edges"
ORE = "dark slate-grey and rust-brown rock lumps shot through with bright COPPER-ORANGE and brassy GOLD flecks and a few green verdigris stains"
DW = str(DUNIN / "wall-straight--cut-rock.jpg"); DW2 = str(DUNIN / "wall-straight--cut-rock--s2.jpg"); DD = str(DUNIN / "wall-doorway--cut-rock.jpg"); DS = str(DUNIN / "shoring-timber.jpg")
ROCKWALL = "the plain wall of hewn living rock (dark grey-brown, chisel-marked, no blocks or joints)"

# ================================================================ wall kit: family mine-timbered (painted from the dungeon's cut-rock plates)
WM = ["one single upright wall section, clearly taller than it is wide", "a hewn rock face (not built of blocks)", "thick timber against the rock"]
WN = ["a floor, base slab, roof or corner return", "a lantern, torch, tool or any fitting attached", "masonry blocks, bricks or mortar joints", "thin sticks or planks (the timber must be thick)"]
add("wall-straight--mine-timbered", "wall-straight", 1, "a wall section of a mine tunnel: hewn rock held by heavy timber",
    "The SAME rock wall, now TIMBERED like a mine: ONE very thick, roughly squared timber POST (a foot thick) stands upright against the rock face in the exact MIDDLE of the section, from the"
    " floor line to the top, and ONE heavy timber CAP BEAM (a foot deep) runs level along the whole TOP edge of the wall from side to side, resting on the post with a fat wooden wedge each side."
    " The rock shows either side of the post. " + TIMBER.capitalize() + ". The top edge is one level line, the bottom sits flat, both side edges are clean vertical cuts (the cap beam is cut"
    " flush with them so that copies join into one long beam)." + TALL,
    "an upright wall section of dark hewn rock with a thick timber post up its middle and a heavy timber beam along its top", WM, WN + ["a door, window or niche"],
    ref=DW, what=ROCKWALL, mode="wall", wall=True, opening="solid", rooms=[TUN, JUN, COLL, FLOOD, SHAFT, TOOLS, POWDER])
add("wall-straight--mine-timbered--s2", "wall-straight", 1, "a second timbered mine wall section, with plank lagging",
    "The SAME rock wall, TIMBERED like a mine, a different arrangement so that two sections side by side do not read as copies: ONE very thick squared timber POST in the exact middle and a heavy"
    " timber CAP BEAM level along the whole top edge, as a mine prop set; and BEHIND the post, over the UPPER half of the wall only, four thick horizontal LAGGING boards (each 8 in tall,"
    " 3 in thick, with gaps showing rock between them) holding back loose rock. The lower half is bare rock. " + TIMBER.capitalize() + ". Level top, flat bottom, clean vertical side cuts." + TALL,
    "an upright wall section of dark hewn rock with a thick timber post, a top beam and a few thick horizontal boards across its upper half", WM, WN + ["a door, window or niche"],
    ref=DW2, what=ROCKWALL, mode="wall", wall=True, opening="solid", rooms=[TUN, JUN, COLL, FLOOD, SHAFT, TOOLS, POWDER])
add("wall-doorway--mine-timbered", "wall-doorway", 1, "a mine tunnel mouth: a rock wall with a timber-framed opening",
    "The SAME rock wall with its EMPTY door opening (3.5 ft x 7 ft, from the bottom), now FRAMED IN TIMBER like a mine tunnel mouth: a very thick squared timber post each side of the opening"
    " and a heavy lintel beam across its head that overhangs the posts a little, fat wedges at the joints. A heavy timber cap beam also runs level along the whole top edge of the wall."
    " NO door leaf; the opening is empty and you see flat chroma blue through it. " + TIMBER.capitalize() + "." + TALL,
    "an upright rock wall section with an empty doorway framed by two thick timber posts and a timber lintel",
    ["one upright wall section taller than wide", "an empty door opening framed in thick timber", "hewn rock around the frame"], WN + ["a door leaf, gate or bars in the opening", "a dressed stone arch"],
    ref=DD, what="the wall of hewn living rock with its empty rough-hewn door opening", mode="wall", wall=True, opening="door", rooms=[TUN, JUN, COLL, FLOOD, SHAFT, TOOLS, POWDER])
VM = ["one upright slab of rock, taller than wide", "a bright vein running through dark rock"]
VN = ["a floor, base or roof", "tools, timber or a lantern attached", "masonry blocks or mortar joints", "glow, sparkle stars or light rays", "blue colour"]
add("ore-vein", "ore-vein", 1, "a slab of the working face: hewn rock with a rich vein of ore in it",
    "The SAME rock face, as the WORKING FACE of a mine: freshly broken, more jagged and paler than the old wall, with ONE thick, branching VEIN of ore (a hand to a foot wide) running"
    " diagonally across it from low left to high right, forking once: the vein is bright brassy GOLD and COPPER-ORANGE metal, matte and painted (no glow), with small nuggets standing proud and green"
    " verdigris staining below it. Pick scars round the vein. Level top, flat bottom, clean vertical side cuts so that copies butt together." + TALL,
    "an upright slab of dark broken rock with a thick bright gold-and-copper vein running diagonally through it", VM, VN,
    ref=DW, what=ROCKWALL, mode="wall", size=(60, 14, 104), base=False, rooms=[FACE, SEAM], note="a PROP (place wall, stands against the end wall, side by side), not a kit panel")
add("ore-vein--s2", "ore-vein", 1, "a slab of rock face studded with crystals",
    "The SAME rock face, as the wall of a CRYSTAL SEAM: freshly broken dark rock with a wide diagonal band, low left to high right, packed with chunky CRYSTALS growing out of it: fat hexagonal"
    " points a hand to a foot long in VIOLET-PURPLE and ROSE, with a few AMBER ones, matte and painted (no glow), biggest in the middle of the band. Level top, flat bottom, clean vertical side cuts." + TALL,
    "an upright slab of dark rock with a diagonal band of chunky violet, rose and amber crystals growing out of it", ["one upright slab of rock, taller than wide", "a band of chunky crystals in dark rock"], VN,
    ref=DW2, what=ROCKWALL, mode="wall", size=(60, 14, 104), base=False, rooms=[SEAM], note="a PROP, as ore-vein; it glows (no flame type: the game has no glow effect yet)")

# ================================================================ the cart road's rolling stock, ore and spoil
add("mine-cart", "mine-cart", 1, "a mine ore cart heaped with ore",
    "A stubby mine cart, 2.5 ft wide, 4 ft long and 3 ft tall: a deep tub of thick oak planks bound with three broad riveted iron straps, flared slightly toward the top, riding LOW on four small,"
    " very FAT solid iron wheels tucked half under the tub (wheels 10 in across and 4 in thick), a stubby iron coupling hook at each end. It is HEAPED above the rim with ore: " + ORE + "."
    " One solid mass." + CHUNKY + MOOD,
    "a short deep wooden cart tub bound with iron, on four small fat iron wheels, heaped with dark ore that glints copper and gold",
    ["a deep box-shaped cart body", "four small wheels", "a heap of rock lumps in it"], ["rails or track under it", "a handle, shafts or a horse harness", "spoked wagon wheels", "a wheelbarrow"],
    size=(30, 48, 36), base=True, rooms=[TUN, JUN, FACE, SORT, SHAFT, PIT, SEAM])
add("mine-cart--s2", "mine-cart", 1, "the same mine cart, empty",
    "The SAME cart, EMPTY: the tub is open and you see its dark, dusty plank floor inside with a little grit in the corners. Nothing in it." + CHUNKY,
    "a short deep wooden cart tub bound with iron on four small fat iron wheels, empty", ["a deep open box-shaped cart body", "four small wheels"], ["rock or ore heaped in it", "rails or track under it"],
    parent="mine-cart", what="the mine cart heaped with ore", mode="set", size=(30, 48, 36), rooms=[TUN, FACE, COLL, FLOOD])
add("rural-ore-cart-tipped", "rural-ore-cart-tipped", 2, "the mine cart tipped on its side, spilling its ore",
    "The SAME cart lying TIPPED OVER on its side, two wheels in the air, its load of ore spilled out of the tub in a fan across the ground in front of it. One strap sprung, a cracked plank."
    " Cart and spill are one solid low mass about 4 ft by 5 ft." + CHUNKY,
    "a wooden mine cart lying on its side with its load of ore spilled out beside it", ["a cart body lying on its side", "wheels visible on the upper side", "spilled rock lumps"], ["an upright cart", "rails or track"],
    parent="mine-cart", what="the mine cart heaped with ore", mode="set", base=False, rooms=[COLL, FLOOD])
add("ore-pile", "ore-pile", 1, "a heap of raw ore",
    "A low conical heap of raw ore 3 ft across and 1.5 ft tall: fist- to head-sized angular lumps, " + ORE + ". The gold and copper flecks are painted clearly enough to read from far away:"
    " this is ORE, not grey rubble and not coins. One solid mound, lumps fused." + MOOD,
    "a low heap of dark angular rock lumps flecked with bright copper and gold", ["one heap of angular rock lumps", "bright metallic flecks in the rock"], ["coins, bars or cut gems", "a sack, crate or cart", "smooth round boulders", "plain grey rubble with no flecks"],
    base=False, rooms=[TUN, JUN, FACE, SORT, SEAM, PIT, SMELT])
add("ore-pile--s2", "ore-pile", 1, "a big stockpile heap of raw ore",
    "A BIG stockpile of the SAME ore: a broad mound 6 ft by 5 ft and nearly 3 ft tall with a rounded top and lumps rolling out round its foot; a short, very thick-handled shovel is stuck"
    " upright in one flank (blade buried, handle as thick as a wrist). One solid mass.",
    "a large mound of dark angular ore lumps flecked with copper and gold, a stubby shovel stuck in it", ["one large mound of rock lumps", "bright metallic flecks"], ["coins or bars", "a cart or crate", "a thin-handled tool"],
    parent="ore-pile", what="the low heap of raw ore", mode="set", size=(72, 60, 34), base=False, rooms=[SORT, PIT, SMELT, FACE])
add("rural-tailings-pile", "rural-tailings-pile", 1, "a spoil heap of waste rock",
    "A spoil heap of WASTE rock, 6 ft by 5 ft and 3.3 ft tall: crushed pale grey and dun-brown stone, from dust and gravel up to a few head-sized blocks, tipped from one side so that it has"
    " a steep face and a long gentle back, with cart-tip ridges down it and two broken plank ends sticking out. NO metallic flecks: this is the worthless rock." + MOOD,
    "a large heap of pale crushed waste rock and gravel with a steep side, a couple of broken plank ends in it", ["one large heap of crushed stone and gravel", "paler than ore, no metallic flecks"], ["coins or ore glints", "a cart", "grass or plants"],
    base=False, rooms=[PIT, FACE, SORT, COLL])

# ================================================================ stores and racks
add("mine-tool-rack", "mine-tool-rack", 1, "a miners' tool rack hung with picks and a shovel",
    "A stout tool rack that stands with its flat back against a wall, 4 ft wide, 14 in deep and 5 ft tall: a BACKBOARD of four thick upright planks on two fat feet, with a heavy peg rail across"
    " the top. Hung flat against the backboard, side by side and touching it along their whole length: TWO big PICKAXES (curved double-pointed iron heads, hafts as thick as a wrist), ONE broad"
    " SHOVEL (blade down) and ONE SLEDGEHAMMER (head down). Below them a plank shelf holding three fat iron wedges and a coil of thick rope. Everything is fused to the backboard: one solid mass,"
    " no gaps behind the tools. " + TIMBER.capitalize() + "; tool heads " + IRON + "." + CHUNKY + MOOD,
    "a wooden rack against a backboard holding two pickaxes, a shovel and a sledgehammer, with a low shelf", ["an upright wooden backboard", "at least one pickaxe with a curved two-pointed head", "a shovel"],
    ["swords, spears, axes or other weapons", "tools standing free with air behind them", "thin wiry handles"], base=False, rooms=[TOOLS, FACE, SHAFT, JUN, SEAM, TUN])
add("mine-lamp-rack", "mine-lamp-rack", 1, "a rack of miners' lamps",
    "A lamp rack that stands with its flat back against a wall, 3.3 ft wide, 1 ft deep and 4.7 ft tall: a thick plank backboard on two fat feet with TWO shelves; on the shelves stand SIX fat"
    " miners' LAMPS in two rows of three (each a squat iron-and-brass lantern 9 in tall with a domed cap, a thick bail handle folded down and a dark horn window), and on the bottom board an open"
    " wooden CANDLE BOX of fat pale tallow candles and a clay oil jug. Everything fused to the shelves." + CHUNKY + MOOD,
    "a wooden shelf rack against a backboard holding six squat miners' lanterns, with a box of candles below", ["an upright wooden rack with shelves", "several small squat lanterns in rows"],
    ["bottles, books or food on the shelves", "weapons", "a single big lantern"], base=False, light="lantern", bench=["fire"], rooms=[POWDER, SHAFT])
add("powder-keg-stack", "powder-keg-stack", 1, "a stack of blasting-powder kegs",
    "A pyramid stack of SIX small blasting-powder KEGS lying on their sides, three, two and one, 3.3 ft wide, 2.5 ft deep and 3.3 ft tall, chocked by two fat wooden wedges: each keg a stubby"
    " oak barrel a foot across with thick hoops of pale WOODEN withy (no iron: no sparks) and a broad band of dull RED paint round its middle; the keg ends show a black painted flame mark."
    " On top of the stack lies a fat coil of dark tarred FUSE cord as thick as a thumb. One solid mass." + MOOD,
    "a pyramid of six small kegs lying on their sides, each with a red painted band, a coil of thick cord on top", ["several small barrels stacked in a pyramid", "a red band on the kegs"],
    ["a lit fuse, sparks or flame", "large wine casks on a rack", "taps or spigots", "blue paint"], base=False, rooms=[POWDER])
add("rural-pit-props-stack", "rural-pit-props-stack", 1, "a stack of pit props",
    "A neat stack of PIT PROPS, 5 ft long, 3 ft deep and 2.5 ft tall: about twelve short, very thick round timbers (each 5 ft long and 9 in across, bark half stripped, ends sawn pale) piled"
    " in a pyramid between two pairs of stubby upright stakes, with three squared cap pieces laid across the top. One solid mass." + MOOD,
    "a stack of short thick round logs piled lengthwise between stakes", ["a pile of thick round timbers lying side by side", "pale sawn log ends"], ["split firewood", "planks only", "a cart"],
    base=False, rooms=[TOOLS, TUN, JUN, SHAFT, PIT, FLOOD])
add("lumber-pile", "lumber-pile", 2, "a stack of heavy mine planks",
    "A stack of heavy sawn PLANKS and squared baulks, 3.3 ft wide, 8 ft long and 2 ft tall: six layers laid lengthwise with thick spacer sticks crosswise between the layers, the top layer a"
    " little askew, two fat squared beams on top. " + TIMBER.capitalize() + "." + MOOD,
    "a long low stack of thick sawn planks with a couple of squared beams on top", ["a long stack of planks in layers"], ["round logs only", "a cart", "a table"],
    base=False, rooms=[TOOLS, PIT])
add("coal-bin--mine", "coal-bin", 2, "a bin of charcoal and coal",
    "A heavy timber fuel BIN, 4 ft wide, 2.5 ft deep and 2.5 ft tall: thick plank sides between four fat corner posts, the front lower than the back, heaped above the rim with matte BLACK lumps"
    " of coal and charcoal, a few spilled at its foot, a stubby scoop shovel stuck in the heap (handle as thick as a wrist). Black dust on the planks." + CHUNKY,
    "an open wooden bin heaped with black lumps of coal, a stubby scoop stuck in it", ["an open box-like wooden bin", "a heap of black lumps"], ["glowing embers or fire", "ore with gold flecks", "a lid"],
    base=False, rooms=[SMELT, PIT], note="tier min: the smithy's own coal bin (when one is made) stays the smithy's")

# ================================================================ fixtures
add("mine-shaft-collar", "mine-shaft-collar", 1, "the mouth of a mine shaft: a timber collar round a black hole",
    "The mouth of a vertical mine shaft seen as ONE low object, 5.8 ft square and 16 in tall: a square KERB of very thick squared timbers (each a foot thick) laid log-cabin fashion two"
    " courses high with crossed, overhanging corners and fat iron dogs, round a square opening 3.8 ft across. INSIDE the kerb everything is painted flat matte BLACK with the first two feet of"
    " plank lining just visible at the rim, so that it reads as a hole going straight down. Over ONE side of the kerb pokes the top of a stout LADDER (two fat rails and two rungs, 2 ft of it"
    " showing, leaning on the inside of the kerb). A thick rope lies over the opposite side and drops into the dark. " + TIMBER.capitalize() + "." + CHUNKY + MOOD,
    "a low square frame of heavy timbers around a black square opening, the top of a ladder sticking out of it", ["a low square timber frame", "a dark black opening inside it", "the top of a ladder"],
    ["a round stone well", "a roof, winch or bucket over it", "water in it", "a trapdoor lid closing it"], base=False, rooms=[SHAFT], note="THE VERTICAL LINK's marker; reads as a hole although it stands on the floor")
add("sorting-table", "sorting-table", 1, "an ore-sorting table",
    "A heavy ORE-SORTING table, 6.5 ft long, 2.8 ft deep and 3 ft tall: a thick plank top with a raised rim board all round on four fat square legs braced by a low stretcher. On the top,"
    " left to right: a heap of unsorted ore lumps; a round SIEVE with a thick wooden hoop; a short fat hand HAMMER lying flat; and two shallow wooden trays, one of bright gold-and-copper ore, one"
    " of grey waste. Ore is " + ORE + ". Everything on the table is fused to it." + CHUNKY + MOOD,
    "a heavy wooden table with a rim, carrying heaps of rock lumps, a round sieve, a hammer and two trays", ["a sturdy table", "heaps of rock lumps on it", "a round sieve or trays"],
    ["food, plates or cups", "chairs or benches", "books or papers", "an anvil"], size=(78, 34, 36), base=True, rooms=[SORT, PIT])
add("smelter--mine", "smelter", 1, "a smelting furnace",
    "A squat SMELTING FURNACE (a bloomery), 4.5 ft square at the base and 7 ft tall: a square platform of rough dark stone blocks one course high, and on it a fat, bottle-shaped furnace"
    " stack of clay and fieldstone bound by three broad iron bands, narrowing to an open, soot-black mouth at the top. Low in the front an arched TAP HOLE over a stone trough with a cold,"
    " dull grey tongue of slag in it; on the right side a stubby clay nozzle where the bellows go. Soot streaks up from the tap hole and round the top. Cold." + STONE + MOOD,
    "a fat bottle-shaped furnace of clay and stone with iron bands on a square stone base, an arched hole low in front", ["one squat tapering furnace stack", "an arched opening low in the front", "iron bands round it"],
    ["an anvil or blacksmith's forge with a hood", "a bread oven with a shelf", "a tall thin factory chimney", "a cauldron"], size=(54, 54, 84), base=False, light="forge", bench=["fire"], rooms=[SMELT, PIT])
add("mine-headframe", "mine-headframe", 1, "a timber headframe over a mine shaft",
    "A squat timber HEADFRAME (winding tower), 9 ft square at the foot and 14 ft tall: FOUR very thick squared posts (each over a foot thick) leaning inward a little, tied by heavy horizontal"
    " beams at mid height and at the top and by one fat diagonal brace on each side; on the top beams sits ONE big solid wooden PULLEY WHEEL (4 ft across, 8 in thick, a solid disc with four"
    " round holes, not spokes) in a heavy cradle, with a rope as thick as an arm running over it and straight down the middle. Between the feet a square KERB of thick timbers round a"
    " flat matte BLACK opening (the shaft). " + TIMBER.capitalize() + "." + CHUNKY + MOOD,
    "a squat four-legged tower of very thick timbers with a big wooden pulley wheel on top, standing over a black square hole", ["four thick timber legs forming a tower", "a large wheel at the top", "a dark opening between its feet"],
    ["a gallows or hanging noose", "a windmill with sails", "a roofed well-house", "a tall thin lattice of sticks", "a siege tower with walls"], size=(110, 110, 168), base=False, rooms=[PIT],
    note="the riskiest mesh (an open frame): every member over a foot thick; if it fails twice, ship the yard with the well-house")
add("rural-water-pump-mine", "rural-water-pump-mine", 2, "a hand-cranked mine drainage pump",
    "A mine drainage PUMP, 2.5 ft square and 4 ft tall: a fat upright barrel of thick oak staves with broad iron hoops on a heavy timber sledge base, a very thick iron crank handle on one side"
    " on a big solid flywheel disc, and a fat leather-and-iron spout pipe (as thick as an arm) curving out of the top and down the other side. A green waterline stain round its lower third." + CHUNKY + MOOD,
    "an upright barrel-shaped wooden pump with iron hoops, a big crank wheel on one side and a thick spout pipe", ["an upright barrel-like pump body", "a crank wheel or handle", "a thick spout pipe"],
    ["flowing water", "a village pump with a long thin lever", "a butter churn", "blue colour"], base=False, bench=["water"], rooms=[FLOOD])
add("rural-ore-bucket", "rural-ore-bucket", 2, "a kibble: a big iron-bound ore bucket",
    "A KIBBLE, the big bucket that goes up the shaft: 2 ft across and 2.3 ft tall, a fat barrel-shaped tub of thick oak staves with three broad riveted iron hoops, a very thick iron bail"
    " handle standing upright over it with a fat ring at the top, heaped with ore: " + ORE + "." + CHUNKY,
    "a big barrel-shaped bucket bound with iron hoops, a thick upright bail handle, heaped with rock lumps", ["a large bucket or tub", "a thick handle over it", "rock lumps in it"], ["water in it", "a thin wire handle", "a cart"],
    size=(24, 24, 28), base=True, rooms=[SHAFT, PIT, FACE], note="own size: the catalog's bucket is 16 in")
add("beam-collapsed", "beam-collapsed", 2, "fallen roof timbers",
    "FALLEN roof timbers as one low mass, 3.3 ft wide, 9 ft long and 2.5 ft tall: TWO very thick squared beams (a foot thick) lying crossed, one snapped in the middle with a splintered pale"
    " break, on a bed of broken rock and dust, a split cap piece and two fat wedges beside them. " + TIMBER.capitalize() + "." + MOOD,
    "two thick broken timber beams lying crossed on a bed of rubble", ["thick timber beams lying on the ground", "a snapped, splintered break", "broken rock under them"], ["an upright frame", "burnt charred wood with embers", "planks only"],
    base=False, rooms=[COLL])
add("shoring-timber--s2", "shoring-timber", 2, "the same timber prop frame, cracked and sagging",
    "The SAME frame, FAILING: the lintel beam is CRACKED through near its middle and sags there by half a foot, with a pale splintered break; the left post has split down its top third and"
    " leans; an extra thick raking strut has been wedged under the sagging lintel on the right, and a fat wedge has dropped out and lies at the foot. Still one frame you can walk through." + CHUNKY,
    "a heavy timber frame of two thick posts and a cracked, sagging beam across the top, propped by an extra slanting timber", ["two upright timber posts", "a cracked or sagging beam across their tops"], ["a door or gate", "rock or wall around it", "a gallows with a rope"],
    ref=DS, what="the mine-style timber prop frame of two thick posts and a lintel", mode="set", size=(60, 20, 100), base=False, kit="frame", opening="door", rooms=[COLL], note="role shoring-timber is the dungeon batch's")
add("crystal-formation--s3", "crystal-formation", 2, "a great crystal formation growing from mine rock",
    "A great CRYSTAL formation, 4.5 ft across and 5.5 ft tall, growing out of a low boss of dark broken mine rock: SEVEN fat hexagonal crystal points, the tallest in the middle and leaning"
    " a little, the others fanning out round it, in deep VIOLET-PURPLE shading to pale ROSE at the tips, with two small AMBER ones at the foot. Matte, painted facets with strong light and dark"
    " planes; NO glow, NO sparkle. One solid mass, every crystal thicker than an arm." + MOOD,
    "a large cluster of fat violet and rose crystal points growing up out of a lump of dark rock", ["a cluster of several large pointed crystals", "dark rock at its base"], ["glow, light rays or sparkle stars", "blue crystals", "thin needle crystals", "a carved pedestal"],
    size=(54, 54, 66), base=False, light="crystal", rooms=[SEAM], note="the wizard batch owns crystal-formation--s1; bench: a glow, not a flame")
add("geode-cluster", "geode-cluster", 2, "a split geode",
    "A split GEODE, 2 ft across and 20 in tall: a rough, dull grey-brown stone ball broken open in two halves lying together, the hollow insides lined with a thick crust of chunky"
    " VIOLET and ROSE crystals round an AMBER heart. Matte painted facets, no glow.",
    "a rough stone ball split in two halves, lined inside with chunky violet and rose crystals", ["a rough stone shell broken open", "crystals lining the inside"], ["glow or sparkle stars", "blue crystals", "an egg with a creature in it"],
    base=False, light="crystal", rooms=[SEAM, SORT])
add("ingot-stack", "ingot-stack", 2, "a stack of rough cast metal pigs",
    "A criss-cross STACK of rough cast metal PIGS (bars), 2.5 ft by 1.8 ft and 16 in tall: four layers of fat, loaf-shaped bars each a foot and a half long laid alternately lengthwise and"
    " crosswise; most are dark IRON-GREY with a rusty bloom, the top layer COPPER-RED. Rough sand-cast skins, a maker's notch on the ends. One solid mass." + MOOD,
    "a criss-cross stack of fat loaf-shaped metal bars, dark grey with a few copper-red ones on top", ["a stack of loaf-shaped bars in crossed layers", "dull metal colours"], ["bright polished gold bars", "bread loaves", "bricks with mortar"],
    base=False, rooms=[SMELT, PIT])
add("rural-sign-danger-mine", "rural-sign-danger-mine", 2, "a crude painted danger board",
    "A crude DANGER board to hang on a wall, 26 in wide, 20 in tall and 4 in thick: three thick rough planks nailed to two fat battens, painted with a big dull RED diagonal cross and under"
    " it a white daubed skull shape (crude, like finger painting); drips of paint, a split corner, four fat nail heads. NO letters or words.",
    "a rough wooden board painted with a big red cross and a crude white skull", ["a flat wooden board of planks", "a red painted cross or skull mark"], ["written words or letters", "a post or stake under it", "an inn sign on a bracket"],
    size=(26, 4, 20), base=False, hung=True, rooms=[TUN, COLL, POWDER, SHAFT], note="hung on the wall (catalog: wall, tiny)")
add("sluice-box", "sluice-box", 2, "a wooden sluice for washing ore",
    "An ore-washing SLUICE, 2 ft wide, 9 ft long and 2.5 ft tall at its high end: a long, sloping open trough of thick planks with a row of fat cross riffle bars along its floor, standing"
    " on three pairs of stubby trestle legs of falling height; a square hopper box at the high end with grit in it; pale gravel and a few gold flecks caught behind the riffles. The trough is"
    " DRY: no water." + CHUNKY + MOOD,
    "a long sloping wooden trough on short trestle legs with cross bars along its floor and a box at the high end", ["a long narrow sloping wooden trough", "short legs under it"], ["flowing water", "a feeding trough with hay", "a boat", "blue colour"],
    base=False, bench=["water"], rooms=[PIT, SMELT])
add("rural-slag-heap", "rural-slag-heap", 3, "a heap of smelting slag",
    "A heap of smelter SLAG, 6 ft by 5 ft and 3 ft tall: glassy, bubbly black and dark purple-brown clinker in ropey lumps and broken plates, with rusty orange patches and grey ash drifts;"
    " darker and shinier than rock, no gold flecks." + MOOD,
    "a large heap of black glassy clinker lumps with rusty patches and ash", ["one large heap of dark lumpy clinker"], ["glowing or molten material", "coal in a bin", "ore with gold flecks"],
    base=False, rooms=[PIT, SMELT])
add("rural-bellows-ventilation", "rural-bellows-ventilation", 3, "a great ventilation bellows",
    "A great BELLOWS on a frame, 4 ft wide, 6 ft long and 4 ft tall: a huge pear-shaped bellows of two thick wooden boards and pleated dark leather with brass studs along the seams,"
    " lying sloping in a heavy timber cradle of four fat posts, a thick lever beam over it with a rope-wrapped handle, and a fat iron nozzle at the narrow end." + CHUNKY + MOOD,
    "a very large leather-and-wood bellows lying in a heavy timber cradle with a lever beam above it", ["a large pear-shaped bellows with pleated leather", "a timber frame holding it"], ["a small hand bellows", "a forge with fire", "a musical organ"],
    base=False, rooms=[SMELT, FLOOD])

# ---------------------------------------------------------------- checks + write
ids = [a["id"] for a in assets]
assert len(ids) == len(set(ids)), [i for i, n in Counter(ids).items() if n > 1]
assert len(assets) == 32, len(assets)
byid = {a["id"]: a for a in assets}
for a in assets:
    assert a["object"] in roles and roles[a["object"]]["size"], a["object"]
    assert a["group"] in ("p1", "p2", "p3", "sib1", "sib2", "sib3") and a["group"][-1] == str(a["prio"]), a["id"]
    assert all(Path(r).exists() or r.startswith(str(HERE / "inputs")) for r in a["refs"]), (a["id"], a["refs"])
    if a["group"].startswith("sib") and not a["refs"][0].startswith(str(DUNIN)):
        par = Path(a["refs"][0]).stem
        assert par in byid and byid[par]["group"].startswith("p") and byid[par]["prio"] <= a["prio"], (a["id"], par)
    if a.get("twin_of"):
        assert roles[a["object"]]["open_of"] == a["twin_of"], a["id"]
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets: (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(assets), "assets", dict(sorted(Counter(a["group"] for a in assets).items())), "prio", dict(sorted(Counter(a["prio"] for a in assets).items())))
print("bench", dict(Counter(b for a in assets for b in a["bench"])), "hung", sum(1 for a in assets if a.get("hung")), "lights", dict(Counter(a["light"] for a in assets if a.get("light"))),
      "tier min", sum(1 for a in assets if a.get("tier")), "new roles", len({a["object"] for a in assets if not a.get("tier")}))
