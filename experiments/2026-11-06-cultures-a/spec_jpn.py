#!/usr/bin/env python3
"""Japan (JPN), anchored on a Kyoto townhouse, tea house and Shinto shrine of the late Edo period (c. 1800-1850).
Every NEW mesh of the culture, with its prompt and its catalog role.  python3 spec_jpn.py -> jpn/assets.json, prompts/,
catalog/objects-japan.catalog.md.  Sensitivity read (codex, 2026-11-06) applied: the shop is a SAKE merchant (sakaya, the
cedar ball over its door), the garden is a TEA GARDEN (roji: stepping stones, the stone basin, a lantern), the honden is
never shown (the hall's offering table stands before closed sanctum doors), komainu stand in pairs by the entrance, the
dojo's kamidana is mounted high on the far wall and never near the weapon racks; inner doors are fusuma, the street
door a wooden lattice door."""
from spec_lib import *  # noqa: F401,F403
import spec_lib

J = "JPN"
# ---- the building style: two wall families, two door leaves, a vermilion post ----
kit("wall-straight--jpn-shoji", "wall-straight", "a straight wall section of an Edo-period Japanese townhouse",
    "ONE straight wall section of a Japanese townhouse: two square posts of dark brown cedar at the two side edges (each about 5 in square), a dark cedar"
    " sill beam along the very bottom, a dark head rail (nageshi) across at 7 ft and a dark beam along the very top. Between the posts, from the sill to the"
    " head rail, stand SHOJI screens: a grid of THICK honey-coloured wooden lattice bars in large square panes (each pane about 10 in), backed by smooth"
    " glowing WHITE paper; the bottom 2 ft is a solid panel of dark cedar boards. Above the head rail a band of smooth warm cream plaster up to the top beam.",
    "a Japanese townhouse wall: dark wooden posts and rails with white paper shoji lattice screens",
    ["dark wooden posts and rails", "white paper screens in a square wooden lattice"], ["stone", "a door opening"])
kit("wall-straight--jpn-shoji--s2", "wall-straight", "a straight earthen-plaster wall section of an Edo-period Japanese townhouse",
    "The same wall section, the same dark cedar posts, sill, head rail and top beam, but the panel between the posts is smooth EARTHEN PLASTER (tsuchikabe)"
    " in a warm sandy ochre-cream from the sill to the top beam, with a dark cedar board skirt along the bottom 1.5 ft. No shoji, no lattice in this one.",
    "a Japanese wall of dark wooden posts with a smooth ochre plaster panel", ["dark wooden posts and rails", "a plain smooth plaster panel"], ["a door opening", "a window"],
    parent="wall-straight--jpn-shoji", what="a Japanese townhouse wall with shoji screens")
kit("wall-doorway--jpn-shoji", "wall-doorway", "a Japanese townhouse wall section with an empty doorway",
    "The same wall section with an EMPTY door opening through it from the very bottom: about 3.5 ft wide and 6.5 ft tall, centred, framed by two dark cedar"
    " door posts and the head rail as its lintel (the sill beam continues across the threshold as a low dark wooden sill). About 9 in of shoji wall remains"
    " each side and the plaster band and top beam run unbroken above. NO door, NO curtain, NO step. You can see straight through the opening.",
    "a Japanese townhouse wall with an empty doorway", ["an empty doorway through the wall", "dark posts and white shoji either side"], ["a door leaf in the opening"],
    parent="wall-straight--jpn-shoji", what="a Japanese townhouse wall with shoji screens")
kit("wall-window-small--jpn-shoji", "wall-window-small", "a Japanese townhouse wall section with a wooden lattice window",
    "The same wall section, the panel smooth warm ochre-cream earthen plaster (as in the plain plaster version), with ONE window in its middle: a square opening"
    " about 2.5 ft across at chest height, closed by a THICK lattice of upright square dark wooden bars set close together (koshi lattice, 8 bars), with a"
    " dark wooden frame.", "a Japanese wall with a window of thick wooden upright bars", ["a window of upright wooden bars in the wall", "dark wooden posts"], ["glass panes", "a door opening"],
    parent="wall-straight--jpn-shoji", what="a Japanese townhouse wall with shoji screens")
