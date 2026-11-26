#!/usr/bin/env python3
"""India (IND), anchored on the Jaipur-Amber region of Rajasthan in the 18th century: a Hindu merchant's haveli, a Rajput
palace hall, a Shiva temple's pillared hall (mandapa), a bazaar shop and a stepwell (baori).
python3 spec_ind.py [--catalog] -> ind/assets.json, prompts/, the catalog file.
Sensitivity read (codex, 2026-11-06) applied: the kitchen is a HOUSEHOLD kitchen (grain, pulses and flour stored, a
clay stove, brass and copper), not an exotic 'spice kitchen'; the bazaar shop is a grain-and-spice merchant whose goods
lie in baskets and bins (heaps only in the baskets); the tulsi planter marks a Hindu household and stands with dignity in
its courtyard's centre; the temple is named a SHIVA temple: Nandi faces the sanctum on the worship axis, the sanctum is
shown SCREENED (its curtain drawn), no image of the deity is shown; the stepwell is a documented baori form (stairs
and landings descending on three sides to the water, a pillared gallery on the fourth); the haveli and palace have the
projecting jharokha window; the temple has its own carved stone wall family."""
from spec_lib import *  # noqa: F401,F403

I = "IND"
kit("wall-straight--ind-lime", "wall-straight", "a straight wall section of a Rajasthani haveli",
    "ONE straight wall section of an 18th-century Rajasthani haveli: smooth thick LIME PLASTER washed warm ivory-white, with a painted dado band along the"
    " bottom 2 ft in soft red ochre with a border of small painted flowers, and a painted frieze band along the top of twining green-and-ochre leaves; the"
    " corners softly rounded. (Painted bands only: no figures, no writing.) It is a PLAIN SOLID wall: NO window, NO jali or lattice, NO niche, NO arch, NO carved panel, NO opening of any kind.", "a white lime-plaster wall with painted red and ochre floral bands",
    ["white plaster", "painted coloured bands top and bottom"], ["a door opening", "brick", "timber framing"])
kit("wall-straight--ind-lime--s2", "wall-straight", "a haveli wall section with an arched niche",
    "The same wall section, the same plaster and painted bands, with ONE small recessed NICHE in its middle at chest height: a pointed cusped arch outline"
    " about 18 in wide and 2 ft tall, cut into the wall, its back painted soft red ochre, EMPTY.", "a white plaster wall with an empty arched niche",
    ["a small arched niche in a plaster wall"], ["a door opening", "a window"], parent="wall-straight--ind-lime", what="a Rajasthani haveli wall of painted lime plaster")
kit("wall-doorway--ind-lime", "wall-doorway", "a haveli wall section with an empty arched doorway",
    "The same wall section with an EMPTY door opening through it from the very bottom: about 3.5 ft wide and 7 ft tall, centred, its top a CUSPED ARCH"
    " (a pointed arch with small rounded lobes), framed by a raised painted border in red ochre; a low stone threshold. NO door. You can see straight through it.",
    "a white plaster wall with an empty cusped-arch doorway", ["an empty arched doorway"], ["a door leaf in the opening"], parent="wall-straight--ind-lime", what="a Rajasthani haveli wall of painted lime plaster")
kit("wall-window-small--ind-lime", "wall-window-small", "a haveli wall section with a projecting jharokha balcony window",
    "The same wall section with ONE JHAROKHA in its middle at about 4 ft up: a small balcony window that PROJECTS about 18 in out from the wall face, carried"
    " on two carved stone brackets, with a low carved parapet, two slim pillars holding a small curved (bangaldar) roof with a deep overhang, and behind"
    " them a dark window opening. Carved in pale sandstone, set in the white plaster wall.", "a white wall with a small projecting balcony window under a curved little roof",
    ["a projecting balcony window", "a little curved roof over it"], ["a door opening", "glass panes"], parent="wall-straight--ind-lime", what="a Rajasthani haveli wall of painted lime plaster")
kit("wall-straight--ind-sandstone", "wall-straight", "a straight wall section of a Rajput palace hall",
    "ONE straight wall section of an 18th-century Rajput palace hall: smooth dressed RED SANDSTONE blocks with fine joints, a moulded plinth along the bottom,"
    " a carved cornice along the top, and in the middle of the wall a shallow BLIND ARCH panel: a tall CUSPED (multifoil) arch outline carved in relief, its"
    " recessed field plain.", "a red sandstone wall with a carved multifoil arch panel", ["red sandstone", "a carved cusped arch panel"], ["a door opening", "white plaster"])
