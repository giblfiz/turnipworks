#!/usr/bin/env python3
"""Market & village (2026-10-11): every NEW mesh the type wants. Writes assets.json (+ prompts/) in the yard / mansion
format for src/plate_gate_batch.py. Nothing here calls an image model.

    python3 build_spec.py

THE SHOP SKELETON. A shop is five roles: counter-shop, shop-shelf-stocked (two shapes), craft-display-table-goods,
shop-floor-stock, shop-sign. A TRADE is a sku tier on those roles (TRADES below): its meshes are those five roles
loaded with its stock, plus one or two signature pieces of its own. From the table camera a shop is told from another by
the colour and the silhouette of its stock, so each trade has ONE colour story and a few BIG things, not many small ones.

Groups: p1 / p2 / p3 independent; sib1 painted from an accepted p1 plate (or an older batch's plate), sib2 from a p2 plate.
Extra fields (the runner ignores them): prio, rooms, bench, hung, light, tier, kit, opening, parent.
"""
import json
from collections import Counter
from spec_lib import *  # noqa: F401,F403  (add, twin, roles, STYLE_REF, NOBLUE, UNLIT, DRY, HERE, MAIN, assets ...)
import spec_lib

SHOPS = ["mkt-general", "mkt-bakery", "mkt-apothecary", "mkt-tailor", "mkt-curio"]
STOUT = (" Built CHUNKY for a tabletop miniature: every post, leg, rail and pole is a THICK square or round timber at least as thick as a man's arm;"
         " nothing thin, no wire, no string, no chains, no dangling loose parts; cloth is thick, stiff and painted as one solid smooth mass.")
BIG = " The goods are FEW and BIG, packed tight against each other as solid masses (no tiny scattered items, nothing floating, nothing hanging free)."

# ---------------------------------------------------------------------------------------------------------------
# the trades: tier, colour story, and what the stock IS, in the words the prompts use
TRADES = {
 "general": dict(tier="mkt-general", room="mkt-general",
    colours="warm honey wood, ochre sacking, burnt-orange clay and dull tin grey, with one or two red-and-cream striped things",
    stock="plump tied sacks, round clay jars with lids, a coil of thick rope, a stout tin lantern, stacked buckets, folded blankets and a wheel of cheese",
    what="a village general store"),
 "bakery": dict(tier="mkt-bakery", room="mkt-bakery",
    colours="golden-brown crusts, pale cream flour and honey wicker",
    stock="big round golden loaves, long loaves standing in baskets, braided bread, a tray of buns and a tall iced cake",
    what="a bakery"),
 "apoth": dict(tier="mkt-apoth", room="mkt-apothecary",
    colours="moss-green and amber glass (painted opaque), cream ceramic jars with ochre bands, and bunches of grey-green dried herbs",
    stock="rows of fat stoppered bottles in green and amber, squat cream apothecary jars with lids, a big wicker-wrapped green carboy, thick bundles of dried herbs, and a heavy stone mortar",
    what="an apothecary's shop"),
 "tailor": dict(tier="mkt-tailor", room="mkt-tailor",
    colours="strong cloth colours side by side: burgundy red, ochre yellow, moss green, cream and plum",
    stock="thick rolled bolts of cloth in burgundy, ochre, moss green, cream and plum, stacks of folded cloth, fat spools of ribbon and a round hat on a block",
    what="a tailor and draper's shop"),
 "curio": dict(tier="mkt-curio", room="mkt-curio",
    colours="deep plum-purple velvet and old gold, with pale bone, a magenta crystal and a green crystal",
    stock="a big crystal ball on a gold claw stand, a pale animal skull with horns, chunky magenta and green crystal clusters, a carved wooden mask, a brass globe of rings, fat scroll cases with gold caps and a small iron-bound casket",
    what="a magic and curio shop"),
}

