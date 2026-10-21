#!/usr/bin/env python3
"""Crypt type (Harry 2026-10-05: "make me castle, crypt and mansion types"): every NEW mesh the seven crypt rooms need.
Same format as experiments/2026-10-05-yard-props/build_spec.py (add(), STYLE, NOBASE, parent= for siblings), plus the
extra per-asset fields the brief asks for: prio, rooms, bench, hung, light, twin_of, route.
Writes assets.json for src/plate_gate_batch.py (plates from the FREE Codex image route). Nothing is generated here.
    python3 build_spec.py

Groups: p1/p2/p3 = independent pieces of that prio; sib1/sib2/sib3 = pieces of that prio painted FROM the accepted plate
of a parent in a p group (inputs/<parent>.jpg): the crypt-stone wall kit from the first wall, the sarcophagus variants and
open twins from the first sarcophagus, the coffin's variant and twin from the first coffin, the occupied embalming slab
from the empty table. Run order: p1, sib1, p2, sib2, p3 (sib2 pieces also hang off p1 parents, never off a sibling).
"""
import json, sys
from collections import Counter
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]   # B/crypt is one level deeper than the yard run folder
sys.path.insert(0, str(ROOT / "src"))
import catalog_tool as ct
STYLE = (ROOT / "style/heroic-handpainted.object.md").read_text()
STYLE_REF = str(ROOT / "style-references/heroic-handpainted-tavern-v1.png")
HEAD = "Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset:"
assert HEAD in STYLE
roles = {}
for p in sorted((ROOT / "catalog").glob("*.catalog.md")):
    roles.update(ct.parse_catalog(p)[0])

NOBASE = (" It stands on nothing: NO ground disc, NO floor patch, NO rubble, NO base slab or platform under it that the real object would not have."
          " The background is flat chroma blue, so the object itself has NO blue anywhere (no blue cloth, gems or glass; stone is grey, grey-green or warm grey, never bright blue).")
NOBLUE = " The background is flat chroma blue, so the object itself has NO blue anywhere (no blue cloth, gems or glass; stone is grey, grey-green or warm grey, never bright blue)."
# big plain stone masses come back partly unpainted: every big stone thing asks for relief and colour variation
STONE = (" The stone is never plain: every face carries deep, chunky carved mouldings or relief panels and clear painted colour variation"
         " (paler worn edges, darker damp patches, a little moss green in the hollows).")
# loose bones break into floating pieces: bones are always one packed mass
BONES = (" All the skulls and bones are packed tightly together into ONE solid mass, like a deep carved relief: big, chunky, simplified skulls and thick long bones,"
         " none sticking out on its own, none lying apart, no gaps you can see the background through. Old ivory and warm tan bone colours, not white.")
UNLIT = " It is UNLIT: no flame, no glow, no smoke, no light painted on it; wicks are dark and unburnt-looking, any fuel is cold and grey-black."
CARVED = " Any figure on it is clearly a STONE CARVING, the same grey stone as the rest, simplified and blocky, not a living person."
MATCH = ("The supplied image is an existing {what}. The new piece must look made as part of the same set:"
         " the SAME materials, colours, thicknesses, carving style, painting style and camera angle. Change ONLY what is described below.\n\n")
TWIN = ("Edit task. The supplied image shows {what} in the Turnip Works hand-painted house style. Show the SAME object: identical material, colours, carving,"
        " proportions and painting style, from the same three-quarter view from slightly above. Do not redesign it.\n\n")

# --- the crypt-stone wall family: 5 ft wide x 9 ft tall kit panels seen from the broad side
WALL_WHAT = "plain wall section of the same crypt (dark, damp, dressed stone)"
WALL_MATCH = ("The supplied image is the existing plain wall section of this same crypt: coursed, dressed DARK slate-grey stone blocks with a green-grey damp cast."
              " The new piece must look cut from the same wall: the SAME block size and number of courses, the same dark stone colour, mortar lines and damp streaks,"
              " the same overall size and proportions (a tall narrow upright panel about 5 ft wide x 9 ft tall, almost twice as tall as wide), painting style and camera angle."
              " Change ONLY what is described below.\n\n")
WALL_TAIL = (" Nothing else: NO floor, NO ground, NO base slab or platform under it, NO roof, NO vault, NO corner return, NO torch, NO furniture."
             " Both side edges are clean, flat, vertical cuts and the top is one level line, so this piece butts against the plain wall pieces to make a longer wall."
             " It stands directly on its bottom course with no footing. Seen from its broad room-facing side at a slight three-quarter angle. Keep the WHOLE object well inside the frame.")
WALL_MUST = ["one single upright wall section of dark dressed stone blocks, clearly taller than it is wide"]
WALL_NOT = ["a floor, base slab, roof or corner return", "a window", "a torch, sconce or furniture attached to the wall"]

assets = []
def add(sku, obj, group, prio, rooms, subject, design, desc, must=(), must_not=(), size=None, parent=None, what="", base=True,
        wall=False, twin_of=None, hung=False, light=None, bench=(), route="trellis", why=None):
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
                    else f"materials, colours and style match the REFERENCE {what} (the described change is the intended difference)")
    if wall:
        must, must_not = WALL_MUST + must, WALL_NOT + must_not
    if light:
        must_not.append("a painted flame, glow or smoke")
    if base and not wall:
        must_not.append("a ground disc, floor patch or base slab under the object that it would not really have")
    a = {"id": sku, "object": obj, "group": group, "source": "generate", "lane": "3d", "subject": subject, "size": [w, d, h],
         "prompt": prompt, "refs": refs, "gate_refs": gate_refs, "gate": {"desc": desc, "must": must, "must_not": must_not},
         "prio": prio, "rooms": list(rooms), "bench": list(bench), "route": route}
    if wall: a["family"], a["generation"] = "crypt-stone", "kit"
    if hung: a["hung"] = True
    if light: a["light"] = light
    if twin_of: a["twin_of"] = twin_of
    if why: a["route_note"] = why
    assets.append(a)

ANTE, VAULT, OSS, CATA, CHAP, EMB, RELIC = "crypt-antechamber", "crypt-vault", "crypt-ossuary", "crypt-catacomb", "crypt-chapel", "crypt-embalming", "crypt-relic"
ALL = [ANTE, VAULT, OSS, CATA, CHAP, EMB, RELIC]

# ================================================================ wall kit: family crypt-stone
W0 = "wall-straight--crypt-stone"
add(W0, "wall-straight", "p1", 1, ALL, "full-height wall segment of dark, damp dressed stone for a crypt",
    "Coursed, dressed DARK slate-grey stone blocks with a green-grey cast, about ten courses of big blocks, each course only two or three blocks long with thin dark mortar lines,"
    " gently worn and rounded at the edges. The lowest two courses are darker and damp, with a few streaks of moss green and pale mineral stain running down from the joints;"
    " a plain, slightly projecting band course runs along the very top. The block faces vary in tone (charcoal, slate, grey-green, a few warmer grey-brown blocks) so the wall is not one flat colour."
    " ONE single straight wall section standing upright, about 5 ft wide x 9 ft tall x 1 ft thick. It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end). It must NOT be square and must NOT be wider than it is tall.",
    "one upright section of wall built of dark grey dressed stone blocks in courses, with damp and moss stains",
    ["coursed stone blocks with mortar lines", "the stone is dark grey (not pale, not blue, not brown brick)"], ["niches, arches or openings in the wall", "bones or skulls"], wall=True)
add(W0 + "--s2", "wall-straight", "sib1", 1, ALL, "a second plain wall segment of the same dark crypt stone",
    "The same dark stone wall, a different section of it: the blocks break joint in a different pattern, ONE block in the middle courses is a larger stone carved with a simple sunk square panel,"
    " one block near the top has a chipped corner, and the damp staining at the foot is on the other side. Still a completely plain, solid wall with the same band course along the top.",
    "one upright section of plain wall built of dark grey dressed stone blocks, a different section from the reference",
    ["coursed stone blocks with mortar lines", "a solid wall with no opening"], ["niches, arches or openings in the wall", "bones or skulls"], parent=W0, wall=True)