kit("wall-straight--jpn-shrine", "wall-straight", "a straight wall section of a Shinto shrine hall",
    "ONE straight wall section of a Shinto shrine worship hall: two thick round posts lacquered bright VERMILION red at the two side edges, a vermilion sill"
    " beam along the very bottom, a vermilion tie beam across at 7 ft and a vermilion beam along the very top, the ends of the beams slightly flared. Between"
    " them, smooth bright WHITE plaster panels. Plain, clean and dignified.", "a Shinto shrine wall: vermilion red posts and beams with white plaster",
    ["vermilion red posts and beams", "white plaster panels"], ["a door opening", "dark brown wood"])
kit("wall-doorway--jpn-shrine", "wall-doorway", "a Shinto shrine hall wall section with an empty doorway",
    "The same shrine wall section with an EMPTY opening through it from the very bottom: about 4 ft wide and 7 ft tall, centred, framed by two vermilion posts"
    " and the vermilion tie beam as its lintel; a low dark wooden threshold sill. White plaster either side, the top beam unbroken above. NO door, NO curtain.",
    "a vermilion and white shrine wall with an empty doorway", ["an empty doorway", "vermilion posts and white plaster"], ["a door leaf in the opening"],
    parent="wall-straight--jpn-shrine", what="a Shinto shrine wall of vermilion posts and white plaster")
leaf("door-plank--jpn-fusuma-leaf", "door-plank", "a Japanese fusuma sliding panel used as an inner door",
     "A FUSUMA panel: a thick slim black-lacquered wooden frame around a panel of heavy cream paper painted with a soft gold-and-green landscape of"
     " low hills and a pine; one small round sunken black finger pull at the middle height near one edge.", "a Japanese fusuma door panel with a painted landscape",
     ["a tall flat door panel", "a painted paper face in a thin dark frame"], ["a European plank door", "iron straps or hinges"])
leaf("door-plank--jpn-koshido-leaf", "door-plank", "a Japanese wooden lattice street door (koshido)",
     "A KOSHIDO street door: a thick frame of honey-brown wood filled with a close lattice of THICK upright wooden bars over a backing of white paper, and a"
     " solid panel of boards along the bottom 2 ft.", "a Japanese wooden lattice door", ["a tall door of close upright wooden bars"], ["iron straps", "a round handle ring"])
add("post-timber--jpn-shrine", "post-timber", (12, 12, 108), "a vermilion lacquered round shrine post",
    "One tall round wooden post lacquered bright vermilion red, about 12 in thick, with a black lacquered base ring and a slightly flared top, standing alone.",
    "a tall round vermilion red post", ["one tall round red post"], ["a lantern or sign on it"], aspect="portrait", family="jpn-shrine")

# ---- the tatami room (zashiki) ----
role("jpn-tokonoma", "tokonoma alcove: raised wooden dais in a recess, hanging scroll, flower arrangement, natural-wood corner post", "wall", "1x2", (72, 30, 96),
     "wood", f"{J}!", "mesh", "P1", "the focal wall of a tatami room or tea room; never anything placed in front of it but a cushion", aff="aff:-")
add("jpn-tokonoma", "jpn-tokonoma", (72, 30, 96), "a Japanese tokonoma alcove",
    "A TOKONOMA alcove built as one free-standing piece that backs onto a wall: a shallow recess about 6 ft wide with plain cream plaster back and side walls,"
    " a low raised dais of polished dark wood a few inches high across its floor, a natural-wood corner post with its bark texture on the left edge, and a dark"
    " lintel across its top. On the back wall hangs ONE long vertical scroll painted with a misty ink landscape of mountains (no writing); on the dais stands one"
    " bronze vase with a single tall flowering branch of camellia and one ceramic incense box.", "a Japanese tokonoma alcove with a hanging scroll and a flower vase",
    ["a shallow alcove with a raised wooden dais", "a hanging scroll on its back wall", "a vase with a flowering branch"], ["a bed", "a shelf of books", "a fireplace"], aspect="portrait", tier="jpn")
