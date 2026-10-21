#!/usr/bin/env python3
"""Yard props (2026-10-05): the mesh batch from docs/ASSETS_TO_BUILD.md -> Outdoors. Trees are tested first
(group "test": three trees in a plain and a chunky-canopy prompt, a bush, a hedge section), then everything else.
Writes assets.json for src/plate_gate_batch.py (run through gen.py: plates from the FREE Codex image route).
Pieces that must butt together (fence, hedge, dry-stone wall) are painted in group "sib" from the accepted plate of
their straight section, the way the log-cabin window was painted from the log wall plate.
    python3 build_spec.py
"""
import json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "src"))
import catalog_tool as ct
STYLE = (ROOT / "style/heroic-handpainted.object.md").read_text()
STYLE_REF = str(ROOT / "style-references/heroic-handpainted-tavern-v1.png")
roles = {}
for p in sorted((ROOT / "catalog").glob("*.catalog.md")):
    roles.update(ct.parse_catalog(p)[0])

NOBASE = (" It stands on nothing: NO ground disc, NO grass patch, NO soil mound, NO rocks, NO base slab or platform under it."
          " The background is flat chroma blue, so the object itself has NO blue anywhere (no blue flowers, berries or cloth).")
LEAFY = (" Foliage is painted as a FEW big solid masses with broad leaf shapes on their surface, never as separate thin leaves or twigs;"
         " no gaps in the foliage that you can see the background through, no stray leaves or petals floating free.")
TREE_PLAIN = ("One stout trunk with a flared root base cut flat at the bottom, dividing into a few thick branches that carry a full, rounded leafy crown."
              " The trunk is clearly visible below the crown (about a third of the height) and is its own shape.")
TREE_CHUNKY = ("A STORYBOOK tree, not a botanical one: one thick trunk with a flared root base cut flat at the bottom, and a canopy built from FIVE to SEVEN big,"
               " chunky, rounded leaf clumps, like green clouds or scoops packed together, each clump a solid sculpted mass with a few big painted leaf shapes on it."
               " The clumps sit at different heights and stick out sideways unevenly, so from straight above the tree reads as a cluster of clumps, not as one smooth ball or disc."
               " The trunk is clearly visible below the canopy (about a third of the height) and one or two thick branches show between the clumps.")
BUTT = (" This is ONE straight 5-ft section of a longer run: both side ends are clean, flat, vertical cuts with nothing sticking out past them,"
        " and the top is one level height from end to end, so that copies placed end to end make one continuous run. Seen from its broad side, three-quarter view from slightly above.")
MATCH = ("The supplied image is an existing straight section of this same {what}. The new piece must look built from the same {what}:"
         " the SAME materials, colours, thicknesses, height, painting style and camera angle. Change ONLY what is described below.\n\n")

assets = []
def add(sku, obj, group, subject, design, desc, must=(), must_not=(), size=None, parent=None, what="", leafy=False, base=True):
    role = roles[obj]
    w, d, h = size or role["size"]
    detail = (f"{design} Real-world size about {w:g} in wide x {d:g} in deep x {h:g} in tall: keep these proportions."
              + (LEAFY if leafy else "") + (NOBASE if base else " The background is flat chroma blue, so the object itself has NO blue anywhere.")
              + " Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.")
    prompt = STYLE.format(subject=subject, detail=detail)
    refs = [STYLE_REF]
    gate_refs = []
    if parent:
        pp = str(HERE / "inputs" / f"{parent}.jpg")
        prompt = prompt.replace("Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset:",
                                MATCH.format(what=what) + "Create a single asset in the Turnip Works house style (heroic hand-painted):")
        refs, gate_refs = [pp], [pp]
        must = list(must) + [f"materials, colours and height match the REFERENCE {what} section (the described change is the intended difference)"]
    assets.append({"id": sku, "object": obj, "group": group, "source": "generate", "lane": "3d", "subject": subject, "size": [w, d, h],
                   "prompt": prompt, "refs": refs, "gate_refs": gate_refs,
                   "gate": {"desc": desc, "must": list(must), "must_not": list(must_not) + (["a ground disc, grass patch, soil mound or base slab under the object"] if base else [])}})