add("wall-doorway--crypt-stone", "wall-doorway", "sib1", 1, ALL, "dark crypt stone wall segment with an empty door opening",
    "The same dark stone wall with an EMPTY door-sized opening through it, starting at the very bottom: about 3.5 ft wide and 7 ft tall, centred left to right, with a shallow pointed-arch head."
    " NO door leaf, NO threshold step. The opening is framed by big chamfered stone jamb blocks and thick arch stones of the same dark stone, a little paler where hands have worn them."
    " About 9 in of wall remains on each side of the opening and two full courses run unbroken above the arch. You can see straight through the opening to the blue background.",
    "a section of dark stone block wall with one empty arched door-sized opening through it (no door leaf)",
    ["one door-sized opening that reaches the bottom of the wall, with NO door in it (you can see through)", "stone courses continue above the opening"],
    ["a door leaf or gate filling the opening", "steps"], parent=W0, wall=True)
N0 = "wall-crypt-niches--crypt-stone"
NICHE = ("The same dark stone wall, made 2 ft thick, with burial niches (loculi) cut into its room-facing side: THREE wide, low, deep rectangular recesses stacked one above the other,"
         " each about 4 ft wide x 1.5 ft high and well over a foot deep, with a thick stone shelf between them and a solid stone pier about 6 in wide left at each side."
         " Each niche is a real dark hollow with a visible floor, back and sides, NOT a painted panel, and none goes through the wall. The lowest niche sits a foot above the bottom; two courses of plain blocks run above the top niche. ")
add(N0, "wall-crypt-niches", "sib1", 1, [VAULT, CATA, OSS], "crypt wall segment with three empty burial niches", NICHE + "All three niches are EMPTY: only a little dust and one small fallen stone chip on a shelf.",
    "a section of dark stone wall with three wide, low burial niches stacked one above the other, all empty",
    ["three (or at least two) wide rectangular recesses stacked vertically in the wall face", "the recesses are empty hollows"],
    ["a hole that goes right through the wall", "bodies, coffins or bones in the niches"], parent=W0, wall=True)
add(N0 + "--s2", "wall-crypt-niches", "sib1", 1, [VAULT, CATA], "crypt wall segment with burial niches holding wrapped bodies",
    NICHE + "Each niche holds ONE body wrapped from head to foot in old cream-and-tan linen bands, lying on its back along the niche, a simple chunky bundle shape that fills most of the recess and touches its floor and back."
    " No face, hands or bare bone shows: only the wrapped shape. The top one has a faded burgundy cloth laid over its middle.",
    "a section of dark stone wall with three burial niches, each holding a linen-wrapped body lying along it",
    ["wide rectangular recesses stacked vertically in the wall face", "a wrapped, bundle-like body shape lying in at least two of the recesses"],
    ["a hole that goes right through the wall", "a living person or an uncovered face", "a body standing upright"], parent=W0, wall=True)
add(N0 + "--s3", "wall-crypt-niches", "sib2", 2, [CATA, OSS, VAULT], "crypt wall segment with burial niches full of old bones",
    NICHE + "The niches hold old bones: the top one a neat row of five big skulls facing out, the middle one a tight stack of long bones laid end-on with two skulls on top,"
    " the bottom one a low heap of bones against the back with one skull." + BONES + " The bones stay inside the niches and touch their floors.",
    "a section of dark stone wall with three burial niches holding skulls and stacked bones",
    ["wide rectangular recesses stacked vertically in the wall face", "skulls or bones inside the recesses"],
    ["a hole that goes right through the wall", "bones lying loose in front of the wall", "a complete standing skeleton"], parent=W0, wall=True)
add("ossuary-wall--crypt-stone", "ossuary-wall", "sib1", 1, [OSS, CATA], "ossuary wall segment faced with skulls and long bones",
    "The same dark stone wall, 1.5 ft thick, but its room-facing side is FACED with bones from 1 ft above the bottom to 1 ft below the top: a dense pattern of the round ends of long bones packed like stacked firewood,"
    " crossed by THREE horizontal rows of big skulls facing out, the rows evenly spaced." + BONES +
    " A course of plain dark stone blocks shows below the bones and the plain band course above them, and a strip of plain stone about 5 in wide runs down each side edge so the piece still butts cleanly against the plain wall.",
    "a section of wall whose face is covered with a packed pattern of bone ends crossed by rows of skulls, framed by dark stone",
    ["rows of skulls set in the wall face", "the bone facing is flat to the wall like a relief, framed by dark stone"],
    ["bones or skulls lying loose in front of the wall", "a complete skeleton", "an opening through the wall"], parent=W0, wall=True)
add("ossuary-wall--crypt-stone--s2", "ossuary-wall", "sib2", 2, [OSS], "ossuary wall segment with a skull-framed arched niche",
    "The same dark stone wall, 1.5 ft thick, its room-facing side faced with the packed round ends of long bones, and in the middle ONE arched niche about 2 ft wide x 3 ft high and 8 in deep,"
    " its arch outlined by a single row of big skulls; in the niche stands one squat stone urn, touching the niche floor. A row of skulls runs across near the top." + BONES +
    " Plain dark stone shows along the bottom, the top and both side edges.",
    "a section of wall faced with packed bones, with one arched niche outlined in skulls holding an urn",
    ["a bone-covered wall face", "one arched recess in the middle"], ["an opening through the wall", "bones lying loose in front of the wall"], parent=W0, wall=True)
add("tomb-door-sealed--crypt-stone", "tomb-door-sealed", "sib2", 2, [ANTE, VAULT, RELIC], "crypt wall segment with a sealed, carved stone tomb door",
    "The same dark stone wall, 1 ft thick, with a SEALED tomb door set flush in its face: one great slab of paler grey stone about 3.5 ft wide x 7 ft tall, starting at the very bottom, in a heavy moulded stone frame."
    " The slab is carved in deep, chunky relief with a border of interlace, a big sun-disc emblem in the upper half and two sunk panels below; no handle, no hinges, no keyhole."
    " A thick band of dull iron crosses the slab at waist height, pinned into the frame at both sides. It is shut for good: no gap shows round it.",
    "a section of dark stone wall with a carved stone slab door sealed shut in a stone frame",
    ["a door-shaped carved stone slab filling a frame, closed", "stone courses continue above it"], ["an open doorway you can see through", "a wooden door", "letters or writing"],
    size=(60, 12, 108), parent=W0, wall=True)

add("crypt-gate-iron", "crypt-gate-iron", "p1", 1, [ANTE, RELIC, VAULT], "a heavy iron crypt gate leaf",
    "ONLY the gate leaf, with NO stone posts and NO wall: a tall single gate of dark forged iron, about 4 ft wide x 7.5 ft tall, flat, closed, seen from its broad side."
    " A thick rectangular outer frame of flat iron bar with a shallow pointed-arch top; inside it SIX very thick square upright bars, widely spaced, crossed by TWO broad flat horizontal bands at knee and chest height, riveted with big round rivet heads."
    " The bottom foot of the gate is a SOLID iron kick plate with a raised diamond boss. A chunky box lock with a ring pull on the right side, two heavy barrel hinges on the left edge."
    " Dark iron with rust-brown and dull orange patches and worn bright edges. Every bar is deliberately thick and toy-like so the gate reconstructs in 3D.",
    "one tall flat iron gate leaf of thick upright bars in a frame with an arched top, without posts",
    ["a single flat gate of upright iron bars in an iron frame", "you can see the background between the bars"], ["stone posts, pillars or wall at the sides", "thin wire-like bars", "a pair of gates"],
    bench=["hinge"])