role("jpn-low-table", "low lacquered table (zataku) for seating on the floor", "floor", "1x2", (48, 30, 14), "wood", f"{J}!", "mesh", "P1", "the middle of a tatami room, cushions round it")
add("jpn-low-table", "jpn-low-table", (48, 30, 14), "a low Japanese lacquered table",
    "A LOW rectangular table for sitting on the floor (zataku): a thick top of glossy-matte dark red-brown lacquer with rounded edges, on four short thick legs,"
    " only about a foot high. On it a small teapot, two small cups and a lidded ceramic bowl.", "a very low dark lacquered table", ["a very low table"], ["chairs", "a tall table"], tier="jpn")
role("jpn-zabuton", "zabuton floor cushion", "floor", "tiny", (22, 22, 5), "cloth", f"{J}", "mesh", "P1", "round a low table, before a tokonoma, in a tea room")
add("jpn-zabuton", "jpn-zabuton", (22, 22, 5), "a Japanese floor cushion",
    "ONE square ZABUTON floor cushion, plump and thick, of deep indigo-purple silk with a small tuft at its centre and its corners, lying flat.",
    "a square flat floor cushion", ["one square flat cushion"], ["a pillow on a bed", "a chair"], tier="jpn")
role("jpn-andon", "andon paper floor lamp in a wooden frame", "floor", "sub", (16, 16, 32), "paper", f"{J}!", "mesh", "P1", "the light of a tatami room and a tea room", aff="aff:lit")
add("jpn-andon", "jpn-andon", (16, 16, 32), "a Japanese andon paper floor lamp",
    "An ANDON floor lamp: a square upright frame of thick dark wood about 2.5 ft tall on four short feet, its four sides covered with warm cream paper panels,"
    " a thick wooden carrying handle bar across the top." + UNLIT, "a square paper floor lamp in a wooden frame", ["a square paper-sided lamp"], ["flames", "a candle stick"], aspect="portrait", tier="jpn", light="lamp")
role("jpn-tansu", "tansu chest of drawers with black iron fittings", "floor", "1", (48, 18, 42), "wood", f"{J}", "mesh", "P1", "against a wall: house, shop, tea house store")
add("jpn-tansu", "jpn-tansu", (48, 18, 42), "a Japanese tansu chest of drawers",
    "A TANSU chest: a low wide chest of warm honey-brown zelkova wood with three rows of drawers and one small hinged door, every drawer with a big flat"
    " black iron handle plate and black iron corner plates.", "a low wooden chest of drawers with black iron fittings", ["a wooden chest of drawers"], ["a wardrobe with doors", "a bed"], tier="jpn")
role("jpn-byobu", "byobu folding screen painted with a gold landscape", "floor", "1x2", (108, 14, 66), "paper", f"{J}!", "mesh", "P1", "behind seating in a hall or along a tatami room wall")
add("jpn-byobu", "jpn-byobu", (108, 14, 66), "a Japanese byobu folding screen",
    "A BYOBU folding screen of SIX tall panels standing in a zigzag, each panel framed in thin black lacquer, the whole face painted as one GOLD-leaf landscape"
    " with green pine trees and blue-green water. The panels are thick enough to stand.", "a six-panel gold folding screen painted with pines",
    ["a zigzag folding screen", "a gold painted face"], ["a wall", "a door"], aspect="landscape", tier="jpn")