TREE_MUST = ["a single tree with one clearly visible trunk that reaches the bottom of the object", "the foliage is solid masses, not sparse thin twigs"]
TREE_NOT = ["more than one tree", "bare leafless branches", "fruit or flowers that are blue"]
def tree(sku, obj, group, kind, extra, size, chunky):
    add(sku, obj, group, kind, (TREE_CHUNKY if chunky else TREE_PLAIN) + " " + extra, f"{kind}: one tree with a trunk and a leafy crown",
        TREE_MUST, TREE_NOT, size=size, leafy=True)
TREES = [
 ("tree-deciduous--s", "tree-deciduous", "a young broadleaf tree about 14 ft tall", "Mid-green summer leaves, grey-brown bark. Crown about as wide as it is tall above the trunk.", (96, 96, 168)),
 ("tree-fruit--s", "tree-fruit", "a young apple tree about 10 ft tall", "A low, round crown on a short crooked trunk, with a dozen big red apples set INTO the surface of the leaf masses (large, chunky, half-embedded, none hanging on thin stalks).", (84, 84, 120)),
 ("tree-birch--s", "tree-birch", "a slender young birch tree about 18 ft tall", "A tall, narrow tree: a straight white trunk with black bands and knots, and a narrow upright crown of light yellow-green leaf masses stacked up the upper two thirds. Much taller than wide.", (48, 48, 216)),
 ("tree-deciduous--l", "tree-deciduous", "a full-grown broadleaf tree about 30 ft tall", "A big shade tree: thick trunk, a wide heavy crown of deep green leaves, taller than it is wide.", (150, 150, 360)),
 ("tree-fruit--l", "tree-fruit", "an old apple tree with a wide spreading crown, about 15 ft tall", "A gnarled, leaning thick trunk and a broad, low, spreading crown wider than the tree is tall above the trunk, with big red apples set INTO the surface of the leaf masses (chunky, half-embedded).", (120, 120, 180)),
 ("tree-birch--l", "tree-birch", "a tall white birch tree about 30 ft tall", "A very tall, narrow tree: a straight white trunk with black bands, bare for the lower third, then a narrow upright crown of light green leaf masses. About six times taller than wide.", (60, 60, 360)),
 ("tree-oak-great", "tree-oak-great", "a great spreading oak tree about 40 ft tall", "A massive, short, very thick trunk with big roots flaring at the base, heavy horizontal limbs, and a huge, broad, domed crown of dark green leaves, about as wide as the tree is tall.", (240, 240, 480)),
]
for i, (sku, obj, kind, extra, size) in enumerate(TREES):
    if i < 3:
        tree(sku, obj, "test", kind, extra, size, False)
        tree(sku + "--chunky", obj, "test", kind, extra, size, True)
    else:
        tree(sku, obj, "trees", kind, extra, size, True)   # rewritten after the test if the plain prompt wins

BUSH_MUST = ["one compact leafy bush, wider than or about as wide as it is tall", "foliage is solid masses"]
for n, extra in (("s1", "A low rounded dome, a little lopsided."), ("s2", "Two or three rounded lobes of different heights, like a small cluster."), ("s3", "A taller, egg-shaped bush with a slightly ragged top and a few small cream flowers set into the surface.")):
    add(f"bush--{n}", "bush", "test" if n == "s1" else "plants", "a round garden bush", f"A dense, leafy green garden shrub with no visible trunk, its foliage reaching the ground all round. {extra}",
        "a round leafy garden bush", BUSH_MUST, ["a tree with a tall bare trunk", "a pot or planter"], leafy=True)
add("bush-berry", "bush-berry", "plants", "a berry bush", "A dense, rounded leafy green bush, foliage to the ground, dotted with clusters of big RED berries set into the surface of the leaf masses (chunky, half-embedded).",
    "a round leafy bush with red berries", BUSH_MUST + ["red berries visible"], ["a pot or planter", "blue or purple berries"], leafy=True)