add("door-crypt--leaf", "door-crypt", "p1", 1, ALL, "a heavy iron-bound crypt door leaf",
    "ONLY the door leaf, with NO frame and NO wall: a massive door about 3.3 ft wide x 7 ft tall and 5 in thick, flat, closed, seen from its broad side, with a shallow pointed-arch top."
    " Five wide vertical planks of very dark, almost black-brown oak, bound by THREE broad horizontal iron straps that run the full width and end in chunky spear-shaped tips, studded with rows of big dome-headed nails."
    " A heavy iron ring handle on a round back plate at the right, and a square iron lock plate under it. The iron is dark with rust-brown patches; the wood is paler and greyer at the worn edges and has a faint green damp stain along the bottom.",
    "one heavy dark plank door leaf with three broad iron straps and a ring handle, without a frame",
    ["a single flat door leaf of vertical planks", "broad iron straps across it"], ["a stone or wooden door frame, arch or wall around it", "a window or grille in the door"],
    bench=["hinge"])

# ================================================================ tombs: sarcophagus family, coffins
S1 = "sarcophagus--s1"
add(S1, "sarcophagus", "p1", 1, [VAULT, CHAP, RELIC], "a stone sarcophagus with a ridged lid",
    "A big stone tomb chest about 3 ft wide, 7.3 ft long and 3.3 ft tall, standing directly on the floor on its own moulded plinth course."
    " The chest sides are divided into deep sunk panels by stout little pilasters (three panels on each long side, one on each end), each panel carved with a chunky round shield boss."
    " The LID is a separate heavy slab that overhangs the chest a little all round, low-pitched like a roof with a rounded ridge running its whole length and a simple raised sun-disc carved at the middle."
    " Pale warm grey limestone, darker and green-stained near the bottom, with worn paler edges and a few chips." + STONE,
    "a long rectangular stone tomb chest with panelled sides and a heavy ridged stone lid, closed",
    ["a long box-shaped stone chest, clearly longer than it is wide", "a separate heavy lid lying on top, closed"], ["an open or missing lid", "a skeleton or body", "letters or writing"])
add("sarcophagus--s2", "sarcophagus", "sib1", 1, [VAULT, RELIC], "a darker stone sarcophagus with a flat banded lid",
    "A different tomb from the same workshop, the same size and proportions: carved from DARKER grey-green stone. Its long sides are a row of FIVE deep round-headed arches (a blind arcade) between stubby columns,"
    " and its lid is a thick FLAT slab with a deeply chamfered edge, crossed by two broad raised bands and carrying a long raised diamond panel down the middle. Two corners of the lid are chipped. Closed." + STONE,
    "a long rectangular dark stone tomb chest with arcaded sides and a thick flat stone lid, closed",
    ["a long box-shaped stone chest", "a flat lid lying on top, closed"], ["an open or missing lid", "a skeleton or body", "letters or writing"], parent=S1, what="stone sarcophagus")
add("sarcophagus--s3", "sarcophagus", "sib2", 2, [VAULT, CATA], "an old, weathered stone sarcophagus with a rounded lid",
    "A much OLDER, plainer tomb of the same size: a slightly tapering stone chest, a little wider at the head end than the foot, with rounded worn corners and one big sunk panel on each side holding a carved ring-cross emblem."
    " Its lid is a heavy half-barrel (a rounded, coffer-shaped top) with a thick raised rib along the ridge and three across it. The stone is rougher and yellower-grey, cracked across one corner, with moss green along the lid ribs and a dark damp tide line round the bottom. Closed." + STONE,
    "a long, old, weathered stone tomb chest with a rounded barrel-shaped lid, closed",
    ["a long stone chest", "a rounded lid lying on top, closed"], ["an open or missing lid", "a skeleton or body", "letters or writing"], parent=S1, what="stone sarcophagus")
add("sarcophagus-open--s1", "sarcophagus-open", "sib1", 1, [VAULT, RELIC, CATA], "the same sarcophagus with its lid slid aside",
    "Show this same sarcophagus OPEN: the heavy ridged lid has been pushed sideways and turned a little, so it rests askew across the chest, still lying on the far long edge and overhanging the far side, uncovering about HALF of the top."
    " The chest is a deep, clearly HOLLOW stone box with thick walls (about 5 in), its dark empty interior and inner far wall plainly visible through the uncovered half; it is EMPTY: no body, no bones, no treasure."
    " Lid and chest touch and are one object. Keep the chest, plinth, panels and lid carving identical.",
    "a stone tomb chest with its heavy lid pushed askew, showing a dark, empty, hollow interior",
    ["the lid is displaced so that part of the chest's top is open", "a dark hollow interior is visible", "the interior is empty"],
    ["a fully closed lid", "a skeleton, mummy, body or treasure inside", "the lid lying far away from the chest"],
    size=(52, 88, 40), parent=S1, what="a closed stone sarcophagus", twin_of=S1, bench=["hinge"])
add("sarcophagus-open--s1--lidoff", "sarcophagus-open", "sib2", 2, [VAULT, RELIC], "the same sarcophagus with its lid off, leaning against its side",
    "Show this same sarcophagus OPEN with the lid taken right OFF: the heavy ridged lid stands on its long edge on the floor, leaning against the near long side of the chest, its carved top facing out; lid and chest touch along the lid's whole length."
    " The chest is a deep, clearly HOLLOW stone box with thick walls (about 5 in) and a flat rim all round; the whole dark empty interior is visible from above. EMPTY: no body, no bones, no treasure."
    " Keep the chest, plinth, panels and lid carving identical.",
    "a stone tomb chest fully open and empty, with its heavy lid leaning on edge against its side",
    ["the top of the chest is completely open, showing a hollow interior", "the lid leans against the side of the chest, touching it"],
    ["a lid on top of the chest", "a skeleton, mummy, body or treasure inside", "the lid lying flat on the floor away from the chest"],
    size=(52, 88, 40), parent=S1, what="a closed stone sarcophagus", twin_of=S1, bench=["hinge"])
add("effigy-knight", "effigy-knight", "p2", 2, [VAULT, CHAP], "a tomb chest with a carved stone knight lying on its lid",
    "A stone tomb chest about 3.3 ft wide, 7.5 ft long and 2.3 ft tall with deep sunk panels holding carved shields, on a moulded plinth course."
    " On its flat lid lies a carved STONE effigy of an armoured knight on his back, a little larger than life and very simplified and chunky: a great helm on a carved stone pillow, a long kite shield laid over the body from chest to knee,"
    " both hands resting on the pommel of a broad sword that lies down the middle on top of the shield, feet together against a carved block. The effigy is part of the lid, carved from the SAME pale grey stone as the chest, worn smooth, with moss in the folds." + CARVED + STONE,
    "a stone tomb chest with a carved stone figure of a knight lying on its back on the lid",
    ["a long stone chest", "a reclining carved stone figure on top, the same stone colour as the chest"], ["a living or flesh-coloured person", "a standing figure", "a skeleton"])
add("stone-coffin-lidless", "stone-coffin-lidless", "p2", 2, [CATA, VAULT], "an open stone coffin holding a linen-wrapped body",
    "A plain, rough-cut stone coffin trough with NO lid, about 3 ft wide, 7 ft long and 2 ft tall: thick walls (5 in), tapering a little from head to foot, with a rounded head end, tool marks and a cracked rim."
    " Lying in it, filling it almost to the rim so the coffin is NOT a deep hole, is one body wrapped from head to foot in old cream and tan linen bands with a faded burgundy cloth over the middle: a simple, chunky bundle; no face, hands or bone shows."
    " Dark grey-green stone with paler worn rim.",
    "a lidless stone coffin trough with a linen-wrapped body lying in it",
    ["a long stone trough with no lid", "a wrapped body-shaped bundle lying inside"], ["a lid", "a bare skeleton", "an uncovered face"])
add("tomb-slab", "tomb-slab", "p2", 2, [VAULT, CHAP], "a raised grave ledger stone",
    "A grave ledger: one thick rectangular slab of pale grey stone about 3 ft wide, 7 ft long and 6 in thick, lying flat, slightly raised on a narrower chamfered bed stone of darker stone."
    " Its top is carved in deep, chunky relief: a broad raised border, a long-stemmed ring-cross down the middle and a small shield at the foot. Worn smooth in the middle, one corner cracked, moss in the carving. Low and wide.",
    "a low, flat, rectangular carved stone grave slab lying on the ground",
    ["a flat slab much longer and wider than it is tall", "carving on its top face"], ["an upright headstone", "letters or writing", "a chest-high tomb"], size=(36, 84, 6))
