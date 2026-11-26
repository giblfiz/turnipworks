#!/usr/bin/env python3
"""China (CHN), anchored on a well-off official's courtyard house (siheyuan) in Beijing of the mid-Qing (c. 1750-1850)
and the main hall of a Buddhist temple of that city. python3 spec_chn.py -> chn/assets.json, prompts/, catalog/objects-china.catalog.md.
Sensitivity read (codex, 2026-11-06) applied: the house is grey brick, dark lacquered timber and grey tile, NOT a
red-columned temple (red is the temple's); lanterns are restrained (hall, tea house, temple, the market's poles); the
hall's long table is a secular console table (a vase, a stand), not an ancestral altar; the courtyard has its screen wall
(yingbi); the Buddha sits on its lotus throne on the hall's altar, offerings arranged before it, never anywhere else and
never as clutter; the bell and the drum stand in their own places by the door, not crowding the altar; no inscriptions."""
from spec_lib import *  # noqa: F401,F403

C = "CHN"
kit("wall-straight--chn-brick", "wall-straight", "a straight wall section of a Qing-dynasty Beijing courtyard house",
    "ONE straight wall section of a north-Chinese courtyard house: a wall of dark blue-grey bricks with thin pale mortar joints laid in neat courses, a"
    " slightly projecting plinth of larger grey stone blocks along the bottom foot, a moulded grey brick cornice band along the top, and at each side"
    " edge a round timber column lacquered DARK RED-BROWN, half set into the wall.", "a grey brick wall between dark red-brown round columns",
    ["grey brick", "dark red-brown columns at the edges"], ["a door opening", "white plaster"])
kit("wall-straight--chn-brick--s2", "wall-straight", "a timber lattice partition wall of a Qing-dynasty courtyard house",
    "The same wall section, the same dark red-brown columns, grey stone plinth and grey brick cornice, but between the columns a timber PARTITION of tall"
    " lattice panels (geshan): a dark red-brown frame, the upper two thirds a THICK geometric wooden lattice in a step-and-square pattern backed by warm"
    " cream paper, the lower third a solid dark wooden panel with one plain carved rectangle.", "a dark wooden lattice partition with cream paper panels",
    ["a dark wooden lattice partition"], ["a door opening", "glass"], parent="wall-straight--chn-brick", what="a Qing courtyard house wall of grey brick")
kit("wall-doorway--chn-brick", "wall-doorway", "a Qing courtyard house wall section with an empty doorway",
    "The same grey brick wall section with an EMPTY door opening through it from the very bottom: about 3.5 ft wide and 7 ft tall, centred, framed by two"
    " dark red-brown lacquered door posts, a dark lintel beam and a low grey stone threshold. Grey brick either side and above. NO door, NO curtain.",
    "a grey brick wall with an empty doorway framed in dark red-brown timber", ["an empty doorway", "grey brick either side"], ["a door leaf in the opening"],
    parent="wall-straight--chn-brick", what="a Qing courtyard house wall of grey brick")
kit("wall-window-small--chn-brick", "wall-window-small", "a Qing courtyard house wall section with a lattice window",
    "The same grey brick wall section with ONE square window in its middle at chest height, about 3 ft across: a dark red-brown timber frame filled with"
    " a THICK geometric wooden lattice (interlocking squares and rectangles) backed by warm cream paper.", "a grey brick wall with a square wooden lattice window",
    ["a square lattice window in a brick wall"], ["glass panes", "a door opening"], parent="wall-straight--chn-brick", what="a Qing courtyard house wall of grey brick")
kit("wall-straight--chn-temple", "wall-straight", "a straight wall section of a Chinese Buddhist temple hall",
    "ONE straight wall section of a Chinese Buddhist temple hall: a smooth wall plastered deep RED OCHRE, standing on a plinth of pale grey stone, at each"
    " side edge a round column lacquered bright red; along the top a broad beam painted with a band of blue-green and gold geometric ornament (no figures,"
    " no writing).", "a red ochre temple wall between red columns under a blue-green painted beam", ["red ochre walls and red columns", "a blue-green painted beam along the top"],
    ["a door opening", "grey brick"])
kit("wall-doorway--chn-temple", "wall-doorway", "a Chinese temple hall wall section with an empty doorway",
    "The same red temple wall section with an EMPTY opening through it from the very bottom: about 4 ft wide and 7.5 ft tall, centred, framed by two red"
    " lacquered posts and a red lintel under the painted beam, a raised grey stone threshold. NO door. You can see straight through the opening.",
    "a red temple wall with an empty doorway", ["an empty doorway", "red walls either side"], ["a door leaf in the opening"],
    parent="wall-straight--chn-temple", what="a red-ochre Chinese temple wall")