for key, T in TRADES.items():
    tier, room = T["tier"], T["room"]
    # the counter: the shop's focal piece, seen from above more than anything else in the room
    add(f"counter-shop--{key}", "counter-shop", "p1", 1, [room], f"the shop counter of {T['what']}",
        f"A sturdy shop counter of warm honey-brown wood, a long solid box about 6 ft long, 2 ft deep and waist high, with a thick overhanging plank top and three plain"
        f" raised panels on its front. The LEFT two thirds of the top is loaded with the shop's goods: {T['stock']}. The right third of the top is clear, bare polished wood"
        f" (where a customer is served). Colours of the goods: {T['colours']}." + BIG + STOUT,
        f"a long wooden shop counter with a pile of shop goods on one end of its top ({T['what']})",
        ["one long waist-high counter", "goods standing on its top"], ["a person", "a second piece of furniture"],
        size=(72, 26, 52), tier=tier)
    # the shelf unit: stands with its back to a wall. The TOP of the unit carries the tallest things: that is what the table camera sees
    add(f"shop-shelf-stocked--{key}", "shop-shelf-stocked", "p1", 1, [room, "mkt-backroom"], f"a tall shop shelf unit crammed with the stock of {T['what']}",
        f"A tall freestanding shelf unit of warm honey-brown wood with a SOLID plank back and solid plank sides, about 5 ft wide, 1.5 ft deep and 6.5 ft tall, with three THICK shelves."
        f" Every shelf is full, edge to edge, and MORE goods stand on the flat top of the unit: {T['stock']}. Colours: {T['colours']}."
        f" The goods fill each shelf as a tight row, big enough that a shelf holds only four or five things." + BIG + STOUT,
        f"a tall wooden shelf unit full of shop goods ({T['what']})",
        ["one tall upright shelf unit with a solid back", "every shelf full of goods"], ["empty shelves", "a person", "books filling the shelves" if key != "curio" else "a person standing"],
        tier=tier)
    add(f"shop-shelf-stocked--{key}--s2", "shop-shelf-stocked", "sib1", 2, [room, "mkt-backroom"], f"a second, lower shelf unit for {T['what']}",
        f"A LOWER, WIDER unit from the same shop: about 5 ft wide, 1.5 ft deep and only 4.5 ft tall, a solid-backed dresser with ONE cupboard base (two plain plank doors) and TWO open"
        f" shelves above it, the flat top crowded with the biggest goods. The stock is the same kind as in the supplied image: {T['stock']}." + BIG + STOUT,
        f"a chest-high wooden shelf unit with a cupboard base, full of shop goods ({T['what']})",
        ["one shelf unit with a solid back, lower than a person", "goods on its shelves and on its top"], ["empty shelves", "a person"],
        size=(60, 18, 56), parent=f"shop-shelf-stocked--{key}", what="shop shelf unit and its stock", match="same", tier=tier)
    add(f"craft-display-table-goods--{key}", "craft-display-table-goods", "p2", 2, [room, "mkt-square"], f"a display table of goods for {T['what']}",
        f"A low, sturdy trestle display table, about 6 ft long, 2.5 ft deep and 2.5 ft high, on two THICK plank trestle ends, its whole top covered by a thick cloth that hangs a hand's width"
        f" over the edges, and heaped from end to end with: {T['stock']}. Seen from above the table top is almost hidden by the goods. Colours: {T['colours']}." + BIG + STOUT,
        f"a low table completely covered with shop goods ({T['what']})",
        ["one low table", "its top covered with goods"], ["a person", "a canopy or awning over the table"],
        size=(72, 30, 44), tier=tier)
    floor = {
     "general": "A stout open half-barrel, hooped with two thick iron bands, packed full: three plump tied sacks standing in it, a thick coil of rope hung over its rim, a tin lantern and two short-handled brooms with fat bristle heads standing upright in the middle.",
     "bakery": "A big round honey-coloured wicker basket, knee high and as wide as a barrel, heaped high with long golden loaves standing on end and big round loaves on top, a cream linen cloth folded over one side of the rim.",
     "apoth": "A big moss-green glass carboy (painted opaque) in a thick wicker jacket with a fat cork, standing in a shallow wooden crate beside two squat cream lidded jars and a thick sheaf of grey-green dried herbs tied with cord.",
     "tailor": "A tall open wicker hamper with a dozen thick rolled bolts of cloth standing upright in it like logs, their ends showing as spirals: burgundy, ochre, moss green, cream and plum.",
     "curio": "A small open iron-bound travelling chest, its lid thrown back, lined with plum-purple velvet and filled to the brim: fat scroll cases with gold caps, a pale horned animal skull, a chunky magenta crystal cluster and a green one, a carved wooden mask leaning against the lid.",
    }[key]
    add(f"shop-floor-stock--{key}", "shop-floor-stock", "p2", 3, [room, "mkt-backroom", "mkt-square"], f"goods standing on the floor of {T['what']}",
        floor + f" Colours: {T['colours']}. About 2.5 ft across and 3 ft tall." + BIG + STOUT,
        f"one container of shop goods standing on the floor ({T['what']})", ["one container full of goods"], ["a person", "a table or shelf"], tier=tier)

SIGNS = {
 "general": ("a plump tied sack with a lantern beside it", "a sack and a lantern"),
 "apoth": ("a fat round-bodied bottle with a stopper and a sprig of three leaves", "a bottle"),
 "tailor": ("a big pair of shears, open in an X, over a spool of thread", "a pair of shears"),
 "curio": ("a wide-open eye inside a five-pointed star", "an eye in a star"),
}
for key, (emblem, short) in SIGNS.items():
    T = TRADES[key]
    add(f"shop-sign--{key}", "shop-sign", "p3", 3, [T["room"], "mkt-street"], f"a hanging shop sign for {T['what']}",
        f"A hanging shop sign: a THICK shield-shaped wooden board, about 2 ft across and as thick as a fist, hanging directly under a stout square timber bracket arm (the board is joined to the arm"
        f" by two fat iron straps, no chains). The arm ends in a flat square wall plate. Carved in deep relief and painted on BOTH faces of the board, with no lettering at all: {emblem}."
        f" The board is painted cream with a burgundy border; the carving is picked out in ochre and moss green." + STOUT,
        f"a hanging wooden shop sign on a bracket, carved with {short}, no writing", ["one sign board hanging from a bracket arm"], ["letters, words or numbers", "chains", "a post standing on the ground"],
        hung=True, tier=T["tier"])