C1 = "coffin--s1"
add(C1, "coffin", "p1", 1, [VAULT, CATA, EMB, CHAP], "a plain wooden coffin",
    "A six-sided (shouldered) wooden coffin, about 2.2 ft at its widest, 6.3 ft long and 1.5 ft tall, lying flat on the floor, lid on, closed."
    " Thick boards of dark grey-brown oak with paler worn edges; the lid is a separate thick board that overhangs slightly, fixed with big dome-headed iron nails along its edge,"
    " and carries one broad raised plank down the middle with a short cross-plank near the head. Two chunky iron carrying rings on each long side, hanging flat against the wood.",
    "a closed six-sided wooden coffin lying flat",
    ["a long wooden box with angled shoulders, wider near one end", "the lid is on"], ["an open lid", "a body or skeleton", "a stone sarcophagus"])
add("coffin--s2", "coffin", "sib2", 2, [VAULT, CATA, EMB], "a cheaper, tapered wooden coffin",
    "A poorer coffin of the same size: a simple TAPERED box, wide at the head and narrow at the foot, with NO shoulders, made of paler, rougher honey-grey boards with visible plank joints, bound round by TWO thick ropes knotted on top."
    " The lid is a flat board nailed down; one board at the foot end is cracked. No iron rings. Closed.",
    "a closed, plain tapered wooden coffin bound with two ropes",
    ["a long tapered wooden box", "the lid is on"], ["an open lid", "a body or skeleton"], parent=C1, what="wooden coffin")
add("coffin-open--s1", "coffin-open", "sib1", 1, [VAULT, CATA, EMB], "the same coffin with its lid lying half off",
    "Show this same coffin OPEN: the lid has been lifted and laid back down askew, resting across the foot half of the coffin and overhanging one side, so the head half of the coffin is uncovered."
    " The coffin is a clearly HOLLOW box with thick board sides; its dark interior, the inner sides and a strip of old cream linen lining are visible in the uncovered half. EMPTY: no body, no bones."
    " Lid and coffin touch and are one object. Keep the boards, nails, rings and proportions identical.",
    "a wooden coffin with its lid lying askew across it, showing an empty hollow interior",
    ["the lid is displaced so that part of the coffin is open", "the inside of the coffin is visible and empty"], ["a fully closed lid", "a body, skeleton or vampire inside", "the lid far away from the coffin"],
    size=(40, 76, 18), parent=C1, what="a closed wooden coffin", twin_of=C1, bench=["hinge"])
add("coffin-maker-stack", "coffin-maker-stack", "p3", 3, [EMB], "a stack of three new coffins",
    "THREE plain new six-sided coffins of pale honey wood stacked squarely one on top of another, lids on, the top one turned a few degrees; thick boards, no fittings yet. One solid stack about 2 ft wide, 6.5 ft long and 3 ft tall.",
    "three plain wooden coffins stacked on top of each other", ["a stack of at least two long coffin-shaped boxes"], ["an open coffin", "a body"])

# ================================================================ focal pieces
add("statue-weeping-angel", "statue-weeping-angel", "p1", 1, [ANTE, CHAP], "a stone statue of a hooded mourner with folded wings",
    "A funerary statue carved from ONE block of pale grey stone, about 6 ft tall including its own square moulded stone pedestal (the pedestal is part of the statue and about a quarter of the height)."
    " A hooded, robed mourning figure stands with head bowed and face hidden in both hands; two big wings are folded tight against the back, reaching from the shoulders to the pedestal like a thick cloak."
    " The whole figure is a compact, chunky, column-like mass: heavy robe folds fall straight to the pedestal, no arm or wing stands free of the body, no thin parts." + CARVED +
    " Weathered: darker in the folds, moss green on the shoulders and the pedestal's top, a pale streak down the front.",
    "a grey stone statue of a hooded, robed figure with folded wings, head bowed into its hands, on a square pedestal",
    ["a single upright stone statue, all one stone colour", "wings folded against the back"], ["a living or flesh-coloured person", "wings spread wide", "a sword or weapon", "more than one figure"])
add("monument-urn-draped", "monument-urn-draped", "p1", 1, [ANTE, CHAP, VAULT, RELIC], "a funerary monument: a draped urn on a pedestal",
    "A tall funerary monument about 2.5 ft square and 6.5 ft tall, in three clear parts: a square stepped base; a tall square pedestal with a deep sunk panel on each face holding a carved wreath;"
    " and on top a big, fat, lidded stone urn, half covered by a heavy carved stone cloth draped over one side and hanging down in thick folds to the pedestal's top."
    " Pale warm grey stone with darker damp staining low down and moss on the base steps; the carved cloth a slightly lighter tone." + STONE,
    "a tall stone monument: a square pedestal with a large urn on top, partly covered by a carved stone drape",
    ["a square pedestal", "a large urn on top of it"], ["a human or angel figure", "letters or writing", "a flame"])
add("altar-stone", "altar-stone", "p1", 1, [CHAP, OSS], "a stone altar block",
    "A solid stone altar about 6 ft wide, 3 ft deep and 3.2 ft tall: a thick top slab (mensa) with a moulded edge that overhangs a slightly narrower body."
    " The front is carved with THREE deep round-headed arched panels between stubby columns, the middle one holding a raised sun-disc; each end has one sunk square panel; the back is plain. It stands on one low chamfered step of its own, the same stone."
    " Pale grey stone, worn and darker at the foot, with a few drips of old cream candle wax on the top's corners. NOTHING stands on it.",
    "a rectangular stone altar with a thick top slab and carved arched panels on the front",
    ["a waist-high rectangular stone block, wider than it is deep", "a thick overhanging top slab"], ["candles, books, cloth or other objects on it", "blood", "a body"])
add("rite-funeral-pall", "rite-funeral-pall", "p1", 1, [CHAP], "a coffin under a heavy funeral pall, on a bier",
    "A coffin lying in state, as ONE solid object about 3 ft wide, 7.5 ft long and 2.2 ft tall: a low wooden bier (a thick plank platform on four short, fat turned legs joined by rails) carries a coffin that is completely covered by a heavy cloth pall."
    " The pall is deep burgundy with a broad dull-gold border and one big gold sun-disc embroidered on the top; it drapes over the coffin's box shape and hangs in thick, simple folds to just below the bier's platform on all four sides, so only the bier's legs show."
    " The coffin's long, shouldered shape reads clearly under the cloth. Nothing else on it.",
    "a long coffin-shaped form completely covered by a dark red cloth with a gold border, on a low wooden stand",
    ["a long box shape draped with cloth that hangs down the sides", "short legs or a low stand under it"], ["an uncovered coffin lid", "a body or face", "candles", "blue cloth"])
add("rite-funeral-bier", "rite-funeral-bier", "p2", 2, [CHAP, EMB], "an empty wooden funeral bier",
    "An empty bier for carrying a coffin: a sturdy platform of thick dark oak planks about 2.5 ft wide and 7 ft long, standing 2.5 ft tall on four fat turned legs joined by thick low rails,"
    " with a low raised lip along both long edges and TWO thick carrying handles sticking out about 10 in at each end (rounded, as thick as a wrist). A folded cream cloth lies at one end. Empty.",
    "an empty long wooden stand with carrying handles at both ends", ["a long narrow wooden platform on four legs", "handles projecting from the ends"], ["a coffin or body on it", "wheels"])
E1 = "embalming-table"
add(E1, "embalming-table", "p1", 1, [EMB], "a stone embalming table",
    "A stone table for preparing the dead, about 2.8 ft wide, 7 ft long and 2.8 ft tall: a thick top slab with a raised rim all round, its surface cut with a shallow herringbone of drain channels running to a short, thick spout that sticks out at the foot end;"
    " a low carved stone head-rest block at the other end. The slab rests on TWO massive stone block legs, each carved with a sunk arched panel. EMPTY: nothing on it."
    " Pale grey stone, the top stained darker ochre-brown along the channels, damp and green low on the legs." + STONE,
    "a long stone table on two block legs, with a rimmed top cut with drain channels, empty",
    ["a long waist-high stone table", "a rim or channels on its top surface", "nothing lying on it"], ["a body or corpse on it", "blood", "tools on it", "a wooden table"])
