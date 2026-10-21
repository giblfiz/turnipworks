#!/usr/bin/env python3
"""Smithy & workshop (2026-10-11): every NEW mesh the type wants. Writes assets.json (+ prompts/) in the yard / mansion
format for src/plate_gate_batch.py. Nothing here calls an image model.

    python3 build_spec.py

THE WORKSHOP SKELETON. A workshop is six roles: a HEAT or power source on the wall facing the door (forge, kiln; the
woodshop has none), the WORKSTATION one step in front of it (anvil, bench, wheel), a TOOL WALL, a RAW store, a rack of
FINISHED goods, and a front counter where it sells. A CRAFT is one line of data naming the piece for each role
(integration/programs.smi.js SMI_CRAFTS). From the table camera a craft is told from another by the colour of its stuff:
  smith      black iron and coal, grey stone, rust
  armourer   bright steel and burgundy leather
  carpenter  pale fresh-cut wood and honey shavings
  potter     terracotta orange, cream slip, wet grey clay
so every piece below carries its craft's colour story, and is a FEW BIG things, not many small ones.

Only what the library lacks is here (reused: quench-trough, grindstone, weapon-rack, armor-stand, mil-armor-repair-bench,
smith-shoeing-stocks, hitching-post, farrier-stand, smith-horseshoe-rack, sawhorse, woodpile, wheel-spare, wagon ...).
Groups: p1 / p2 / p3, all independent (no sibling plates). Extra fields: prio, rooms, bench, hung, light, tier.
"""
import json
from collections import Counter
from spec_lib import *  # noqa: F401,F403
import spec_lib

STOUT = (" Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and bar is THICK, at least as thick as a man's arm;"
         " nothing thin, no wire, no string, no chains, no dangling loose parts.")
BIG = " The things on it are FEW and BIG, packed tight against each other as solid masses (no tiny scattered items, nothing floating, nothing hanging free)."
COLD = " It is COLD and UNLIT: the coals are dull black with pale grey ash, NO flames, NO glow, NO embers, NO sparks, NO smoke (the game adds the fire)."
RELIEF = (" Every tool lies FLAT against the board and is fixed to it along its whole length, like a deep relief carving: thick, fat-handled, with no gap"
          " behind it and nothing sticking out past the edge of the board.")
FORGE = ["smi-forge"]; ARM = ["smi-armoury"]; WOOD = ["smi-carpenter"]; POT = ["smi-potter"]; SHOP = ["smi-shopfront"]; YARD = ["smi-yard"]; STOCK = ["smi-stock"]

# ---------------------------------------------------------------------------------------------------------------
# THE BLACKSMITH'S FORGE (the signature room)
add("forge", "forge", "p1", 1, FORGE + ARM, "a blacksmith's stone forge with its hood",
    "A blacksmith's forge: a big square raised hearth built of rough grey fieldstone blocks, waist high, about 6 ft wide and 5 ft deep. Its top is a shallow stone trough heaped with"
    " black coal. Over the BACK half rises a broad tapering hood and chimney breast of soot-blackened brick and stone, as wide as the hearth at the bottom and narrowing to a stout square"
    " chimney stub at head height and a half. The front of the hearth has one small arched ash hole, dark and empty. A thick iron poker and a pair of fat tongs lie flat on the stone rim." + COLD + STOUT,
    "a big waist-high stone hearth heaped with black coal, with a tall brick chimney hood over its back", ["a raised stone hearth with coal on top", "a hood or chimney rising behind it"],
    ["flames, glow or sparks", "a person", "an anvil standing beside it"], size=(72, 60, 96), bench=["fire"], light="forge")
add("anvil", "anvil", "p1", 1, FORGE + ARM + YARD, "a blacksmith's anvil on its stump",
    "A blacksmith's anvil: a heavy black iron anvil with a fat round horn at one end and a square heel at the other, its worked face polished bright steel-grey, standing on a THICK"
    " round oak stump as wide as the anvil is long, bound with one broad iron band. A short-handled smith's hammer with a big square head lies flat on the stump beside the anvil's foot." + STOUT,
    "a black iron anvil with a horn, standing on a thick tree stump", ["an anvil with a horn", "a wooden stump under it"], ["a person", "flames or sparks", "a glowing bar"], size=(30, 22, 34))