# ---- the tea house (chashitsu) ----
role("jpn-ro-kama", "sunken tea hearth (ro) with an iron kettle on its trivet", "floor", "1", (24, 24, 14), "metal", f"{J}!", "mesh", "P1", "a tea room's hearth: cut into the mats beside the host's place")
add("jpn-ro-kama", "jpn-ro-kama", (24, 24, 14), "a Japanese sunken tea hearth with its iron kettle",
    "A tea-ceremony hearth: a small square hearth frame of black lacquered wood, flush with the floor, filled with smooth pale grey ash, and set in it a round"
    " cast-iron tea KETTLE (kama), dark and rough-textured, with two small lugs and a lid with a small knob. Seen from above, the square frame and the round"
    " kettle." + UNLIT, "a square sunken hearth with a round iron kettle in it", ["a square hearth frame", "a round iron kettle"], ["a stove with legs", "flames"], tier="jpn")
role("jpn-tea-utensils", "tea-ceremony utensils: tea bowl, whisk, caddy, scoop and the water jar on a tray", "floor", "tiny", (30, 20, 12), "ceramic", f"{J}!", "mesh", "P1", "beside the tea hearth, at the host's place")
add("jpn-tea-utensils", "jpn-tea-utensils", (30, 20, 12), "Japanese tea-ceremony utensils",
    "The utensils of a tea ceremony set out together on a plain wooden board: a wide rough tea BOWL (dark brown raku glaze) with a bamboo WHISK beside it, a"
    " small lacquered tea CADDY, a bamboo ladle laid across a lidded ceramic WATER JAR (mizusashi). Few big pieces, packed close.",
    "a tea bowl, whisk, caddy and water jar on a board", ["a tea bowl and a water jar"], ["a teapot with a spout", "cups on saucers"], tier="jpn")

# ---- the dojo ----
role("jpn-kamidana", "kamidana household shrine shelf, mounted high on a wall", "wall", "1", (48, 16, 30), "wood", f"{J}!", "mesh", "P1", "high on the dojo's front wall, centred; never near the weapons, never low", mount=78)
add("jpn-kamidana", "jpn-kamidana", (48, 16, 30), "a Japanese kamidana shrine shelf",
    "A KAMIDANA: a plain shelf of pale unpainted cypress wood mounted on a wall, on it a small miniature shrine of pale wood with a little gabled roof and"
    " closed doors in its middle, a small sakaki branch in a white vase each side, and a thick twisted straw rope (shimenawa) with white zigzag paper"
    " streamers hung along the shelf's front edge. Dignified and simple.", "a small wooden shrine on a shelf with a straw rope across it",
    ["a shelf with a small wooden shrine on it", "a twisted straw rope along its front"], ["a weapon", "a bookcase"], tier="jpn", hung=True)
role("jpn-bokken-rack", "rack of wooden practice swords and staves standing against a wall", "floor", "1", (48, 12, 66), "wood", f"{J}!", "mesh", "P1", "the dojo's side walls")
add("jpn-bokken-rack", "jpn-bokken-rack", (48, 12, 66), "a Japanese dojo rack of wooden practice swords",
    "A dojo weapon rack standing against a wall: a stout frame of pale wood with two cross bars, holding upright side by side SIX pale wooden practice"
    " swords (bokken, thick curved wooden swords) and two long thick wooden staffs; all of pale honey wood, no metal blades.",
    "a wooden rack of upright wooden practice swords and staffs", ["a rack holding wooden swords upright"], ["steel blades", "a spear rack with metal heads"], aspect="portrait", tier="jpn")