add("rite-corpse-on-slab", "rite-corpse-on-slab", "sib1", 1, [EMB], "the same stone table with a shrouded body on it",
    "The same stone table, now occupied: one body lies on its back along the slab, completely covered from head to foot by a single cream linen shroud that falls in thick simple folds and hangs a little over both long edges."
    " Only the covered shape shows (head, chest, feet as soft bumps): NO face, NO hands, NO skin, no blood. The shroud and body sit firmly on the slab as part of one object. Keep the table identical.",
    "a long stone table with a body lying on it completely covered by a pale shroud",
    ["a long waist-high stone table", "a cloth-covered body shape lying along it"], ["an uncovered face, hands or skin", "blood or gore", "a sitting or standing figure"], parent=E1, what="stone embalming table")
add("ossuary-shrine", "ossuary-shrine", "p1", 1, [OSS], "a bone shrine: a stone altar under an arch built of skulls",
    "A shrine that stands against a wall, about 6 ft wide, 2.5 ft deep and 7 ft tall, flat-backed: a thick upright back wall with a round-arched top, its whole front face built of packed bone ends,"
    " with a single arc of big skulls following the arch and one large round-headed niche in the middle holding THREE skulls stacked in a pyramid. In front of it and joined to it stands a low, solid stone altar block (about 3 ft tall) with a thick top slab,"
    " and on the altar's top a row of five fat cream candle stubs, set well back, touching the back wall." + BONES + " The altar and the plain edges of the back wall are dark grey stone. Candles UNLIT: dark wicks, no flame.",
    "a tall arched back panel covered in skulls and bones with a stone altar block in front of it",
    ["an upright arched panel faced with skulls or bones", "a waist-high altar or shelf block in front of it"], ["bones or skulls lying loose around it", "a complete standing skeleton", "a flame or glow"])
add("reliquary-shrine", "reliquary-shrine", "p1", 1, [RELIC, CHAP], "a gilded house-shaped reliquary on a stone table base",
    "A relic shrine about 3.7 ft wide, 2.3 ft deep and 5 ft tall, in two clear parts. BELOW: a solid stone table base (about 3 ft tall) on a moulded plinth, its front carved with three deep quatrefoil panels, with a thick overhanging top slab."
    " ABOVE, standing on the slab and filling most of it: a big HOUSE-SHAPED reliquary chest of dull gold metal, like a little chapel with a steep gabled roof, a ridge crest of fat round knobs, a row of four round-headed arches on each long side,"
    " and big round cabochon gems in burgundy and moss green set at the gable ends and along the roof. The gold is warm ochre-yellow with darker bronze shadows, mostly matte. Chunky and solid, no thin spires." + STONE,
    "a gold house-shaped chest with a gabled roof, standing on a carved stone table base",
    ["a chest shaped like a small gabled building, gold or brass coloured", "a stone base under it"], ["a cross-shaped or tall thin spire", "blue gems", "a person or statue"])
add("chest-treasure", "chest-treasure", "p1", 1, [RELIC], "a treasure chest full of gold coins",
    "A stout treasure chest about 2.8 ft wide, 1.7 ft deep and 2 ft tall: dark honey-brown wood with broad dull-gold metal bands, big corner plates and a heavy front lock plate, standing on four fat bun feet."
    " Its domed lid is OPEN, tipped back and resting firmly on the chest's back edge, and the chest is heaped ABOVE the rim with one solid, rounded mound of gold coins, with a few big burgundy and green gems and one gold goblet half-sunk in the mound."
    " The coins are painted as big chunky discs on the surface of one solid mass; none are loose in the air and none lie on the floor.",
    "an open wooden treasure chest with metal bands, heaped with gold coins",
    ["a chest with its lid open", "a heap of gold coins filling it"], ["coins scattered on the ground around it", "a closed lid", "blue gems"])
add("pedestal-display", "pedestal-display", "p2", 2, [RELIC, ANTE], "a stone display pedestal",
    "A waist-high stone pedestal about 1.5 ft square and 3.3 ft tall for showing one precious thing: a square moulded base, an eight-sided shaft with a deep sunk panel on each face, and a wider square top with a moulded edge,"
    " its upper surface slightly dished and lined with a thick fitted burgundy cushion. Nothing on the cushion. Pale grey stone, worn at the edges." + STONE,
    "a waist-high stone pedestal with a wider top, empty", ["one upright pedestal, taller than wide", "nothing standing on top"], ["a statue, bust, orb or relic on it", "blue cloth"])

# ================================================================ ossuary and catacomb pieces (bones always bundled)
add("skull-pile--s1", "skull-pile", "p1", 1, [OSS, CATA, VAULT], "a heap of skulls",
    "A low pyramid-shaped heap of about a dozen big human skulls, about 2 ft across and 1.5 ft tall, the skulls facing different ways, the lowest ring sitting flat on the floor." + BONES,
    "a compact heap of skulls", ["many skulls piled together in one mound"], ["skulls lying apart from the heap", "a complete skeleton", "a candle or flame"])
add("skull-pile--s2", "skull-pile", "p3", 3, [OSS, CATA], "a neat stack of skulls against a wall",
    "A tidy stack of skulls built like a low wall end, about 2 ft wide, 1.3 ft deep and 1.7 ft tall: three rows of four skulls, all facing the front, each row set back a little on a layer of long bones laid crosswise; flat at the back." + BONES,
    "a neat stepped stack of skulls in rows, all facing forward", ["skulls in rows stacked on top of each other"], ["skulls lying apart from the stack", "a complete skeleton"], size=(24, 16, 20))
add("bones-pile", "bones-pile", "p2", 2, [OSS, CATA], "a heap of old bones",
    "A low rounded mound of old bones about 2.5 ft across and 1 ft tall: thick long bones, a ribcage half sunk into the top, a pelvis, and three skulls, all jumbled together and sitting flat on the floor." + BONES,
    "a low mound of mixed bones with a few skulls", ["a single heap of bones", "at least one skull in it"], ["bones scattered away from the heap", "a complete laid-out skeleton", "meat or blood"])
K1 = "catacomb-shelf-bones--s1"
add(K1, "catacomb-shelf-bones", "p2", 2, [CATA, OSS], "rough stone shelves stacked with bones",
    "A free-standing stack of rough-cut stone shelves that stands against a wall: about 5 ft wide, 2 ft deep and 7 ft tall, flat-backed, with two thick stone side slabs, a solid stone back and FOUR thick shelf slabs."
    " Every shelf is packed full to the front: two shelves with long bones laid end-on like stacked firewood, two with rows of skulls facing out." + BONES + " The stone is dark grey-green and rough, with tool marks.",
    "tall stone shelves packed with stacked bones and rows of skulls",
    ["a tall shelf unit with several shelves", "bones or skulls filling the shelves"], ["bones fallen on the floor in front", "a complete skeleton", "wooden shelves with jars"])
add("catacomb-shelf-bones--s2", "catacomb-shelf-bones", "sib2", 2, [CATA, OSS], "the same bone shelves, half empty and sagging",
    "The same stone shelf unit, an older and emptier one: the top shelf is EMPTY but for dust, the second holds a row of five skulls, the third a tight stack of long bones that fills only its left half, and the bottom shelf slab is cracked across the middle and sags a little,"
    " carrying a low heap of bones." + BONES + " A grey cobweb is painted flat onto the stone in one top corner (painted on the surface, not a separate thing).",
    "tall stone shelves partly filled with skulls and stacked bones, one shelf empty",
    ["a tall shelf unit with several shelves", "bones or skulls on some shelves"], ["bones fallen on the floor in front", "a complete skeleton"], parent=K1, what="stone shelf unit stacked with bones")