add("bellows-great", "bellows-great", "p1", 1, FORGE, "a smith's great bellows in its frame",
    "A smith's great bellows: one huge pear-shaped bellows, about 5 ft long, of two thick wooden boards joined by a fat pleated bag of dark red-brown leather studded with big round"
    " brass nails, lying level in a heavy timber cradle of four THICK square posts, its stout iron nozzle pointing out of one end. Above it one thick wooden rocking beam on a post, with a"
    " fat rope-free wooden pull handle at its end." + STOUT,
    "a very large leather and wood bellows lying in a heavy timber frame", ["one big bellows with a pleated leather bag", "a timber frame carrying it"], ["a person", "a fire or forge", "ropes or chains"], size=(60, 30, 54))
add("coal-bin", "coal-bin", "p1", 1, FORGE + STOCK + YARD, "a bin of forge coal",
    "A smith's coal bin: a stout open-topped bin of thick grey-brown oak planks with iron corner straps, its front lower than its back, about 4 ft wide, 2.5 ft deep and 2.5 ft high,"
    " heaped high with lumps of black coal. A broad flat iron shovel with a fat wooden handle stands stuck upright in the coal." + STOUT,
    "an open wooden bin heaped with black coal, a shovel stuck in it", ["an open bin", "black coal heaped in it"], ["a lid closing it", "flames or glow", "a person"])
add("tool-rack-smith", "tool-rack-smith", "p1", 1, FORGE + ARM, "a smith's wall rack of hammers and tongs",
    "A smith's tool board that hangs on a wall: a THICK plank board about 4 ft wide and 3 ft tall, as thick as a fist, of dark soot-stained oak with a heavy rail along its top. On it, in one"
    " row: three big hammers with fat square black iron heads and thick pale ash handles, and three pairs of fat black iron tongs, all hanging head-up side by side." + RELIEF + STOUT,
    "a wooden wall board with a row of big hammers and iron tongs on it", ["a flat wooden board", "hammers and tongs in a row on it"], ["legs or a stand on the ground", "a person", "thin wire-like tools"],
    size=(48, 8, 36), hung=True)
add("metal-stock", "metal-stock", "p1", 1, FORGE + ARM + STOCK, "a rack of iron bar stock and ingots",
    "A smith's stock rack: a low, heavy timber cradle of four THICK square posts and two cross rails, about 4 ft long, 2 ft deep and 2.5 ft high, loaded with a dozen FAT iron bars lying"
    " side by side and on top of each other like logs (dark grey-black iron with dull orange rust at the cut ends). On the ground rail under them, a neat stack of six brick-shaped iron"
    " ingots." + STOUT,
    "a low timber rack stacked with thick iron bars, ingots under them", ["thick metal bars lying stacked", "a low timber frame"], ["a person", "wooden logs or firewood", "thin rods"], size=(48, 22, 30))

# ---------------------------------------------------------------------------------------------------------------
# THE ARMOURER & WEAPONSMITH: bright steel and burgundy leather (racks, stands, the repair bench and the grindstone exist)
add("smith-breastplate-on-form", "smith-breastplate-on-form", "p1", 1, ARM + SHOP, "a breastplate being fitted on an armourer's form",
    "An armourer's fitting form: a wooden torso with NO head and NO arms (a flat wooden cap where the neck would be) on ONE thick turned post rising from a heavy round wooden foot. It wears a"
    " bright polished steel breastplate with a raised ridge down the middle, two big rounded steel shoulder plates and a short skirt of three steel bands, strapped on with broad burgundy-red"
    " leather straps and brass buckles. The steel is painted pale silver-grey with soft white highlights." + STOUT,
    "a headless wooden dummy on a post wearing a shiny steel breastplate and shoulder plates", ["a torso form with no head", "steel armour on it"], ["a head, helmet or face", "arms or hands", "a real person", "a weapon"], size=(26, 22, 60))