kit("wall-doorway--ind-sandstone", "wall-doorway", "a Rajput palace wall section with an empty multifoil arched doorway",
    "The same red sandstone wall section with an EMPTY opening through it from the very bottom: about 4 ft wide and 7.5 ft tall, centred, its top a CUSPED"
    " MULTIFOIL arch of many rounded lobes, framed by a carved moulding. NO door. You can see straight through it.", "a red sandstone wall with an empty multifoil-arched doorway",
    ["an empty multifoil arched doorway in red sandstone"], ["a door leaf in the opening"], parent="wall-straight--ind-sandstone", what="a Rajput palace wall of red sandstone")
kit("wall-window-small--ind-sandstone", "wall-window-small", "a Rajput palace wall section with a jali screen window",
    "The same red sandstone wall section with ONE window in its middle at chest height: a tall arched opening about 2.5 ft wide filled by a JALI, a thick"
    " slab of red sandstone pierced right through in a bold geometric lattice of hexagons and stars, so you can see the background through its holes.",
    "a red sandstone wall with a pierced stone lattice window", ["a pierced stone lattice window"], ["glass panes", "a door opening"], parent="wall-straight--ind-sandstone", what="a Rajput palace wall of red sandstone")
kit("wall-straight--ind-temple", "wall-straight", "a straight wall section of a Nagara Hindu temple hall",
    "ONE straight wall section of an 18th-century north-Indian (Nagara) temple hall in pale golden-buff SANDSTONE: the whole face carved in horizontal"
    " BANDS of mouldings from bottom to top: a stepped plinth, a band of rounded cushion mouldings, a band of carved lotus petals, a band of small square"
    " carved panels with rosettes, plain ashlar, and at the top a band of small pointed niche outlines; a slim carved pilaster at each side edge. Geometric and"
    " floral carving only: no figures.", "a golden sandstone temple wall carved in horizontal bands of mouldings", ["golden sandstone", "horizontal carved bands"],
    ["a door opening", "red sandstone", "figures or statues"])
kit("wall-doorway--ind-temple", "wall-doorway", "a Nagara temple hall wall section with an empty doorway",
    "The same golden sandstone temple wall section with an EMPTY opening through it from the very bottom: about 4 ft wide and 7 ft tall, rectangular,"
    " framed by several stepped carved door jambs and a carved lintel; a raised stone threshold. NO door. You can see straight through it.",
    "a carved golden sandstone wall with an empty doorway", ["an empty doorway with carved stepped jambs"], ["a door leaf in the opening"], parent="wall-straight--ind-temple", what="a carved golden sandstone Hindu temple wall")
add("pillar-square--ind-sandstone", "pillar-square", (20, 20, 120), "a square carved red sandstone pillar",
    "One square column of red sandstone about 18 in thick: a square moulded base, a shaft that turns octagonal in its middle third, and a carved bracket"
    " capital with a little flared top block.", "a square red sandstone pillar", ["one tall red stone pillar"], ["a statue on it", "a lamp"], aspect="portrait", family="ind-sandstone")
leaf("door-plank--ind-carved-leaf", "door-plank", "a Rajasthani carved wooden door leaf with brass studs",
     "A thick door leaf of dark teak carved in sunken square panels, each panel with a carved rosette, studded with rows of domed BRASS studs, and ONE brass"
     " ring knocker at the middle height.", "a dark carved wooden door with brass studs", ["a tall carved wooden door"], ["glass", "iron straps"])

# ---- the haveli courtyard
role("ind-tulsi", "tulsi vrindavan: a decorated square masonry planter with a holy basil plant", "ground", "sub", (30, 30, 48), "stone", f"{I}!", "mesh", "P1", "the centre of a Hindu household's courtyard; never as loose decor")
add("ind-tulsi", "ind-tulsi", (30, 30, 48), "a tulsi vrindavan planter with its holy basil",
    "A TULSI VRINDAVAN: a square masonry planter about 4 ft tall on a stepped base, plastered white and painted with soft red and ochre borders, a small"
    " arched niche on its front, its top shaped like a tiny shrine's rim, and growing from it a bushy holy basil plant of small green leaves in a round"
    " solid mass. Dignified and tidy.", "a square white decorated planter with a bushy green basil plant on top", ["a square decorated planter", "a bushy plant on top"], ["a well", "a fountain"], aspect="portrait", leafy=True, tier="ind")
