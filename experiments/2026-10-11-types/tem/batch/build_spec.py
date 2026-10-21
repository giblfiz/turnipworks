#!/usr/bin/env python3
"""Temple & chapel type (Harry 2026-10-11: "build out the rest of the fantasy genre type assets"): every NEW mesh the
nine temple rooms need. Same format as experiments/2026-10-05-castle-crypt-mansion/crypt/build_spec.py (add(), STYLE,
NOBASE, parent= for siblings; fields prio, rooms, bench, hung, light). Writes assets.json for tools/gen.py (plates from
the FREE Codex image route). Nothing is generated here.
    python3 build_spec.py

Two kinds of piece:
  NEUTRAL   architecture and furniture: no emblem, no figure, nothing that says which faith (so the same nave can be
            dressed good or evil);
  FLAVOR    the six slot roles `flavor-*` (catalog/objects-flavor.catalog.md, shared with the Cult sanctum), one sku per flavor: `--sun`, `--moon`.
            The flat slots (banner, sigil) are in ../flats/.
Text prompts and our own style reference only; no third-party reference image.
"""
import json, sys
from collections import Counter
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT / "src"))
import catalog_tool as ct
STYLE = (ROOT / "style/heroic-handpainted.object.md").read_text()
STYLE_REF = str(ROOT / "style-references/heroic-handpainted-tavern-v1.png")
HEAD = "Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset:"
assert HEAD in STYLE
roles = {}
for p in sorted((ROOT / "catalog").glob("*.catalog.md")):
    roles.update(ct.parse_catalog(p)[0])

NOBLUE = " The background is flat chroma blue, so the object itself has NO blue and NO purple anywhere (no blue cloth, gems or glass; stone is cream, warm grey or charcoal, never bluish)."
NOBASE = " It stands on nothing: NO ground disc, NO floor patch, NO rubble, NO base slab or platform under it that the real object would not have." + NOBLUE
STONE = (" The stone is never plain: every face carries deep, chunky carved mouldings or relief panels and clear painted colour variation"
         " (paler worn edges, warmer honey patches, soft grey shadow in the hollows).")
UNLIT = " It is UNLIT: no flame, no glow, no smoke, no light painted on it; wicks are dark and unburnt-looking."
NEUTRAL = " It carries NO religious emblem of any kind: no cross, sun, moon, star, eye, skull, figure, face, animal or lettering; only plain mouldings, panels and simple geometric or leaf-free ornament."
STOUT = " Everything is thick and chunky, made of a few big simple solid masses: no thin rods, wires, chains, spindles, lattice or fine openwork; nothing see-through."
MATCH = ("The supplied image is an existing {what}. The new piece must look made as part of the same set:"
         " the SAME materials, colours, thicknesses, carving style, painting style and camera angle. Change ONLY what is described below.\n\n")
FAMILY = "temple-stone"
WALL_MATCH = ("The supplied image is the existing plain wall section of this same temple: coursed, dressed PALE cream limestone blocks."
              " The new piece must look cut from the same wall: the SAME block size and number of courses, the same pale stone colour and mortar lines,"
              " the same overall size and proportions (a tall narrow upright panel about 5 ft wide x 9 ft tall, almost twice as tall as wide), painting style and camera angle."
              " Change ONLY what is described below.\n\n")
WALL_TAIL = (" Nothing else: NO floor, NO ground, NO base slab or platform under it, NO roof, NO vault, NO corner return, NO torch, NO banner, NO furniture."
             " Both side edges are clean, flat, vertical cuts and the top is one level line, so this piece butts against the plain wall pieces to make a longer wall."
             " It stands directly on its bottom course with no footing. Seen from its broad room-facing side at a slight three-quarter angle. Keep the WHOLE object well inside the frame." + NOBLUE)
WALL_MUST = ["one single upright wall section of pale dressed stone blocks, clearly taller than it is wide"]
WALL_NOT = ["a floor, base slab, roof or corner return", "a torch, sconce, banner or furniture attached to the wall", "a religious emblem, figure or lettering"]