add("ossuary-pillar", "ossuary-pillar", "p2", 2, [OSS], "a square pillar faced with skulls and bones",
    "A square pier about 2 ft across and 9 ft tall, the same on all four sides: a dark stone base block and a dark stone capital block with a simple moulding, and between them the shaft is faced with bones,"
    " FOUR bands of big skulls facing out (three skulls per side) alternating with bands of packed long-bone ends." + BONES,
    "a tall square pillar whose sides are covered with bands of skulls and bones, with a stone base and top",
    ["one tall upright pillar, much taller than wide", "skulls set into its faces"], ["bones lying loose around its foot", "a round column", "a complete skeleton"])
add("charnel-trough", "charnel-trough", "p2", 2, [OSS, CATA], "a stone trough heaped with bones",
    "A long, heavy stone trough about 5.5 ft long, 2.3 ft wide and 1.5 ft tall, with thick walls, a moulded rim and a row of sunk square panels along each side,"
    " heaped ABOVE the rim with one long rounded mound of old bones and skulls (about a dozen skulls showing on top)." + BONES + " Nothing hangs over the sides. Dark grey-green stone.",
    "a long stone trough filled with a heap of bones and skulls",
    ["a long low stone box or trough", "a heap of bones and skulls filling it"], ["bones on the floor around it", "a lid", "water"])
add("burial-urn-niche", "burial-urn-niche", "p2", 2, [ANTE, VAULT, CATA, OSS], "a wall niche block holding funerary urns",
    "A wall-mounted stone niche block about 2 ft wide, 1.3 ft deep and 2.5 ft tall, flat-backed: a thick stone frame with a round-arched top and a projecting sill, enclosing a deep recess that holds THREE squat lidded pottery urns side by side"
    " (one ochre, one dull burgundy, one cream with a moss-green band), standing on the sill and touching the back. Dark grey stone frame with paler worn edges. NO wall shown.",
    "an arched stone niche holding three lidded urns", ["an arched stone frame with a recess", "urns standing inside it"], ["a wall around it", "bones or skulls", "a flame"], hung=True)
U1 = "urn-decorative--s1"
add(U1, "urn-decorative", "p2", 2, [ANTE, VAULT, CHAP, RELIC], "a tall stone funerary urn",
    "A tall, fat-bellied stone urn about 1.3 ft across and 3 ft tall: a square foot block, a short stem, a broad swelling body carved with thick vertical flutes on its lower half and a band of chunky laurel leaves round the shoulder,"
    " two stubby solid lug handles pressed against the neck, and a domed lid with a fat acorn knob. Pale grey stone with green damp staining low down." + STONE,
    "a tall lidded stone urn on a square foot", ["one tall urn with a lid"], ["flowers or plants in it", "a flame", "thin looping handles"])
add("urn-decorative--s2", "urn-decorative", "p3", 3, [ANTE, VAULT, RELIC], "a tall dark bronze funerary urn",
    "A tall urn of the same size in dark BRONZE with a dull green patina in the hollows: a round stepped foot, an egg-shaped body with three broad raised bands and a row of big round bosses, NO handles, and a low conical lid with a ball knob.",
    "a tall lidded dark metal urn", ["one tall urn with a lid"], ["flowers or plants in it", "a flame"])
add("rite-mummified-remains", "rite-mummified-remains", "p2", 2, [VAULT, CATA, EMB], "a linen-wrapped body lying on a low board",
    "One body wrapped from head to foot in old cream and tan linen bands, lying on its back, arms bound to the body, as a single chunky bundle about 5.7 ft long, 1.7 ft wide and 1 ft tall."
    " The bands cross in a broad diamond pattern on the chest, a faded burgundy band wraps the head, and the feet are a simple rounded block. It lies on a thin plank board of the same length that is part of the object. No face, no hands, no bare bone, no blood.",
    "a body completely wrapped in linen bands, lying flat", ["a long wrapped bundle in the shape of a lying body"], ["an uncovered face or hands", "a bare skeleton", "a figure sitting up or standing", "a sarcophagus"], base=False)
B1 = "bench-stone--s1"
add(B1, "bench-stone", "p2", 2, [ANTE, CHAP, VAULT], "a heavy stone bench",
    "A backless stone bench about 5.5 ft long, 1.7 ft deep and 1.6 ft tall: one thick seat slab with a rounded front edge, worn into a shallow dip in the middle, resting on TWO massive block legs, each carved on its outer face with a sunk round-arched panel. Pale grey stone, darker and mossy at the feet." + STONE,
    "a long backless stone bench on two block legs", ["a long seat slab on two supports", "no backrest"], ["a wooden bench", "cushions", "a backrest"])
add("bench-stone--s2", "bench-stone", "sib2", 2, [ANTE, CHAP, VAULT], "a stone bench with scrolled ends",
    "A different bench from the same crypt, the same length and height: the seat slab is thicker with a deep moulded edge, and it rests on THREE legs shaped like fat S-scroll brackets; a low, thick, rolled arm block rises at each end of the seat. One end has a chipped corner.",
    "a long backless stone bench with scroll-shaped legs and low end blocks", ["a long stone seat on supports", "no tall backrest"], ["a wooden bench", "cushions"], parent=B1, what="stone bench")

# ================================================================ lights (all UNLIT; the engine adds flame) and hanging things
P1L = "rite-pillar-candle-tall--s1"
add(P1L, "rite-pillar-candle-tall", "p2", 2, [CHAP, VAULT, OSS], "a tall pillar candle on an iron pricket stand",
    "A funerary candle stand about 4 ft tall and 10 in across: a heavy round iron foot on three stubby paws, a thick twisted iron stem with one fat knop halfway up, and a wide iron drip pan on top carrying ONE very fat cream wax pillar candle about 14 in tall,"
    " with thick runs of melted wax down its sides and over the pan's edge. Dark iron with rust-brown patches.",
    "a floor-standing iron candle stand with one fat cream candle on top", ["one thick candle on top of a tall stand"], ["several candles or branching arms", "a thin wire-like stem"], light="candle", bench=["fire"])
add("rite-pillar-candle-tall--s2", "rite-pillar-candle-tall", "p3", 3, [CHAP, VAULT, RELIC], "a tall pillar candle on a stone baluster stand",
    "A funerary candle stand about 4 ft tall and 10 in across, carved from pale grey STONE: a square foot block, a fat turned baluster shaft, and a square top block with a shallow dish carrying ONE very fat cream wax pillar candle about 12 in tall with thick wax runs down onto the stone.",
    "a floor-standing stone baluster stand with one fat cream candle on top", ["one thick candle on top of a tall stand"], ["several candles or branching arms"], light="candle", bench=["fire"])
add("rite-memorial-sand-tray", "rite-memorial-sand-tray", "p2", 2, [CHAP, ANTE], "a stand with a sand tray of memorial candles",
    "A memorial candle stand about 2.5 ft wide, 1.5 ft deep and 3 ft tall: a sturdy dark iron table frame on four thick legs with a low shelf, carrying a deep rectangular tray filled level with pale sand,"
    " in which stand about TWELVE short, fat cream candles of different heights in three loose rows, each with a little wax pooled at its foot. The candles are thick stubs, not thin tapers.",
    "a waist-high stand with a tray of sand holding many short candles", ["a tray on legs", "many short candles standing in it"], ["thin needle-like tapers"], light="candle", bench=["fire"])
add("rite-sacred-flame-bowl", "rite-sacred-flame-bowl", "p2", 2, [RELIC, ANTE, CHAP], "a bronze fire bowl on a stone drum",
    "A sacred fire bowl about 2 ft across and 3 ft tall: a wide, shallow, thick-walled bronze bowl with a rolled rim and a band of big round bosses, sitting in a short stone drum pedestal carved with a ring of deep arches."
    " The bowl is filled level with a low mound of cold grey ash and black charcoal lumps. Warm dull bronze with green patina in the hollows; pale grey stone drum.",
    "a wide metal bowl full of ash and charcoal on a short round stone pedestal", ["a wide shallow bowl on a pedestal", "ash or charcoal in the bowl, no fire"], ["thin tripod legs"], light="brazier", bench=["fire"])