# ---- signature pieces, one or two a trade (bakery: the inn's oven, bread rack and dough trough already exist) ----
add("bins-dry-goods", "bins-dry-goods", "p1", 1, ["mkt-general"], "a row of open dry-goods bins",
    "A grocer's bin unit of warm honey-brown wood, about 5 ft long, 2 ft deep and 2.5 ft high: FOUR big open-topped square bins side by side in one frame, each with a forward-sloping front,"
    " each heaped full of a different dry good: pale cream flour, ochre grain, red-brown beans and dark green-grey lentils. A stout wooden scoop stands in the grain." + STOUT,
    "a low wooden unit of four open bins, each heaped with a different coloured dry food", ["a row of open bins in one piece of furniture", "the bins are full"], ["lids closed over the bins", "a person"], tier="mkt-general")
add("apothecary-drawers", "apothecary-drawers", "p1", 1, ["mkt-apothecary"], "an apothecary's cabinet of small drawers",
    "A tall apothecary cabinet of dark red-brown wood that stands against a wall, about 5 ft wide, 1 ft deep and 6 ft tall: the lower two thirds is a grid of SMALL SQUARE DRAWERS, six across and"
    " five high, each with one chunky round cream knob and a small blank cream label plate; above them one open shelf with a row of six fat cream apothecary jars with ochre bands and lids;"
    " on the flat top a big moss-green carboy and a bunch of dried herbs." + STOUT,
    "a tall dark wooden cabinet with a grid of many small square drawers and a row of jars above", ["a grid of many small drawers with knobs", "jars on a shelf or on top"], ["writing on the labels", "a person"], tier="mkt-apoth")
add("dress-form", "dress-form", "p1", 1, ["mkt-tailor"], "a tailor's dress form wearing a half-made gown",
    "A tailor's dress form: a padded cream-linen torso with NO head and NO arms (a flat wooden cap with a round knob where the neck would be), on ONE thick turned wooden post rising from a heavy"
    " round wooden foot. It wears a half-made burgundy-red gown with a full floor-length skirt painted as one solid bell-shaped mass, one ochre-yellow panel pinned on at the hip, and a cream"
    " measuring tape draped round the neck as a thick band." + STOUT,
    "a headless, armless tailor's dummy on a post wearing a red gown", ["a torso form with no head", "it wears a garment"], ["a head or a face", "arms or hands", "a real person"], size=(26, 26, 64), tier="mkt-tailor")
add("cutting-table-tailor", "cutting-table-tailor", "p2", 2, ["mkt-tailor"], "a tailor's cutting table",
    "A tailor's long cutting table, about 7 ft long, 3 ft deep and waist high, on four THICK square legs with a low shelf between them holding three fat rolled bolts of cloth (burgundy, ochre, moss green)."
    " On the top: a length of plum cloth unrolled across half the table from a thick bolt, a big pair of iron shears lying flat on it, a cream paper pattern piece and a fat round pincushion." + STOUT,
    "a long work table with rolls of coloured cloth on and under it and a big pair of shears", ["one long table", "rolls or lengths of coloured cloth on it"], ["a person", "a sewing machine"], tier="mkt-tailor")
add("display-case-glass--curio", "display-case-glass", "p1", 1, ["mkt-curio"], "a curio shop's display case",
    "A waist-high display case on four fat turned legs, about 4 ft long and 2 ft deep: a dark wood case with a sloping top of thick gold-edged panes (the panes are painted as opaque pale"
    " cream-gold glass with soft streaks, NOT blue and NOT see-through). ON TOP of the case, on a plum-purple velvet runner, stand its showpieces: a big crystal ball on a gold claw stand in the"
    " middle, a pale horned animal skull at one end and a chunky magenta crystal cluster at the other." + STOUT,
    "a waist-high display case with a crystal ball, a skull and a crystal standing on top of it", ["one display case on legs", "a crystal ball or orb on it"], ["a person", "blue glass"], size=(48, 24, 52), tier="mkt-curio")