assets = []
def add(sku, obj, group, prio, rooms, subject, design, desc, must=(), must_not=(), size=None, parent=None, what="", base=True,
        wall=False, opening=None, hung=False, light=None, bench=(), route="trellis", flavor=None):
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
        prompt = prompt.replace(HEAD, (WALL_MATCH if wall else MATCH.format(what=what)) + "Create a single asset in the Turnip Works house style (heroic hand-painted):")
        refs, gate_refs = [pp], [pp]
        must.append(f"materials, colours and style match the REFERENCE {what or 'wall section'} (the described change is the intended difference)")
    if wall:
        must, must_not = WALL_MUST + must, WALL_NOT + must_not
    if light:
        must_not.append("a painted flame, glow or smoke")
    if base and not wall:
        must_not.append("a ground disc, floor patch or base slab under the object that it would not really have")
    a = {"id": sku, "object": obj, "group": group, "source": "generate", "lane": "3d", "subject": subject, "size": [w, d, h],
         "prompt": prompt, "refs": refs, "gate_refs": gate_refs, "gate": {"desc": desc, "must": must, "must_not": must_not},
         "prio": prio, "rooms": list(rooms), "bench": list(bench), "route": route,
         "provenance": "text prompt + our own style reference (style-references/heroic-handpainted-tavern-v1.png)" + (f" + our own parent plate {parent}" if parent else "")}
    if wall: a["family"], a["generation"], a["kit"] = FAMILY, "kit", "wall"
    if opening: a["opening"] = opening
    if hung: a["hung"] = True
    if light: a["light"] = light
    if flavor: a["flavor"] = flavor
    assets.append(a)

NAVE, CATH, SHRINE, VESTRY, CLOISTER, SCRIPT, INFIRM, CELL, BELL = ("temple-nave", "cathedral", "temple-shrine", "temple-vestry", "temple-cloister",
                                                                   "temple-scriptorium", "temple-infirmary", "temple-cell", "temple-belltower")
ALL = [NAVE, CATH, SHRINE, VESTRY, CLOISTER, SCRIPT, INFIRM, CELL, BELL]

# ================================================================ wall kit: family temple-stone (pale dressed limestone)
W0 = "wall-straight--temple-stone"
add(W0, "wall-straight", "p1", 1, ALL, "full-height wall segment of pale dressed limestone for a temple",
    "Coursed, finely dressed PALE cream and warm ivory limestone blocks, about ten courses of big smooth-faced blocks, each course only two or three blocks long with thin grey-tan mortar lines,"
    " crisp but gently worn at the edges. A plain projecting plinth course, slightly darker and warmer, runs along the very bottom, and a plain rounded moulding band runs along the very top."
    " The block faces vary in tone (cream, ivory, pale honey, a few pale warm-grey blocks) so the wall is not one flat colour; a little soft grey weathering under the top band."
    " ONE single straight wall section standing upright, about 5 ft wide x 9 ft tall x 1 ft thick. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end)."
    " It must NOT be square and must NOT be wider than it is tall.",
    "one upright section of wall built of pale cream dressed stone blocks in courses",
    ["coursed stone blocks with mortar lines", "the stone is pale cream or ivory (not dark grey, not blue, not brown brick)"], ["niches, arches or openings in the wall"], wall=True)
add(W0 + "--s2", "wall-straight", "sib1", 1, ALL, "a second plain wall segment of the same pale temple stone",
    "The same pale stone wall, a different section of it: the blocks break joint in a different pattern, a flat shallow pilaster strip (a plain raised vertical band of the same stone, about 10 in wide)"
    " runs up the middle from the plinth to the top band, and one block low down is a slightly warmer honey colour. Still a completely plain, solid wall with the same plinth course and top band.",
    "one upright section of plain wall built of pale cream dressed stone blocks, with a shallow raised vertical strip up the middle",
    ["coursed stone blocks with mortar lines", "a solid wall with no opening"], ["niches, arches or openings in the wall"], parent=W0, wall=True)