add("brazier-standing--crypt", "brazier-standing", "p2", 2, [ANTE, VAULT, RELIC, OSS], "a heavy iron brazier on three legs",
    "A squat, heavy iron brazier about 1.7 ft across and 3 ft tall: a deep round fire basket made of EIGHT very thick flat iron staves riveted to two broad hoops (narrow gaps between the staves), with a solid dished bottom,"
    " carried on THREE fat, straight iron legs braced by a thick ring halfway down, ending in broad flat feet. The basket holds a mound of cold black charcoal and grey ash up to the rim. Dark iron with rust-brown and soot-black patches.",
    "an iron fire basket on three thick legs, filled with cold charcoal", ["a basket or bowl on three legs", "charcoal or ash in it, no fire"], ["thin wire-like legs or bars"], light="brazier", bench=["fire"])
add("censer-hanging", "censer-hanging", "p2", 2, [CHAP, EMB, RELIC], "a bronze censer hanging on three chain rods",
    "A hanging incense burner about 10 in across and 2.5 ft tall overall, as ONE solid object: a fat, onion-shaped bronze pot with a pierced domed lid (a few big round holes) and a small round foot, hanging from THREE thick straight rods of chunky oval chain links,"
    " each rod as thick as a thumb, that rise close together from three lugs on the pot's shoulder to one heavy ring at the top. The three chain rods are nearly vertical, almost touching, and read as one stout stem. Warm dull bronze with green patina.",
    "a rounded metal incense pot hanging from three thick chains that meet at a ring", ["a rounded lidded pot", "chains or rods rising from it to a single top ring"], ["thin hair-like chains", "a wall bracket or stand"],
    base=False, route="trellis", why="thin risk: the chains are drawn as three thick near-touching rods; if they still break, hang the pot on a single thick rod")
add("rite-sanctuary-lamp", "rite-sanctuary-lamp", "p2", 2, [CHAP, EMB, VAULT], "a hanging sanctuary lamp with a red glass cup",
    "A hanging lamp about 8 in across and 14 in tall, as ONE solid object: a deep burgundy-red glass cup, thick and opaque-looking, held in a chunky brass cage of four broad straps with a pointed finial below and a brass collar above,"
    " hanging from ONE short, very thick brass rod of three fat chain links to a ring. Inside the cup the top of a cream candle shows. Warm brass with darker shadows.",
    "a small hanging lamp: a red cup in a brass holder under a short thick chain", ["a red or burgundy cup held in metal", "a hanging ring or link at the top"], ["thin hair-like chains", "a wall bracket"],
    base=False, light="lantern", bench=["fire"], why="catalog gen is thin: single thick link rod instead of three chains")
add("candle-drippings-mound", "candle-drippings-mound", "p3", 3, [VAULT, OSS, CATA, ANTE, CHAP], "a mound of old candle wax with candle stubs",
    "A low, lumpy mound of melted cream and yellowed wax about 1.5 ft across and 10 in tall, built up from years of candles: thick overlapping drips and pooled skirts spreading flat onto the floor, with FIVE fat candle stubs of different heights standing in it.",
    "a low mound of melted wax with several candle stubs standing in it", ["a spreading mound of wax", "candle stubs on it"], ["a candlestick or holder", "a skull"], base=False, light="candle", bench=["fire"])
add("skull-candle", "skull-candle", "p3", 3, [OSS, EMB, CATA], "a skull with a candle on top",
    "One big old skull without its lower jaw, sitting flat, with a fat cream candle stub melted onto its crown; thick wax runs down over the forehead and into one eye socket. Chunky and simplified, old ivory colour.",
    "a skull with a candle stuck on top of it", ["one skull", "one candle on top of it"], ["more than one skull", "a holder or stand"], light="candle", bench=["fire"])
add("rite-bone-candelabra", "rite-bone-candelabra", "p3", 3, [OSS], "a candelabra built of bones",
    "A table candelabra about 14 in wide and 20 in tall built from bones: a base of three skulls set in a tight triangle, a thick upright thigh bone as the stem, and at its top a short, fat cross-piece of bone carrying THREE cream candle stubs in a row, the middle one highest."
    " Every part is thick and fused together with old wax drips. Old ivory and tan.",
    "a candle holder made of skulls and bones carrying three candles", ["three candles", "skulls or bones forming the holder"], ["thin spindly arms", "a metal candelabra"], light="candle", bench=["fire"])
add("rite-offering-candles-tray", "rite-offering-candles-tray", "p3", 3, [CHAP, RELIC], "a tray of small offering candles",
    "A shallow rectangular brass tray about 18 in by 12 in with a low rim, holding about FIFTEEN short, fat cream votive candles packed close together in rows, some shorter, with a little wax pooled between them.",
    "a shallow tray filled with rows of short candles", ["a tray", "many short candles in it"], ["tall thin tapers"], base=False, light="candle", bench=["fire"])

# ================================================================ embalming room
add("rite-canopic-jars-set", "rite-canopic-jars-set", "p2", 2, [EMB, VAULT], "a set of four canopic jars on a tray",
    "FOUR squat stone jars standing close together in a square on one thick wooden tray, about 18 in across and 12 in tall overall: each jar is cream stone with one painted band (burgundy, ochre, moss green, dark teal-green),"
    " and each has a different chunky carved stopper: a hawk head, a jackal head, a round-eared ape head and a plain domed knob. The jars touch each other.",
    "four lidded jars with carved animal-head stoppers standing together on a tray", ["four jars close together", "carved stoppers"], ["jars far apart", "a living animal"], base=False)
add("rite-canopic-jar--s1", "rite-canopic-jar", "p3", 3, [EMB, VAULT, RELIC], "a canopic jar with a jackal-head stopper",
    "ONE squat cream stone jar about 5 in across and 12 in tall, slightly wider at the shoulder, with a broad ochre band, closed by a chunky carved jackal-head stopper with tall thick ears.",
    "one stone jar with a carved animal-head stopper", ["a single jar", "a carved head as its stopper"], ["several jars"])
add("rite-canopic-jar--s2", "rite-canopic-jar", "p3", 3, [EMB, VAULT, RELIC], "a canopic jar with a hawk-head stopper",
    "ONE squat dark green-grey stone jar about 5 in across and 12 in tall, with two raised cream bands, closed by a chunky carved hawk-head stopper with a short thick beak.",
    "one stone jar with a carved bird-head stopper", ["a single jar", "a carved head as its stopper"], ["several jars"])
add("natron-tub", "natron-tub", "p2", 2, [EMB], "a stone tub heaped with embalming salt",
    "A low, round stone tub about 2.8 ft across and 1.5 ft tall with thick walls and two broad raised bands, heaped with a rounded mound of coarse white-grey salt crystals; a chunky wooden scoop is half-buried in the mound, its fat handle resting on the rim. Pale grey stone with a crust of white salt on the rim.",
    "a low round stone tub filled with a mound of white salt, with a scoop in it", ["a low wide tub", "a heap of white granular material in it"], ["water", "a body"])
add("rite-embalming-tools", "rite-embalming-tools", "p3", 3, [EMB], "a tray of embalming tools",
    "A shallow wooden tray about 14 in by 8 in with a low rim and a cream cloth lining, holding FIVE chunky bronze tools laid side by side and touching: a broad curved knife, a fat hook, a blunt spoon, a short saw and a thick needle. Deliberately thick and toy-like so they reconstruct in 3D.",
    "a small tray holding a row of bronze tools", ["a tray", "several tools lying on it"], ["blood", "tools scattered off the tray"], base=False)
add("rite-burial-shroud-folded", "rite-burial-shroud-folded", "p3", 3, [EMB, CHAP], "a stack of folded burial shrouds",
    "A neat stack of FOUR thickly folded cream linen shrouds, about 14 in by 10 in and 6 in tall, tied round once with a broad burgundy band; soft rounded folds.",
    "a tied stack of folded cream cloths", ["folded cloth in a stack"], ["blue cloth", "a body"], base=False, size=(14, 10, 6))