add("planter-barrel--s1", "planter-barrel", "plants", "a half barrel planted with flowers", "A wooden half barrel (staves and two iron hoops) standing on its flat bottom, filled with soil and a full mound of flowers in red, yellow and cream with green leaves, the flowers as big chunky blooms in one solid mass.",
    "a wooden half-barrel planter full of flowers", ["a barrel-shaped wooden tub with hoops", "flowers or plants growing out of the top"], ["blue flowers"], leafy=True)
add("planter-barrel--s2", "planter-barrel", "plants", "a half barrel planted with a small shrub and trailing flowers", "A wooden half barrel (staves and two iron hoops) standing on its flat bottom, planted with a small round green shrub in the middle and a ring of cream and orange flowers spilling a little over the rim, all as chunky solid masses.",
    "a wooden half-barrel planter with a small shrub and flowers", ["a barrel-shaped wooden tub with hoops", "plants growing out of the top"], ["blue flowers"], leafy=True)
add("planter-stone", "planter-stone", "plants", "a stone planter with a clipped shrub", "A square, carved blue-grey stone planter box on a low plinth foot, holding one round clipped green shrub like a ball, taller than the planter is wide.",
    "a square stone planter holding a round shrub", ["a stone box or urn planter", "a shrub growing from it"], [], leafy=True)
add("flowerbed", "flowerbed", "plants", "a cultivated flowerbed", "A square raised bed about 5 ft across and a foot and a half high: a low border of rounded field stones holding dark soil, packed full with a dense low carpet of flowers in red, yellow, cream and orange with green leaves, painted as chunky clustered blooms in one solid mass. Low and wide.",
    "a low square flowerbed edged with stones and full of flowers", ["low and wide, clearly much wider than tall", "a border or edging round the flowers"], ["blue flowers", "a tall plant or tree"], leafy=True, base=False)
add("flowerbox-window", "flowerbox-window", "plants", "a window box of flowers on brackets", "A long, narrow wooden trough (a window box) carried on two chunky wooden brackets underneath, filled with a full row of red and cream flowers and green leaves as one solid mass. Seen from the front, three-quarter view. It hangs on a wall, so the back is flat; NO wall, NO window shown.",
    "a long narrow wooden window box full of flowers, on two brackets", ["a long narrow box", "flowers along the top"], ["a wall or a window", "blue flowers"], leafy=True)
add("trellis-vine", "trellis-vine", "plants", "a wall trellis with a climbing plant", "A tall wooden wall trellis: a sturdy frame of THICK square laths in a wide diamond grid (only four or five big openings across), almost completely covered by a thick climbing vine with big green leaves and a few red-orange flowers, painted as solid masses, so only a little of the lattice shows at the edges. Flat-backed, seen from the front. NO wall shown.",
    "a tall flat wooden trellis covered with a climbing vine", ["taller than wide", "leaves covering most of the lattice"], ["a wall", "blue flowers"], leafy=True)

# --- edge kits: straight section first (group plants/edge), siblings from its plate (group sib)
add("hedge-straight--low", "hedge-straight", "test", "a section of clipped garden hedge", "A clipped box hedge, chest high: a long, dense, solid block of small dark green leaves with a flat top, slightly rounded top edges and near-vertical sides, leaves right down to the ground, with a few woody stems just visible at the very bottom." + BUTT,
    "one straight section of clipped green hedge, a long solid block with a flat top", ["a long box-shaped block of foliage, longer than it is tall", "both ends are flat cut faces"], ["a pot or planter", "an arch or gap", "flowers"], size=(60, 24, 40), leafy=True)
add("hedge-corner", "hedge-corner", "sib", "an L-shaped corner of clipped garden hedge", "The same clipped hedge turning a right-angle corner: an L-shaped block, each arm about 5 ft long, the same height and thickness as the straight section, flat top, both far ends clean flat vertical cuts.",
    "an L-shaped corner piece of clipped green hedge", ["an L shape seen from above (two arms at a right angle)"], ["an arch or gap"], parent="hedge-straight--low", what="clipped hedge", leafy=True)