add("wall-window-small--temple-stone", "wall-window-small", "sib1", 1, ALL, "pale temple stone wall segment with a tall lancet window",
    "The same pale stone wall with ONE tall, narrow pointed-arch (lancet) window in it: the window is about 20 in wide and 5.5 ft tall, centred left to right, its sill about 2.5 ft above the bottom of the wall"
    " and its pointed head about 1 ft below the top band. It has a deep splayed stone surround with one bold roll moulding. The window is glazed: filled with thick pale amber and honey-yellow glass in big plain"
    " diamond-shaped panes with broad dark lead lines, painted as ONE flat solid opaque surface set a little back from the wall face (not transparent, not see-through). At least 18 in of plain wall each side of the window.",
    "a section of pale stone block wall with one tall narrow pointed-arch window glazed in pale yellow diamond panes",
    ["exactly one tall narrow window with a pointed top", "the window is filled with yellowish glass panes (not an empty hole)"], ["a door", "coloured pictures or figures in the glass", "two or more windows"],
    parent=W0, wall=True, opening="window")
add("window-stained-glass--temple-stone", "window-stained-glass", "sib1", 1, [NAVE, CATH, SHRINE], "pale temple stone wall segment with a great stained-glass window",
    "The same pale stone wall with ONE large pointed-arch window in it, about 3 ft wide and 6.5 ft tall, centred, its sill about 1.5 ft above the bottom of the wall. A thick stone mullion divides it into two tall lights"
    " under one round opening in the arch head, with a bold roll-moulded stone surround. It is glazed with STAINED GLASS in a purely geometric pattern of big simple shapes (diamonds, squares and plain bands) in warm ruby red,"
    " amber gold, emerald green and cream white with broad dark lead lines: an abstract pattern only, with NO picture, figure, face, animal, sun, moon, star, cross or other emblem. The glass is painted as ONE flat solid opaque"
    " surface set a little back from the wall face (not transparent). About 12 in of plain wall each side.",
    "a section of pale stone block wall with one large pointed-arch stained-glass window in an abstract pattern of red, gold and green",
    ["one large window with a pointed arch top, divided by a stone mullion", "coloured glass in a geometric pattern"], ["a picture, figure or emblem in the glass", "a door"],
    parent=W0, wall=True, opening="window", size=(60, 12, 108))

# ================================================================ neutral furniture
add("altar-stone--marble", "altar-stone", "p1", 1, [NAVE, CATH, SHRINE], "a white marble high altar",
    "A massive block altar table of creamy white marble with soft warm-grey veining: a thick overhanging top slab with a bold moulded edge on a solid block body whose front is divided into three deep sunk square panels"
    " by four short chunky engaged columns of honey-gold stone, all on a stepped plinth of the same marble. The top is bare and empty." + NEUTRAL + STONE,
    "a massive rectangular altar table of white marble with a panelled front, nothing on it", ["one rectangular stone altar block with a flat empty top"], ["candles, cloth, books or cups on it", "a cross, sun, moon or other emblem"])
add("pulpit", "pulpit", "p1", 1, [NAVE, CATH], "a raised wooden preaching pulpit",
    "A raised preaching pulpit of warm honey oak: a chunky six-sided tub with solid panelled sides and a thick moulded rail, standing about 4 ft up on one fat turned central pedestal with a spreading six-sided foot,"
    " reached by a short, steep, SOLID boxed-in stair of five thick steps with solid panelled sides (no open balusters) rising to an opening at the back. A sloped book ledge on the front rail." + NEUTRAL + STOUT,
    "a raised wooden pulpit: a panelled tub on a pedestal with a short solid stair", ["a raised enclosed stand with panelled sides", "a short stair up to it"], ["a person", "a canopy or roof over it", "an emblem"])