role("jpn-taiko", "taiko drum on its wooden stand", "floor", "1", (40, 32, 50), "wood", f"{J}!", "mesh", "P1", "a dojo corner by the front wall; a shrine hall's side")
add("jpn-taiko", "jpn-taiko", (40, 32, 50), "a Japanese taiko drum on its stand",
    "A large TAIKO drum held UPRIGHT on edge, high in a tall thick wooden frame stand with splayed legs, so one big round drum HEAD faces the viewer"
    " like a great round face: the head is pale cowhide with a bold black-and-red three-comma MITSUDOMOE swirl painted in its middle and a ring of big"
    " round brass tacks round its rim; the short fat body of glossy dark red-brown wood shows only as a band behind the head; two thick wooden"
    " drumsticks crossed in the stand (v2, 2026-11-06: the first, lying drum read as a barrel on a stand).", "a big drum standing on edge in a tall stand, its painted round head facing out",
    ["a large barrel drum on a stand"], ["a barrel of drink", "a cart wheel"], tier="jpn")
role("jpn-armour-chest", "suit of samurai armour seated on its storage chest", "floor", "1", (30, 26, 66), "mixed", f"{J}!", "mesh", "P1", "a samurai house's room, the dojo's front corner")
add("jpn-armour-chest", "jpn-armour-chest", (30, 26, 66), "a suit of Japanese samurai armour displayed on its chest",
    "A suit of Edo-period samurai ARMOUR (yoroi) displayed sitting on its square black lacquered storage chest: a helmet with a broad flared neck guard and"
    " a pair of short flat golden crests, a lacquered breastplate, wide skirt plates and shoulder plates of rows of dark red and black lacquered scales laced"
    " with thick deep-blue cords, the sleeves resting on the knees. No face, no person inside, no weapons.", "samurai armour sitting on a black chest",
    ["a suit of samurai armour", "a chest under it"], ["a person", "a sword"], aspect="portrait", tier="jpn")

# ---- the shrine hall (haiden) and its approach ----
role("jpn-shinsen-altar", "shrine offering table before closed sanctum doors: offerings on stands, sakaki branches, a round mirror stand", "floor", "1x2", (72, 30, 54), "wood", f"{J}!", "mesh", "P1", "the far end of the shrine hall, on the axis; nothing placed on or before it but the offering box", aff="aff:-")
add("jpn-shinsen-altar", "jpn-shinsen-altar", (72, 30, 54), "a Shinto shrine's offering table",
    "A Shinto shrine OFFERING TABLE (hassokuan) of plain pale unpainted cypress wood with eight slim legs, standing before a low back panel of closed plain"
    " wooden doors with a thick twisted straw rope (shimenawa) hung across their top with white zigzag paper streamers. On the table, in a row, small plain"
    " wooden offering stands holding a mound of white rice, two small white sake flasks, and a pile of round fruit; at each end a white vase with a green"
    " SAKAKI branch. Plain, clean and calm; no statue, no image.", "a plain wooden offering table with offerings and green branches before closed doors",
    ["a plain wooden offering table", "offerings and green branches on it", "a straw rope over closed doors"], ["a statue or idol", "a skull", "gold coins"], aspect="landscape", tier="jpn")
role("jpn-bell-rope", "shrine bell (suzu) with its thick striped rope, hung from the ceiling", "ceiling", "sub", (20, 20, 84), "mixed", f"{J}!", "mesh", "P1", "over the offering box at the front of the shrine hall")
add("jpn-bell-rope", "jpn-bell-rope", (20, 20, 84), "a Shinto shrine bell with its rope",
    "A shrine BELL hanging from above: a large round brass bell (suzu) about the size of a melon with a slot across its lower half, and hanging from it a"
    " THICK braided rope of red, white and purple cloth as thick as an arm, falling about 6 ft, with a fat tassel at its end.", "a round brass bell hanging on a thick red and white rope",
    ["a round bell at the top", "a thick hanging rope below it"], ["a lantern", "a noose"], aspect="portrait", tier="jpn", hung=True)