add("smith-blade-barrel", "smith-blade-barrel", "p2", 2, ARM + SHOP + STOCK, "a barrel of swords for sale",
    "A stout open oak barrel with three thick iron hoops, no lid, packed tight with a dozen swords standing point-down in it: their hilts fan out above the rim as one close bunch, fat"
    " cross-guards of bright steel and brass, thick grips wrapped in burgundy-red and dark brown leather, big round pommels. Two short-hafted axes stand among them, bright blades up." + STOUT,
    "an open wooden barrel with a bunch of sword hilts standing out of it", ["an open barrel", "sword hilts sticking up out of it"], ["a lid closing the barrel", "a person", "swords lying on the ground"], size=(24, 24, 46))
add("wares-display", "wares-display", "p2", 2, SHOP + ARM + FORGE, "a smith's rack of finished ironwork and blades",
    "A smith's display rack that stands with its back to a wall: a solid-backed unit of dark oak planks about 4 ft wide, 1.5 ft deep and 5 ft tall. Fixed flat against its back board in"
    " one row: four broad swords, points down, bright steel blades with brass and burgundy-leather hilts, and one round steel shield with a big brass boss. On the one thick shelf at knee"
    " height: two polished steel helmets and a black iron cooking pot. On the flat top: a row of four big black iron horseshoes leaning against the back board." + BIG + STOUT,
    "a wooden rack with a solid back, swords and a shield fixed on it, helmets on its shelf", ["a rack or stand with a solid back", "swords or blades shown on it"], ["a person", "empty shelves", "books"])
add("counter-shop--smith", "counter-shop", "p1", 1, SHOP, "the shop counter of a blacksmith's shop",
    "A sturdy shop counter of dark soot-stained oak, a long solid box about 6 ft long, 2 ft deep and waist high, with a thick overhanging plank top, three plain raised panels on its front"
    " and a broad black iron strap round each end. The LEFT two thirds of the top is loaded with the smith's finished goods: a polished steel helmet, three black iron cooking pots stacked"
    " in each other, a heap of big black horseshoes, a fat coil of heavy iron chain painted as one solid lump, two bright axe heads and a big iron padlock. The right third of the top is"
    " clear, bare wood. Colours of the goods: black iron, bright silver steel, a little brass." + BIG + STOUT,
    "a long wooden shop counter with a pile of iron and steel goods on one end of its top (a blacksmith's shop)", ["one long waist-high counter", "metal goods standing on its top"], ["a person", "a second piece of furniture", "food or bread"],
    size=(72, 26, 50), tier="smi")
add("craft-display-table-goods--smith", "craft-display-table-goods", "p2", 2, SHOP + YARD, "a display table of a smith's wares",
    "A low, sturdy trestle display table, about 6 ft long, 2.5 ft deep and 2.5 ft high, on two THICK plank trestle ends, its top a single thick dark plank, heaped from end to end with a"
    " smith's wares: black iron cooking pots and a big frying pan, a row of bright axe heads and hammer heads, a heap of horseshoes, two polished steel helmets, a pile of fat iron hinges and"
    " a big iron lantern. Seen from above the table top is almost hidden by the goods. Colours: black iron, bright silver steel and a little brass." + BIG + STOUT,
    "a low table completely covered with iron and steel goods (a blacksmith's wares)", ["one low table", "its top covered with metal goods"], ["a person", "a canopy or awning over the table", "food"],
    size=(72, 30, 40), tier="smi")
add("smith-sign-anvil", "smith-sign-anvil", "p2", 2, SHOP + YARD + FORGE, "a hanging smithy sign",
    "A hanging smithy sign: a THICK shield-shaped wooden board about 2 ft across and as thick as a fist, hanging directly under a stout square black iron bracket arm (the board is joined"
    " to the arm by two fat iron straps, no chains). The arm ends in a flat square wall plate. Carved in deep relief and painted on BOTH faces of the board, with no lettering at all: a"
    " black anvil with a hammer crossed over it. The board is painted cream with a rust-red border." + STOUT,
    "a hanging wooden shop sign on an iron bracket, carved with an anvil and hammer, no writing", ["one sign board hanging from a bracket arm", "an anvil shape on it"], ["letters, words or numbers", "chains", "a post standing on the ground"],
    size=(30, 6, 30), hung=True)