add("scales-balance", "scales-balance", "p3", 3, SHOPS, "a merchant's balance scales",
    "A merchant's balance for a shop counter, made FAT and sturdy: a thick brass column on a heavy square wooden base, a short thick brass beam across the top, and two deep round brass pans that"
    " sit close under the beam ends on short solid brass yokes (thick curved arms, NOT chains or strings). One pan holds a heap of ochre grain, the other three stacked brass weights." + STOUT,
    "a brass balance scale with two pans on a wooden base", ["two pans, one each side of a central column"], ["chains or strings holding the pans", "a person"], size=(16, 8, 14))

# ---------------------------------------------------------------------------------------------------------------
# MARKET SQUARE. The stall is the unit: four thick posts, a striped canvas roof like a thick board, a solid counter
# heaped with one kind of goods, more of it at its feet. Each stall has its OWN awning colours: from above, the stripes
# are the market.
STALL = ("A covered market stall, about 8 ft wide, 5 ft deep and 8 ft tall. FOUR THICK square timber corner posts carry a pitched canvas roof painted as ONE thick, stiff, smooth slab with a"
         " scalloped front edge, in broad stripes of {stripes}. The roof covers the BACK two thirds of the stall; the front third is open to the sky. Between the posts a solid plank counter with a"
         " boarded front runs the full width, and it is heaped with {goods}. In front of the counter, on the ground and touching it, {front}. The back and sides of the stall are open." + BIG + STOUT)
STALLS = {
 "produce": ("burgundy red and cream", "crates and baskets of vegetables and fruit: orange carrots, green cabbages, red apples, yellow pears, purple turnips and a big orange pumpkin", "two slanted crates of apples and cabbages"),
 "bread": ("ochre yellow and cream", "golden loaves of every shape: big round loaves, long loaves standing in a basket, braided rings, a tray of buns and two pies", "a big wicker basket of long loaves"),
 "fish": ("moss green and cream", "silver-grey fish laid in overlapping rows on a slanted board, a heap of pink crabs, a tub of dark mussels and a string of smoked golden fish", "a half-barrel of silver fish and a round wicker creel"),
 "cloth": ("plum purple and ochre", "thick rolled bolts of cloth lying in a stack like logs (burgundy, ochre, moss green, cream), folded piles of cloth and one length draped over the counter front", "an upright hamper of standing bolts of cloth"),
 "pottery": ("burnt orange and cream", "fired pottery: big orange-brown jugs, cream glazed bowls stacked inside each other, a green glazed pitcher, round lidded crocks and a tall amphora", "a cluster of big clay pots and jugs standing on the ground"),
 "trinkets": ("burgundy red and moss green", "a pedlar's wares on a plum velvet cloth: brass lanterns, a stack of wide-brimmed hats, strings of fat beads laid in coils, carved wooden toys, a small mirror and candles in bundles", "an open chest of trinkets"),
}
for key, (stripes, goods, front) in STALLS.items():
    add(f"market-stall--{key}", "market-stall", "p1", 1, ["mkt-square"], f"a covered market stall selling {key}",
        STALL.format(stripes=stripes, goods=goods, front=front),
        f"a market stall with a striped canvas roof on four posts and a counter heaped with {key}", ["a striped cloth roof on posts", "a counter or table with goods on it"],
        ["a person", "wheels", "walls closing the stall in"], size=(96, 64, 96))
add("market-cross", "market-cross", "p1", 1, ["mkt-square"], "a carved stone market cross",
    "A town's market cross: a monument of weathered warm grey limestone with ochre lichen. THREE wide octagonal stone steps (the real base of the monument) carry a thick octagonal shaft about"
    " 8 ft tall, banded once in the middle, with a carved lantern-shaped head at the top: four small arched niches under a short pointed stone cap with a ball finial. Deep, simple carving; the"
    " shaft is as thick as a tree trunk. About 5 ft across the bottom step and 12 ft tall in all.",
    "a tall stone monument: a thick shaft with a carved head, standing on wide stone steps", ["a tall stone shaft on steps", "a carved head or cap at the top"], ["a statue of a person", "water", "thin cross arms"],
    size=(60, 60, 144), base=False)
add("pump-trough-village", "pump-trough-village", "p2", 2, ["mkt-square", "mkt-street"], "a village pump and stone trough",
    "A village water pump: a THICK square oak post about 5 ft tall with a pointed lead cap, a fat curved iron spout on its front and a stout iron pump handle on its side (a thick bar close to the"
    " post). It stands at the end of a long rectangular stone trough about 6 ft long and knee high, of warm grey stone with thick walls." + DRY.replace("basin", "trough").replace("bowl", "trough") + STOUT,
    "a wooden pump post with a spout standing at the end of a long empty stone trough", ["a long stone trough", "an upright pump post with a spout at one end"], ["water or blue colour in the trough", "an animal"],
    size=(72, 26, 60), bench=["water"])