add("post-timber--chn-brick", "post-timber", (14, 14, 108), "a round dark red-brown lacquered column on a stone drum base",
    "One tall round timber column lacquered dark red-brown, about 12 in thick, standing on a round carved grey stone drum base, with a plain flared top.",
    "a tall round dark red column on a stone base", ["one tall round column on a stone base"], ["a lantern or sign on it"], aspect="portrait", family="chn-brick")
leaf("door-plank--chn-gate-leaf", "door-plank", "a Chinese courtyard-house street door leaf",
     "A thick plank door leaf lacquered dark red-black, with two rows of round domed bronze studs and ONE round bronze knocker ring hanging from a lion-mask"
     " plate at the middle height.", "a dark red lacquered plank door with bronze studs and a ring knocker", ["a tall dark lacquered door"], ["glass", "a lattice"])
leaf("door-panelled--chn-lattice-leaf", "door-panelled", "a Chinese lattice door (geshan men) used between rooms",
     "A lattice door leaf: a dark red-brown frame, the upper two thirds a THICK geometric wooden lattice of interlocking squares backed by cream paper,"
     " the lower third a solid wooden panel with one carved plain rectangle.", "a Chinese lattice door with paper panels", ["a tall lattice door"], ["iron straps", "glass"])

# ---- the hall (tang)
role("chn-console-table", "long narrow console table with upturned scroll ends (qiaotou an), a porcelain vase and a carved stand on it", "floor", "1x2", (96, 20, 40), "wood", f"{C}!", "mesh", "P1", "against the back wall of a courtyard-house hall, centred")
add("chn-console-table", "chn-console-table", (96, 20, 40), "a Chinese long console table",
    "A long narrow Chinese console table (qiaotou an) of dark rosewood: a long thick top whose two ends curl UP like scrolls, deep carved aprons and stout legs"
    " with carved feet. On it, centred, a tall blue-and-white porcelain vase and at one end a small carved wooden stand with a flat round grey stone disc.",
    "a long dark wooden table with upturned ends and a blue-and-white vase", ["a long narrow table with upturned ends"], ["chairs", "a bed"], aspect="landscape", tier="chn")
role("chn-square-table", "square 'eight immortals' table of dark hardwood", "floor", "1", (40, 40, 32), "wood", f"{C}!", "mesh", "P1", "before the console table between two armchairs; tea houses")
add("chn-square-table", "chn-square-table", (40, 40, 32), "a Chinese square table",
    "A square Chinese table (baxian zhuo) of dark rosewood: a thick square top, a carved openwork apron under each edge, four stout straight legs with a"
    " stretcher between them. On it a small teapot and two cups.", "a square dark wooden table with carved aprons", ["a square table"], ["chairs", "a round table"], tier="chn")
role("chn-armchair", "Chinese official's hat armchair (guanmao yi)", "floor", "1", (26, 22, 44), "wood", f"{C}!", "mesh", "P1", "a pair either side of the square table; the study")
add("chn-armchair", "chn-armchair", (26, 22, 44), "a Chinese official's hat armchair",
    "A Chinese armchair (guanmao yi) of dark rosewood: a tall S-curved back splat, a top rail whose ends sweep OUTWARD past the posts like the wings of an"
    " official's hat, curved arms, a square seat with a thin cushion of deep blue silk, stout legs with a foot rail.", "a dark wooden armchair with a tall curved back",
    ["an armchair with a tall back"], ["a throne", "a stool"], aspect="portrait", tier="chn")
role("chn-palace-lantern", "hexagonal palace lantern of carved wood and painted silk with red tassels", "ceiling", "sub", (20, 20, 36), "mixed", f"{C}!", "mesh", "P1", "hung in a hall, a tea house, a temple; one or two, not rows", aff="aff:lit")
add("chn-palace-lantern", "chn-palace-lantern", (20, 20, 36), "a Chinese palace lantern",
    "A Chinese PALACE LANTERN (gongdeng) hanging from above: a hexagonal frame of dark carved wood with six panels of cream silk painted with small flowers,"
    " a carved wooden crown on top with a short thick hanging hook, and a short thick red silk tassel hanging from each of the six lower corners." + UNLIT,
    "a hexagonal wooden lantern with silk panels and red tassels", ["a hanging hexagonal lantern"], ["a round paper lantern", "flames"], aspect="portrait", tier="chn", hung=True, light="lantern")