add("hedge-end-block", "hedge-end-block", "sib", "a square end block of clipped garden hedge", "The same clipped hedge as a short square block that ends a hedge run or sits at its corner: a compact cube of foliage about 2.5 ft across and a little TALLER than the straight section, with a softly domed top, leaves down to the ground on all four sides.",
    "a compact square block of clipped green hedge (flat or softly domed top)", ["roughly as wide as it is deep (a block, not a long section)", "not taller than about twice its width"], ["an arch or gap", "a pot or planter"], parent="hedge-straight--low", what="clipped hedge", leafy=True)
add("hedge-gap-arch", "hedge-gap-arch", "sib", "a hedge section with a walk-through arch", "The same clipped hedge grown up and over into an arch: a 5-ft section whose two sides rise as thick hedge pillars and join overhead in a thick rounded leafy arch about 7 ft tall, with a clear walk-through opening about 3 ft wide and 6 ft high in the middle, open down to the ground; the blue background shows through the opening. Both side ends are clean flat vertical cuts at the same height and thickness as the straight hedge section.",
    "a hedge section with a walk-through arched opening", ["one arched opening you can see through, reaching the ground", "foliage continuous over the top of the opening"], ["a door or gate leaf in the opening"], parent="hedge-straight--low", what="clipped hedge", leafy=True)

add("fence-post-rail", "fence-post-rail", "edge", "a section of post-and-rail fence", "A rustic post-and-rail paddock fence: exactly TWO stout square posts, set in from the ends at about one quarter and three quarters of the length, carrying THREE thick horizontal split rails that run the whole length and stick out past both posts to flat-cut ends. Weathered warm honey-grey wood, big iron nail heads." + BUTT,
    "one straight section of wooden post-and-rail fence: two posts and three horizontal rails", ["exactly two upright posts", "horizontal rails that extend past the posts to both ends"], ["pickets or vertical boards filling the fence", "a gate", "a post at the very end of the section"])
add("fence-post-corner", "fence-post-corner", "sib", "a stout fence corner post", "ONLY a single stout square corner post of the same fence, standing alone with NO rails: a little thicker and a little taller than the fence's own posts, with a simple chamfered pyramid cap and an iron band below the cap. About 8 in square and 4 ft tall.",
    "a single stout square wooden fence post with a cap, standing alone", ["exactly one upright post", "no rails attached"], ["rails or fence sections attached", "a lantern or sign"], parent="fence-post-rail", what="wooden fence")
add("gate-fence", "gate-fence", "sib", "a small wooden field gate", "ONLY the gate leaf of the same fence, with NO posts: a small five-bar field gate about 4 ft wide, the same height as the fence, made of thick horizontal bars in a frame of two uprights with ONE diagonal brace, two chunky iron strap hinges on the left upright and a simple iron latch on the right. Closed, flat, seen from its broad side.",
    "a wooden bar gate leaf with a diagonal brace, without posts", ["horizontal bars in a frame", "one diagonal brace"], ["fence sections or tall gate posts attached at the sides"], parent="fence-post-rail", what="wooden fence")
add("fence-wattle", "fence-wattle", "edge", "a section of woven wattle fence", "A rustic wattle garden fence: FIVE thick upright stakes with thick flexible rods woven in and out between them from the ground to the top, like chunky basketwork, the woven rods running the whole length. The end stakes sit a little in from the ends so the woven rods end in flat cuts. Warm brown and honey wood." + BUTT,
    "one straight section of woven wattle fence: upright stakes with rods woven between them", ["basket-like horizontal weaving between upright stakes"], ["a gate", "pickets"])
add("fence-picket", "fence-picket", "edge", "a section of picket fence", "A tidy cottage picket fence: about EIGHT thick flat pickets with pointed tops, evenly spaced with half a gap at each end, nailed to TWO thick horizontal back rails that run the whole length to flat-cut ends. No posts. Pale cream-painted wood, a little worn, showing honey wood at the edges." + BUTT,
    "one straight section of picket fence: pointed upright pickets on two horizontal rails", ["a row of upright pickets with pointed tops", "two horizontal rails"], ["a gate", "tall end posts"])