add("town-crier-platform", "town-crier-platform", "p2", 2, ["mkt-square"], "a town crier's platform with a bell",
    "A town crier's stand: a small square wooden platform about 3 ft across and knee high, boarded in on all four sides with a burgundy-painted panel on each side, two thick steps up at the front,"
    " and at one back corner a THICK square post about 6 ft tall with a short stout arm carrying one big brass handbell (the bell hangs directly under the arm on a fat iron staple, mouth down)." + STOUT,
    "a small boxed-in wooden platform with steps and a post carrying a bell", ["a low platform with steps", "a bell on a post"], ["a person", "a roof"], size=(42, 42, 76))
add("pottery-for-sale", "pottery-for-sale", "p2", 2, ["mkt-square", "mkt-general", "mkt-backroom"], "a ground display of pottery for sale",
    "A potter's ground display: about a dozen fired pots standing TIGHT together on a thick square of ochre straw matting (the mat is part of the display): two big orange-brown storage jars,"
    " a tall amphora, a green glazed pitcher, cream bowls stacked in two piles, three round lidded crocks and a row of small cups. The pots touch each other in one close cluster." + STOUT,
    "a tight cluster of clay pots, jars and bowls standing together on a straw mat", ["many pots and jars in one cluster"], ["a table or shelf", "a person", "broken pots"], size=(42, 36, 30), base=False)
add("rug-merchant-stack", "rug-merchant-stack", "p3", 3, ["mkt-square", "mkt-backroom"], "a rug merchant's stack",
    "A rug merchant's stock: a thick stack of eight folded carpets lying flat on top of each other, each a different colour and bold woven pattern (burgundy with ochre diamonds, moss green with"
    " cream borders, plum with gold medallions), with three thick ROLLED carpets leaning upright against one end of the stack like fat logs. The cloth is painted smooth as one flat solid surface, no fringe.",
    "a stack of folded patterned carpets with rolled carpets standing beside it", ["a stack of folded patterned textiles"], ["a person", "loose thin fringe", "a table"], size=(52, 38, 44))
add("spice-sacks-open", "spice-sacks-open", "p2", 2, ["mkt-square", "mkt-general", "mkt-apothecary"], "open sacks of bright spices",
    "A spice seller's sacks: FIVE fat open-mouthed sacks of ochre sacking standing shoulder to shoulder in a tight cluster, their tops rolled down in thick collars, each heaped to a cone with a"
    " different bright powder: golden-yellow turmeric, brick-red paprika, burnt orange, dark brown cinnamon and moss green dried herb. A stout wooden scoop stands in the yellow one.",
    "a cluster of open sacks, each heaped with a different brightly coloured powder", ["several open sacks touching each other", "each holds a different colour"], ["a person", "a table"], size=(42, 30, 24))
add("fish-barrel-salted", "fish-barrel-salted", "p3", 3, ["mkt-square", "mkt-backroom"], "an open barrel of salted fish",
    "A stout open barrel of grey-brown weathered oak with three thick iron hoops, no lid, packed to the brim with silver-grey fish laid in a tight ring, tails to the middle, crusted with coarse"
    " white salt. Two more fish lie over the rim.",
    "an open wooden barrel packed full of silver fish", ["an open barrel", "fish filling it"], ["a lid closing the barrel", "water in the barrel"], size=(26, 26, 36))
add("cart-merchant-covered", "cart-merchant-covered", "p2", 2, ["mkt-square", "mkt-street"], "a pedlar's covered cart",
    "A pedlar's covered cart: a boxy two-wheeled wooden cart about 9 ft long with two BIG thick solid plank wheels (no thin spokes: each wheel is a solid disc with a fat hub), a body of burgundy-painted"
    " planks, and an arched canvas tilt over it painted as one thick smooth cream-and-ochre striped shell, open at the back to show sacks, a barrel and bundles packed inside. Two thick shafts at"
    " the front rest on a stout prop leg. Pots and a lantern are fixed tight against its side (touching the planks, not dangling)." + STOUT,
    "a two-wheeled covered wooden cart with a canvas top, loaded with goods, no animal", ["a cart with two wheels", "an arched cloth cover over it"], ["a horse or other animal", "a person", "four wheels"], size=(60, 108, 84))
add("flower-buckets", "flower-buckets", "p2", 2, ["mkt-square", "mkt-street"], "a flower seller's tubs of flowers",
    "A flower seller's display: FIVE stout wooden tubs and tin pails standing tight together in two stepped rows on a low two-step plank stand, each tub filled with ONE dense dome of flowers in a"
    " single colour: burgundy roses, ochre-yellow sunflowers, white daisies, pink peonies, orange marigolds, with a collar of moss-green leaves under each dome." + LEAFY,
    "several tubs of cut flowers, each a different colour, standing together on a low stand", ["several tubs or pails of flowers in one cluster"], ["blue flowers", "a person", "a single potted plant"], size=(44, 30, 34), leafy=False)