role("chn-standing-screen", "table screen on a carved stand with a marble landscape panel (zuoping)", "floor", "1x2", (60, 20, 72), "mixed", f"{C}!", "mesh", "P1", "a hall's or a study's side wall")
add("chn-standing-screen", "chn-standing-screen", (60, 20, 72), "a Chinese standing screen",
    "A Chinese standing SCREEN (zuoping): ONE broad upright panel of pale marble whose natural grey veins look like misty mountains, framed in dark carved"
    " rosewood, standing in a heavy carved wooden base with two broad feet.", "a standing screen with one marble panel in a carved wooden frame", ["one framed panel on a heavy stand"], ["a door", "a mirror"], aspect="portrait", tier="chn")

# ---- the tea house
role("chn-bench", "long narrow wooden bench (changdeng)", "floor", "1x2", (48, 10, 18), "wood", f"{C}", "mesh", "P1", "a pair either side of each tea table")
add("chn-bench", "chn-bench", (48, 10, 18), "a Chinese long narrow bench",
    "A long narrow Chinese bench (changdeng) of honey-brown elm: a thick plank seat, four splayed stout legs joined by stretchers.", "a long narrow wooden bench",
    ["a long narrow bench"], ["a back rest", "a table"], aspect="landscape", tier="chn")
role("chn-tea-counter", "tea house counter with a brick stove and two big copper kettles", "floor", "1x2", (72, 30, 48), "mixed", f"{C}!", "mesh", "P1", "the back wall of a tea house")
add("chn-tea-counter", "chn-tea-counter", (72, 30, 48), "a Chinese tea house counter with its stove",
    "A tea house COUNTER of dark wood with a grey brick stove built into one end, two big round COPPER kettles with long spouts standing on the stove's two"
    " fire holes, and on the counter a row of round ceramic tea jars with lids, a stack of small cups and a wooden tray of teapots." + UNLIT,
    "a wooden counter with a brick stove and two copper kettles", ["a counter", "big copper kettles on a stove"], ["a bar with bottles", "flames"], aspect="landscape", tier="chn")

# ---- the scholar's study
role("chn-painting-table", "scholar's long painting table with brushes, ink stone and paper", "floor", "1x2", (72, 30, 32), "wood", f"{C}!", "mesh", "P1", "the middle of a scholar's study, under the window")
add("chn-painting-table", "chn-painting-table", (72, 30, 32), "a Chinese scholar's painting table",
    "A Chinese scholar's long PAINTING TABLE of dark rosewood with plain straight legs, on it: a sheet of cream paper weighted with a dark wooden paperweight"
    " bar, a big rectangular black ink stone, a round porcelain brush pot holding thick brushes, a wooden brush rack with brushes hanging, a small water"
    " dropper. Few big pieces.", "a long table with brushes, an ink stone and paper", ["a long table", "brushes and an ink stone on it"], ["a book of writing", "a candle"], aspect="landscape", tier="chn")
role("chn-bookcase", "open bookcase of string-bound books in blue cloth cases", "floor", "1x2", (48, 18, 72), "wood", f"{C}!", "mesh", "P1", "a study's walls")
add("chn-bookcase", "chn-bookcase", (48, 18, 72), "a Chinese scholar's bookcase",
    "A Chinese open BOOKCASE (wanli gui) of dark wood with three open shelves holding stacks of thin string-bound books lying FLAT in deep blue cloth cases"
    " with ivory clasps, one small blue-and-white vase and a little carved box; a closed cabinet with two plain doors below.", "a dark bookcase of flat stacked books in blue cases",
    ["an open bookcase", "stacks of books lying flat"], ["upright European books", "bottles"], aspect="portrait", tier="chn")
role("chn-penjing", "penjing: a miniature tree and rock in a shallow ceramic tray on a carved stand", "floor", "sub", (24, 18, 36), "organic", f"{C}!", "mesh", "P1", "a study's corner, a hall's side table")
add("chn-penjing", "chn-penjing", (24, 18, 36), "a Chinese penjing potted landscape",
    "A PENJING potted landscape: a shallow oval celadon-green ceramic tray holding a little craggy grey rock and one small twisted pine with flat pads of"
    " needles, standing on a tall slender carved dark wooden stand.", "a miniature tree and rock in a tray on a tall stand", ["a small tree in a shallow tray on a stand"], ["a big tree", "flowers"], aspect="portrait", leafy=True, tier="chn")