add("wall-drystone", "wall-drystone", "edge", "a section of low dry-stone wall", "A low dry-stone field wall, waist high and 2 ft thick: big, chunky, rounded blue-grey and warm grey field stones stacked without mortar in about four rough courses, with a top row of upright slab coping stones, a little moss on top." + BUTT,
    "one straight section of low dry-stone wall with coping stones on top", ["stacked field stones without a gap or gate", "longer than it is tall"], ["a gate or gap", "mortar-flat brickwork", "a pillar taller than the wall"])
add("wall-drystone-gate", "wall-drystone-gate", "sib", "a dry-stone wall section with a gap and stone piers", "The same dry-stone wall as a 5-ft GATEWAY section: a clear walk-through gap about 3 ft wide in the middle, open to the ground (the blue background shows through), flanked by two square stone piers built of the same stones, each about 1 ft wide and a little taller than the wall, each with a flat cap stone. Nothing spans the gap and there is NO gate leaf. The two piers stand as one object joined by a thin flat stone threshold slab on the ground.",
    "two low square stone piers either side of an open gap, joined by a flat threshold stone", ["two piers", "a clear open gap between them"], ["a gate leaf or door in the gap", "an arch over the gap"], parent="wall-drystone", what="dry-stone wall", base=False)
add("wall-drystone-pier", "wall-drystone-pier", "sib", "a square dry-stone corner pier", "ONLY a single square corner pier of the same wall, standing alone: built of the same stacked stones, about 2.3 ft square and a little taller than the wall, with one big flat cap stone on top.",
    "a single square pier of stacked field stones with a cap stone, standing alone", ["one compact square pillar of stacked stones"], ["wall sections attached at the sides", "a lantern"], parent="wall-drystone", what="dry-stone wall")
add("gatepost-stone", "gatepost-stone", "furn", "a stone gatepost with a ball finial", "ONE tall square gate pier of dressed blue-grey stone blocks on a wider plinth, with a moulded cap carrying a carved stone ball finial. About 2.5 ft square and 6 ft tall.",
    "one tall square stone gatepost with a ball finial on top", ["exactly one pier", "a ball or carved finial on top"], ["a gate leaf", "two piers"])

F = "furn"
add("table-picnic", "table-picnic", F, "a plank picnic table with attached benches", "A heavy outdoor trestle table of thick planks, about 6 ft long, with a bench seat fixed along each long side, carried on the same two A-shaped end frames as the table top (the classic beer-garden picnic table). Bare weathered honey wood. Nothing on it.",
    "a wooden picnic table with a bench attached along each long side", ["one table top", "two benches joined to the table by shared frames"], ["loose separate benches or chairs", "food, mugs or other objects on it"])
add("sign-post-inn", "sign-post-inn", F, "a free-standing inn sign post", "A TALL, NARROW object, three times as tall as it is wide: a stout square wooden post about 9 ft tall with a chamfered top, a SHORT thick horizontal arm near the top (the arm only about 2.5 ft long) braced by a curved wooden bracket, and a small thick wooden sign board, about 2 ft across, hanging under the arm from two short chunky iron chains, close beside the post. The board is painted with a simple plump turnip picture (round purple-and-cream root, green leafy top) and NO text. The post ends in a flat cut at the bottom.",
    "a tall wooden post with a side arm from which a painted sign board hangs", ["one upright post", "a sign board hanging from an arm", "no text on the sign"], ["a wall or building", "text or letters"])
add("signpost", "signpost", F, "a crossroads signpost", "A stout wooden post about 7 ft tall with a pointed cap and THREE thick wooden finger boards near the top pointing in different directions, each a plank with one pointed end, blank with NO text. The post ends in a flat cut at the bottom.",
    "a wooden signpost with several pointing finger boards", ["one upright post", "two or more pointing boards", "no text"], ["text or letters"])
add("log-seat", "log-seat", F, "a log bench", "A long seat made from ONE thick tree log split in half lengthwise, flat side up, bark on the underside, resting on two short chunky log rounds. About 6 ft long and low. Nothing on it.",
    "a low bench made from a half log on two short log feet", ["long and low", "made of a log"], ["a backrest", "objects on it"])