add("awning--s1", "awning", "p2", 2, ["mkt-street", "mkt-square"], "a striped shop awning",
    "A shop-front awning that fixes to a wall: a sloping canopy about 6 ft wide that projects 3 ft from the wall, painted as ONE thick, stiff, smooth slab of canvas in broad stripes of burgundy red"
    " and cream, with a thick scalloped valance along its front edge. It is carried on a stout timber frame: a square wall rail along the back and two THICK diagonal timber brackets, one under each"
    " end, coming back to the wall. Seen from slightly above so the striped top is the main thing in the picture." + STOUT,
    "a striped cloth shop awning on two timber brackets, with nothing under it", ["a sloping striped canopy", "brackets or a frame holding it"], ["a wall, door or window behind it", "posts standing on the ground", "a market stall counter"],
    size=(72, 38, 28), hung=True)
add("awning--s2", "awning", "sib2", 3, ["mkt-street", "mkt-square"], "a second shop awning in other colours",
    "The same awning on the same frame, in other colours: broad stripes of moss green and ochre yellow, and its front valance is cut straight with a thick rolled hem instead of scallops.",
    "a green and yellow striped cloth shop awning on two timber brackets", ["a sloping striped canopy"], ["a wall, door or window behind it", "posts standing on the ground"],
    size=(72, 38, 28), parent="awning--s1", what="shop awning", match="same", hung=True)
# (the "same" helper's gate line asks for the reference's COLOURS; this piece is the same awning in other colours: the gate
# refused two good plates for being green and yellow, 2026-10-11)
spec_lib.assets[-1]["gate"]["must"] = ["a sloping striped canopy", "the same shape and timber frame as the REFERENCE awning (the stripe colours are the intended difference)"]

# ---------------------------------------------------------------------------------------------------------------
# TOWN STREET
add("lamp-post-iron--town", "lamp-post-iron", "p2", 2, ["mkt-street", "mkt-square"], "an iron street lamp post",
    "A town street lamp, built CHUNKY: a THICK dark green-black iron column, as thick as a man's leg, on a wider moulded base that ends in a flat cut at the bottom, with a short thick cross bar"
    " (a ladder rest) near the top, carrying ONE big six-sided lantern with a pointed cap and a ball finial; the lantern's panes are opaque frosted glass painted pale cream-ochre (NOT blue, NOT"
    " see-through). UNLIT: NO flame, NO glow. About 9 ft tall.",
    "a tall dark iron lamp post with one lantern on top", ["one upright column", "one lantern at the top, not glowing"], ["flames or glow", "blue glass", "several lantern arms"],
    size=(18, 18, 108), bench=["fire"], light="lantern")
add("bollard-stone", "bollard-stone", "p3", 3, ["mkt-street", "mkt-square"], "a stone street bollard",
    "A stone street bollard: a short, fat post of warm grey granite about knee to thigh high, round in section, slightly wider at the bottom, with a domed top and one thick carved band below the"
    " dome; worn smooth and a little chipped, with ochre lichen low on one side. It ends in a flat cut at the bottom.",
    "a short fat stone post with a rounded top", ["one short stone post"], ["a chain", "a base slab"], size=(14, 14, 30))

# ---------------------------------------------------------------------------------------------------------------
# WATCH POST. The lockup is the read: a timber pen in a corner of an ordinary room.
add("watch-desk", "watch-desk", "p1", 1, ["mkt-watch"], "a watch sergeant's desk",
    "A watch sergeant's desk: a heavy plain oak desk about 4 ft wide with a boarded front and two drawers, iron-strapped at the corners. On top: a big open logbook with cream pages and a"
    " burgundy cover, a fat iron ring of big keys, an open-faced iron helmet resting at one end, a short wooden truncheon and a stout unlit tin lantern. A shield-shaped wooden badge board painted"
    " burgundy and ochre in two halves (no emblem, no letters) is fixed to the front of the desk." + STOUT,
    "a heavy wooden desk with an open book, a ring of keys and a helmet on it", ["one desk", "an open book and keys on it"], ["a person", "writing that can be read"], size=(52, 30, 44))
KITW = (" ONE single straight section standing upright, a tall panel about 5 ft wide x 8 ft tall x half a foot thick. Nothing else: NO floor, NO ground, NO base slab under it, NO ceiling,"
        " NO corner return. Both side edges are clean flat vertical cuts (a thick square post at each edge), so that copies placed side by side make one continuous run. Where there are gaps"
        " between the bars the blue background shows through them. Keep the WHOLE object well inside the frame with a generous margin.")
