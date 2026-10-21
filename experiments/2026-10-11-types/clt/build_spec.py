#!/usr/bin/env python3
"""Cult sanctum type (Harry 2026-10-11: "go ahead and build out the rest of the fantasy genre type assets ... the wiz
tower and cult sanctum and such"): every NEW mesh the nine sanctum rooms need.
Same format as experiments/2026-10-05-castle-crypt-mansion/crypt/build_spec.py (add(), STYLE, NOBASE, parent= for
siblings; extra fields prio, rooms, bench, hung, light, twin_of). Writes assets.json for tools/gen.py (plates from the
FREE Codex image route). Nothing is generated here.
    python3 build_spec.py

FLAVORS. The architecture and furniture are flavor-NEUTRAL (black stone, altar slab, braziers, cages, robes, hidden-door
pieces: no emblem, no creature, no symbol on any of them). All iconography is on the `flavor-*` roles, one mesh per
flavor, sku `<role>--<flavor>`; this batch fills `devils` and `spiders`. The two flat slots (banner, floor sigil) are in
flats.json. Scheme: tools/spawn-tuner/ROOMS.md -> "Flavor slots".

Groups: p1/p2/p3 = independent pieces of that prio; sib1/sib2 = pieces of that prio painted FROM the accepted plate of a
parent in a p group (inputs/<parent>.jpg). Run order: p1, sib1, p2, sib2, p3.
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
HEAD = "Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset:"
assert HEAD in STYLE
roles = {}
for p in sorted((ROOT / "catalog").glob("*.catalog.md")):
    roles.update(ct.parse_catalog(p)[0])

FAMILY = "black-stone"
NOBASE = (" It stands on nothing: NO ground disc, NO floor patch, NO rubble, NO base slab or platform under it that the real object would not have."
          " The background is flat chroma blue, so the object itself has NO blue anywhere (no blue cloth, gems, glass or highlights; black stone is charcoal and warm grey-black, never blue-black).")
NOBLUE = " The background is flat chroma blue, so the object itself has NO blue anywhere (no blue cloth, gems, glass or highlights; black stone is charcoal and warm grey-black, never blue-black)."
STONE = (" The stone is never plain and never pure black: every face carries deep, chunky carved mouldings or sunk panels and clear painted colour variation"
         " (charcoal, warm dark grey, paler grey worn edges and arrises, a few dull rust-red mineral streaks), so its shape reads clearly.")
NEUTRAL = " It carries NO emblem, NO symbol, NO face, NO animal or monster shape and NO writing anywhere: only plain mouldings, grooves and bands."
UNLIT = " It is UNLIT: no flame, no glow, no smoke, no light painted on it; wicks are dark and unburnt-looking, any fuel is cold and grey-black."
CARVED = " The figure is clearly a STONE CARVING, the same stone as its plinth, simplified, blocky and stout, not a living creature. Menacing, not gory: no blood, no wounds."
STOUT = " Every part is deliberately thick, chunky and toy-like, with no thin wires, strings, chains or spindly parts, so it reconstructs cleanly in 3D."
MATCH = ("The supplied image is an existing {what}. The new piece must look made as part of the same set:"
         " the SAME materials, colours, thicknesses, carving style, painting style and camera angle. Change ONLY what is described below.\n\n")
TWIN = ("Edit task. The supplied image shows {what} in the Turnip Works hand-painted house style. Show the SAME object: identical material, colours, carving,"
        " proportions and painting style, from the same three-quarter view from slightly above. Do not redesign it.\n\n")

# --- the black-stone wall family: 5 ft wide x 9 ft tall kit panels seen from the broad side
WALL_MATCH = ("The supplied image is the existing plain wall section of this same underground sanctum: big, smooth-dressed, near-black basalt blocks with ONE band course of dull dark red stone."
              " The new piece must look cut from the same wall: the SAME block size and number of courses, the same charcoal-black stone, the same dark red band at the same height, the same thin pale mortar lines,"
              " the same overall size and proportions (a tall narrow upright panel about 5 ft wide x 9 ft tall, almost twice as tall as wide), painting style and camera angle."
              " Change ONLY what is described below.\n\n")
WALL_TAIL = (" Nothing else: NO floor, NO ground, NO base slab or platform under it, NO roof, NO vault, NO corner return, NO torch, NO furniture."
             " Both side edges are clean, flat, vertical cuts and the top is one level line, so this piece butts against the plain wall pieces to make a longer wall."
             " It stands directly on its bottom course with no footing. Seen from its broad room-facing side at a slight three-quarter angle. Keep the WHOLE object well inside the frame."
             " The background is flat chroma blue, so the wall itself has NO blue anywhere (the black stone is charcoal and warm grey-black, never blue-black).")
WALL_MUST = ["one single upright wall section of very dark, near-black stone blocks, clearly taller than it is wide"]
WALL_NOT = ["a floor, base slab, roof or corner return", "a window", "a torch, sconce or furniture attached to the wall", "an emblem, face, symbol or writing carved on the wall"]

assets = []
def add(sku, obj, group, prio, rooms, subject, design, desc, must=(), must_not=(), size=None, parent=None, what="", base=True,
        wall=False, twin_of=None, hung=False, light=None, bench=(), route="trellis", flavor=None, kit=None, opening=None):
    role = roles[obj]
    w, d, h = size or role["size"]
    tail = WALL_TAIL if wall else (NOBASE if base else NOBLUE)
    detail = (f"{design} Real-world size about {w:g} in wide x {d:g} in deep x {h:g} in tall: keep these proportions." + (UNLIT if light else "") + tail
              + " Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.")
    prompt = STYLE.format(subject=subject, detail=detail)
    refs, gate_refs = [STYLE_REF], []
    must, must_not = list(must), list(must_not)
    if parent:
        pp = str(HERE / "inputs" / f"{parent}.jpg")
        lead = TWIN.format(what=what) if twin_of else (WALL_MATCH if wall else MATCH.format(what=what))
        prompt = prompt.replace(HEAD, lead + "Create a single asset in the Turnip Works house style (heroic hand-painted):")
        refs, gate_refs = [pp], [pp]
        must.append("it is the SAME object as the REFERENCE (same material, colours and carving); only the described open state differs" if twin_of
                    else f"materials, colours and style match the REFERENCE {what or 'wall section'} (the described change is the intended difference)")
    if wall:
        must, must_not = WALL_MUST + must, WALL_NOT + must_not
    if light:
        must_not.append("a painted flame, glow or smoke")
    if base and not wall:
        must_not.append("a ground disc, floor patch or base slab under the object that it would not really have")
    a = {"id": sku, "object": obj, "group": group, "source": "generate", "lane": "3d", "subject": subject, "size": [w, d, h],
         "prompt": prompt, "refs": refs, "gate_refs": gate_refs, "gate": {"desc": desc, "must": must, "must_not": must_not},
         "prio": prio, "rooms": list(rooms), "bench": list(bench), "route": route,
         "provenance": "text prompt + our own style reference (style-references/heroic-handpainted-tavern-v1.png)" + (f" + our own parent plate {parent}" if parent else "") + "; no third-party image"}
    if wall: a["family"], a["generation"] = FAMILY, "kit"
    if kit: a["kit"] = kit
    if opening: a["opening"] = opening
    if hung: a["hung"] = True
    if light: a["light"] = light
    if twin_of: a["twin_of"] = twin_of
    if flavor: a["flavor"] = flavor
    assets.append(a)

ENTRY, PASS, SANC, SUMM, CELLS, VEST, LIB, QUART, VAULT = ("cult-entry", "cult-passage", "cult-sanctum", "cult-summoning", "cult-cells", "cult-vestry",
                                                            "cult-library", "cult-quarters", "cult-vault")
ALL = [ENTRY, PASS, SANC, SUMM, CELLS, VEST, LIB, QUART, VAULT]

# ================================================================ wall kit: family black-stone
W0 = "wall-straight--black-stone"
add(W0, "wall-straight", "p1", 1, ALL, "full-height wall segment of smooth near-black basalt blocks for a hidden underground sanctum",
    "Coursed, smooth-dressed, very dark charcoal-black basalt blocks, about ten courses of big blocks, each course only two or three blocks long, with thin PALE grey mortar lines so the block pattern reads clearly."
    " The block faces vary in tone (charcoal, soot black, warm dark grey, one or two slightly brown-black blocks) and their edges are a little paler and worn."
    " ONE course at about two thirds of the height is a band of dull DARK RED stone (oxblood, matte, a little chipped) running the full width; a plain, slightly projecting band course of the black stone runs along the very top."
    " A few faint dull rust-red streaks run down from the red band. Otherwise completely plain." + NEUTRAL +
    " ONE single straight wall section standing upright, about 5 ft wide x 9 ft tall x 1 ft thick. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end). It must NOT be square and must NOT be wider than it is tall.",
    "one upright section of wall built of very dark, near-black dressed stone blocks in courses, with one band course of dull dark red stone",
    ["coursed stone blocks with visible mortar lines", "the stone is very dark, charcoal to black (not pale grey, not brown brick)", "one horizontal band of dark red stone"],
    ["niches, arches or openings in the wall", "bones or skulls"], wall=True)
add(W0 + "--s2", "wall-straight", "sib1", 1, ALL, "a second plain wall segment of the same near-black sanctum stone",
    "The same black basalt wall, a different section of it: the blocks break joint in a different pattern, ONE block in the lower courses is a larger stone with a plain sunk square panel,"
    " one block near the top has a chipped corner, and one block of the dark red band is a little paler than the rest. Still a completely plain, solid wall with the same red band and the same band course along the top." + NEUTRAL,
    "one upright section of plain wall built of near-black dressed stone blocks with a dark red band, a different section from the reference",
    ["coursed stone blocks with mortar lines", "a solid wall with no opening"], ["niches, arches or openings in the wall", "bones or skulls"], parent=W0, wall=True)
add("wall-doorway--black-stone", "wall-doorway", "sib1", 1, ALL, "near-black sanctum wall segment with an empty door opening",
    "The same black basalt wall with an EMPTY door-sized opening through it, starting at the very bottom: about 3.5 ft wide and 7 ft tall, centred left to right, with a flat stone lintel whose underside is cut to a shallow trapezoid (a corbelled head)."
    " NO door leaf, NO threshold step. The opening is framed by big plain jamb blocks of the same black stone, a little paler where hands have worn them; the lintel is one great block of the dull dark red stone."
    " About 9 in of wall remains on each side of the opening and two full courses run unbroken above the lintel. You can see straight through the opening to the blue background." + NEUTRAL,
    "a section of near-black stone block wall with one empty door-sized opening through it (no door leaf)",
    ["one door-sized opening that reaches the bottom of the wall, with NO door in it (you can see through)", "stone courses continue above the opening"],
    ["a door leaf or gate filling the opening", "steps"], parent=W0, wall=True)
add("wall-alcove--black-stone", "wall-alcove", "sib1", 1, [PASS, SANC, VAULT], "near-black sanctum wall segment with one deep arched alcove",
    "The same black basalt wall, made 1.5 ft thick, with ONE deep alcove cut into its room-facing side: a tall round-arched recess about 3 ft wide x 6 ft high and a full foot deep, starting 1 ft above the bottom,"
    " its arch made of thick wedge stones of the dull dark red stone and its sill a projecting slab of the same red stone. The alcove is a real dark hollow with a visible back, sides and sill, NOT a painted panel, and it does NOT go through the wall."
    " It is EMPTY except for a low mound of old cream candle wax with three stubby unlit candle stumps on the sill. About 1 ft of plain black wall remains each side and two courses run above the arch." + NEUTRAL,
    "a section of near-black stone wall with one tall arched alcove recessed into its face, empty but for a few candle stumps on its sill",
    ["one tall arched recess in the wall face that does not go through the wall", "the recess is an empty hollow"],
    ["a hole that goes right through the wall", "a statue, figure or skull in the alcove", "a lit flame"], size=(60, 18, 108), parent=W0, wall=True, opening="panel")
add("wall-secret-door--black-stone", "wall-secret-door", "sib2", 2, [ENTRY, PASS, VAULT], "near-black sanctum wall segment whose middle is a hidden stone door standing ajar",
    "The same black basalt wall, but its middle is a HIDDEN DOOR caught standing open: a slab of the wall's own blockwork about 3 ft wide x 6.5 ft tall, starting at the very bottom, has pivoted on its centre like a revolving door"
    " and now stands turned about 35 degrees, one edge swung out toward the viewer and the other edge swung back, so a dark gap shows down both sides of it and you can see through the gaps to the blue background."
    " The slab is as thick as the wall and built of the same black blocks, with the dark red band running across it at the same height, so that shut it would vanish into the wall."
    " The opening it leaves has plain square stone edges; about 1 ft of wall remains on each side and two courses run unbroken above. A stout iron ring is set in the slab's face." + NEUTRAL,
    "a section of near-black stone wall in which a door-sized slab of the same stonework has pivoted partly open like a hidden revolving door",
    ["a door-sized slab of stonework turned at an angle to the wall", "a dark gap beside the slab where the wall is open"],
    ["a wooden door", "a fully closed, unbroken wall", "steps"], size=(60, 16, 108), parent=W0, wall=True, opening="door", bench=["hinge"])

# ================================================================ hidden entrance: the bookcase door
BK = "door-secret-bookcase--leaf"
add(BK, "door-secret-bookcase", "p2", 2, [ENTRY, LIB], "a tall bookcase that is secretly a door",
    "ONLY the bookcase, with NO wall and NO door frame: a tall, plain bookcase of dark stained oak about 3.3 ft wide x 7.5 ft tall and 16 in deep, seen from its broad front, closed flat."
    " A solid plank back, thick side boards, a moulded cornice on top and a plain plinth board at the bottom that reaches the floor. FIVE thick shelves, every one packed full of chunky old books in dull colours"
    " (oxblood, moss green, tan, black, ochre) with a few lying flat; no gaps you can see through. The books are simplified solid blocks, part of one mass with the shelves."
    " The only clues that it is a door: two heavy black iron strap hinges on the left edge and one book on the middle shelf that leans out a little, its spine worn pale." + STOUT,
    "one tall wooden bookcase full of books, closed, seen from the front, with iron hinges on one side",
    ["a tall bookcase with shelves full of books", "it is one flat, closed piece of furniture"], ["a wall or a door frame around it", "an open door or a gap behind the books", "letters or writing on the spines"],
    kit="wall", opening="door", bench=["hinge"])
add("door-secret-bookcase-open", "door-secret-bookcase-open", "sib2", 2, [ENTRY, LIB], "the same bookcase door swung open",
    "The same bookcase, now SWUNG OPEN like a door on its left-hand hinges: it stands turned about 80 degrees, so we see its book-filled front at a steep angle and its plain plank BACK edge-on,"
    " with a thick black iron hinge post at the hinge side. Nothing else: NO wall, NO door frame, NO passage painted behind it. It still stands upright on its plinth board, books in place.",
    "a tall bookcase full of books standing turned sideways as if swung open like a door",
    ["a tall bookcase with shelves full of books, turned at an angle"], ["a wall, a doorway or a room behind it", "books falling out"],
    parent=BK, what="a tall bookcase that is secretly a door, closed", twin_of=BK, kit="wall", opening="door", bench=["hinge"])

# ================================================================ flavor-neutral focal pieces
A0 = "altar-sacrificial--s1"
add(A0, "altar-sacrificial", "p1", 1, [SANC], "a great black stone altar slab",
    "A massive altar: one thick rectangular top slab of polished near-black stone, about 3.3 ft wide x 7 ft long and 8 in thick, overhanging a stout base block of rougher charcoal stone with deep sunk panels on all four sides."
    " The top is bare and dished very slightly, with a shallow groove running round it an inch from the edge that leads to a small spout notch at one end. A band of dull dark red stone runs round the base block."
    " A heavy iron ring hangs flat against each end of the base. Three steps of wear polish the floor-side edges paler. Total height about 3.2 ft. It stands directly on the floor on its own base block."
    + STONE + NEUTRAL + " NO cloth, NO candles, NO objects on it, NO blood.",
    "one big, long altar of very dark stone: a thick flat slab on a panelled stone base, with nothing on it",
    ["a long rectangular stone table-like block with a thick flat top", "the stone is very dark"], ["a body, bones or blood", "candles, cloth or objects on top", "a carved face, animal or symbol"])
add("altar-sacrificial--s2", "altar-sacrificial", "sib1", 1, [SANC, VAULT], "a second black stone altar of the same sanctum",
    "The same kind of altar, a different one: the thick black top slab rests on TWO massive block legs (one at each end, each as wide as the slab and 1.5 ft thick) instead of one base block, with a clear dark hollow between them;"
    " each leg has one sunk panel and the dark red band. One corner of the top slab is chipped. Same groove round the top, same iron ring on each end." + NEUTRAL + " NO cloth, NO candles, NO objects on it, NO blood.",
    "one long altar of very dark stone: a thick flat slab resting on two massive stone block legs, with nothing on it",
    ["a long thick stone slab on two stone supports", "the stone is very dark"], ["a body, bones or blood", "candles, cloth or objects on top", "a carved face, animal or symbol"],
    parent=A0, what="great black stone altar")
H0 = "statue-hooded--s1"
add(H0, "statue-hooded", "p1", 1, [PASS, SANC, VAULT], "a stone statue of a hooded, faceless robed figure holding a bowl",
    "A larger-than-life statue, about 7.5 ft tall with its plinth: a standing figure in a long, heavy, floor-length robe with wide sleeves and a deep hood pulled forward. Inside the hood there is only a smooth, dark, empty hollow: NO face at all."
    " Both hands, hidden in the sleeves, hold a wide shallow stone bowl in front of the chest. The robe falls in a few broad, simple, chunky folds straight to a square two-step plinth carved from the same block, which is part of the statue."
    " Dark grey stone, paler and worn on the hood, shoulders and bowl rim, with a little dull red mineral streaking from the bowl." + CARVED + NEUTRAL,
    "one tall stone statue of a robed figure with a deep hood and no visible face, holding a bowl, on its own plinth",
    ["a standing hooded, robed statue made of stone", "the hood is empty or shadowed: no face"], ["a visible face, skull or horns", "wings", "a weapon", "a living person in cloth robes"])
add("statue-hooded--s2", "statue-hooded", "sib1", 1, [PASS, SANC], "a second hooded stone statue of the same set",
    "The same statue type, a different pose: the hooded, faceless robed figure stands with its head bowed and both arms crossed over its chest, hands hidden in the sleeves, holding nothing."
    " The same heavy robe in broad chunky folds, the same square two-step plinth, the same dark grey stone with paler worn hood and shoulders." + CARVED + NEUTRAL,
    "one tall stone statue of a robed, hooded, faceless figure with arms crossed on its chest, on its own plinth",
    ["a standing hooded, robed statue made of stone", "the hood is empty or shadowed: no face"], ["a visible face, skull or horns", "wings", "a weapon"],
    parent=H0, what="stone statue of a hooded faceless figure")
add("portal-arch--black", "portal-arch", "p1", 1, [SUMM], "a free-standing arch of black stone for a summoning chamber",
    "A free-standing gateway arch about 5 ft wide x 10 ft tall and 2 ft deep: two massive square piers of near-black stone blocks carrying a thick round arch of big wedge stones, alternating black and dull dark red."
    " The opening is EMPTY: you see straight through it to the blue background. Each pier stands on its own heavy moulded foot block and has a plain sunk panel on its face; a big plain keystone projects at the top."
    " A stout iron ring is fixed to the outer side of each pier. The inner edge of the arch is worn smooth and a little paler." + STONE + NEUTRAL,
    "one tall free-standing stone archway of very dark stone with an empty opening you can see through",
    ["two stone piers joined by an arch", "an empty opening through the arch"], ["a door, gate or swirling portal filling the opening", "a wall on either side", "carved faces, runes or symbols"])
add("spellbook-lectern--chained", "spellbook-lectern", "p1", 1, [LIB, SUMM], "a heavy lectern with a huge closed book chained to it",
    "A stout reading stand about 2 ft wide, 4 ft tall: a thick octagonal column of dark stained oak on a broad stepped foot, carrying a steeply sloped book-rest with a deep lip."
    " On the rest lies ONE huge CLOSED book, 18 in tall, bound in black leather with heavy brass corner plates and two big brass clasps, a plain round boss in the middle of its cover."
    " A single short, very THICK iron chain (five fat links, modelled like a solid rope of metal lying flat against the wood) runs from a ring on the book's spine to a staple on the column. A fat, unlit cream candle stump in an iron cup is fixed to one upper corner of the rest."
    + NEUTRAL + STOUT,
    "one sturdy wooden lectern with a very large closed black book lying on its sloped top, held by a short thick chain",
    ["a lectern or reading stand", "one big closed book on it"], ["an open book with visible pages", "glowing light or magic effects", "thin dangling chains hanging free in the air"])
add("robe-stand", "robe-stand", "p1", 1, [VEST, QUART], "a freestanding rail hung with hooded robes",
    "A sturdy freestanding clothes rail about 5 ft long x 5.5 ft tall: two thick dark oak end posts on broad cross feet, joined by a stout round top rail and a low stretcher."
    " FIVE identical long hooded robes hang from the rail on thick wooden pegs, shoulder to shoulder, filling the whole length: heavy matte wool the colour of dark charcoal brown, each with its deep hood hanging forward and a plain rope belt looped at the waist."
    " The robes are smooth, simplified and painted as one flat solid surface each, hanging in a few broad chunky folds, their hems an inch above the floor; together they read as one solid dark mass with five hood shapes along the top."
    + NEUTRAL + STOUT,
    "one freestanding wooden rail with a row of dark hooded robes hanging from it",
    ["several dark robes with hoods hanging side by side", "a wooden stand or rail holding them"], ["a person or face inside a robe", "a wall behind it", "emblems or symbols on the robes"])

# ================================================================ flavor-neutral furniture (prio 2)
add("pillar-square--black", "pillar-square", "p2", 2, [SANC, PASS, SUMM, VAULT], "a square pillar of near-black stone with a dark red band",
    "A massive free-standing square pillar, about 20 in square and 10 ft tall: a moulded foot block, a tall shaft built of five big drums of smooth near-black basalt with thin pale joints,"
    " ONE drum at shoulder height of dull dark red stone, and a plain heavy block capital that flares a little at the top. The arrises are chamfered and worn paler." + STONE + NEUTRAL,
    "one tall square stone pillar of very dark stone with a dark red band, with a base and a capital",
    ["one tall, straight, free-standing pillar", "the stone is very dark"], ["a wall or arch attached to it", "a statue, face or skull on it"])
add("cage-sacrifice", "cage-sacrifice", "p2", 2, [CELLS, SANC], "a heavy prisoner cage of thick timber and iron",
    "A cube-shaped cage about 4 ft square and 6 ft tall, EMPTY, door shut: a thick floor of dark oak planks, a thick plank roof, and between them FOUR massive square corner posts and, on each side, only THREE very thick square bars of dark oak (each as thick as a fence post, widely spaced)."
    " Broad black iron bands wrap the top and bottom edges, studded with big dome rivets; one side is a door with two chunky iron hinges and a big box padlock. A stout iron ring is bolted to the middle of the roof."
    " You can see into the cage between the bars: it is empty apart from a little straw on its floor. The wood is dark and worn paler at the edges; the iron has rust-brown patches." + STOUT,
    "one big empty box-shaped cage of very thick wooden bars with iron bands and a padlocked door",
    ["a cage with thick upright bars you can see between", "it is empty"], ["a person, animal or skeleton inside", "thin wire-like bars", "blood"], bench=["hinge"])
R0 = "robe-rack--s1"
add(R0, "robe-rack", "p2", 2, [VEST, QUART, ENTRY], "a wall peg rail hung with hooded robes",
    "A thick dark oak board about 2.5 ft long with a moulded shelf along its top, meant to be fixed high on a wall, and THREE fat turned wooden pegs under it. From each peg hangs one long hooded robe of heavy matte charcoal-brown wool,"
    " side by side, hoods hanging forward, falling in a few broad chunky folds to about 5 ft below the board. The robes are smooth, simplified, painted as one flat solid surface each, and together form one solid mass about 10 in deep."
    " Seen from the front, as if the wall behind it had been taken away: NO wall is shown." + NEUTRAL + STOUT,
    "a wooden peg board with three dark hooded robes hanging from it side by side",
    ["dark hooded robes hanging from pegs", "a wooden board or rail at the top"], ["a person or face inside a robe", "a wall behind it", "emblems or symbols on the robes"], hung=True)
add("robe-rack--s2", "robe-rack", "sib2", 2, [VEST, QUART], "a second wall peg rail of robes, one peg empty",
    "The same peg board, a different one: TWO hooded robes hang on the left and middle pegs; the right-hand peg is empty and from it hangs only a coiled, thick rope belt. On the shelf above stands one plain, smooth, pale bone-white oval mask with two dark eye slots and no other feature, leaning back."
    + NEUTRAL,
    "a wooden peg board with two dark hooded robes hanging from it, one empty peg, and a plain white mask on its shelf",
    ["dark hooded robes hanging from pegs"], ["a person or face inside a robe", "a wall behind it"], parent=R0, what="wooden peg rail hung with hooded robes", hung=True)
S0 = "rite-sigil-stone--s1"
add(S0, "rite-sigil-stone", "p2", 2, [SUMM, SANC], "a waist-high boundary stone for a ritual circle",
    "A stout standing stone about 14 in square at the foot and 28 in tall, tapering a little to a blunt, slightly domed top: one block of near-black basalt, roughly dressed, with ONE deep plain groove cut round it near the top like a collar"
    " and a band of dull dark red paint below the groove. The top has a shallow cup hollow holding a little cold grey ash. Worn paler on the arrises; it stands directly on the floor." + STONE + NEUTRAL,
    "one short, thick, dark standing stone with a groove and a dark red band round it",
    ["one squat upright stone block, taller than wide", "very dark stone"], ["letters, runes or a carved symbol", "a flame or glow", "a skull"], size=(14, 14, 28))
add("rite-sigil-stone--s2", "rite-sigil-stone", "sib2", 2, [SUMM, SANC], "a second boundary stone of the same ritual circle",
    "The same kind of standing stone, a different one: a little shorter and rounder in section, leaning very slightly, with TWO plain grooves round it and the dark red band between them; one corner of its foot is chipped away. The cup in its top is empty." + NEUTRAL,
    "one short, thick, dark standing stone with two grooves and a dark red band round it",
    ["one squat upright stone block", "very dark stone"], ["letters, runes or a carved symbol", "a flame or glow", "a skull"], size=(14, 14, 28), parent=S0, what="squat black boundary stone")
add("cauldron-bronze-ritual", "cauldron-bronze-ritual", "p2", 2, [VAULT, SANC], "a wide bronze offering bowl on three feet",
    "A big, wide, shallow offering cauldron about 30 in across and 22 in tall: a thick-walled bowl of dark, greened bronze with a heavy rolled rim, standing on THREE short, very thick legs that end in plain block feet,"
    " and two fat ring handles hanging flat against its sides. A band of plain raised ribs runs round the belly. Inside it is heaped level with offerings painted as one solid mass: dull gold and silver coins, a few rings and two small ingots."
    + NEUTRAL + STOUT,
    "one wide, shallow bronze bowl on three thick legs, filled with coins",
    ["a wide metal bowl or cauldron on short legs"], ["a flame or fire in the bowl", "blood", "a carved face or animal"], size=(30, 30, 22))
add("elemental-brazier", "elemental-brazier", "p2", 2, [SANC, SUMM, VAULT, PASS], "a great black iron fire bowl on a stone drum",
    "A big ceremonial brazier about 26 in across and 3 ft tall: a wide, deep bowl of thick black iron with a heavy flat rim, resting on a short, fat drum of near-black stone with a band of dull dark red stone round its middle and a broad moulded foot."
    " Three stout iron brackets clasp the bowl to the drum. The bowl is filled level with cold, grey-black charcoal lumps and pale ash, modelled as one solid mass." + NEUTRAL + STOUT,
    "one wide iron fire bowl full of cold charcoal on a short thick stone pedestal",
    ["a wide bowl on a short thick stand", "cold dark charcoal in the bowl"], ["thin tripod legs", "a carved face or animal"], size=(26, 26, 36), light="brazier", bench=["fire"])

# ================================================================ flavor slots: devils, spiders (ALL iconography lives here)
DEV = (" Flavor: DEVILS. Horns, bat wings, a barbed tail, cloven hooves, flames and tridents are the motifs; colours are brass, soot black and deep crimson. Menace, not gore: no blood, no victims, no nudity.")
SPI = (" Flavor: SPIDERS. Fat-bodied spiders, radiating webs, egg-sac orbs and fangs are the motifs; colours are black iron, pale bone-white web lines and a poison YELLOW-GREEN accent (never blue, never purple). Menace, not gore.")
add("flavor-idol--devils", "flavor-idol", "p1", 1, [SANC, VAULT], "a towering stone idol of a horned, winged devil",
    "A huge idol about 5 ft wide and 9 ft tall with its plinth: a massive, broad-shouldered devil SEATED on a block throne, leaning forward, clawed hands resting on its knees."
    " Two great thick ram-like horns curve up from its brow; big bat wings are folded tight against its back and shoulders like a cloak (solid slabs, not spread); a thick barbed tail curls round the base; cloven hooves rest on the plinth."
    " The face is a stern, heavy-browed mask with a short pointed beard and blank, deep-set eyes. Carved from dark red-brown stone (like dull oxblood granite), worn paler on the horns, knees and knuckles, with soot-black hollows;"
    " the square stepped plinth is part of the statue." + CARVED + DEV,
    "one huge seated stone statue of a horned devil with folded bat wings, on its own plinth",
    ["a big statue of a horned, winged, devil-like figure", "it is made of stone, with a plinth"], ["spread wings with thin membranes", "a living creature with skin and eyes", "blood or a victim", "a weapon held out on a thin shaft"],
    flavor="devils")
add("flavor-idol--spiders", "flavor-idol", "p1", 1, [SANC, VAULT], "a towering stone idol of a giant spider on a web-carved rock",
    "A huge idol about 5.5 ft wide and 8 ft tall: a giant, fat-bodied spider carved crouching on top of a tall, rough column of rock that it grips with all EIGHT legs."
    " The legs are very thick, short and arched, and every one is pressed against the rock and fused to it along its whole length like deep relief, so nothing sticks out thin into the air. A huge round abdomen, a smaller head-chest with a cluster of eight plain round bead eyes and two stout curved fangs pointing down."
    " The rock column under it is carved all round with a bold web of thick raised strands and has a square foot block. Carved from dark grey-black stone, worn paler on the legs' knees and the abdomen; the web strands are picked out in pale bone-white, the eyes and one stripe on the abdomen in poison yellow-green."
    + CARVED + SPI,
    "one huge stone statue of a giant fat spider crouching on top of a rock pillar carved with a web",
    ["a big statue of a spider with a round body and thick legs", "it sits on a rock or pillar base and is made of stone"], ["thin spindly legs sticking out into the air", "a real web of fine threads", "a living spider with hair"],
    flavor="spiders")
add("flavor-altarpiece--devils", "flavor-altarpiece", "p2", 2, [SANC, VAULT], "a brass altar-piece in the shape of a horned devil's head",
    "An altar ornament about 22 in wide and 2 ft tall: a heavy cast BRASS head of a devil, bigger than a man's, rising from a short, thick, flaring neck base that stands flat on the altar."
    " Two thick curling horns sweep up and back, a heavy brow, a hooked nose, a short pointed beard, and an open mouth that forms a dark round hollow like a small furnace door. Its eyes are two deep-red glass cabochons."
    " Dull, warm, tarnished brass, sooty black in the hollows and round the mouth, polished brighter on the horns and nose." + DEV + STOUT,
    "one large brass devil's head with two thick curling horns on a short base",
    ["a horned head made of metal", "a short base it stands on"], ["a whole body", "blood", "thin spiky parts"], flavor="devils", base=False)
add("flavor-altarpiece--spiders", "flavor-altarpiece", "p2", 2, [SANC, VAULT], "a black iron altar-piece of a spider clutching a pale orb",
    "An altar ornament about 22 in wide and 16 in tall: a fat black iron spider crouching over a big, smooth, pale bone-white ORB (an egg sac the size of a pumpkin), all eight thick legs wrapped down round the orb and joined to it and to a low round iron base ring."
    " The spider's round abdomen has one poison yellow-green stripe and its eight bead eyes are the same yellow-green; faint raised web lines cross the orb. The legs are short, thick and fused to the orb along their length: nothing thin sticks out."
    + SPI + STOUT,
    "one thick metal spider sitting on top of a big pale ball, gripping it with its legs, on a low base",
    ["a spider shape with a round body", "a big pale orb or ball under it"], ["thin spindly legs sticking out into the air", "a real hairy spider", "blue colour"], size=(22, 22, 16), flavor="spiders", base=False)
# (2026-10-11, Harry: "just a handful to set the motif, one or two centerpieces, and some 2d wall banners and floor tiles":
#  the relief slot is a FLAT wall card (flats/gen.py). Then he added slots 7 and 8: a core SCULPTURE that is not the idol,
#  and a flavor-styled FLYING BUTTRESS, usable inside, in the vertical kit's buttress box (36 x 48 x 108).)
add("flavor-sculpture--devils", "flavor-sculpture", "p1", 1, [SANC, PASS, VAULT], "a stone sculpture of two crouching imps back to back on a drum pedestal holding up a fire bowl",
    "A sculpture about 3 ft wide and 7 ft tall: a fat round drum pedestal carved with a ring of plain flame tongues, and on it TWO stout little devils crouching back to back, knees up, small thick horns, bat wings folded flat against their backs,"
    " their barbed tails coiled together round the pedestal. Between their shoulders they hold up one wide, shallow stone bowl. One solid, compact mass: no limb sticks out thin, and the bowl rests on both heads and all four raised hands."
    " Dark red-brown stone with soot-black hollows, worn paler on horns, knees and the bowl rim. The bowl is empty and cold." + CARVED + DEV,
    "one stone sculpture of two small horned, winged devil figures crouching back to back on a round pedestal, holding a bowl above them",
    ["two crouching horned figures carved in stone", "a pedestal under them and a bowl above"], ["one single big seated devil", "spread wings", "a flame in the bowl", "blood"], flavor="devils")
add("flavor-sculpture--spiders", "flavor-sculpture", "p1", 1, [SANC, PASS, VAULT], "a stone column of clustered egg sacs bound in thick web cords",
    "A sculpture about 3 ft wide and 7 ft tall: a thick column made of a dozen big, smooth, rounded egg-sac shapes (each the size of a barrel) piled and bulging on top of one another, bound together by a net of very THICK raised web cords, standing on a square foot block."
    " Three small fat spiders are carved in relief flat on the sacs at different heights, legs short and pressed to the stone. The top is a plain flat cap stone. One solid mass with nothing sticking out."
    " Dark grey-black stone; the egg sacs paler warm grey, the web cords picked out in pale bone-white, the little spiders with one poison yellow-green stripe each." + CARVED + SPI,
    "one stone column made of bulging rounded sacs bound in a thick carved web, with small spiders carved on it",
    ["a tall column of rounded bulging shapes", "a thick web or net pattern carved over it"], ["one single giant spider on top", "thin spindly legs sticking out", "real fine threads"], flavor="spiders")
BUT = (" It is a FLYING BUTTRESS section meant to stand against a wall: on the right, a massive upright pier about 3 ft wide and 1.5 ft deep, 9 ft tall, on a moulded foot; from the top of the pier ONE thick half arch springs out to the left and"
       " sweeps down in a quarter circle to end on a stout low footing block 4 ft away, leaving a clear open space under the arch that you can see through. Seen from the side, so the whole quarter arch shows. Everything is very thick and blocky (the arch rib is over a foot thick).")
add("flavor-buttress--devils", "flavor-buttress", "p2", 2, [SANC], "a flying buttress of dark red-brown stone whose arch is ridged like a horn and whose pier carries a horned mask",
    "The arch rib is carved like one great curving HORN, ridged along its back with a row of blunt triangular spikes, thick at the pier and a little thinner at the footing; the pier's front carries one big grim horned mask in deep relief and a plain flame-tongue band at its top."
    " Dark red-brown stone with soot-black hollows and paler worn edges." + BUT + CARVED + DEV,
    "one stone flying buttress seen from the side: a tall pier and a thick quarter arch sweeping down from it to a low block, carved with horns and spikes",
    ["a tall stone pier with a thick curved arch leaning from its top down to a lower block", "open space under the arch"], ["a complete round arch between two equal pillars", "a wall filling the space under the arch", "thin spikes"],
    size=(36, 48, 108), flavor="devils")
add("flavor-buttress--spiders", "flavor-buttress", "p2", 2, [SANC], "a flying buttress of dark stone whose arch is a great jointed spider leg",
    "The arch rib is carved as one great bent SPIDER LEG, very thick, with two bulging knuckle joints and a blunt clawed tip planted on the footing block; the pier's front is carved with a bold web of thick raised strands in pale bone-white and one fat spider in relief with a poison yellow-green stripe."
    " Dark grey-black stone with paler worn edges." + BUT + CARVED + SPI,
    "one stone flying buttress seen from the side: a tall pier and a thick jointed arch like a huge spider leg sweeping down from it to a low block",
    ["a tall stone pier with a thick curved or bent arch leaning from its top down to a lower block", "open space under the arch"], ["a whole spider", "a complete round arch between two equal pillars", "thin spindly parts"],
    size=(36, 48, 108), flavor="spiders")
add("flavor-censer--devils", "flavor-censer", "p2", 2, [SANC, VAULT, SUMM], "a standing brass candle-holder with a fat three-pronged trident head",
    "A floor-standing candle-holder about 20 in wide and 5 ft tall: a broad, heavy round brass foot shaped as three cloven hooves, a very thick twisted column, and at the top a short, FAT three-pronged trident head whose three stubby prongs each end in a wide cup holding one fat, dark crimson candle."
    " Tarnished warm brass, sooty in the hollows; old crimson wax has run down the prongs in thick solid drips." + DEV + STOUT,
    "one tall, thick brass candle stand with three stout prongs each holding a fat dark red candle",
    ["a tall floor-standing candle holder", "three thick candles at the top"], ["thin wiry arms", "blue colour"], light="candle", bench=["fire"], flavor="devils")
add("flavor-censer--spiders", "flavor-censer", "p2", 2, [SANC, VAULT, SUMM], "a standing black iron candle-holder topped by a spider carrying candles",
    "A floor-standing candle-holder about 20 in wide and 5 ft tall: a broad, heavy round black iron foot cast with a raised web pattern, a very thick plain column, and at the top a fat iron spider lying flat like a dish, legs curled up short and thick round its rim,"
    " carrying on its back FOUR fat, pale bone-white candles in a tight cluster. The spider's eyes and one stripe are poison yellow-green; old pale wax has run down the column in thick solid drips." + SPI + STOUT,
    "one tall, thick black iron candle stand whose top is a spider shape holding a cluster of fat pale candles",
    ["a tall floor-standing candle holder", "thick candles at the top"], ["thin spindly legs sticking out into the air", "blue colour"], light="candle", bench=["fire"], flavor="spiders")

# ================================================================ smalls (prio 3), all flavor-neutral
SM = [SANC, VAULT, SUMM]
add("candle-cluster", "candle-cluster", "p3", 3, ALL, "a cluster of fat melted candles",
    "A tight cluster of SEVEN fat cream-coloured candles of different heights (3 to 8 in), fused together at the bottom into one broad mound of melted wax that has run and pooled in thick solid drips. Everything is one chunky solid mass.",
    "a cluster of several fat pale candles of different heights melted together at the base", ["several candles joined by melted wax"], ["a candlestick or holder", "a skull"], light="candle", bench=["fire"], base=False)
add("candle-black", "candle-black", "p3", 3, [SANC, SUMM, VEST, LIB, QUART], "a fat black ritual candle in a low iron cup",
    "ONE fat, matte black candle about 2.5 in thick and 8 in tall, standing in a low, wide black iron cup with a flat rim; thick black wax drips run down one side into the cup.", "one thick black candle in a low metal cup",
    ["one black candle"], ["several candles", "a skull"], size=(4, 4, 9), light="candle", bench=["fire"], base=False)
add("dagger-ritual", "dagger-ritual", "p3", 3, SM, "a wavy-bladed ritual dagger",
    "ONE dagger about 15 in long lying flat: a broad, thick, WAVY blade of dark steel with a pale honed edge, a heavy brass crossguard with plain ball ends, a grip wrapped in black leather and a round brass pommel. Chunky and oversized, no fine detail."
    + NEUTRAL, "one dagger with a wavy blade, lying flat", ["a dagger with a wavy blade"], ["blood", "a sheath", "a hand"], base=False)
add("chalice-dark", "chalice-dark", "p3", 3, SM + [QUART], "a black iron chalice",
    "ONE heavy goblet about 8 in tall: a wide, thick-walled cup of black iron on a short fat stem with a big ball knop and a broad round foot; three plain raised bands round the cup; the rim worn to dull grey metal. It holds dark red wine nearly to the brim." + NEUTRAL,
    "one heavy black metal goblet with a thick stem and a wide foot", ["one goblet or chalice", "it is dark metal"], ["a skull", "gems"], base=False)
add("rite-blood-bowl", "rite-blood-bowl", "p3", 3, SM, "a shallow stone bowl of dark red ritual ink",
    "ONE wide, shallow, thick-walled bowl carved from near-black stone, about 9 in across and 4 in tall, with a flat rim and three little lug feet, filled almost to the rim with opaque, dark red liquid like ink. A stubby stirring stick of pale bone rests across the rim. Clean: nothing spilled." + NEUTRAL,
    "one shallow dark stone bowl filled with dark red liquid", ["a shallow bowl of dark red liquid"], ["splashes or drips of blood outside the bowl", "a skull", "flesh"], base=False)
add("rite-ritual-hand-bell", "rite-ritual-hand-bell", "p3", 3, SM + [VEST], "a tarnished black hand bell",
    "ONE hand bell about 7 in tall standing on its mouth: a thick, flaring bell of blackened bronze with two raised plain bands and a pale worn rim, and a fat turned handle of dark wood with a brass cap." + NEUTRAL,
    "one dark metal hand bell with a wooden handle, standing upright", ["a hand bell"], ["a skull"], base=False)
add("tome-grimoire", "tome-grimoire", "p3", 3, [LIB, SUMM, VAULT, SANC], "a heavy black grimoire with clasps",
    "ONE very thick closed book lying flat, about 10 x 14 in and 4 in thick: black leather boards with heavy brass corner pieces, a plain round brass boss in the middle of the cover, two wide brass clasps on the fore-edge, and a dark red ribbon marker hanging out. Pale, ragged page edges." + NEUTRAL,
    "one thick closed black book with brass corners and clasps, lying flat", ["one closed book with metal fittings"], ["an open book", "a face or eye on the cover", "letters"], base=False)
add("rite-tome-stack-forbidden", "rite-tome-stack-forbidden", "p3", 3, [LIB, SUMM, VAULT], "a stack of forbidden tomes bound with an iron strap",
    "A leaning stack of FOUR thick old books lying flat on one another (black, oxblood, dark green and tan leather, pale ragged page edges), bound together by ONE broad iron strap with a chunky padlock on top. One solid mass about 12 in wide and 10 in tall." + NEUTRAL,
    "a stack of four thick old books held together by an iron strap with a padlock", ["a stack of several closed books"], ["an open book", "letters", "a skull"], base=False)
add("tome-chained", "tome-chained", "p3", 3, [LIB, SUMM], "a book chained shut",
    "ONE thick closed book lying flat, about 9 x 12 in and 3 in thick, bound in dark oxblood leather with iron corner plates, wrapped once lengthwise and once crosswise by a very THICK, short iron chain (fat links modelled as one solid band lying tight on the cover) that meets at a big padlock in the middle of the cover." + NEUTRAL,
    "one closed dark red book wrapped in a thick chain with a padlock, lying flat", ["one closed book", "a chain or band and a padlock round it"], ["an open book", "thin dangling chains", "letters"], base=False)
add("rite-hooded-robe-folded", "rite-hooded-robe-folded", "p3", 3, [VEST, QUART], "a folded hooded robe",
    "ONE heavy woollen robe of dark charcoal brown, neatly folded into a thick rectangular bundle about 14 x 10 in and 4 in tall, its hood folded on top and a coiled rope belt lying on the hood. Smooth, simplified, painted as one flat solid surface with two or three broad folds." + NEUTRAL,
    "one folded bundle of dark cloth with a hood and a coiled rope belt on top", ["a folded bundle of dark cloth"], ["a person", "emblems"], base=False)
add("rite-cult-mask-blank", "rite-cult-mask-blank", "p3", 3, [VEST, QUART, SANC], "a blank white mask",
    "ONE plain oval mask about 7 in wide and 9 in tall, lying face up and tilted a little on its own curved edge: thick, smooth, matte bone-white ceramic with only two dark almond eye slots, no mouth, no nose, no decoration, and a short dark leather strap at each side.",
    "one plain white oval mask with two eye holes and no other features", ["a featureless pale mask with two eye holes"], ["a mouth, horns or decoration", "a skull", "a head wearing it"], base=False)

ids = [a["id"] for a in assets]
assert len(ids) == len(set(ids)), [i for i, n in Counter(ids).items() if n > 1]
by_id = {a["id"]: a for a in assets}
for a in assets:
    assert a["object"] in roles and roles[a["object"]]["size"], a["id"]
    assert a["group"] in ("p1", "p2", "p3", "sib1", "sib2", "sib3") and a["group"][-1] == str(a["prio"]), a["id"]
    if a["gate_refs"]:
        par = Path(a["gate_refs"][0]).stem
        assert a["group"].startswith("sib") and by_id[par]["group"].startswith("p"), (a["id"], par)
    if a.get("twin_of"):
        assert roles[a["object"]]["open_of"] == by_id[a["twin_of"]]["object"], a["id"]
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets: (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(assets), "assets", dict(sorted(Counter(a["group"] for a in assets).items())), "prio", dict(sorted(Counter(a["prio"] for a in assets).items())))
print("hung:", [a["id"] for a in assets if a.get("hung")])
print("lights:", {a["id"]: a["light"] for a in assets if a.get("light")})
print("bench:", {a["id"]: a["bench"] for a in assets if a["bench"]})
print("flavor:", {a["id"]: a["flavor"] for a in assets if a.get("flavor")})