add("well-house", "well-house", F, "a roofed well with a windlass", "A round well of big rough stones, waist high, with two stout timber posts carrying a small pitched roof of thick wooden shingles over it, and between the posts a thick wooden windlass roller with a crank handle and a chunky rope wound on it holding a wooden bucket just above the well mouth. The well shaft is dark and empty.",
    "a round stone well under a small pitched roof on two posts, with a windlass and bucket", ["a round stone well wall", "a small roof over it", "a winding roller between the posts"], ["water visible to the brim"])
add("hitching-post--s2", "hitching-post", F, "a hitching rail for horses", "A horse hitching rail: TWO short stout round posts with ONE thick round horizontal rail on top running the whole 6-ft length, and two big iron tie rings hanging from the rail. Bare weathered wood.",
    "a horse hitching rail: two posts and one horizontal rail", ["two posts", "one horizontal top rail"], ["a horse", "a fence with several rails"])
add("hitching-post--s3", "hitching-post", F, "a hitching rail for horses", "A horse hitching rail: THREE stout square posts with pyramid tops joined by ONE thick squared horizontal beam mortised through them a little below their tops, about 6 ft long, with a short length of thick rope knotted round the beam. Bare weathered wood.",
    "a horse hitching rail: three posts and one horizontal beam", ["three posts", "one horizontal beam"], ["a horse", "a fence with several rails"])
add("sawhorse", "sawhorse", F, "a sawhorse with a plank", "A carpenter's sawhorse: a thick horizontal beam on two pairs of splayed A-shaped legs with cross braces, with one thick plank lying along the top. Bare honey wood.",
    "a wooden sawhorse on splayed legs with a plank on top", ["four splayed legs in two A-shaped pairs", "a horizontal beam"], ["a saw or other tools"])
add("axe-woodcutter", "axe-woodcutter", F, "a woodcutter's felling axe", "A heavy felling axe lying flat: a thick, slightly curved honey-wood haft about 3 ft long and a big, chunky dark iron head with a bright bevelled edge. Deliberately thick and toy-like so it reconstructs in 3D.",
    "a single long-handled wood axe", ["one axe with one head and one handle"], ["a stump or log", "two axes"])
add("dog-kennel", "dog-kennel", F, "a small plank dog kennel", "A small dog kennel of thick planks with a pitched plank roof and one arched doorway in the front gable, dark and empty inside. NO dog, no bowl, no chain.",
    "a small wooden dog kennel with a pitched roof and an arched doorway", ["a pitched roof", "one doorway opening"], ["a dog or any animal", "a bowl"])
add("woodpile--long", "woodpile", F, "a long low stack of split firewood", "A LONG, low firewood stack to run along a wall: split logs neatly stacked crosswise in one row about 8 ft long, 20 in deep and 3 ft high, held between two short upright stakes at each end, the cut log ends facing the viewer. Much longer than tall.",
    "a long low stack of split firewood", ["stacked split logs", "clearly much longer than it is tall"], ["an axe or chopping block", "a shed or roof"], size=(96, 20, 40))

G = "garden"
add("trade-herb-bed", "trade-herb-bed", G, "a herb garden bed with labels", "A long, narrow raised garden bed about 3 ft by 8 ft and under a foot high: a low frame of thick planks holding dark soil, planted with FOUR different low herb clumps in a row (silver-green sage, dark rosemary, bright parsley, purple-pink flowering thyme) as chunky solid mounds, each with a small blank wooden label stake.",
    "a long low plank-edged garden bed with rows of herb clumps", ["low and long", "a plank frame around soil", "several low plants"], ["text on the labels", "tall plants"], leafy=True, base=False)