role("ind-charpai", "charpai: a rope-strung wooden cot", "ground", "1x2", (36, 72, 18), "wood", f"{I}!", "mesh", "P1", "a courtyard's side, a roof terrace, a shop's back")
add("ind-charpai", "ind-charpai", (36, 72, 18), "an Indian charpai rope cot",
    "A CHARPAI: a low rectangular wooden cot with four stout turned legs painted with red and green rings, its frame strung with thick woven jute ROPE in a"
    " diagonal crisscross pattern, a folded cotton quilt in faded red at one end.", "a low wooden cot strung with woven rope", ["a low cot with a woven rope bed"], ["a European bed with a headboard", "a table"], aspect="landscape", tier="ind")
role("ind-jhula", "jhula: a wooden swing seat hung from a stout frame", "ground", "1x2", (72, 36, 84), "wood", f"{I}!", "mesh", "P1", "a haveli courtyard's side")
add("ind-jhula", "ind-jhula", (72, 36, 84), "an Indian jhula swing",
    "A JHULA swing: a broad flat wooden swing seat with a carved low back rail, painted red with yellow flowers, hanging from a thick carved wooden frame of"
    " two posts and a beam by four THICK brass-ringed chains drawn as solid bars.", "a broad painted swing seat hanging from a wooden frame", ["a hanging swing seat in a frame"], ["a cradle", "a bench on legs"], aspect="landscape", tier="ind")
role("ind-water-pots", "terracotta water pots (matka) on a wooden stand", "ground", "1", (40, 24, 36), "ceramic", f"{I}", "mesh", "P1", "a courtyard's corner, a kitchen, the stepwell")
add("ind-water-pots", "ind-water-pots", (40, 24, 36), "Indian terracotta water pots on a stand",
    "Three round-bellied TERRACOTTA water pots (matka), red-orange clay with a few painted white lines, sitting in a row on a low wooden stand, a brass"
    " drinking cup on one lid.", "three round clay water pots on a low stand", ["round clay pots on a stand"], ["metal pots", "barrels"], tier="ind")

# ---- the palace hall (durbar)
role("ind-gaddi-throne", "gaddi: the ruler's cushioned seat with bolsters under a canopy on four posts, on a low dais", "floor", "2x2", (96, 72, 96), "mixed", f"{I}!", "mesh", "P1", "the far wall of the palace hall on its axis")
add("ind-gaddi-throne", "ind-gaddi-throne", (96, 72, 96), "a Rajput gaddi throne under its canopy",
    "A Rajput ruler's GADDI throne: a low square platform about 1 ft high on a carved marble dais, covered with a deep red velvet mattress and a big round"
    " BOLSTER cushion at the back and two at the sides, all embroidered in gold; over it a CANOPY of four slim gilded posts carrying a small domed canopy roof"
    " (a chhatri shape) of gold-embroidered red cloth with a scalloped fringe.", "a cushioned platform throne with bolsters under a domed canopy on four posts",
    ["a cushioned platform with bolsters", "a canopy on four posts over it"], ["a European throne chair", "a bed with curtains"], tier="ind")
role("ind-floor-seating", "gadda: a long white floor mattress with round bolster cushions", "floor", "1x2", (72, 36, 20), "cloth", f"{I}!", "mesh", "P1", "along the side walls of a hall or a shop")
add("ind-floor-seating", "ind-floor-seating", (72, 36, 20), "Indian floor seating with bolsters",
    "A long low floor MATTRESS (gadda) covered in clean white cotton with a thin red border, and laid along its back two fat round BOLSTER cushions of deep"
    " red and gold striped silk.", "a long white floor mattress with round bolster cushions", ["a long low mattress", "round bolsters on it"], ["a sofa with legs", "a bed frame"], aspect="landscape", tier="ind")