# ---- the temple hall
role("chn-buddha-altar", "seated Buddha on a lotus throne with a halo, on the temple hall's altar platform", "floor", "2x2", (96, 60, 104), "mixed", f"{C}!", "mesh", "P1", "the far wall of the temple hall on its axis; never anywhere else", aff="aff:-")
add("chn-buddha-altar", "chn-buddha-altar", (96, 60, 104), "a seated Buddha on a lotus throne in a Chinese temple hall",
    "A serene SEATED BUDDHA in meditation, legs crossed, hands resting in the lap, eyes lowered, a gentle calm face, gilded in soft gold, sitting on a broad"
    " LOTUS THRONE of layered pink-and-gold petals; behind it a tall flame-shaped halo of gold and deep red; all on a broad stepped altar platform of dark"
    " red lacquered wood with gold borders. Dignified, calm, symmetrical, with reverence.", "a serene gilded seated Buddha on a lotus throne with a halo",
    ["a seated Buddha figure", "a lotus throne", "a halo behind it"], ["a warrior statue", "a dragon", "broken or damaged parts"], aspect="square", tier="chn")
role("chn-offering-table", "temple offering table with candlesticks, a small censer and plates of fruit", "floor", "1x2", (84, 30, 40), "wood", f"{C}!", "mesh", "P1", "before the temple hall's altar, on the axis")
add("chn-offering-table", "chn-offering-table", (84, 30, 40), "a Chinese temple offering table",
    "A long Chinese temple OFFERING TABLE of red lacquered wood with a gold-bordered yellow silk cloth hanging over its front, and on it, symmetrical: a small"
    " bronze tripod incense burner in the middle, a tall bronze candlestick with a red candle each side, plates heaped with oranges and peaches, two vases"
    " of lotus flowers." + UNLIT, "a red altar table with a censer, candlesticks and fruit offerings", ["a long offering table", "candlesticks and offerings on it"], ["a statue on it", "food for a meal"], aspect="landscape", tier="chn")
role("chn-incense-burner", "great bronze incense burner (ding) on three legs, with a pierced lid", "floor", "1", (40, 40, 54), "metal", f"{C}!", "mesh", "P1", "on the temple hall's axis near the door; temple courts")
add("chn-incense-burner", "chn-incense-burner", (40, 40, 54), "a great Chinese bronze incense burner",
    "A great Chinese bronze INCENSE BURNER (ding): a round deep cauldron with two upright handles on its rim, standing on three stout legs, with a tall domed"
    " pierced lid crowned by a small seated lion; dark bronze with a soft green patina, a few sticks of incense standing in it." + UNLIT,
    "a big bronze cauldron on three legs with a pierced lid", ["a bronze cauldron on three legs"], ["a cooking pot over a fire", "smoke"], aspect="square", tier="chn")
role("chn-kneeling-cushion", "round woven kneeling cushion (putuan)", "floor", "tiny", (22, 22, 8), "organic", f"{C}", "mesh", "P1", "in rows before the temple altar")
add("chn-kneeling-cushion", "chn-kneeling-cushion", (22, 22, 8), "a Chinese round kneeling cushion",
    "ONE round plump kneeling CUSHION (putuan) of woven golden straw with a band of deep yellow cloth round its side, lying flat.", "a round woven cushion",
    ["one round flat cushion"], ["a basket", "a drum"], tier="chn")
role("chn-temple-bell", "bronze temple bell hanging in a wooden frame", "floor", "1", (48, 36, 84), "metal", f"{C}!", "mesh", "P1", "one side of the temple hall's door; the drum on the other")
add("chn-temple-bell", "chn-temple-bell", (48, 36, 84), "a Chinese bronze temple bell in its frame",
    "A Chinese bronze TEMPLE BELL: a tall round-shouldered bell with straight sides and a flat rim, its surface in raised bands and panels of knobs, dark"
    " bronze with green patina, hanging from a thick red lacquered wooden frame of two posts and a cross beam, a short thick wooden striking log hung beside it.",
    "a big bronze bell hanging in a red wooden frame", ["a big bronze bell", "a wooden frame"], ["a church bell tower", "a gong"], aspect="portrait", tier="chn")
role("chn-temple-drum", "large red temple drum on a wooden stand", "floor", "1", (48, 36, 60), "wood", f"{C}!", "mesh", "P1", "the other side of the temple hall's door")
add("chn-temple-drum", "chn-temple-drum", (48, 36, 60), "a Chinese temple drum on its stand",
    "A large Chinese temple DRUM: a fat barrel drum lacquered bright red with two rows of brass studs holding pale hide heads, standing upright on edge in a"
    " stout dark wooden stand with four legs, two thick wooden drumsticks in the stand.", "a big red barrel drum on a wooden stand", ["a big red drum on a stand"], ["a barrel", "a cart wheel"], aspect="square", tier="chn")