add("vegetable-patch", "vegetable-patch", G, "a vegetable patch of tilled rows", "A LONG, NARROW rectangular vegetable patch, almost TWICE as long as it is wide (about 5 ft by 9 ft) and a foot high: bare dark tilled soil with NO wooden frame or box round it, raised in FOUR long rounded ridges that run the LONG way, with furrows between, each ridge carrying a row of chunky leafy crops, two rows of turnips with purple-and-cream shoulders showing above the soil and green tops, one of cabbages, one of leafy greens. The soil slab has a clean, neat rectangular edge.",
    "a rectangular patch of tilled soil in rows with leafy vegetable crops", ["soil in rows or ridges", "low leafy crops in rows"], ["a fence", "tall plants", "tools"], leafy=True, base=False)
add("garden-tools-leaning", "garden-tools-leaning", G, "a spade, a rake and a hoe leaning together", "Three long-handled garden tools standing upright and bundled together as ONE chunky object, their thick wooden handles touching and tied with a turn of thick rope, heads on the ground: a spade with an iron blade, a wooden rake, and a hoe. Handles deliberately thick, about 5 ft tall. Leaning very slightly back as if against a wall; NO wall shown.",
    "three long-handled garden tools (spade, rake, hoe) bundled upright together", ["three long handles close together", "tool heads at the bottom"], ["a wall", "tools lying scattered apart"])
add("compost-heap", "compost-heap", G, "a slatted compost bin", "A square compost bin about 4 ft across and 2.5 ft high: four stout corner posts with thick horizontal slats on three sides (gaps between the slats), open at the front, heaped full with a rounded mound of brown compost, straw, leaves and vegetable scraps (a cabbage leaf, turnip tops, eggshells).",
    "a square slatted wooden compost bin heaped with compost and scraps", ["a slatted wooden bin", "a heap of organic waste inside"], ["a lid", "tools"])
add("clothesline", "clothesline", G, "a washing line between two posts, with linen", "A washing line as ONE solid object: two stout wooden posts about 6 ft tall, each with a short cross arm at the top, 10 ft apart, joined by ONE very thick rope, with a row of washing hanging from it that nearly fills the span and touches edge to edge: a big cream bed sheet, a shirt, a red-brown skirt, two cloths. The cloth hangs as thick, stiff, heavy slabs with a few deep folds, reaching about half-way to the ground. Seen from the broad side.",
    "two posts joined by a line hung with a row of washing", ["two posts", "several pieces of cloth hanging in a row"], ["a basket", "a person", "blue cloth"])
add("watering-can", "watering-can", G, "a clay watering pot", "A medieval clay watering pot: a rounded terracotta jug about 10 in tall with one thick loop handle on the side and a short thick spout ending in a pierced rose. Chunky and simple.",
    "a terracotta watering pot with one handle and a spout", ["one handle", "one spout"], [])
add("spade-garden", "spade-garden", G, "a garden spade", "A garden spade lying flat: a thick honey-wood shaft with a T-shaped grip at the top and a broad, chunky dark iron blade with a bright edge. Deliberately thick and toy-like so it reconstructs in 3D.",
    "a single garden spade with a T grip and a flat iron blade", ["one spade"], ["soil", "other tools"])
add("rake", "rake", G, "a wooden rake", "A wooden hay rake lying flat: a thick honey-wood handle about 5 ft long with a thick cross head carrying EIGHT short chunky wooden teeth. Deliberately thick and toy-like so it reconstructs in 3D.",
    "a single wooden rake with a cross head of teeth", ["one rake"], ["hay", "other tools"])
add("hoe", "hoe", G, "a garden hoe", "A garden hoe lying flat: a thick honey-wood handle about 4.5 ft long with a chunky dark iron blade set at a right angle at one end. Deliberately thick and toy-like so it reconstructs in 3D.",
    "a single garden hoe with a blade at a right angle to the handle", ["one hoe"], ["soil", "other tools"])
add("trowel-garden", "trowel-garden", G, "a garden trowel", "A garden trowel lying flat: a short fat turned wooden grip and a chunky, scoop-shaped dark iron blade with a bright edge. Hand-sized, thick and simple.",
    "a single garden hand trowel", ["one trowel with a short handle and a scoop blade"], ["soil", "other tools"])

ids = [a["id"] for a in assets]
assert len(ids) == len(set(ids))
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets: (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
from collections import Counter
print(len(assets), "assets", dict(Counter(a["group"] for a in assets)))