add("cell-holding-wood", "cell-holding-wood", "p1", 1, ["mkt-watch"], "a section of a timber lockup wall",
    "One section of a village lockup's wall, all of heavy grey-brown oak: a thick sill beam along the bottom, a thick head beam along the top, a thick square post at each side, and between them"
    " FIVE fat square upright timber bars, each as thick as a man's forearm, with gaps between them about as wide as the bars. One thick horizontal rail crosses the bars at waist height, and a"
    " broad iron strap is nailed across each end of it. Seen from the front at a slight three-quarter angle." + KITW,
    "a tall panel of thick wooden bars in a heavy timber frame, like the wall of a cage or lockup", ["upright wooden bars with gaps between them", "a heavy frame round them"], ["a door", "iron bars", "a floor or base"],
    size=(60, 8, 96), kit="wall", opening="panel")
add("cell-holding-wood--gate", "cell-holding-wood", "sib1", 1, ["mkt-watch"], "the lockup wall section with its door",
    "The same lockup wall section, with a DOOR in it: the middle three bars and their rail are a separate door leaf inside the frame, with its own thick timber frame, two fat iron strap hinges on"
    " one side and a big square iron lock box with a heavy hasp and padlock on the other. The door is SHUT and sits flush in the frame. Everything else is as in the supplied image." + KITW,
    "a panel of thick wooden bars with a barred door in it, hinges on one side and a big padlock on the other", ["upright wooden bars", "a door with hinges and a lock"], ["an open door", "a floor or base"],
    size=(60, 8, 96), parent="cell-holding-wood", what="timber lockup wall", match="kit", kit="wall", opening="panel", bench=["hinge"])

# ---------------------------------------------------------------------------------------------------------------
# TOWN HOUSE: the two things that say "somebody lives here"
add("cradle", "cradle", "p2", 2, ["mkt-house", "mkt-bedroom"], "a wooden rocking cradle",
    "A wooden rocking cradle of warm honey oak: a deep boarded box with a raised hooded end, on two THICK curved rockers, with a heart shape cut out of each end board. Inside, a cream pillow and"
    " a quilt of burgundy and ochre squares tucked flat (no baby)." + STOUT,
    "a wooden baby's cradle on two rockers with a quilt inside, empty", ["a small boxed bed on curved rockers"], ["a baby or doll", "a person"], size=(36, 20, 30))
add("spinning-wheel", "spinning-wheel", "p2", 2, ["mkt-house", "mkt-tailor"], "a spinning wheel",
    "A spinning wheel made THICK and toy-like: one big wheel that is nearly a SOLID wooden disc (a fat rim, a fat hub and only FOUR very thick spokes, the gaps between them small), standing upright"
    " on a heavy slanted plank bench with three fat splayed legs, with a thick upright post at the other end carrying a fat distaff wrapped in a big cream ball of wool. A wide foot treadle board"
    " under the bench. No thread, cord or string anywhere." + STOUT,
    "a wooden spinning wheel: a big upright wheel on a low bench with a bundle of wool on a post", ["one large upright wheel", "a low bench or stand it is fixed to"], ["thin thread or string", "a person", "a cart wheel lying flat"], size=(40, 20, 44))

# ---------------------------------------------------------------------------------------------------------------
# WALL KIT: the half-timber family exists (2026-10-01: one wall section, one small window, its open twin). It lacked a
# second wall shape, a doorway and a shop window (its own kit role, wall-window-shop: a PANEL on a shop's street wall,
# so no other half-timbered room rolls it as a window). All three are painted from the accepted plate of the existing wall.
HT = str(MAIN / "experiments/2026-10-01-walls/inputs/wall-straight--half-timber.jpg")
WSTYLE = """Geometry: stout, miniature-compatible proportions; thick timbers and glazing bars; broad soft bevels; sturdy construction that could survive as a printed tabletop piece. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Avoid: invented handles, ring pulls, levers, knobs, hooks or pegs sticking out of the wall; pictures, mirrors, lamps, curtains or furniture on the wall; multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, fine scratches, tiny wood pores, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, logos, emblems.

Presentation for image-to-3D: exactly one complete asset, centered, seen from the front at a slight three-quarter angle from slightly above (the same camera as the supplied image), clear space around every edge, perfectly uniform solid chroma-blue background, no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. The blue background is a removable mask and must not reflect blue light onto the asset; the wall itself has NO blue anywhere; where the wall has a real hole, the blue background shows through it."""
WTAIL = (" ONE single straight wall section standing upright, a TALL, NARROW panel about 5 ft wide x 9 ft tall x 1 ft thick: almost TWICE as tall as it is wide, it must NOT be square."
         " Nothing else: NO floor, NO ground, NO base slab or platform under it, NO ceiling, NO roof, NO corner return, NO furniture or decorations attached."
         " Both side edges are clean flat vertical cuts with nothing sticking out past them, so that copies placed side by side make one continuous wall."
         " Keep the WHOLE object well inside the frame with a generous margin.")