add("organ-pipe", "organ-pipe", "p1", 1, [CATH, NAVE], "a pipe organ",
    "A church pipe organ against a wall: a broad case of warm dark oak about 8 ft wide, with a keyboard desk and a solid bench block at the bottom centre, and above it a towering front of FAT, close-packed pipes of dull gold"
    " and pewter-grey metal standing shoulder to shoulder with no gaps, tallest at the two ends and in the middle, shorter between, so their tops make a bold W-shaped skyline; a thick carved oak cornice frames the pipe tops"
    " at each tower. The pipes are painted as ONE solid ribbed mass like a deep relief, not separate thin tubes; the back is a flat closed wooden panel." + NEUTRAL,
    "a pipe organ: a wide wooden case with a keyboard below and a tall front of fat metal pipes", ["a row of large upright organ pipes", "a keyboard desk at the bottom"], ["a person", "thin separate tubes with gaps between them", "an emblem"])
add("bell-on-frame", "bell-on-frame", "p1", 1, [BELL], "a great bronze bell in a timber frame",
    "A great church bell hanging in a short, massive timber frame that stands on the floor: the bell is dark golden-bronze, about 3.5 ft across at the mouth and 3.5 ft tall, with a flaring lip, three plain raised bands"
    " and a fat crown; it hangs from a thick squared oak headstock beam carried by two heavy A-shaped trestle ends of squared oak timbers on thick sill beams, tied by a low stretcher. The bell's mouth hangs about 1 ft off the floor."
    " A big spoked wooden bell wheel is NOT included. Very chunky timbers with bold iron straps." + NEUTRAL + STOUT,
    "a large bronze bell hanging from a beam in a heavy wooden frame", ["one large bell", "a heavy timber frame holding it"], ["a rope", "a wheel", "a tower or roof", "an emblem or lettering on the bell"])
add("scriptorium-desk--s1", "scriptorium-desk", "p1", 1, [SCRIPT], "a monk's slanted copying desk",
    "A scribe's copying desk of warm honey oak: a steeply SLANTED thick writing board on a solid panelled box pedestal with a low shelf, and a built-in thick plank seat joined to it by heavy side boards, all one sturdy piece."
    " On the slanted board lies one large open cream manuscript with bold red and black line blocks (no readable letters), and at the top edge a fat stoneware ink pot and a short cut quill laid flat." + NEUTRAL + STOUT,
    "a wooden desk with a steeply slanted top and a built-in seat, an open book on it", ["a slanted writing board", "an open book or page on it"], ["a person", "a candle", "readable text"])
add("scriptorium-desk--s2", "scriptorium-desk", "sib2", 2, [SCRIPT], "a second monk's copying desk",
    "The same kind of copying desk, a different one of the set: here the slanted board carries a tall thick upright copy-stand board at its top edge holding a second, closed red-bound book,"
    " the open manuscript has a big gold square in one corner, and the seat is a separate-looking but joined chunky three-plank stool block. Same oak, same thickness, same size.",
    "a wooden slanted-top copying desk with an open book and an upright book stand", ["a slanted writing board", "an open book or page on it"], ["a person", "a candle", "readable text"],
    parent="scriptorium-desk--s1", what="monk's copying desk")
add("rite-choir-stall", "rite-choir-stall", "p2", 2, [CATH, NAVE], "a carved choir stall",
    "A block of choir stalls of dark honey oak, 7 ft long: a row of three wide seats divided by thick shaped arm-rests, with a tall solid panelled back rising to a deep overhanging carved cornice, solid carved end boards,"
    " and in front a solid panelled desk front with a thick sloping book ledge, joined to the seats by the end boards so it is ONE heavy piece of furniture. Seat cushions of muted burgundy." + NEUTRAL + STOUT,
    "a long wooden choir stall: three seats with a tall panelled back and a desk front", ["a row of seats with a tall wooden back", "a desk or book ledge in front of the seats"], ["a person", "an emblem"])
add("confessional", "confessional", "p2", 2, [CATH, NAVE], "a wooden confessional booth",
    "A closed confessional booth of warm dark oak, like a broad wardrobe 5.5 ft wide and 7.5 ft tall: a centre compartment with a solid half-height panelled door under a short muted-burgundy curtain painted as one thick stiff mass,"
    " flanked by two narrower side compartments each closed by a full-length burgundy curtain painted as one thick stiff mass; thick panelled sides, a solid back, and a heavy moulded cornice with a plain low arched pediment." + NEUTRAL + STOUT,
    "a tall wooden booth with three compartments, curtains and a heavy cornice", ["a tall wooden booth or cabinet with curtained openings"], ["a person", "an emblem", "an open see-through lattice"])