add("linen-wrappings-basket", "linen-wrappings-basket", "p3", 3, [EMB], "a basket of rolled linen wrappings",
    "A round, low wicker basket about 20 in across and 16 in tall with two thick loop handles pressed against its sides, filled with a dozen fat rolls of cream and tan linen bandage standing on end and lying on top, one roll trailing a short thick tail over the rim.",
    "a round basket full of rolled cloth bandages", ["a basket", "rolls of cloth in it"], ["blue cloth"])
add("rite-death-mask", "rite-death-mask", "p3", 3, [EMB, VAULT, ANTE, RELIC], "a funerary death mask on a wall plaque",
    "A wall-hung funerary mask about 8 in wide and 10 in tall: a calm, closed-eyed face mask of dull gold with a broad striped headband, simplified and chunky, mounted on a thick oval plaque of dark wood; flat-backed. NO wall shown.",
    "a gold face mask with closed eyes mounted on a dark oval plaque", ["one mask of a face, metal coloured"], ["a living face", "a whole head or bust", "a wall"], hung=True)
M1 = "rite-memorial-plaque--s1"
add(M1, "rite-memorial-plaque", "p3", 3, [ANTE, VAULT, CATA, CHAP], "a carved stone memorial plaque",
    "A wall-hung stone memorial tablet about 20 in wide, 14 in tall and 2 in thick: a rectangular slab of pale stone in a thick moulded frame, carved with a raised laurel wreath in the middle and a row of five short raised bars beneath it (standing in for an inscription: NO letters). Flat-backed. NO wall shown.",
    "a rectangular stone wall tablet carved with a wreath", ["a flat rectangular carved stone tablet"], ["letters or writing", "a wall"], hung=True)
add("rite-memorial-plaque--s2", "rite-memorial-plaque", "p3", 3, [ANTE, VAULT, CATA, CHAP], "a shield-shaped bronze memorial plaque",
    "A wall-hung memorial plaque about 16 in wide and 20 in tall: a thick shield-shaped plate of dark bronze with green patina, a raised rope border, a raised sun-disc in the upper half and three short raised bars below (NO letters), on a slightly larger backing board of dark stone. Flat-backed. NO wall shown.",
    "a shield-shaped dark metal wall plaque with a raised emblem", ["a flat shield-shaped plaque"], ["letters or writing", "a wall"], hung=True, size=(16, 2, 20))

# ================================================================ relic chamber
add("coin-pile", "coin-pile", "p2", 2, [RELIC], "a heap of gold coins",
    "A rounded heap of gold coins about 2.5 ft across and 1 ft tall, sitting flat on the floor, painted as big chunky discs on the surface of ONE solid mound, with a gold cup, a short string of fat pearls and three big burgundy and green gems half-sunk in it. No coin lies apart from the heap.",
    "a mound of gold coins with a few treasures in it", ["one heap of gold coins"], ["coins scattered away from the heap", "a chest", "blue gems"], base=False)
add("rite-grave-goods-pile", "rite-grave-goods-pile", "p2", 2, [RELIC, VAULT], "a pile of grave goods",
    "Grave goods left with the dead, gathered into ONE compact group about 2.5 ft wide, 2 ft deep and 1.3 ft tall, everything touching: two fat pottery jars (one ochre, one burgundy with a cream band), a round bronze shield boss leaning on them,"
    " a short broad sword in a thick scabbard lying across the front, a shallow bronze bowl of gold coins, and a folded moss-green cloth. Dusty and old.",
    "a compact group of old pots, a bronze bowl of coins, a short sword and a shield boss piled together", ["several different objects grouped tightly together", "at least one pottery jar"], ["objects scattered far apart", "a skeleton"], base=False)
add("reliquary", "reliquary", "p2", 2, [RELIC, CHAP], "a small gilded reliquary box",
    "A small casket about 12 in wide, 8 in deep and 10 in tall for a holy relic: a dull-gold box on four fat ball feet with a hipped roof-shaped lid, a round rock-crystal window (cream-white, not blue) in the front set in a thick ring, and big burgundy and green cabochon gems at the corners.",
    "a small gold box with a roof-shaped lid and gems", ["a small box with a pitched lid, gold coloured"], ["blue gems", "a cross on top taller than the box"])
add("reliquary-hand", "reliquary-hand", "p3", 3, [RELIC], "a hand-shaped reliquary",
    "A reliquary shaped like a forearm and hand standing upright, about 4 in wide and 14 in tall: a dull-gold sleeve with broad jewelled bands rising from a thick round foot, ending in a simplified gold hand held flat with the fingers together, like a mitten with finger lines. Chunky; no separate thin fingers.",
    "an upright gold forearm-and-hand shaped container on a round foot", ["an upright arm shape ending in a hand, gold coloured"], ["a real flesh hand", "spread thin fingers", "blue gems"])
add("rite-relic-bone-fragment", "rite-relic-bone-fragment", "p3", 3, [RELIC, CHAP], "a bone relic on a velvet cushion",
    "A fat square burgundy velvet cushion about 8 in across with a thick gold cord edge and four chunky corner tassels pressed against it, with one short, thick piece of old ivory-coloured bone lying in a dip in its middle, bound round with a broad gold band.",
    "a square red cushion with a short piece of bone resting on it", ["a cushion", "one bone fragment on it"], ["a skull", "blue cloth"], base=False)
add("urn-ashes-small", "urn-ashes-small", "p3", 3, [RELIC, OSS, VAULT, CHAP], "a small funerary urn",
    "A small lidded urn about 5 in across and 8 in tall: a fat egg-shaped body of dark green-grey stone on a little round foot, with one raised cream band and a low domed lid with a round knob.",
    "a small lidded urn", ["one small urn with a lid"], ["handles", "flowers"])
add("skull-single", "skull-single", "p3", 3, [OSS, CATA, VAULT, EMB], "a human skull",
    "One big old human skull with its lower jaw attached, sitting flat on its jaw: simplified and chunky, with deep round eye sockets, a triangular nose hole and a row of big square teeth; old ivory and tan with darker brown in the hollows and one crack across the crown.",
    "a single human skull", ["exactly one skull"], ["other bones", "a candle", "a helmet"], base=False)
add("casket-ornate", "casket-ornate", "p3", 3, [RELIC], "a small ornate casket",
    "A small jewel casket about 10 in wide, 7 in deep and 7 in tall: dark burgundy lacquered wood with a domed lid, broad dull-gold corner mounts and bands, a fat gold lock plate with a ring, and four squat lion-paw feet. Closed.",
    "a small ornate box with a domed lid and gold fittings, closed", ["a small box with a lid, closed"], ["an open lid", "blue gems"])

ids = [a["id"] for a in assets]
assert len(ids) == len(set(ids)), [i for i, n in Counter(ids).items() if n > 1]
by_id = {a["id"]: a for a in assets}
for a in assets:
    assert a["object"] in roles and roles[a["object"]]["size"], a["id"]
    assert a["group"] in ("p1", "p2", "p3", "sib1", "sib2", "sib3") and a["group"][-1] == str(a["prio"]), a["id"]
    if a["gate_refs"]:
        par = Path(a["gate_refs"][0]).stem
        assert a["group"].startswith("sib") and by_id[par]["group"].startswith("p"), (a["id"], par)   # a parent is always in a p group
    if a.get("twin_of"):
        assert roles[a["object"]]["open_of"] == by_id[a["twin_of"]]["object"], a["id"]
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets: (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(assets), "assets", dict(sorted(Counter(a["group"] for a in assets).items())), "prio", dict(sorted(Counter(a["prio"] for a in assets).items())))
print("hung:", [a["id"] for a in assets if a.get("hung")])
print("lights:", {a["id"]: a["light"] for a in assets if a.get("light")})
print("bench:", {a["id"]: a["bench"] for a in assets if a["bench"]})