role("jpn-saisen-bako", "shrine offering box with a slatted top", "floor", "1x2", (54, 24, 30), "wood", f"{J}!", "mesh", "P1", "before the shrine hall's offering table, under the bell")
add("jpn-saisen-bako", "jpn-saisen-bako", (54, 24, 30), "a Shinto shrine offering box",
    "A shrine OFFERING BOX (saisen-bako): a long low sturdy box of dark-stained wood with black iron corner fittings, its top a row of slanting wooden slats"
    " like a grate, a small plain round crest on its front.", "a long wooden box with a slatted top", ["a long box with a slatted top"], ["a chest with a lid", "a bench"], tier="jpn")
role("jpn-komainu", "komainu guardian lion-dog statue on its stone plinth (placed as a mirrored pair)", "floor", "1", (26, 32, 44), "stone", f"{J}!", "mesh", "P1", "a pair either side of the shrine entrance, facing the approach")
add("jpn-komainu", "jpn-komainu", (26, 32, 44), "a Japanese komainu guardian lion-dog statue",
    "A KOMAINU guardian statue of pale grey granite: a seated lion-dog with a curly mane in big carved spiral curls, a fat bushy tail curling up behind,"
    " broad chest, front legs straight, mouth open, sitting on a low square stone plinth.", "a stone lion-dog guardian statue on a plinth",
    ["a seated stone lion-dog statue"], ["a real dog", "a dragon"], tier="jpn")
role("jpn-torii", "torii gate of vermilion-lacquered wood", "ground", "2x2", (144, 30, 144), "wood", f"{J}!", "mesh", "P1", "astride the shrine approach, facing the way in")
add("jpn-torii", "jpn-torii", (144, 30, 144), "a Japanese vermilion torii gate",
    "A TORII gate: two thick round upright pillars lacquered bright VERMILION with black bases, a straight tie beam across between them a little below the"
    " top, and over that a broad top lintel painted black on its upper face, its ends sweeping gently upward past the pillars; a short upright plaque post"
    " between the two beams, plain (no writing).", "a red torii gate", ["a red gate of two pillars and two cross beams"], ["a door", "a fence"], aspect="square", tier="jpn")
role("jpn-toro", "stone lantern (toro)", "ground", "sub", (26, 26, 66), "stone", f"{J}!", "mesh", "P1", "lining a shrine approach; one in a tea garden by the basin", aff="aff:lit")
add("jpn-toro", "jpn-toro", (26, 26, 66), "a Japanese stone lantern",
    "A Japanese STONE LANTERN (kasuga-doro) of weathered grey granite: a round base, a thick round post, a broad platform, a hexagonal light box with square"
    " window openings, a wide hexagonal roof with curled-up corners and a round jewel knob on top." + UNLIT, "a tall grey stone lantern with a wide roof",
    ["a tall stone lantern with a wide roof"], ["a lamp post of iron", "a pagoda building"], aspect="portrait", tier="jpn", light="lamp")
role("jpn-chozuya", "chozuya purification basin pavilion: a stone water basin with bamboo ladles under a small roof", "ground", "1x2", (72, 48, 96), "mixed", f"{J}!", "mesh", "P1", "beside the shrine approach before the hall: wash before worship")
add("jpn-chozuya", "jpn-chozuya", (72, 48, 96), "a Japanese shrine purification basin pavilion",
    "A CHOZUYA: a long rectangular basin cut from grey granite, filled to the brim with still water painted as a smooth teal surface, a row of three"
    " long-handled bamboo ladles laid across its rim, under a small open pavilion of four thick dark wooden posts carrying a little tiled roof with gently"
    " curved eaves.", "a stone water basin with ladles under a small roofed pavilion", ["a stone water basin", "a small roof on four posts over it"], ["a well with a bucket", "a horse trough"], tier="jpn")