add("rite-prie-dieu", "rite-prie-dieu", "p2", 2, [SHRINE, CELL, NAVE], "a kneeling desk",
    "A prayer kneeler (prie-dieu) of honey oak: a low thick kneeling board with a fat muted-burgundy cushion, joined by a solid panelled upright front to a sloped book rest with a thick arm ledge at elbow height."
    " One chunky L-shaped piece of furniture, solid sides." + NEUTRAL + STOUT,
    "a low wooden kneeling desk with a red kneeling cushion and a sloped top ledge", ["a low kneeling step with a cushion", "an upright front with a ledge on top"], ["a person", "a book", "an emblem"])
add("rite-alms-box", "rite-alms-box", "p2", 2, [NAVE, CATH, SHRINE, CLOISTER], "an alms box on a post",
    "An offering box on a post: a stout square oak chest about 12 in across with a domed lid, bound with three broad dark iron bands, a fat iron padlock on the front and a coin slot in the lid,"
    " fixed on top of a thick square oak post with chamfered corners that stands on a heavy spreading cross-shaped oak foot." + NEUTRAL + STOUT,
    "a small iron-bound wooden box with a padlock on top of a thick wooden post", ["a small banded box with a lock", "a post with a foot holding it up"], ["coins spilling out", "an emblem or lettering"])
add("rite-vestments-stand--s1", "rite-vestments-stand", "p2", 2, [VESTRY], "priest's vestments on a stand",
    "A priest's ceremonial robe displayed on a wooden stand: a heavy bell-shaped cream-white robe with a broad plain ochre-gold band down the front and round the hem, and a short shoulder cape of muted burgundy with a gold edge,"
    " hanging from a thick T-shaped oak stand with a round knob on top and a heavy round foot that shows under the hem. The cloth is painted as ONE thick, stiff, solid mass with a few deep folds, closed all round"
    " (no thin edges, no gaps, not hollow). There is NO person, head or hands in it." + NEUTRAL,
    "a cream and red ceremonial robe hanging on a wooden stand, nobody in it", ["a robe on a stand", "no person wearing it"], ["a person, head or hands", "an emblem on the cloth", "blue or purple cloth"])
add("rite-vestments-stand--s2", "rite-vestments-stand", "sib2", 2, [VESTRY], "a second set of vestments on a stand",
    "The same kind of stand with a different robe: a moss-green robe with a broad cream band down the front, a cream shoulder cape with a gold edge, and a tall plain cream hat with a gold band resting on the stand's top knob."
    " Same thick stiff solid cloth, same oak stand and foot, same size. NO person, head or hands.",
    "a green and cream ceremonial robe hanging on a wooden stand, nobody in it", ["a robe on a stand", "no person wearing it"], ["a person, head or hands", "an emblem on the cloth", "blue or purple cloth"],
    parent="rite-vestments-stand--s1", what="set of vestments on a stand")
add("scroll-rack", "scroll-rack", "p2", 2, [SCRIPT, VESTRY], "a scroll rack",
    "A scroll cabinet of honey oak standing against a wall, 40 in wide and 4 ft tall: a thick frame holding a grid of twelve deep square pigeon-holes (four wide, three high), every hole packed full with the round ends"
    " of fat rolled cream parchment scrolls, a few with red ribbon ties, so the front reads as a solid face of scroll ends with no empty dark holes; a closed solid back and a thick top board with two more scrolls lying on it.",
    "a wooden rack of square pigeon-holes filled with rolled scrolls", ["a grid of compartments", "rolled scrolls in the compartments"], ["books standing upright", "bottles", "empty see-through holes"])