role("ind-lamp-stand", "tall brass oil lamp stand (dipa stambha) with tiers of lamp cups", "floor", "sub", (18, 18, 60), "metal", f"{I}!", "mesh", "P1", "either side of the throne; the temple hall", aff="aff:lit")
add("ind-lamp-stand", "ind-lamp-stand", (18, 18, 60), "an Indian brass oil lamp stand",
    "A tall Indian brass OIL LAMP STAND (samai): a round stepped brass foot, a thick turned brass column, three tiers of round flat brass dishes each with a"
    " ring of small spouted lamp cups, and a small brass peacock finial on top; polished warm gold." + UNLIT, "a tall brass lamp stand with tiers of lamp cups",
    ["a tall brass lamp stand"], ["a candelabra with candles", "flames"], aspect="portrait", tier="ind", light="lamp")

# ---- the Shiva temple hall (mandapa)
role("ind-sanctum-door", "the sanctum doorway of a Shiva temple: carved stone door frame, bells, a lamp, its curtain drawn", "wall", "1x2", (72, 24, 96), "stone", f"{I}!", "mesh", "P1", "the far wall of the mandapa, centred on the worship axis; never elsewhere")
add("ind-sanctum-door", "ind-sanctum-door", (72, 24, 96), "the sanctum doorway of a Hindu temple with its curtain drawn",
    "The SANCTUM DOORWAY of a north-Indian Hindu temple, built as one piece that stands against a wall: a deep doorway with several stepped door frames of"
    " carved golden sandstone (bands of lotus petals and scrollwork), a carved lintel, a raised threshold; across the opening a CURTAIN of deep red cloth with"
    " a gold border is drawn closed; two small brass bells hang at the top of the doorway and a small brass oil lamp stands on the threshold. No statue, no"
    " figure, no image shown.", "a carved stone temple doorway with its red curtain drawn", ["a deep carved stone doorway", "a red curtain drawn across it"],
    ["a statue or idol", "an open dark doorway"], aspect="portrait", tier="ind")
role("ind-nandi", "Nandi: the seated stone bull who faces Shiva's sanctum, on his plinth", "floor", "1x2", (36, 60, 44), "stone", f"{I}!", "mesh", "P1", "on the worship axis of a Shiva temple, facing the sanctum; never elsewhere")
add("ind-nandi", "ind-nandi", (36, 60, 44), "Nandi the seated bull of a Shiva temple",
    "NANDI, the seated sacred BULL of a Shiva temple, carved in smooth dark grey stone: lying with his legs folded under him, head raised and looking ahead,"
    " a broad hump on his shoulders, short curved horns, a carved bell necklace and a garland of orange marigolds over his neck, on a low square stone plinth."
    " Calm and dignified.", "a seated stone bull with a marigold garland on a plinth", ["a seated stone bull"], ["a cow standing", "a horse"], aspect="landscape", tier="ind")
role("ind-temple-bell", "brass temple bell hung on a chain from the ceiling", "ceiling", "sub", (18, 18, 40), "metal", f"{I}!", "mesh", "P1", "over the way into a temple hall; rung on entering")
add("ind-temple-bell", "ind-temple-bell", (18, 18, 40), "an Indian brass temple bell",
    "An Indian brass TEMPLE BELL hanging from above: a round-mouthed brass bell with a thick ring at its top, hanging from a short THICK chain drawn as a solid"
    " twisted bar, a thick clapper showing below its rim, polished warm gold.", "a brass bell hanging on a short chain", ["a hanging brass bell"], ["a lantern", "a pot"], aspect="portrait", tier="ind", hung=True)
role("ind-temple-pillar", "carved temple pillar of golden sandstone with a bell-and-chain motif and a bracket capital", "floor", "sub", (30, 30, 120), "stone", f"{I}!", "mesh", "P1", "in rows through a temple's pillared hall")
add("ind-temple-pillar", "ind-temple-pillar", (30, 30, 120), "a carved Indian temple pillar",
    "A free-standing carved TEMPLE PILLAR of golden-buff sandstone about 10 ft tall: a square moulded base, a square shaft that changes to octagonal then"
    " round as it rises, carved with a band of hanging bell-and-chain motifs and a band of lotus petals, and a square bracket capital with four stepped"
    " arms. Geometric and floral carving only, no figures.", "a tall carved sandstone pillar with a bracket capital", ["a tall carved stone pillar"], ["a statue", "a lamp post"], aspect="portrait", tier="ind")