# ---- the market street
role("chn-market-stall", "market stall: a wooden counter of goods under a cloth awning on poles", "ground", "2x2", (96, 60, 96), "mixed", f"{C}!", "mesh", "P1", "along a market street's edges")
add("chn-market-stall", "chn-market-stall", (96, 60, 96), "a Chinese market stall",
    "A Chinese MARKET STALL: a wooden counter on trestles with round bamboo baskets of red chillies, green vegetables and dried mushrooms and a stack of"
    " bowls, under a slanting awning of indigo-blue cotton cloth stretched on four stout bamboo poles.", "a market stall with baskets of goods under a blue cloth awning",
    ["a market stall", "a cloth awning on poles", "baskets of goods"], ["a tent", "a cart"], tier="chn")
role("chn-steamer-stack", "stack of bamboo steamer baskets on a small clay stove", "ground", "1", (30, 30, 48), "mixed", f"{C}!", "mesh", "P1", "a market stall's front; a tea house kitchen corner")
add("chn-steamer-stack", "chn-steamer-stack", (30, 30, 48), "a stack of Chinese bamboo steamers",
    "A tall stack of FIVE round BAMBOO STEAMER baskets with a domed woven lid, standing on a round squat clay stove with an iron pan rim." + UNLIT,
    "a tall stack of round bamboo steamers on a clay stove", ["a stack of round bamboo steamers"], ["hat boxes", "steam or smoke"], aspect="portrait", tier="chn")
role("chn-carrying-pole", "shoulder carrying pole with two baskets of goods, set down", "ground", "1x2", (72, 22, 32), "organic", f"{C}!", "mesh", "P1", "a market street; set down by a stall")
add("chn-carrying-pole", "chn-carrying-pole", (72, 22, 32), "a Chinese carrying pole with two baskets",
    "A thick bamboo CARRYING POLE about 6 ft long resting across the tops of two round deep bamboo BASKETS set on the ground, one heaped with oranges, one"
    " with green vegetables, each hung from the pole by thick ropes.", "two round baskets joined by a carrying pole", ["two baskets with a pole across them"], ["a person", "a yoke for oxen"], aspect="landscape", tier="chn")
role("chn-porcelain-jars", "group of large blue-and-white porcelain jars with lids", "floor", "1", (40, 24, 30), "ceramic", f"{C}", "mesh", "P1", "a market stall, a hall's corner, a shop")
add("chn-porcelain-jars", "chn-porcelain-jars", (40, 24, 30), "a group of Chinese blue-and-white porcelain jars",
    "THREE big round-shouldered porcelain JARS with domed lids standing close together, white glazed and painted in cobalt blue with bold lotus scrolls and"
    " wave bands (no writing).", "three big blue-and-white jars", ["big blue-and-white porcelain jars"], ["glass", "metal pots"], tier="chn")
role("chn-lantern-pole", "red paper lantern hung from a wooden post", "ground", "sub", (18, 18, 96), "mixed", f"{C}!", "mesh", "P1", "a market street's edges", aff="aff:lit")
add("chn-lantern-pole", "chn-lantern-pole", (18, 18, 96), "a Chinese lantern on a post",
    "A stout dark wooden POST about 8 ft tall on a grey stone foot, with a short arm at its top from which hangs ONE round red paper LANTERN with dark ribs"
    " and a short tassel." + UNLIT, "a wooden post with a red round lantern hanging from it", ["a post", "a red lantern hanging from it"], ["a street lamp of iron", "flames"], aspect="portrait", tier="chn", light="lantern")

# ---- the courtyard
role("chn-screen-wall", "yingbi: free-standing brick screen wall with a carved brick panel and a tiled top", "ground", "2x2", (120, 24, 108), "stone", f"{C}!", "mesh", "P1", "facing a courtyard's gate, a few steps inside it")
add("chn-screen-wall", "chn-screen-wall", (120, 24, 108), "a Chinese courtyard screen wall (yingbi)",
    "A free-standing Chinese SCREEN WALL (yingbi): a broad short wall of dark blue-grey brick on a stone plinth, about 10 ft wide and 9 ft tall, with a"
    " carved grey brick panel in its middle (a square frame with a lotus-and-scroll medallion in the centre and floral corner pieces) and a little roof of"
    " dark grey cylindrical tiles along its top with gently upturned ends. It stands alone.", "a free-standing grey brick screen wall with a carved panel and a tiled top",
    ["a free-standing brick wall", "a carved panel in its middle", "a little tiled roof on top"], ["a gate", "a building"], aspect="landscape", tier="chn")