add("apothecary-drawers", "apothecary-drawers", "p2", 2, [INFIRM], "an apothecary's chest of drawers",
    "A healer's wall cabinet of honey oak, 5 ft wide and 6 ft tall: the lower two thirds a grid of twenty small square drawers (five wide, four high), each with one fat round brass knob and a small cream label card"
    " (blank, no lettering); above them two open shelves crowded with squat stoneware jars with cork lids in cream, ochre and moss green, shoulder to shoulder; a heavy moulded top and a solid plinth.",
    "a tall wooden cabinet with many small square drawers and shelves of jars above", ["a grid of many small drawers with knobs", "jars on shelves above"], ["blue jars or bottles", "readable labels", "books"])
add("trade-treatment-bench", "trade-treatment-bench", "p2", 2, [INFIRM], "a healer's treatment bench",
    "A healer's treatment couch: a long narrow thick oak bench, 6 ft long and waist high, on four fat square legs joined by low stretchers, with a thick cream linen-covered pad along its top, a raised sloping head-rest block"
    " at one end, and a folded moss-green blanket at the foot. On a low shelf between the legs: a big cream bowl and a fat roll of bandage.",
    "a long narrow padded wooden couch with a raised headrest and a folded blanket", ["a long padded bench or couch", "a raised headrest at one end"], ["a person or body on it", "blood", "blue cloth"])

# ================================================================ FLAVOR slot meshes: sun and moon
SUN = " Flavor: SUN. Warm polished gold with cream-white and warm orange enamel; bold, radiant and symmetrical. NO face on the sun, NO moon, NO stars."
MOON = (" Flavor: MOON. Pale polished silver and pearl white with charcoal-black enamel; calm, curved and elegant. The moon is always a CRESCENT with both horns pointing straight up."
        " NO face on the moon, NO sun, NO rays. No blue and no purple anywhere: night is charcoal black, not blue.")
add("flavor-idol--sun", "flavor-idol", "p1", 1, [NAVE, CATH, SHRINE], "a monumental golden sun emblem on a marble pillar",
    "A monumental temple idol: a huge, thick, round golden SUN DISC about 3 ft across, its centre a smooth domed boss ringed by two raised bands, with sixteen short, broad, thick triangular rays all round its rim like a cog,"
    " standing upright on edge on top of a stout, tapering square pillar of creamy white marble with a moulded cap and a two-step square base. The disc is about a third of the whole height. The disc is thick like a millstone, not a thin plate." + SUN + STOUT,
    "a big round golden sun disc with short rays, standing on top of a white stone pillar", ["a large round sun disc with rays", "a stone pillar or pedestal under it"], ["a face", "a human or animal figure", "a crescent moon", "a cross"], flavor="sun", size=(40, 30, 100))
add("flavor-idol--moon", "flavor-idol", "p1", 1, [NAVE, CATH, SHRINE], "a monumental silver crescent moon on a stone pedestal",
    "A monumental temple idol: a huge, thick CRESCENT MOON of pale silver-white stone, about 3 ft across, standing with both horns pointing straight up like a cradle, holding between its horns a smooth pearl-white sphere"
    " about 14 in across that rests in the curve; the crescent stands on a short fat stem on top of a stout round column of charcoal-grey stone with three pale silver bands and a two-step round base."
    " The crescent and sphere are about a third of the whole height. The crescent is thick and rounded like carved stone, not a thin blade." + MOON + STOUT,
    "a big pale crescent moon with its horns pointing up, holding a white ball, on top of a dark round stone pedestal", ["a large crescent moon shape with horns pointing up", "a pedestal or column under it"],
    ["a face", "a human or animal figure", "a sun with rays", "a cross"], flavor="moon", size=(40, 30, 100))
add("flavor-altarpiece--sun", "flavor-altarpiece", "p1", 1, [NAVE, CATH, SHRINE, VESTRY], "a golden sunburst altar emblem",
    "An altar centrepiece about 26 in tall: a thick round golden sun disc about 14 in across with a domed cream-enamel centre and twelve short, broad, thick wedge rays round its rim, standing upright on a short fat turned gold stem"
    " with one round knop, on a heavy round stepped gold foot ringed with small orange enamel studs. Thick and solid like a trophy." + SUN + STOUT,
    "a golden sun disc with short rays on a short stem and round foot", ["a round sun disc with rays", "a stem and foot under it"], ["a face", "a cross", "a crescent moon", "a cup or bowl"], base=False, flavor="sun", size=(20, 8, 26))