# ---- the sake merchant's shop (sakaya) ----
role("jpn-shop-platform", "merchant's raised tatami platform with the counting desk and its low lattice screen (choba)", "floor", "2x2", (96, 48, 40), "wood", f"{J}!", "mesh", "P1", "the back of a machiya shop, facing the earthen floor by the door")
add("jpn-shop-platform", "jpn-shop-platform", (96, 48, 40), "a Japanese merchant's raised counting platform",
    "A MERCHANT'S PLATFORM: a raised wooden platform about 18 in high with a thick dark wooden edge beam, its top covered with two pale green-gold tatami mats"
    " with dark cloth borders; on it a low writing desk with an abacus (soroban, a thick frame with rows of fat round beads) and a stack of bound ledgers,"
    " and before the desk a low folding wooden lattice screen (choba-goshi) about 18 in high. Small, square, dark-wood and tatami.",
    "a raised tatami platform with a low desk, an abacus and a low lattice screen", ["a raised platform with tatami on top", "a low desk and an abacus"], ["a bed", "a shop counter of European style"], aspect="landscape", tier="jpn")
role("jpn-sake-casks", "stack of straw-wrapped sake casks (komodaru)", "floor", "1", (60, 30, 44), "organic", f"{J}!", "mesh", "P1", "a sake shop's walls and floor; a festival's offering")
add("jpn-sake-casks", "jpn-sake-casks", (60, 30, 44), "a stack of Japanese straw-wrapped sake casks",
    "A pyramid stack of THREE big round sake casks (komodaru) lying on their sides, two below and one on top, each cask wrapped in thick pale straw matting"
    " bound with dark rope bands, its round end showing a bold painted red-and-black crest circle (no writing).", "a stack of three straw-wrapped barrels",
    ["round casks wrapped in straw"], ["wooden staved barrels with iron hoops", "hay bales"], tier="jpn")
role("jpn-sugidama", "sugidama: the ball of cedar sprigs hung over a sake shop's door", "wall", "sub", (24, 24, 26), "organic", f"{J}!", "mesh", "P1", "hung over the sake shop's street door", mount=78)
add("jpn-sugidama", "jpn-sugidama", (24, 24, 26), "a Japanese sugidama cedar ball",
    "A SUGIDAMA: a big round ball of tightly packed green cedar sprigs, smooth and solid like a topiary ball, hanging from a short thick dark wooden bracket"
    " with a thick rope.", "a round green ball of cedar hanging from a bracket", ["a round green ball hanging from a bracket"], ["a lantern", "a bush in a pot"], tier="jpn", hung=True)
role("jpn-shop-shelves", "shop shelves of ceramic sake flasks and lidded jars", "floor", "1x2", (60, 18, 72), "wood", f"{J}", "mesh", "P1", "a sake shop's back and side walls")
add("jpn-shop-shelves", "jpn-shop-shelves", (60, 18, 72), "Japanese shop shelves of sake flasks",
    "A tall open shelf unit of honey-brown wood with four shelves, holding rows of fat ceramic sake flasks (tokkuri) in cream and brown glazes, lidded"
    " stoneware jars and small wooden measuring boxes (masu). Few big pieces, packed close.", "tall wooden shelves of ceramic flasks and jars",
    ["tall shelves", "ceramic flasks and jars on them"], ["books", "glass bottles"], aspect="portrait", tier="jpn")

# ---- the tea garden (roji) ----
role("jpn-maple", "Japanese maple tree in autumn red", "ground", "2x2", (110, 110, 132), "organic", f"{J}!", "mesh", "P1", "a tea garden's corner, over the basin")
add("jpn-maple", "jpn-maple", (110, 110, 132), "a Japanese maple tree",
    "A small JAPANESE MAPLE tree: a short thick grey trunk, and over it ONE broad low DOME of bright RED and orange foliage, a single solid rounded mass"
    " with a softly lumpy surface, wider than it is tall, its edge coming down to about 2 ft above the ground all round so the trunk shows only at the"
    " bottom; no separate branches, no gaps, no holes in the crown (v2, 2026-11-06: the first crown's separate layers left a third of the mesh unpainted).",
    "a small tree with a red crown", ["a small tree with red leaves"], ["fruit", "a pine"], leafy=True, tier="jpn")