def wall(sku, obj, group, prio, subject, design, desc, must, must_not=(), **extra):
    intro = (f"Create a new single asset in the Turnip Works house style (heroic hand-painted): {subject}.\n\n"
             "The supplied image is the existing plain wall section of this same half-timbered building. The new piece must look cut from the same wall: the SAME dark oak timbers and"
             " cream daub panels, the same timber thickness, the same overall size and proportions, painting style and camera angle. Change ONLY what is described below.")
    prompt = f"{intro}\n\n{WSTYLE}\n\nSpecific design: {design}{WTAIL}\n"
    must = list(must) + ["dark timbers and pale plaster panels match the REFERENCE wall (the described change is the intended difference)"]
    spec_lib.base_record(sku, obj, group, prio, SHOPS + ["mkt-house", "mkt-bedroom", "mkt-backroom", "mkt-passage"], subject, (60, 12, 108), prompt, [HT], [HT], desc, must,
                         list(must_not) + ["a floor, base slab, ceiling or corner return", "a picture, lamp, curtain or furniture on the wall"], {"parent": "wall-straight--half-timber", "kit": "wall", **extra})


wall("wall-straight--half-timber--s2", "wall-straight", "sib1", 1, "a second half-timbered wall section",
     "The timber frame is laid out differently: the two edge posts, a sill beam along the bottom and a head beam along the top as before, but ONE horizontal rail at half height and, in the upper"
     " half only, TWO short curved braces rising from the posts to the head beam (a shallow arch). The lower half is two plain cream daub panels divided by one short central stud. No diagonal brace across the lower half.",
     "a tall half-timbered wall panel: dark timber frame with curved braces and cream plaster panels", ["a dark timber frame with pale plaster between", "taller than it is wide"], ["a window or door"], opening="solid")
wall("wall-doorway--half-timber", "wall-doorway", "sib1", 1, "the half-timbered wall section with a doorway",
     "A DOORWAY in the middle of the section: an EMPTY rectangular opening about 3.5 ft wide and 7 ft tall, starting at the very bottom edge of the wall (no sill, no threshold, no step),"
     " framed by two thick dark oak door posts and a thick oak lintel. The opening is a real hole right through the wall: the blue background shows through it. There is NO door leaf in it."
     " A narrow strip of cream daub each side of the door posts and a cream daub panel above the lintel up to the head beam.",
     "a tall half-timbered wall panel with an empty doorway through it", ["an empty door opening that reaches the bottom edge", "a dark timber frame round the opening"], ["a door leaf in the opening", "a window"], opening="door")
wall("wall-window-shop--half-timber", "wall-window-shop", "sib1", 1, "the half-timbered wall section with a wide shop window",
     "A SHOP WINDOW fills the middle of the section between the two edge posts: a wide display window about 4 ft wide and 3.5 ft tall whose sill is at waist height, of THICK dark oak glazing"
     " bars making a grid of small square panes, four across and three high; the panes are opaque bottle glass painted warm cream-amber with a soft round swirl in each (NOT blue, NOT"
     " see-through). Under it a deep oak sill shelf projects a hand's width, carried on two fat carved brackets. Below the sill, plain cream daub with one short stud; above the window, the head beam.",
     "a tall half-timbered wall panel with a wide many-paned shop window", ["a wide window divided into many small panes", "dark timber frame and pale plaster"], ["a door", "blue or see-through glass", "goods or objects on the sill"], opening="window")

# ---------------------------------------------------------------------------------------------------------------
A = spec_lib.assets
ids = [a["id"] for a in A]
assert len(ids) == len(set(ids)), [i for i, n in Counter(ids).items() if n > 1]
by = {a["id"]: a for a in A}
for a in A:
    assert a["object"] in roles and roles[a["object"]].get("size"), a["id"]
    assert a["group"] in ("p1", "p2", "p3", "sib1", "sib2"), a["id"]
    if a["group"].startswith("sib") and a["parent"] in by:
        pg = by[a["parent"]]["group"]
        assert (a["group"] == "sib1" and pg == "p1") or (a["group"] == "sib2" and pg in ("p2", "sib1")), (a["id"], a["group"], a["parent"], pg)
    if a.get("light"):
        assert "UNLIT" in a["prompt"], a["id"]
    assert " blue " not in a["prompt"].split("Specific design:")[1].replace("NOT blue", "").replace("NO blue", "").replace("chroma blue", "").replace("the blue background", "").replace("or blue colour", "").replace("blue flowers", "").replace("(no blue cloth", ""), a["id"]
(HERE / "assets.json").write_text(json.dumps({"assets": A}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in A:
    (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(A), "assets", "groups", dict(sorted(Counter(a["group"] for a in A).items())), "prio", dict(sorted(Counter(a["prio"] for a in A).items())))
print("bench", dict(Counter(b for a in A for b in a["bench"])), "hung", sum(1 for a in A if a.get("hung")), "lights", sum(1 for a in A if a.get("light")),
      "tiers", dict(Counter(a.get("tier", "-") for a in A)), "roles", len({a["object"] for a in A}))