add("flavor-altarpiece--moon", "flavor-altarpiece", "p1", 1, [NAVE, CATH, SHRINE, VESTRY], "a silver crescent moon altar emblem",
    "An altar centrepiece about 26 in tall: a thick polished silver CRESCENT about 14 in across with both horns pointing straight up, cradling a smooth pearl-white ball about 5 in across, standing on a short fat turned silver stem"
    " with one round knop, on a heavy round stepped silver foot inlaid with a ring of charcoal-black enamel. Thick and solid like a trophy." + MOON + STOUT,
    "a silver crescent moon with horns up holding a white ball, on a short stem and round foot", ["a crescent moon shape with horns pointing up", "a stem and foot under it"], ["a face", "a cross", "a sun with rays", "a cup or bowl"], base=False, flavor="moon", size=(20, 8, 26))
# Harry, 2026-10-11 (via the coordinator): keep each flavor SMALL, a handful of pieces: in 3D the idol, the altar centrepiece,
# a core SCULPTURE that is not the idol (slot 7), a flavor-styled flying BUTTRESS usable inside (slot 8) and the censer;
# the banner, the wall relief and the floor sigil are flat images (../flats/gen.py).
add("flavor-sculpture--sun", "flavor-sculpture", "p1", 1, [NAVE, CATH, CLOISTER], "a carved sun obelisk",
    "A temple showpiece sculpture, 7 ft tall: a stout four-sided OBELISK of cream limestone tapering to a small gilded pyramid cap, each face carved in deep relief with a column of three chunky round sun discs with short rays,"
    " gilded warm gold against the cream stone, with a band of orange enamel under the cap; it stands on a broad two-step square base whose corners carry four fat gilded half-spheres. No pillar-and-disc on top (that is a different piece)." + SUN + STOUT,
    "a cream stone obelisk carved with golden sun discs on its faces, with a gold pointed cap", ["a tapering four-sided stone obelisk", "round sun discs carved on its faces"], ["a face", "a human or animal figure", "a crescent moon", "one big disc standing on top"],
    flavor="sun", size=(34, 34, 84))
add("flavor-sculpture--moon", "flavor-sculpture", "p1", 1, [NAVE, CATH, CLOISTER], "a carved moon basin",
    "A temple showpiece sculpture, 4 ft tall and 3.5 ft across: a broad, shallow, round BASIN of charcoal-grey stone on a fat fluted pedestal with a round stepped foot; the basin's thick rim is set with eight round pale silver discs"
    " showing the moon growing from a thin sliver to a full circle and back; the bowl is filled level with a smooth pearl-white surface painted as ONE flat solid opaque disc (still water under moonlight, not transparent),"
    " with one small silver crescent, horns up, rising from its middle on a short stem." + MOON + STOUT,
    "a wide round dark stone basin on a pedestal, filled with white, with silver discs round its rim", ["a broad round basin on a pedestal", "round silver discs set round the rim"], ["a face", "a human or animal figure", "a sun with rays", "a tall pillar"],
    flavor="moon", size=(42, 42, 48), bench=["water"])
BUTT = (" It is a FLYING BUTTRESS seen from the side: a massive upright stone PIER about 3 ft wide, 2 ft deep and 9 ft tall standing at one side, and springing from the top third of the pier a thick stone HALF-ARCH that leans"
        " across and ends in a flat vertical cut at the same 9-ft height, 4 ft away from the pier's outer face, where it would meet a wall. The space under the half-arch is OPEN (one big clear opening you can walk under)."
        " The pier has a stepped, sloping set-off half way up and stands on a plain plinth block. Thick, heavy masonry; nothing thin.")