# ---- the bazaar shop (a grain-and-spice merchant)
role("ind-grain-baskets", "row of low baskets of grains, pulses and spices", "floor", "1x2", (60, 30, 24), "organic", f"{I}!", "mesh", "P1", "a grain merchant's floor in front of his seat; a kitchen's store")
add("ind-grain-baskets", "ind-grain-baskets", (60, 30, 24), "Indian baskets of grains and spices",
    "A row of FOUR low round woven baskets standing close together, each heaped a little above its rim: pale rice, yellow lentils, red chilli and golden"
    " turmeric; a small brass measuring scoop in one.", "four round baskets heaped with grains and spices", ["low baskets heaped with grains"], ["fruit", "flowers"], aspect="landscape", tier="ind")
role("ind-merchant-seat", "merchant's seat: a white mattress with a bolster and a low writing chest (gaddi-takia)", "floor", "1x2", (60, 40, 30), "mixed", f"{I}!", "mesh", "P1", "the back of a bazaar shop, facing the street")
add("ind-merchant-seat", "ind-merchant-seat", (60, 40, 30), "an Indian merchant's seat with his writing chest",
    "A MERCHANT'S SEAT (gaddi-takia): a low wooden platform covered by a clean white cotton mattress, a fat round red bolster cushion along its back, and on"
    " it at the front a small low sloping-lidded wooden writing chest with brass corners, a red cloth-bound account book lying on it and a brass inkpot.",
    "a low white mattress seat with a bolster and a small writing chest", ["a low mattress seat with a bolster", "a small writing chest"], ["a bed", "a counter"], aspect="landscape", tier="ind")
role("ind-brass-pots", "stacked display of brass and copper pots", "floor", "1", (36, 30, 48), "metal", f"{I}!", "mesh", "P1", "a shop's walls; a kitchen shelf's floor")
add("ind-brass-pots", "ind-brass-pots", (36, 30, 48), "a stack of Indian brass and copper pots",
    "A tidy pyramid STACK of round-bellied Indian pots, polished BRASS and COPPER: big wide water pots (handi and lota shapes) at the bottom, smaller ones on"
    " top, nested and stacked tight.", "a stack of shining brass and copper pots", ["a stack of brass pots"], ["iron cauldrons", "glass"], aspect="portrait", tier="ind")

# ---- the stepwell (baori) and its pavilion
role("ind-stepwell", "baori stepwell: stairs and landings descending on three sides to green water, a pillared gallery on the fourth", "ground", "big", (180, 180, 48), "stone", f"{I}!", "mesh", "P1", "the middle of a stepwell ground")
add("ind-stepwell", "ind-stepwell", (180, 180, 48), "a Rajasthani stepwell (baori)",
    "A Rajasthani STEPWELL (baori) seen from above at an angle: a big square sunken tank of pale golden sandstone, its THREE sides made of many flights of"
    " narrow STAIRS in a zigzag pattern going down level after level with small landings, to a square pool of still deep-green WATER at the bottom; its"
    " FOURTH side a stack of two pillared galleries with arched openings. Broad and squat: much wider than tall; the rim is a flat paved border.",
    "a square stepped tank with zigzag stairs down to green water", ["a square sunken tank", "zigzag stairs going down to water"], ["a pyramid", "a fountain", "a swimming pool"], tier="ind")
role("ind-chhatri", "chhatri: a small domed pavilion on four pillars", "ground", "2x2", (72, 72, 132), "stone", f"{I}!", "mesh", "P1", "the corners of a stepwell's rim; a palace terrace")
add("ind-chhatri", "ind-chhatri", (72, 72, 132), "a Rajasthani chhatri pavilion",
    "A CHHATRI: a small open pavilion of pale golden sandstone on a square stepped platform, four slim carved pillars with bracket capitals carrying a deep"
    " sloping overhang (chhajja) and a smooth round DOME with a small lotus finial on top.", "a small domed pavilion on four pillars", ["a small pavilion with a dome on four pillars"], ["a temple tower", "a gazebo of wood"], aspect="portrait", tier="ind")

# ---- the household kitchen
role("ind-chulha", "chulha: a two-mouthed clay cooking stove on the floor, a brass pot on it", "floor", "1", (36, 24, 16), "ceramic", f"{I}!", "mesh", "P1", "a kitchen's back wall, the cook sitting before it")
add("ind-chulha", "ind-chulha", (36, 24, 16), "an Indian clay chulha stove",
    "A CHULHA: a low U-shaped cooking stove of smooth plastered clay, rubbed warm red-ochre, with TWO round cooking mouths on its top and a fuel opening in"
    " its front; a round-bottomed brass pot sits on one mouth, a flat iron griddle (tava) on the other, a few sticks of firewood by its mouth." + UNLIT,
    "a low clay stove with two cooking holes, a brass pot and an iron griddle on it", ["a low clay stove", "a pot on it"], ["a European iron range", "flames"], tier="ind")