# ---------------------------------------------------------------------------------------------------------------
# THE CARPENTER'S WOODSHOP: pale fresh-cut wood and honey shavings (sawhorse, woodpile, ladder exist)
add("carpenter-bench", "carpenter-bench", "p1", 1, WOOD, "a carpenter's workbench",
    "A carpenter's workbench: a massive bench of pale honey beech about 6 ft long, 2 ft deep and waist high, with a top as thick as a hand is long on four THICK square legs joined by a low"
    " shelf. A big wooden screw vise with a fat round handle at its left end. On the top: a long pale freshly planed board lying lengthwise, a big wooden jack plane sitting on it, a fat"
    " round wooden mallet, and a thick drift of pale yellow curled shavings heaped at one end, painted as one solid mound. On the low shelf: a boxy wooden tool chest." + STOUT,
    "a heavy pale wooden workbench with a vise, a plane and a heap of wood shavings on it", ["one heavy wooden bench", "a wood plane or shavings on it"], ["a person", "metal armour or weapons", "an anvil"])
add("craft-tool-wall-pegboard", "craft-tool-wall-pegboard", "p1", 1, WOOD, "a carpenter's wall board of tools",
    "A carpenter's tool board that hangs on a wall: a THICK plank board about 5 ft wide and 3 ft tall, as thick as a fist, of pale honey pine with a heavy rail along its top. On it, in one"
    " row: a big bow saw with a fat wooden frame, a broad hand saw with a thick blade, a fat round wooden mallet, a big wooden try square, a wooden plane and three chisels with fat round"
    " handles. Pale wood and dull grey steel." + RELIEF + STOUT,
    "a wooden wall board with saws, a mallet, a square and chisels on it", ["a flat wooden board", "woodworking tools in a row on it, a saw among them"], ["legs or a stand on the ground", "a person", "hammers and tongs only"],
    size=(60, 8, 36), hung=True)
add("craft-boards-planed-stack", "craft-boards-planed-stack", "p2", 2, WOOD + STOCK + YARD, "a stack of sawn boards",
    "A carpenter's timber stack: about fifteen long, thick, freshly sawn boards of pale cream-yellow wood lying flat on top of each other in five layers of three, each layer kept apart by"
    " short fat cross sticks, the whole stack resting on two thick square bearers. About 8 ft long, 2 ft wide and knee to thigh high. The cut ends show pale growth rings.",
    "a neat low stack of long pale wooden boards", ["long boards stacked flat in layers"], ["a person", "round logs or firewood", "a table"], size=(96, 26, 22), base=False)
add("craft-chair-half-built", "craft-chair-half-built", "p2", 2, WOOD, "a half-built chair",
    "A half-built wooden chair of pale fresh-cut wood, made THICK and toy-like: four fat square legs, a thick plank seat, and a tall back frame of two fat posts and one top rail with NO"
    " back panel and NO slats yet (the back is an empty frame); one fat stretcher between the front legs. A thick wooden clamp is screwed across the seat. Bare pale yellow wood, unfinished." + STOUT,
    "an unfinished pale wooden chair with an empty frame for a back", ["one chair", "bare unpainted pale wood"], ["a person", "cushions or cloth", "two chairs"], size=(22, 22, 40))
add("craft-shavings-pile", "craft-shavings-pile", "p2", 2, WOOD, "a heap of wood shavings and offcuts",
    "A carpenter's sweepings: ONE low rounded mound of pale yellow curled wood shavings, painted as a single solid heap with big fat curls on its surface, about 3 ft across and a foot"
    " high, with four short thick pale offcut blocks of wood half buried in it. Pale straw-yellow and cream.",
    "a low mound of pale yellow wood shavings with a few wood blocks in it", ["one low heap of pale curled shavings"], ["a person", "hay or straw stalks", "a container or basket", "gold coins"], size=(36, 30, 12), base=False)