add("flavor-buttress--sun", "flavor-buttress", "p1", 1, [CATH, NAVE], "a flying buttress of a sun temple",
    "A flying buttress of pale cream limestone blocks." + BUTT + " Sun motif: the pier's front face carries ONE big gilded round sun disc with short thick rays in a sunk round panel, the half-arch's upper edge is a row of chunky gilded"
    " triangular ray points like a crest, and the pier is topped with a short gilded pyramid finial." + SUN,
    "a pale stone flying buttress: a tall pier with a half-arch leaning from its top, with a gold sun disc on the pier", ["a tall stone pier", "a half-arch springing from the pier with open space under it"], ["a face", "a crescent moon", "a whole wall", "a full round arch with two legs"],
    flavor="sun", size=(36, 48, 108))
add("flavor-buttress--moon", "flavor-buttress", "p1", 1, [CATH, NAVE], "a flying buttress of a moon temple",
    "A flying buttress of charcoal-grey stone blocks with pale silver-grey bands." + BUTT + " Moon motif: the pier's front face carries a vertical row of three round pale silver discs (a thin sliver, a half, a full circle) in sunk round panels,"
    " the half-arch is a smooth, clean curve with a pale silver-grey edge moulding, and the pier is topped with a thick silver crescent finial, horns up." + MOON,
    "a dark stone flying buttress: a tall pier with a half-arch leaning from its top, with silver moon discs on the pier", ["a tall stone pier", "a half-arch springing from the pier with open space under it"], ["a face", "a sun with rays", "a whole wall", "a full round arch with two legs"],
    flavor="moon", size=(36, 48, 108))
add("flavor-censer--sun", "flavor-censer", "p2", 2, [NAVE, CATH, SHRINE], "a tall golden sun candle stand",
    "A tall floor candle stand of warm polished gold, 4.5 ft tall: a heavy round stepped foot, a fat turned column with two round knops, and at the top a broad shallow dish whose rim is a ring of twelve short, thick,"
    " triangular sun rays pointing outward, holding ONE fat cream pillar candle about 5 in across and 10 in tall." + SUN + STOUT,
    "a tall golden candle stand with a spiky sun-ray dish at the top holding one fat candle", ["a tall stand on a round foot", "one thick candle on top", "a ring of ray points round the top dish"], ["a face", "a crescent moon", "several thin candles"],
    light="candle", bench=["fire"], flavor="sun", size=(18, 18, 54))
add("flavor-censer--moon", "flavor-censer", "p2", 2, [NAVE, CATH, SHRINE], "a tall silver crescent candle stand",
    "A tall floor candle stand of pale polished silver, 4.5 ft tall: a heavy round stepped foot inlaid with a charcoal-black ring, a fat smooth tapering column with one round knop, and at the top a thick CRESCENT with both horns"
    " pointing straight up, about 14 in across, cradling ONE fat pearl-white pillar candle about 5 in across and 10 in tall that stands in the curve between the horns." + MOON + STOUT,
    "a tall silver candle stand topped by an upward crescent holding one fat white candle", ["a tall stand on a round foot", "one thick candle on top", "a crescent shape with horns up at the top"], ["a face", "sun rays", "several thin candles"],
    light="candle", bench=["fire"], flavor="moon", size=(18, 18, 54))

ids = [a["id"] for a in assets]
assert len(ids) == len(set(ids)), [i for i, n in Counter(ids).items() if n > 1]
by_id = {a["id"]: a for a in assets}
for a in assets:
    assert a["object"] in roles and roles[a["object"]]["size"], a["id"]
    assert a["group"] in ("p1", "p2", "p3", "sib1", "sib2", "sib3") and a["group"][-1] == str(a["prio"]), a["id"]
    if a["gate_refs"]:
        par = Path(a["gate_refs"][0]).stem
        assert a["group"].startswith("sib") and by_id[par]["group"].startswith("p"), (a["id"], par)
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets: (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(assets), "assets", dict(sorted(Counter(a["group"] for a in assets).items())), "prio", dict(sorted(Counter(a["prio"] for a in assets).items())))
print("hung:", [a["id"] for a in assets if a.get("hung")])
print("lights:", {a["id"]: a["light"] for a in assets if a.get("light")})
print("flavor:", {a["id"]: a["flavor"] for a in assets if a.get("flavor")})