role("ind-grinding-stone", "sil-batta: a flat grinding stone with its stone roller, and a small brass spice box", "floor", "tiny", (24, 16, 8), "stone", f"{I}", "mesh", "P1", "on the kitchen floor beside the stove")
add("ind-grinding-stone", "ind-grinding-stone", (24, 16, 8), "an Indian grinding stone and roller",
    "A SIL-BATTA: a broad flat rectangular slab of dark grey stone with a lightly roughened top, a thick round stone roller lying across it, a small heap of"
    " green herbs on it, and beside it a round brass spice box with its lid off showing small bowls of colourful spices.", "a flat grinding stone with a roller and a round spice box",
    ["a flat stone slab with a roller"], ["a bread board", "a book"], tier="ind")
role("ind-niche-shelf", "kitchen wall shelf of brass and copper vessels", "wall", "1x2", (60, 14, 48), "mixed", f"{I}!", "mesh", "P1", "a kitchen's side walls", mount=30)
add("ind-niche-shelf", "ind-niche-shelf", (60, 14, 48), "an Indian kitchen shelf of brass and copper vessels",
    "A wall SHELF of dark wood with two long shelves and a carved bracket edge, holding rows of shining BRASS and COPPER vessels: plates standing on edge,"
    " round pots, cups and a tall lidded water jar, tight together.", "a wall shelf of shining brass and copper plates and pots", ["a shelf of brass vessels"], ["books", "bottles"], aspect="landscape", tier="ind", hung=True)
role("ind-grain-jars", "large clay grain-storage jars with lids", "floor", "1", (36, 30, 48), "ceramic", f"{I}", "mesh", "P1", "a kitchen's corners, a store")
add("ind-grain-jars", "ind-grain-jars", (36, 30, 48), "Indian clay grain storage jars",
    "TWO big round-shouldered clay storage JARS for grain and flour, smooth plastered clay rubbed pale ochre with painted white dot borders, each closed by a"
    " clay lid with a knob, standing side by side.", "two big round clay storage jars with lids", ["big clay storage jars"], ["barrels", "metal pots"], aspect="portrait", tier="ind")

# ---- flats
role("floor-ind-sandstone", "red sandstone floor slabs", "ground", "1", (60, 60, 1), "stone", f"{I}!", "flat", "P1", "the palace hall, the stepwell's rim")
role("floor-ind-temple", "pale golden sandstone floor slabs, worn smooth", "ground", "1", (60, 60, 1), "stone", f"{I}", "flat", "P1", "the temple hall")
role("floor-ind-lime", "polished lime floor in warm ochre with a faint inlaid border pattern", "ground", "1", (60, 60, 1), "stone", f"{I}", "flat", "P1", "the haveli rooms, the bazaar shop")
role("decal-mandana", "mandana: a white folk floor painting on red-ochre ground (geometric, auspicious)", "floor", "1", (54, 54, 0.2), "paper", f"{I}!", "flat", "P1", "the centre of a haveli courtyard before the tulsi; a temple hall's entrance")
role("rug-ind-durrie", "flat-woven cotton durrie in red, brown and ochre stripes", "floor", "1", (96, 60, 0.4), "cloth", f"{I}", "flat", "P1", "the palace hall's floor, a shop's seat")

INTRO = """# India objects: the IND culture pack (2026-11-06, cultures-a)

The Jaipur-Amber region of Rajasthan in the 18th century: a Hindu merchant's haveli and its household kitchen, a Rajput
palace hall, a Shiva temple's pillared hall, a bazaar shop of a grain-and-spice merchant, a stepwell. Prompts and build
order: `experiments/2026-11-06-cultures-a/spec_ind.py`. Every mesh is in the exclusive tier `ind`. The sanctum doorway,
Nandi, the temple bell and the tulsi are placed only by their own rooms (the temple hall; the haveli courtyard).

## I India
"""
write("ind", "india", INTRO)