add("table-work", "table-work", "p2", 2, ARM + POT + STOCK + FORGE, "a heavy trade workbench",
    "A heavy workshop bench that any trade could use: a thick, scarred top of grey-brown oak, about 6 ft long and 2.5 ft deep, waist high, on four THICK square legs with a plank shelf low"
    " between them. A fat iron leg vise bolted to its right front corner. On the top: a big wooden mallet, a thick leather apron folded into a square, and a stout unlit tin lantern. On the low"
    " shelf: one wooden box and one small keg." + STOUT,
    "a heavy plain wooden workbench with an iron vise at one corner", ["one heavy wooden bench or table", "a vise on it"], ["a person", "food or tableware", "books"])

# ---------------------------------------------------------------------------------------------------------------
# THE POTTER: terracotta orange, cream slip, wet grey clay
add("kiln-pottery", "kiln-pottery", "p1", 1, POT + YARD, "a potter's domed kiln",
    "A potter's kiln: a fat beehive DOME of red-orange brick and cream clay daub, about 4.5 ft across and 5 ft tall, standing on a low ring of grey stone (the real base of the kiln)."
    " In its front, one arched stoke hole framed in brick, dark and empty. A short, fat round chimney pot of orange clay on the very top of the dome. Two broad iron bands round the dome." +
    COLD.replace("the coals are dull black with pale grey ash, ", "") + STOUT,
    "a domed brick kiln like a beehive, with an arched opening in front and a short chimney on top", ["a dome-shaped brick oven", "an arched opening in its front"], ["flames, glow or smoke", "bread or loaves", "a person"],
    base=False, bench=["fire"], light="kiln")
add("potters-wheel", "potters-wheel", "p1", 1, POT, "a potter's kick wheel with a pot on it",
    "A potter's kick wheel, made THICK and toy-like: a heavy boxy timber frame about 3 ft square and 2.5 ft high with a plank seat across the back; at the bottom a big, heavy stone"
    " flywheel disc; on top a round wooden wheel head carrying one fat, wet, shiny GREY clay pot, half made, with a wide open mouth. Beside the wheel head on the frame, a round wooden bowl"
    " (dry, empty) and a lump of grey clay. The timber is splashed with pale grey clay." + STOUT,
    "a potter's wheel: a timber frame with a seat, a round wheel head with a grey clay pot on it", ["a round wheel head with a clay pot on it", "a seat or frame"], ["a person", "a spinning wheel with wool", "a cart wheel"], size=(40, 40, 36))
add("pots-drying-shelf", "pots-drying-shelf", "p2", 2, POT + SHOP, "a potter's rack of pots",
    "A potter's drying rack that stands with its back to a wall: a tall unit of pale plank shelves with a SOLID plank back and solid sides, about 5 ft wide, 1.5 ft deep and 5.5 ft tall,"
    " three THICK shelves. Every shelf is full, edge to edge, and more stand on the flat top: big round pots, jugs with fat handles, wide bowls and lidded crocks, about half of them fired"
    " terracotta orange and half unfired pale grey clay, a few dipped in cream. Each shelf holds only four or five big pots in a tight row." + BIG + STOUT,
    "a tall wooden shelf unit full of clay pots, jugs and bowls in orange and grey", ["one tall shelf unit with a solid back", "pots and jugs on every shelf"], ["empty shelves", "a person", "books", "glass bottles"], size=(60, 18, 66))
add("clay-bin", "clay-bin", "p2", 2, POT + STOCK, "a bin of wet clay",
    "A potter's clay bin: a low, stout open trough of thick wet-darkened planks, about 3 ft wide, 2 ft deep and 2 ft high, filled with a smooth mound of wet GREY clay; four big brick-shaped"
    " blocks of cut grey clay are stacked on one end of the rim, and a fat round wooden paddle stands stuck upright in the mound. Grey clay smears on the planks." + STOUT,
    "a low wooden trough filled with grey clay, blocks of clay stacked on it", ["an open wooden bin or trough", "grey clay in it"], ["water", "a person", "coal or black lumps", "a lid"], size=(36, 26, 26))