role("jpn-pine", "pruned Japanese black pine with layered pads of needles", "ground", "2x2", (110, 110, 120), "organic", f"{J}!", "mesh", "P1", "a garden's focal tree; a shrine approach")
add("jpn-pine", "jpn-pine", (110, 110, 120), "a pruned Japanese black pine",
    "A pruned JAPANESE BLACK PINE: a thick twisting dark trunk leaning to one side, its branches carrying flat cloud-like PADS of dark green needles in"
    " separate layers, like a big garden bonsai.", "a twisted pine tree with flat cloud-shaped pads of needles", ["a twisted tree with flat green pads"], ["a round bush", "red leaves"], leafy=True, tier="jpn")
role("jpn-tsukubai", "tsukubai: low stone wash basin with a bamboo spout and stepping stones", "ground", "1", (40, 36, 30), "stone", f"{J}!", "mesh", "P1", "on the way to the tea house, beside its lantern")
add("jpn-tsukubai", "jpn-tsukubai", (40, 36, 30), "a Japanese tsukubai stone wash basin",
    "A TSUKUBAI: a low round granite basin with a round hollow of still teal water in its top, a thick bamboo pipe spout reaching over it from one side on"
    " a short post, one bamboo ladle resting across the rim, and a few big flat rounded stones set round its foot.", "a low round stone basin with a bamboo spout",
    ["a low stone basin with water", "a bamboo spout"], ["a fountain with a statue", "a well"], tier="jpn")
role("fence-bamboo", "low bamboo garden fence (yotsume-gaki): stout canes tied with black rope", "kit", "edge", (60, 6, 48), "organic", f"{J}", "kit", "P1", "a tea garden's and shrine court's open edges")
add("fence-bamboo", "fence-bamboo", (60, 6, 48), "a Japanese bamboo garden fence section",
    "ONE straight section of a Japanese bamboo fence (yotsume-gaki): three thick upright green-gold bamboo posts and four thick horizontal bamboo rails,"
    " crossed in an open grid and tied at every crossing with neat black rope knots; about 5 ft long and 4 ft tall. Both ends are clean cuts so sections"
    " butt together.", "a bamboo fence section in an open grid", ["a fence section of bamboo poles"], ["a wooden plank fence", "a gate"], aspect="landscape", tier="jpn", kit=True)

# ---- flats (painted by flats/gen.py, not meshes): the floors and the stepping stones ----
role("floor-tatami", "tatami mats with dark cloth borders, laid edge to edge", "ground", "1", (60, 60, 1), "organic", f"{J}!", "flat", "P1", "the tatami room, the tea house")
role("floor-jpn-cedar", "polished honey-coloured cedar floorboards", "ground", "1", (60, 60, 1), "wood", f"{J}", "flat", "P1", "the dojo, the shrine hall")
role("floor-jpn-moss", "soft green moss ground of a tea garden", "ground", "1", (60, 60, 1), "organic", f"{J}", "flat", "P1", "the tea garden")
role("decal-stepping-stones", "a flat natural stepping stone set in the ground", "floor", "sub", (26, 20, 0.2), "stone", f"{J}", "flat", "P1", "laid along a garden path")

INTRO = """# Japan objects: the JPN culture pack (2026-11-06, cultures-a)

A Kyoto townhouse, tea house and Shinto shrine of the late Edo period (c. 1800-1850): the tatami room, the tea house, the
dojo, the shrine hall and its approach, a sake merchant's shop, the tea garden. Prompts and build order:
`experiments/2026-11-06-cultures-a/spec_jpn.py`; reads `experiments/2026-11-06-cultures-a/ROOM_READS.md`. Every mesh is
in the exclusive tier `jpn`. The shrine's pieces (offering table, bell, offering box, komainu, torii, chozuya, kamidana)
are placed only by the shrine and dojo rooms, as their worship spaces have them; never as loose dressing.

## J Japan
"""
write("jpn", "japan", INTRO)