role("chn-taihu-rock", "Taihu garden rock: a tall eroded limestone rock full of holes, on a stone base", "ground", "1", (48, 36, 96), "stone", f"{C}!", "mesh", "P1", "a courtyard's or garden's focal point")
add("chn-taihu-rock", "chn-taihu-rock", (48, 36, 96), "a Chinese Taihu garden rock",
    "A tall Chinese TAIHU garden rock: a craggy pale grey limestone rock, taller than a man, twisting upward, eroded into smooth rounded hollows and several"
    " deep holes right through it, standing on a low carved grey stone base.", "a tall twisting pale rock full of holes on a base", ["a tall eroded rock with holes"], ["a statue", "a tree"], aspect="portrait", tier="chn")
role("chn-goldfish-vat", "large glazed ceramic vat of water with lotus leaves", "ground", "1", (36, 36, 30), "ceramic", f"{C}!", "mesh", "P1", "a courtyard; one each side of a hall's steps")
add("chn-goldfish-vat", "chn-goldfish-vat", (36, 36, 30), "a Chinese courtyard goldfish vat",
    "A big round glazed ceramic VAT, deep green-brown glaze with a band of raised rings, filled to just below the rim with dark still water on which float"
    " three broad round green LOTUS leaves and one pink lotus bud.", "a big glazed vat of water with lotus leaves", ["a big round vat", "lotus leaves on the water"], ["a well", "a cooking pot"], tier="chn")
role("chn-stone-table", "round stone garden table with four drum-shaped stone stools", "ground", "2x2", (72, 72, 32), "stone", f"{C}!", "mesh", "P1", "a courtyard under a tree")
add("chn-stone-table", "chn-stone-table", (72, 72, 32), "a Chinese round stone table with drum stools",
    "A round Chinese garden TABLE of pale grey stone with a thick top on a round carved pedestal, and four squat round drum-shaped STONE STOOLS standing"
    " round it, each carved with two bands of studs like a drum.", "a round stone table with four drum-shaped stools", ["a round stone table", "drum-shaped stools round it"], ["chairs", "a well"], tier="chn")
role("chn-pomegranate-tub", "pomegranate tree in a big glazed tub", "ground", "1", (54, 54, 96), "organic", f"{C}!", "mesh", "P1", "a courtyard's corners, in pairs")
add("chn-pomegranate-tub", "chn-pomegranate-tub", (54, 54, 96), "a pomegranate tree in a big tub",
    "A small POMEGRANATE tree in a big round deep blue-green glazed ceramic tub: a short twisting trunk and a round crown of glossy dark green leaves in big"
    " soft masses, dotted with a few round red pomegranates.", "a small tree with red fruit in a big glazed tub", ["a small tree in a big tub"], ["an apple tree in the ground", "a bush"], aspect="portrait", leafy=True, tier="chn")

# ---- flats (flats/gen.py)
role("floor-chn-brick", "square grey floor bricks (jinzhuan) laid in a grid", "ground", "1", (60, 60, 1), "stone", f"{C}!", "flat", "P1", "the hall, the study, the tea house, the temple")
role("floor-chn-paving", "courtyard paving of grey bricks laid on edge in a herringbone", "ground", "1", (60, 60, 1), "stone", f"{C}", "flat", "P1", "a courtyard house's court")
role("chn-scroll-landscape", "hanging scroll painted with an ink landscape (no writing)", "wall", "1", (24, 1, 72), "paper", f"{C}!", "flat", "P1", "the back wall of a hall over the console table, a study", mount=36)

INTRO = """# China objects: the CHN culture pack (2026-11-06, cultures-a)

A well-off official's courtyard house in mid-Qing Beijing (c. 1750-1850) and the main hall of a Buddhist temple of that
city: the hall, the tea house, the scholar's study, the temple hall, the market street, the courtyard. Prompts and
build order: `experiments/2026-11-06-cultures-a/spec_chn.py`. Every mesh is in the exclusive tier `chn`. The Buddha,
the temple's offering table, censer, bell, drum and kneeling cushions are placed only by the temple hall.

## C China
"""
write("chn", "china", INTRO)