add("pottery-for-sale--glazed", "pottery-for-sale", "p2", 2, POT + SHOP + YARD, "a potter's finished ware set out together",
    "A potter's finished ware: about ten fired and glazed pots standing TIGHT together on one thick square plank pallet (the pallet is part of the piece): two big terracotta-orange"
    " storage jars, a tall cream-glazed jug with a fat handle, a moss-green glazed pitcher, wide cream bowls stacked in two piles, two round lidded crocks banded in ochre, and one very big"
    " orange urn in the middle, taller than the rest. The pots touch each other in one close cluster." + STOUT,
    "a tight cluster of glazed clay pots, jars and bowls standing together on a wooden pallet", ["many pots and jars in one cluster"], ["a table or shelf", "a person", "broken pots"], size=(44, 38, 34), base=False)

# ---------------------------------------------------------------------------------------------------------------
# THE YARD AND THE STOCK STORE
add("smith-coal-heap", "smith-coal-heap", "p2", 2, YARD + STOCK + FORGE, "a heap of coal",
    "ONE low rounded heap of black forge coal, about 3.5 ft across and a foot and a half high, painted as a single solid mound of big angular black lumps with dull grey dust in the"
    " hollows, held on two sides by three thick grey-brown planks set on edge in an L (a rough corner pen, part of the piece)." + COLD,
    "a low heap of black coal held in a corner of planks", ["one heap of black lumps"], ["flames or glow", "a person", "a shovel standing apart", "a sack"], size=(42, 36, 18), base=False)
add("smelter", "smelter", "p3", 3, YARD, "a clay smelting furnace",
    "A smith's bloomery furnace: a fat round tapering tower of baked ochre-orange clay, like a tall thick chimney pot, about 3.5 ft across at the bottom and 6 ft tall, banded with"
    " three broad black iron hoops, soot-blackened round its open top. At the bottom front one small arched tap hole, dark and empty, with a short thick clay spout below it; a low ring of"
    " grey stones round its foot (the real base of the furnace)." + COLD.replace("the coals are dull black with pale grey ash, ", "") + STOUT,
    "a tall fat round clay furnace like a chimney, with a small arched hole at the bottom", ["a tall round clay tower", "a small opening near the bottom"], ["flames, glow or smoke", "a person", "a dome-shaped bread oven"],
    base=False, bench=["fire"], light="kiln")
add("craft-wood-offcut-bin", "craft-wood-offcut-bin", "p3", 3, WOOD + STOCK, "a bin of wood offcuts",
    "A carpenter's offcut bin: a stout open-topped square bin of thick pale planks, about 2 ft wide and 2 ft high, filled to overflowing with short thick offcuts of pale yellow wood:"
    " blocks, wedges, short lengths of square post and two round discs, standing and lying packed tight, the tallest sticking up a hand above the rim." + STOUT,
    "an open wooden bin full of short pale wood blocks and offcuts", ["an open bin", "blocks of pale wood filling it"], ["a lid", "a person", "firewood logs with bark", "coal"])

# ---------------------------------------------------------------------------------------------------------------
A = spec_lib.assets
ids = [a["id"] for a in A]
assert len(ids) == len(set(ids)), [i for i, n in Counter(ids).items() if n > 1]
for a in A:
    assert a["object"] in roles and roles[a["object"]].get("size"), a["id"]
    assert a["group"] in ("p1", "p2", "p3"), a["id"]
    if a.get("light"):
        assert "UNLIT" in a["prompt"], a["id"]
    body = a["prompt"].split("Specific design:")[1]
    for ok in ("NOT blue", "NO blue", "chroma blue", "the blue background", "or blue colour", "(no blue cloth"):
        body = body.replace(ok, "")
    assert " blue " not in body, a["id"]
(HERE / "assets.json").write_text(json.dumps({"assets": A}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in A:
    (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(A), "assets", "groups", dict(sorted(Counter(a["group"] for a in A).items())), "prio", dict(sorted(Counter(a["prio"] for a in A).items())))
print("bench", dict(Counter(b for a in A for b in a["bench"])), "hung", sum(1 for a in A if a.get("hung")), "lights", sum(1 for a in A if a.get("light")),
      "tiers", dict(Counter(a.get("tier", "-") for a in A)), "roles", len({a["object"] for a in A}))
