#!/usr/bin/env python3
"""Dungeon & prison type (2026-10-11, batch 2026-10-11-types): every NEW mesh of DESIGN.md ("New meshes", 75 specs), in
the castle batch's format (experiments/2026-10-05-castle-crypt-mansion/castle/build_spec.py). Writes assets.json for
tools/gen.py (src/plate_gate_batch.py) and prompts/<id>.spec.md.
Groups: p1/p2/p3 = independent pieces by priority; sib1/sib2/sib3 = painted FROM the accepted plate of a parent that is in
a p group (wall pieces from the wall, shape variants from the first, the open chest from the crypt's accepted chest plate).
Run order: p1, sib1, p2, sib2, p3.
Extra fields per asset (ignored by the runner): prio, rooms, bench, light, twin_of, route, note, tier, kit, opening, family.
Provenance: text prompts and our own style reference only (the same STYLE_REF the castle used); the one supplied
picture that is not the style reference is our own accepted crypt plate of chest-treasure.
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
CHEST = str(MAIN / "experiments/2026-10-05-castle-crypt-mansion/crypt/inputs/chest-treasure.jpg")
roles = {}
for p in sorted((ROOT / "catalog").glob("*.catalog.md")):
    roles.update(ct.parse_catalog(p)[0])
NEW_ROLES = {r for r, v in roles.items() if v["file"] == "objects-dungeon.catalog.md"}

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
MOOD = " Dungeon mood: cool, quiet, matte surfaces with a strong, simple silhouette that reads from far above."
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
    if obj not in NEW_ROLES: a["tier"] = "dun"          # a sku under a role the library already has: exclusive to the dungeon rooms
    if wall: a["generation"], a["family"], a["kit"] = "kit", "cut-rock", "wall"
    if kit: a["kit"] = kit
    if opening: a["opening"] = opening
    if hung: a["hung"] = True
    if light: a["light"] = light
    if twin_of: a["twin_of"] = twin_of
    if note: a["note"] = note
    assets.append(a)

CELL, GUARD, INTER, VAULT, SEWER = "dun-cell-block", "dun-guard-room", "dun-interrogation", "dun-vault", "dun-sewer"
CORR, TRAP, PUZ, CHASM, DEN, SHRINE, FLOOD, COLL = ("dun-corridor", "dun-trap-corridor", "dun-puzzle-hall", "dun-chasm", "dun-den", "dun-shrine",
                                                    "dun-flooded", "dun-collapsed")
ADV = [CORR, TRAP, PUZ, CHASM, DEN, SHRINE, FLOOD, COLL]
PRISON = [CELL, GUARD, INTER, VAULT, SEWER]
IRON = "dark forged iron with a little rust-brown and worn bright edges"

# ================================================================ wall kit: family cut-rock (adventure half)
W0 = "wall-straight--cut-rock"
RW = "a wall hewn from living rock, one continuous dark grey-brown chiselled rock face with no blocks or joints"
WM = ["one single upright wall section, clearly taller than it is wide", "one continuous hewn rock face with chisel marks (not built of blocks)"]
WN = ["a floor, base slab, roof or corner return", "a torch, banner, ring or any fitting attached to the wall", "masonry blocks, bricks or mortar joints"]
add(W0, "wall-straight", 1, "a straight wall section hewn out of living rock, for a dungeon",
    f"ONE plain straight wall section, {PANEL}, of {CUTROCK}. The top edge is one level line and the bottom edge sits flat; the two side edges are clean vertical cuts." + TALL,
    "a plain upright wall section of dark hewn rock covered in chisel marks, with no masonry blocks", WM, WN + ["a window, niche or door"],
    wall=True, opening="solid", rooms=ADV)
add(W0 + "--s2", "wall-straight", 1, "a second straight wall section hewn out of living rock",
    "The same plain wall with a DIFFERENT pattern, so that two sections side by side do not read as copies: one long fissure running diagonally from high left to low right,"
    " a band of PALER, warmer stone about a foot tall running level across the wall at two-thirds height, and a small natural ledge low on the right."
    " Same height, thickness, level top, flat bottom and clean vertical side cuts." + TALL,
    "a plain upright wall section of dark hewn rock with a paler band running across it", WM, WN + ["a window, niche or door"],
    wall=True, opening="solid", parent=W0, what=RW, mode="wall", rooms=ADV)
add(W0 + "--s3", "wall-straight", 1, "a hewn rock wall section with a small empty torch nook",
    "The same wall with ONE shallow hewn recess at head height (its sill about 5 ft above the bottom), centred: a small EMPTY torch nook about 12 in wide, 16 in tall and 6 in deep,"
    " with a roughly rounded head, chisel marks inside and a smear of old soot above it. It does NOT go through the wall. Nothing stands in it."
    " Same height, thickness, level top, flat bottom and clean vertical side cuts." + TALL,
    "an upright wall section of dark hewn rock with one small empty shallow recess at head height",
    WM + ["one small shallow recess, empty"], WN + ["an opening that goes through the wall", "a torch, candle or statue in the recess", "a door"],
    wall=True, opening="solid", parent=W0, what=RW, mode="wall", rooms=ADV)
add("wall-doorway--cut-rock", "wall-doorway", 1, "a hewn rock wall section with an empty rough door opening",
    "The same wall with an EMPTY door-sized opening cut through it, starting at the very bottom: about 3.5 ft wide and 7 ft tall, centred, with a roughly SQUARED head and"
    " plain hewn jambs marked by chisel strokes. NO dressed arch, NO door leaf, NO frame, NO threshold step, NO hinges. About 9 in of rock remains on each side and"
    " a deep band of rock, 2 ft tall, runs unbroken above the opening. It is still ONE slab of the same wall with a hole cut through it: the side strips and the band above are the"
    " same single uninterrupted rock face, with NO joint, NO step and NO change of stone between them (it is NOT two posts carrying a separate lintel, NOT a trilithon, NOT a free-standing"
    " gateway), and the outer outline is the same plain rectangle as the plain wall. You can see straight through the opening to the blue background." + TALL,
    "a wall section of dark hewn rock with one empty, roughly squared door opening through it (no door leaf)",
    ["one upright rectangular slab of wall, clearly taller than it is wide, pierced by a door opening (narrow strips of wall beside the opening and a band above it are expected)",
     "hewn rock with chisel marks, not built of blocks", "one door-sized opening that reaches the bottom of the wall, with NO door in it (you can see through)", "rock continues above the opening"],
    WN + ["a door leaf filling the opening", "a dressed stone arch or frame", "a window"], wall=True, opening="door", parent=W0, what=RW, mode="wall", rooms=ADV)

# ================================================================ doors (leaf only: the engine hinges them)
add("door-cell-bars--leaf", "door-cell-bars", 1, "a barred prison cell door leaf, without a frame",
    f"ONLY the door leaf, with NO wall, NO door frame and NO fixed bars round it: an upright barred prison door about 3.3 ft wide and 7 ft tall. A heavy rectangular frame of FLAT iron bar"
    f" (4 in wide) all round, filled with FIVE fat round vertical bars evenly spaced, tied by TWO flat horizontal straps that the bars pass through at one third and two thirds of the height."
    f" A big box lock with a keyhole plate on the right edge at waist height; two chunky knuckle hinges on the left edge. {IRON.capitalize()}. You can see the blue background between the bars."
    " Closed, flat, seen from its broad side." + CHUNKY + MOOD,
    "an upright barred iron prison door leaf: vertical bars in a flat iron frame with a lock, no wall round it",
    ["one door leaf only, taller than wide", "vertical iron bars with gaps you can see through", "a lock box on one edge"],
    ["a stone wall, door frame or fixed panel of bars round the door", "a solid plank door", "two leaves"],
    size=(40, 5, 84), base=False, kit="door-leaf", rooms=[CELL, GUARD, INTER],
    note="RISK: bars. leaf-only sku like door-reinforced--leaf (the castle's dungeon wants it too); if the mesh fails twice it ships as a flat card from this plate")
add("door-rune-sealed--leaf", "door-rune-sealed", 1, "a monolithic rune-carved stone door slab, without a frame",
    "ONLY the door slab, with NO frame, NO wall and NO arch round it: one thick rectangular monolith of dark slate-grey stone, about 3.7 ft wide, 7.5 ft tall and 8 in thick, square-cornered."
    " On its face a big RING of deep-carved angular runes (abstract straight-stroke marks, not letters) surrounds a central carved stone disc with an EMPTY round socket in its middle."
    " The runes are painted DULL: dark cut grooves with a little worn ochre in them, NO glow. Heavy verdigris-bronze bindings wrap the four corners. No handle. Closed, flat, upright, seen from its broad side." + MOOD,
    "an upright rectangular stone door slab carved with a ring of runes round a central disc, bronze corner bindings, no frame",
    ["one upright rectangular stone slab, taller than wide", "a ring of carved rune marks round a central disc"],
    ["a stone frame, arch or wall round the door", "glowing runes or light", "readable letters or words", "a handle or ring pull"],
    size=(44, 8, 90), kit="door-leaf", rooms=[PUZ, VAULT, SHRINE, CORR], note="leaf only; the runes are dull so the engine can light them")
add("door-face-carved--leaf", "door-face-carved", 2, "a stone door slab carved as one giant grim face, without a frame",
    "ONLY the door slab, with NO frame, NO wall and NO arch round it: one thick rectangular monolith of grey stone, about 3.7 ft wide, 7.5 ft tall and 8 in thick, its whole face carved as ONE giant"
    " grim face in bold relief: heavy brows, deep-set blank eyes, a broad nose and a wide OPEN mouth that is a shallow dark recess (it does NOT go through the slab)."
    " Moss green in the creases, worn pale on the nose and brows. No handle. Closed, flat, upright, seen from its broad side." + MOOD,
    "an upright rectangular stone door slab carved as one large grim face with an open mouth, no frame",
    ["one upright rectangular stone slab, taller than wide", "one large carved face filling it"],
    ["a stone frame, arch or wall round the door", "a hole right through the slab", "glowing eyes", "a whole statue with a body"],
    size=(44, 8, 90), kit="door-leaf", rooms=[PUZ, SHRINE, CORR])

# ================================================================ traps and hazards
add("pressure-plate", "pressure-plate", 1, "a square stone pressure plate for a dungeon floor",
    "A floor trap trigger seen as one low object: a square plate of pale grey stone about 2 ft across standing 3 in PROUD inside a square collar of darker stone (the collar about 2.5 ft across and"
    " 1 in tall). The plate is worn into a shallow hollow in the middle, with chamfered edges and a clear dark gap between plate and collar; a small carved warning skull at one corner of the collar." + MOOD,
    "a low square stone floor plate set in a darker stone collar", ["a low flat square slab, much wider than tall", "an inner plate distinct from its surrounding collar"],
    ["spikes", "a lever", "a tall block or pedestal"], size=(30, 30, 4), base=False, rooms=[TRAP, PUZ, CORR, VAULT], note="the collar IS the object's base")
add("pressure-plate--s2", "pressure-plate", 2, "a round bronze-rimmed pressure plate for a dungeon floor",
    "A ROUND plate instead of a square one: a disc of the same pale stone about 2 ft across, carved with one big spiral groove, standing 3 in proud inside a broad verdigris-BRONZE rim ring,"
    " the whole set in a square collar of the same darker stone. No skull.",
    "a low round stone floor plate with a carved spiral, inside a bronze ring", ["a low flat disc, much wider than tall", "a spiral carved on it", "a metal rim ring"],
    ["spikes", "a lever", "a tall block or pedestal"], size=(30, 30, 4), base=False, parent="pressure-plate", what="a square stone pressure plate in a darker stone collar",
    rooms=[TRAP, PUZ, SHRINE])
add("trap-spikes", "trap-spikes", 1, "a sprung floor spike trap",
    "A SPRUNG floor spike trap as one object: a square, iron-bound stone plate about 4.5 ft across and 4 in thick, with a 4 x 4 grid of round holes, and out of every hole stands one FAT"
    " cone spike, sixteen in all, each 18 in tall with a base as thick as a fist and a blunt point, like a row of big iron traffic cones. The spikes are dark iron with rust and dark stains;"
    " the plate is grey stone with an iron band round its edge and four big rivets at the corners." + CHUNKY + MOOD,
    "a square stone plate with a grid of fat upright iron spikes standing out of it",
    ["a square low plate", "many upright cone spikes in rows, thick at the base"], ["thin needles or wire-thin spikes", "a pit or hole in the ground", "a body or skeleton"],
    size=(56, 56, 22), base=False, rooms=[TRAP, CORR, VAULT], note="RISK: spikes; asked for fat cones. The plate IS its base")
add("trap-spike-pit", "trap-spike-pit", 1, "a spiked pit trap seen as one low object",
    "A pit trap made as ONE low object that sits on a floor: a square kerb of big dressed grey stones 10 in tall and 8 in thick round a 4 ft square opening. Inside the kerb the floor is painted"
    " very dark (near-black brown, as if deep) and bristles with about twelve FAT sharpened wooden stakes, each as thick as an arm, whose pale cut tips reach just to the top of the kerb."
    " Half of a broken false-floor cover of thick planks still lies across one side of the kerb, its snapped ends jagged." + CHUNKY + MOOD,
    "a low square stone kerb round a dark pit full of thick sharpened stakes, with a broken plank cover on one side",
    ["a low square stone rim", "thick pointed stakes inside it", "a dark interior"], ["thin needle spikes", "a skeleton or body", "a tall wall round it"],
    size=(58, 58, 12), base=False, rooms=[TRAP, CORR, DEN], note="reads as a pit although it stands on the floor; the kerb IS its base")
add("trap-blade", "trap-blade", 1, "a swinging-blade trap on its own stone gantry",
    "A swinging-blade trap as ONE free-standing gantry about 5.5 ft wide and 8 ft tall: TWO thick square stone posts (each about 14 in square, of big grey blocks) joined across the top by a heavy"
    " dark timber crossbeam with iron straps. From the middle of the beam hangs ONE thick, flat iron arm (as wide as a hand) on a big pivot pin, and at its bottom a huge CRESCENT axe blade about"
    " 3 ft wide, edge downwards, hanging straight down at the bottom of its swing with its edge a foot above the floor. Blade: dark iron with a worn bright edge and dark stains. Nothing thin: no chains, no ropes." + CHUNKY + MOOD,
    "a stone and timber gantry with a big crescent blade hanging from its crossbeam on a thick iron arm",
    ["two upright posts joined by a beam across the top", "one large crescent blade hanging between the posts"],
    ["a chain or rope holding the blade", "a guillotine with a slanted blade in grooves", "a person", "several blades"],
    size=(66, 20, 96), rooms=[TRAP, CORR], note="catalog line changed from ceiling to floor (a gantry). RISK: the hanging arm; asked for a broad flat arm")
add("trap-dart-wall", "trap-dart-wall", 1, "a carved stone dart-trap slab that stands against a wall",
    "A dart trap as ONE upright carved stone slab, flat-backed to stand against a wall: about 4.5 ft wide, 7 ft tall and 10 in thick, of pale grey stone inside a broad verdigris-BRONZE rim."
    " Its face carries THREE rows of FOUR round dart holes; every hole is the open mouth of a small carved snarling face (twelve little faces), the holes painted black."
    " At its foot a low stone sill on which a few short fat darts lie, fused to the sill." + ROCKY + MOOD,
    "an upright carved stone slab with rows of small snarling faces whose mouths are dark round holes, in a bronze rim",
    ["one upright rectangular slab, taller than wide", "rows of round holes or small carved faces on its front"],
    ["a whole room wall of blocks", "darts flying in the air", "a door or archway through it"],
    size=(56, 10, 84), base=False, rooms=[TRAP, CORR, VAULT], note="catalog line changed: wall, fp 1, mount 0 (a slab against the wall, not a kit panel)")
add("trap-flame-jet", "trap-flame-jet", 2, "a bronze dragon-head flame nozzle set in a scorched stone block",
    "A flame trap nozzle: a squat square block of grey stone about 2 ft across and 10 in tall, and set on its top a stubby verdigris-BRONZE dragon head about 14 in long, jaws wide open, pointing"
    " forward and slightly up, with a round black nozzle hole in its throat. A fan of black soot spreads over the block in front of the mouth and the bronze is heat-darkened round the jaws." + MOOD,
    "a small bronze dragon head with open jaws mounted on a low soot-stained stone block",
    ["a low stone block", "a metal beast or dragon head with an open mouth on it"], ["a whole dragon with wings or body", "a tall statue"],
    size=(24, 24, 16), light="flame-jet", bench=["fire"], rooms=[TRAP, CORR, VAULT, SHRINE])
add("trap-crossbow", "trap-crossbow", 2, "a trap crossbow bolted to a low timber block",
    "A corridor trap: ONE heavy crossbow bolted flat on top of a stubby timber block stand (a squat three-legged block of thick dark oak about 20 in tall). The crossbow has a thick stock,"
    " a short FAT steel bow, a string as thick as a finger drawn back, and one fat bolt loaded, pointing forward. A thick cord runs from the trigger down to a fat wooden floor peg right beside the stand,"
    " lying against the stand's leg (not stretched through the air)." + CHUNKY + MOOD,
    "a heavy crossbow mounted on a low, stubby wooden stand, loaded with a bolt",
    ["a crossbow with a bow across the front of a stock", "a low wooden stand under it"], ["a tall tripod of thin legs", "a person", "wheels", "a giant siege ballista"],
    size=(26, 34, 34), rooms=[TRAP, CORR, VAULT], note="RISK: bow arms and string; asked for fat")
add("boulder-rolling", "boulder-rolling", 1, "one huge round granite boulder",
    "ONE huge, near-SPHERICAL granite boulder 5 ft across, the classic rolling-trap stone: mottled grey granite with warm speckles, chipped and scarred, with a few flat facets where pieces have"
    " broken off and a paler SCRAPED band running round its middle like an equator where it has rolled along the walls. Just the ball: it rests on the floor on its own curve.",
    "one big round grey stone boulder, nearly a sphere", ["a single large rounded boulder", "about as tall as it is wide"],
    ["a pile of several rocks", "a carved face", "a track, ramp or cradle under it", "moss covering it"], size=(60, 60, 60), rooms=[TRAP, CORR, COLL])
add("lever-floor", "lever-floor", 1, "a heavy iron floor lever in a stone housing",
    "A floor lever: a housing about 16 in wide, 22 in long and 12 in tall, a block of grey stone capped by a thick iron plate with one long slot, and out of the slot rises ONE thick iron lever"
    " (as thick as a wrist) about 3 ft long, ending in a ball handle as big as a fist, thrown over to ONE side at about 30 degrees from upright. Four big rivets on the plate; " + IRON + "." + CHUNKY + MOOD,
    "a thick iron lever with a ball handle rising from a slotted iron and stone base", ["one lever with a ball or knob handle", "a low housing block under it"],
    ["a wall plate", "several levers", "a wheel or crank", "a chain"], size=(16, 22, 40), rooms=[TRAP, PUZ, GUARD, SEWER, FLOOD, CELL])
add("trap-bear", "bear-trap", 3, "an open iron jaw trap",
    "A big iron jaw trap lying OPEN and set, about 2.5 ft across: two semicircular jaws lying flat with FAT triangular teeth (each as big as a thumb, about eight per jaw), a round pressure pan in the"
    " middle, two thick flat springs at the sides and a stub of three fat chain links at one end. " + IRON.capitalize() + ". Low and flat." + CHUNKY,
    "a round open iron jaw trap with big teeth lying flat", ["two toothed jaws lying open", "low and flat"], ["closed jaws", "an animal or a leg in it", "a long thin chain"],
    size=(30, 30, 10), base=False, rooms=[TRAP, DEN, CORR], note="variant sku of bear-trap at a bigger, own size")

# ================================================================ puzzle hall
add("block-sliding", "block-sliding", 1, "a pushable carved stone puzzle cube",
    "A pushable stone puzzle block: a CUBE of grey stone 4.5 ft on every edge. Each visible face is framed by a broad carved border and carries ONE big recessed angular rune (an abstract"
    " straight-stroke mark, a different one on each face, not a letter). Chunky verdigris-bronze caps on all eight corners; the lower edges scuffed and paler from being dragged." + ROCKY + MOOD,
    "a large stone cube with a carved border and one big rune mark on each face, bronze corner caps",
    ["one cube, as tall as it is wide", "a carved mark on its faces"], ["glowing runes", "readable letters", "handles or rings", "a lid (it is not a chest)"],
    size=(54, 54, 54), base=False, rooms=[PUZ, TRAP, VAULT])
add("statue-rotating", "statue-rotating", 1, "a robed stone guardian statue on a round turntable plinth",
    "A puzzle statue that can be turned: a robed, hooded stone guardian about 5 ft tall standing upright, holding a thick stone staff CLOSE against the body with one hand, the other arm bent with"
    " the hand pointing forward only slightly (the arm stays close to the chest, nothing sticks far out). It stands on a ROUND turntable plinth about 2.7 ft across and 14 in tall: a stone drum"
    " with a verdigris-bronze TOOTHED ring round its top edge and one bronze arrow marker on the front. The figure is plain weathered grey stone, simple and blocky, face in shadow under the hood." + ROCKY + MOOD,
    "a stone statue of a robed, hooded figure with a staff standing on a round plinth with a toothed bronze ring",
    ["one standing robed figure of stone", "a round (not square) plinth under it"], ["a living person in coloured clothes", "wings", "arms spread wide", "a square plinth"],
    size=(32, 32, 78), base=False, rooms=[PUZ, SHRINE], note="the round plinth IS the base")
add("statue-rotating--s2", "statue-rotating", 2, "an armoured stone knight statue on the same round turntable plinth",
    "A different figure on the SAME round turntable plinth (stone drum, bronze toothed ring, arrow marker): an armoured stone KNIGHT standing upright in a great helm, both hands resting on the pommel of"
    " a broad stone sword whose point stands on the plinth between the feet. Arms close to the body; plain weathered grey stone like the first.",
    "a stone statue of an armoured knight with a sword point-down, on a round plinth with a toothed bronze ring",
    ["one standing armoured figure of stone", "a sword held point down in front", "a round plinth"], ["a living person in coloured clothes", "a shield held out to the side", "a horse"],
    size=(32, 32, 78), base=False, parent="statue-rotating", what="a robed stone guardian statue on a round turntable plinth with a bronze toothed ring", rooms=[PUZ, SHRINE, VAULT])
add("orb-socket-pedestal", "orb-socket-pedestal", 1, "a carved stone pedestal holding a dull stone orb",
    "A waist-high puzzle pedestal about 20 in across and 3.5 ft tall: a square stepped base, a fat eight-sided carved shaft with a sunk panel on each face, and a wider top carved into a"
    " bowl-shaped SOCKET. In the socket sits ONE dull grey STONE orb about 10 in across (matte stone, NOT glass, NOT glowing), gripped by three stubby verdigris-bronze claws." + ROCKY + MOOD,
    "a waist-high carved stone pedestal with a grey stone ball held on top by bronze claws",
    ["one upright pedestal, taller than wide", "a ball resting on top of it"], ["a glowing or glass crystal ball", "a statue or bust on it", "blue colour"],
    size=(20, 20, 42), base=False, rooms=[PUZ, SHRINE, VAULT], note="the stepped base is its own")
add("puzzle-dial-pillar", "puzzle-dial-pillar", 2, "a stone combination pillar of four rotating drums",
    "A puzzle lock: a FAT round stone column 2 ft across and 5 ft tall made of FOUR stacked drums of equal height, separated by verdigris-bronze bands, on a low round base and with a low domed cap."
    " Each drum is carved all round with a row of big, different abstract symbols (sun, moon, eye, wave, triangle, spiral: simple shapes, not letters), one symbol per panel, and the drums are"
    " turned slightly out of line with each other so the panels do not line up." + ROCKY + MOOD,
    "a fat round stone column made of four stacked drums carved with symbols, with bronze bands between them",
    ["one upright round column", "horizontal bands dividing it into stacked sections", "carved symbols round it"], ["glowing symbols", "readable letters or numbers", "a statue on top"],
    size=(24, 24, 60), base=False, rooms=[PUZ, VAULT])
add("obelisk-rune", "obelisk-rune", 2, "a dark stone obelisk cut with runes",
    "A four-sided OBELISK of dark slate-grey stone, 7.5 ft tall, tapering from about 22 in square at the bottom to a blunt pyramid tip, standing on its own two-step square base 28 in across."
    " Deep-cut angular runes (abstract straight-stroke marks, not letters) run in a column down every face, the grooves dull with a little worn ochre in them. NO glow." + MOOD,
    "a tall, tapering four-sided dark stone obelisk with carved rune marks, on a stepped base",
    ["one tall tapering pillar with a pointed top", "carved marks on its faces"], ["glowing runes", "readable letters", "a statue or orb on top"],
    size=(28, 28, 90), base=False, rooms=[PUZ, SHRINE, CORR])
add("statue-guardian", "statue-guardian", 1, "a massive weathered stone warrior statue with a great shield",
    "A massive guardian statue of weathered grey stone, 7.5 ft tall with its plinth: a broad, blocky WARRIOR standing at attention in heavy armour and an open-faced helm, both hands resting on the"
    " top rim of a great tall shield that stands on the plinth in front of the legs (the shield covers the figure from the waist down, so the figure and shield are one solid mass)."
    " It stands on a low SQUARE plinth about 3 ft wide. Worn edges, a few chips, a little moss on the shoulders." + ROCKY + MOOD,
    "a big stone statue of an armoured warrior standing behind a tall shield, on a square plinth",
    ["one standing stone figure in armour", "a large shield in front of it", "a plinth under it"], ["a living person in coloured clothes", "a raised weapon or outstretched arm", "wings"],
    size=(36, 30, 90), base=False, rooms=[CORR, VAULT, SHRINE, PUZ, GUARD])
add("statue-guardian--s2", "statue-guardian", 2, "a horned, beast-headed stone guardian statue with crossed arms",
    "A different guardian on the SAME kind of low square plinth, the same height and bulk: a broad-shouldered figure with the HEAD OF A HORNED BEAST (a bull-like head with two short, very thick"
    " curved horns), standing upright with its arms CROSSED on its chest, wearing a long stone kilt that reaches the plinth so the legs are one solid mass. No shield. The same weathered grey stone.",
    "a big stone statue of a horned, beast-headed figure with crossed arms, on a square plinth",
    ["one standing stone figure with a horned animal head", "arms crossed on the chest", "a plinth under it"], ["a living creature in colour", "wings", "a weapon held out"],
    size=(36, 30, 90), base=False, parent="statue-guardian", what="a massive weathered stone warrior statue on a square plinth", rooms=[CORR, SHRINE, PUZ, DEN])

# ================================================================ prison
add("skeleton-chained", "skeleton-chained", 1, "a chained skeleton slumped against a slab of wall",
    "The forgotten prisoner as ONE solid mass: a thick upright slab of dark dressed stone backing about 26 in wide, 5.5 ft tall and 5 in thick, and SITTING slumped against it a human skeleton,"
    " legs stretched forward a little and fused to a low stone sill, skull fallen forward on the chest. Both wrists are held up at shoulder height in FAT iron manacles on short, thick chains"
    " (three fat links each) from two big ring bolts in the slab. The ribcage is filled in dark (painted as a solid chest with rib ridges, NOT open bars), the arms and legs lie against the"
    " body and the slab, with ragged scraps of ochre-grey cloth over the hips. Bones chunky and cream; nothing thin, nothing sticking out into the air." + CHUNKY + MOOD,
    "a skeleton slumped against an upright stone slab with its wrists chained above it",
    ["a human skeleton, sitting or slumped", "manacles or chains at the wrists", "a stone backing slab behind it"], ["a living person", "a whole cell or room", "a skeleton standing free with thin separate bones"],
    size=(26, 14, 66), base=False, rooms=[CELL, INTER, CORR, SEWER], note="catalog: wall, mount 0. RISK: thin bones; asked for one solid mass on a backing slab (the slab and sill are its own)")
add("ball-and-chain", "ball-and-chain", 2, "a prisoner's iron ball and chain",
    "A prisoner's ball and chain lying on the floor: ONE iron ball about 9 in across, joined by THREE very fat oval chain links to an OPEN hinged leg shackle (a thick iron ring in two halves)."
    " The links lie touching each other in a short curve, flat on the floor. " + IRON.capitalize() + "." + CHUNKY,
    "an iron ball joined by a few fat chain links to an open leg shackle", ["a round iron ball", "a short chain of thick links", "a ring-shaped shackle"],
    ["a long thin chain", "a leg or a person", "spikes on the ball (it is not a flail)"], size=(20, 14, 10), base=False, rooms=[CELL, INTER, GUARD])
add("chain-pile", "chain-pile", 2, "a heap of rusty heavy chain",
    "A heap of heavy, rusty chain about 22 in across and 9 in tall: very FAT oval links fused together into ONE solid rounded mound (the links painted on the surface of one mass, none hanging free),"
    " with one big blunt iron hook lying on top. Rust-brown and dark iron with a few worn bright spots." + CHUNKY,
    "a low mound of thick rusty chain links with a hook on top", ["one compact heap of chain", "thick links"], ["a long chain stretched out", "a thin chain", "an anchor"],
    size=(22, 22, 9), base=False, rooms=[CELL, GUARD, INTER, SEWER])
add("chair-interrogation", "chair-interrogation", 1, "a heavy iron-and-oak restraint chair",
    "An interrogation chair: a heavy, square chair of thick dark oak with iron edge bands, a tall straight back about 4.7 ft high, broad flat arms and four very thick square legs bolted to an"
    " iron FOOT PLATE with a raised foot rest. Thick burgundy-brown leather straps with big buckles lie across each arm and at each front leg, and a broad iron head band stands at the top of"
    " the back. EMPTY: nobody in it. No spikes." + CHUNKY + MOOD,
    "a heavy wooden and iron chair with a tall back and leather restraint straps on the arms and legs, empty",
    ["one chair with a tall back and arms", "straps or buckles on the arms"], ["a person or skeleton sitting in it", "a throne with cushions and gold", "spikes all over the seat"],
    size=(30, 30, 56), base=False, rooms=[INTER], note="the iron foot plate is its own")
add("table-torture-tools", "table-torture-tools", 1, "a scarred work table laid out with interrogator's tools",
    "A heavy, scarred work table about 5 ft long, 2.3 ft deep and 3 ft tall: a very thick dark plank top on four fat square legs with a low stretcher. Laid out on the top, all CHUNKY and fused to it:"
    " a big pair of iron pincers, two thick pokers, a square-headed hammer, a fat coil of rope, and an OPEN leather tool roll with five stubby tools in its pockets. Dark old stains on the wood."
    " Nothing hangs over the edge." + CHUNKY + MOOD,
    "a heavy wooden table with pincers, pokers, a hammer, a coil of rope and a roll of tools lying on it",
    ["a sturdy table with four legs", "iron tools lying on its top"], ["a person or body on the table", "a torture rack with rollers", "food or dishes", "fresh red blood"],
    size=(60, 28, 36), rooms=[INTER, GUARD])
add("whipping-post", "whipping-post", 2, "a scarred timber whipping post on a stone foot",
    "A whipping post: ONE very thick, square, scarred dark timber post about 14 in square and 6.7 ft tall with a chamfered top, set in a square stone foot block 16 in across and 8 in tall."
    " Two big iron rings on staples at head height, one on each side, and a pair of FAT iron manacles on two very short thick links hanging CLOSE against the front of the post (touching it)."
    " Old lash scars and dark stains on the wood." + CHUNKY + MOOD,
    "a thick upright wooden post on a stone block with iron rings and manacles on it", ["one thick upright post", "iron rings or manacles attached to it"],
    ["a person tied to it", "a cross-beam (it is not a gallows or a cross)", "long hanging chains"], size=(16, 16, 80), base=False, rooms=[INTER, CELL], note="the stone foot is its own")
add("gibbet-cage", "gibbet-cage-standing", 2, "a man-sized iron gibbet cage on a low stand",
    "A gibbet cage standing on the floor, about 2.8 ft across and 7 ft tall in all: a man-shaped cage of FAT FLAT iron straps (each strap as wide as a hand): four broad hoops and eight broad"
    " upright straps, rounded in at the shoulders to a domed top with one stubby, thick hook ring on it. The gaps between the straps are no wider than the straps themselves."
    " It stands on a low, heavy iron stand (a thick round plate on three stubby feet). On the cage floor inside lies one skull. " + IRON.capitalize() + ", rusty." + CHUNKY + MOOD,
    "a tall, narrow man-shaped cage of broad iron straps with a domed top, standing on a low iron base, a skull inside",
    ["one tall narrow cage of iron bands", "a rounded top with a ring", "you can see between the bands"], ["a whole skeleton or a person inside", "a long chain above it", "a square animal cage", "thin wire bars"],
    size=(34, 34, 84), base=False, kit="cage", rooms=[INTER, CELL, CORR, GUARD],
    note="NEW role gibbet-cage-standing (cage-hanging is left as it is: the one on a chain). RISK: a cage; asked for broad flat straps")
add("bed-cell-stone", "bed-cell-stone", 3, "a stone slab prison bunk with a thin straw mattress",
    "A prison cell bunk: one thick slab of grey stone 6 ft long and 2.5 ft wide lying on two solid stone block supports, 14 in off the floor, and on it a THIN lumpy mattress of ochre sackcloth"
    " leaking a little straw, with a ragged grey-brown blanket crumpled at the foot. No pillow." + STONE + MOOD,
    "a low stone slab bed with a thin straw mattress and a ragged blanket", ["a long low stone slab on supports", "a thin mattress or bedding on it"],
    ["a wooden bed frame", "a person or skeleton on it", "a pillow and clean sheets"], size=(30, 72, 18), rooms=[CELL])

# ================================================================ treasure vault
add("chest-treasure-open", "chest-treasure-open", 1, "the same treasure chest thrown wide open and overflowing",
    "The lid is thrown RIGHT back, standing upright past vertical on its hinges, and the chest is heaped far ABOVE its rim with one solid, rounded mound of gold coins that spills forward over the"
    " front edge and down the front of the chest (still fused to it, none lying loose on the floor). Half-sunk in the top of the mound: one gold CROWN with burgundy gems and two fat gold goblets."
    " The coins are big chunky discs painted on the surface of one solid mass. Warm, rich gold, not pale.",
    "an open treasure chest with its lid thrown back, overflowing with gold coins, a crown and goblets",
    ["a chest with its lid open", "a heap of gold coins rising above the rim", "a crown or goblets in the heap"], ["a closed lid", "coins scattered on the ground away from the chest", "blue gems"],
    size=(40, 30, 40), ref=CHEST, what="a treasure chest of dark honey wood with dull-gold bands, full of gold coins", mode="open", twin_of="chest-treasure",
    bench=["twin"], rooms=[VAULT, DEN], note="EDIT of the crypt's accepted chest-treasure plate (that chest is already open and full: this is the fuller, lid-right-back state)")
add("dun-treasure-hoard", "dun-treasure-hoard", 1, "a great mound of treasure",
    "A treasure hoard as ONE solid mound about 8 ft across and 3 ft tall: a broad, rounded hill of gold coins (big chunky discs painted on the surface of one solid mass), and half-buried in it"
    " two treasure chests (one open and full, one closed and tilted), two fat gold urns, a round shield lying on the slope, three broad-bladed swords stuck in upright to half their length,"
    " and big cut gems in burgundy and green. WARM, rich, deep gold with orange-brown shadows, NOT pale and NOT lemon yellow. The mound slopes down to the floor all round; no loose coins away from it.",
    "a big mound of gold coins with chests, urns, a shield, swords and gems half-buried in it",
    ["one large heap of gold coins, wider than tall", "chests or urns half-buried in the heap"], ["a dragon or any creature", "blue gems", "a pale or white heap", "coins scattered far from the heap"],
    size=(96, 96, 36), base=False, rooms=[VAULT, DEN], note="role and sku renamed from treasure-hoard: that id is a render SET in catalog/sets.md")
add("gold-bars", "gold-bars", 1, "a pyramid stack of gold ingots",
    "A neat PYRAMID stack of big gold ingots about 2.5 ft long, 20 in deep and 14 in tall: four layers (four, three, two and one ingot wide, each layer two ingots deep), every ingot a fat"
    " trapezoid bar with a simple stamped round mark on its top (no letters). Warm deep gold with orange-brown shadows and soft highlights on the edges.",
    "a stepped pyramid stack of fat gold bars", ["several gold bars stacked in layers", "the stack narrows toward the top"], ["coins", "a chest", "letters or numbers on the bars", "silver bars"],
    size=(30, 20, 14), base=False, rooms=[VAULT])
add("coin-pile--s2", "coin-pile", 2, "a spilled heap of gold coins with three coin sacks",
    "A spilled heap of gold coins about 2.5 ft across and a foot tall, one solid rounded mound (the coins big chunky discs painted on its surface), with THREE bulging coin sacks of ochre"
    " sackcloth tied with thick cord: two standing in the heap and one fallen over with coins pouring from its mouth into the mound. Warm deep gold, not pale.",
    "a low heap of gold coins with three bulging cloth sacks in it", ["a heap of gold coins", "bulging tied sacks"], ["a chest", "blue cloth", "coins scattered far from the heap"],
    size=(30, 30, 12), base=False, rooms=[VAULT, DEN, GUARD], note="p2, not painted from a parent: the library's coin-pile plate is from another batch")
add("mimic-chest", "mimic-chest", 2, "a mimic: a treasure chest with teeth and a tongue",
    "A mimic caught half-open: an iron-bound wooden chest about 3 ft wide whose domed lid is raised a hand's breadth at the front, and in the gap, along the rim of BOTH lid and box, rows of big"
    " cream TEETH like fat pegs; a fat PURPLE tongue lolls out over the front edge and down the front of the chest (lying against it). Inside the mouth dark burgundy. A few gold coins lie"
    " on the tongue as bait. The wood is warm brown, the bands dark iron; one small yellow eye peers from the lock plate.",
    "a wooden chest with big teeth along its half-open lid and a purple tongue hanging out",
    ["a chest shape with a lid", "rows of teeth in the opening", "a tongue coming out"], ["legs or arms", "an ordinary chest with no teeth", "blue colour"],
    size=(38, 26, 34), rooms=[VAULT, DEN, CORR], note="own size, bigger than the catalog's")
add("silver-plate-pile", "silver-plate-pile", 2, "a pile of looted silver plate",
    "A pile of silver table plate about 2.3 ft across and 16 in tall, fused into one solid heap: a stack of five big round platters leaning on a fat round-bellied ewer, two stubby thick"
    " candlesticks lying on their sides, a covered dish and a few cups. Soft grey SILVER with warm grey shadows and creamy highlights, a little tarnish in the hollows (NOT blue, NOT chrome).",
    "a heap of silver platters, a jug and candlesticks piled together", ["several round plates or platters", "silver-grey metal vessels in one pile"], ["gold coins", "food", "a table", "blue tint"],
    size=(28, 24, 16), base=False, rooms=[VAULT, DEN])
add("armor-chainmail-heap", "armor-chainmail-heap", 3, "a slumped chainmail shirt with a helm on top",
    "A chainmail shirt dropped in a slumped heap about 2 ft across and 6 in tall: one soft, rounded mound of mail, painted as a surface of small overlapping grey rings on a SOLID mass"
    " (no see-through mesh), with a short sleeve flopped to one side, and a plain round iron helm with a nose guard sitting on top. Dull steel grey with warm rust in the folds.",
    "a low slumped heap of grey chainmail with a round helmet on top", ["a low soft heap of mail", "a helmet on it"], ["a person or mannequin wearing it", "an armour stand", "plate armour"],
    size=(26, 22, 9), base=False, rooms=[VAULT, GUARD, DEN])
add("strongbox-stack", "strongbox-stack", 1, "three iron strongboxes stacked",
    "THREE iron strongboxes stacked on top of each other, a little askew, about 3.3 ft wide and 3.7 ft tall in all: the biggest at the bottom, the smallest on top. Each is a squat riveted box"
    " of dark iron plates with broad straps, big round rivet heads, a FAT padlock on the front hasp and one thick carry ring on each end lying flat against the side."
    " " + IRON.capitalize() + ", with a dull brass padlock on the top one." + CHUNKY + MOOD,
    "three riveted iron boxes with padlocks stacked on top of each other", ["three box shapes stacked", "padlocks or hasps on the fronts", "iron with rivets"],
    ["open lids", "coins or treasure visible", "wooden crates"], size=(40, 30, 44), rooms=[VAULT, GUARD])
add("vault-shelf-treasure", "vault-shelf-treasure", 2, "a heavy iron-framed vault shelf loaded with treasure",
    "A vault shelf unit that stands with its back to a wall: 4.7 ft wide, 18 in deep and 6.5 ft tall, a heavy frame of thick dark iron posts with FOUR thick oak shelves and a solid plank back."
    " The shelves are loaded, everything fused in place: small iron-bound coffers, three fat gold urns, a stack of gold ingots, a row of rolled charters with burgundy wax seals, and a pile of"
    " coin bags on the bottom shelf. Warm gold against dark iron and oak." + MOOD,
    "a tall shelf unit with a heavy iron frame, its shelves full of small chests, gold urns, ingots and scrolls",
    ["a tall shelf unit, taller than wide", "several shelves holding boxes and gold objects"], ["books filling the shelves (it is not a bookcase)", "glass doors", "blue colour"],
    size=(56, 18, 78), rooms=[VAULT])

# ================================================================ monster den
add("nest-monster", "nest-monster", 1, "a huge monster's nest with three eggs",
    "A huge round NEST about 8 ft across and 2.5 ft tall, one solid ring-shaped mound with a hollowed middle: built of thick broken branches, torn grey-ochre bedding and rags, big cream bones,"
    " and pieces of shredded armour (a dented breastplate, a split shield) woven into the rim. In the hollow, on a bed of rags and down, lie THREE large mottled eggs, each as big as a barrel"
    " head, cream speckled with moss green and rust. Everything is chunky and packed solid; no thin twigs sticking out.",
    "a very large round nest of branches, rags and bones with three big speckled eggs in the middle",
    ["one big ring-shaped nest, much wider than tall", "large eggs in its hollow"], ["a creature or bird sitting in it", "a tree", "thin twigs sticking far out"],
    size=(100, 100, 30), base=False, rooms=[DEN])
add("web-cocoon", "web-cocoon", 1, "a man-sized victim wrapped in thick web, standing",
    "A man-sized cocoon, 5.5 ft tall: the clear shape of a person (head, shoulders, tapering to the feet) wrapped tight in thick, pale grey-cream web like a mummy bundle, standing upright and"
    " leaning a little, its foot buried in a fat clump of web on the floor about 2 ft across. THREE very FAT web cables (each as thick as an arm) run from its shoulders straight down to the clump,"
    " lying against the body. The wrapping has broad overlapping bands with soft shadows between; one dark boot toe shows at the bottom. One solid mass, no fine strands.",
    "a tall, person-shaped bundle wrapped in thick pale web, standing on a clump of web",
    ["one upright bundle shaped like a wrapped body", "pale web wrapping in thick bands"], ["a spider", "a visible face or a living person", "fine thin web threads", "an Egyptian mummy case"],
    size=(26, 26, 66), base=False, rooms=[DEN, CORR, SEWER], note="the web clump is its own foot")
add("web-cocoon--s2", "web-cocoon", 2, "the same web-wrapped victim lying on the floor",
    "The same kind of cocoon LYING flat on the floor, about 5 ft long and 2 ft tall: a person-shaped bundle on its back in the same thick pale web bands, one side stuck down by a fat clump of web,"
    " with ONE dark leather boot sticking out of the wrapping at the foot end.",
    "a person-shaped bundle wrapped in thick pale web lying on the floor, a boot sticking out",
    ["one long bundle lying down, longer than tall", "pale web wrapping", "a boot or foot showing at one end"], ["a spider", "a visible face", "fine thin web threads"],
    size=(60, 26, 24), base=False, parent="web-cocoon", what="a man-sized victim wrapped in thick pale web bands", rooms=[DEN, SEWER, CORR])
add("eggs-monster", "eggs-monster", 2, "a clutch of leathery monster eggs",
    "A clutch of FIVE leathery monster eggs standing close together in a low crust of dried slime, about 2.5 ft across and 18 in tall: each egg a fat upright oval as big as a bucket,"
    " green-black with paler olive ridges and a wrinkled, leathery skin; ONE egg is cracked open at the top with a dark, wet, empty inside. The slime crust is a thick amber-green collar round their feet.",
    "a tight cluster of five dark green leathery eggs in a crust of slime, one cracked", ["several large upright eggs clustered together", "dark leathery shells"],
    ["a creature hatching or a visible baby monster", "bird eggs in a twig nest", "blue colour"], size=(30, 26, 18), base=False, rooms=[DEN, SEWER, FLOOD], note="the slime crust is its own")
add("adventurer-remains", "adventurer-remains", 1, "the remains of a dead adventurer lying on the floor",
    "The last adventurer, lying flat on the back as ONE low, solid mass about 6 ft long and 14 in tall: a skeleton in rusted armour (a dented breastplate, a round helm on the skull, heavy boots),"
    " arms close along the body, with a bulging leather pack under the shoulders, a ROUND shield lying over the hip and a broad sword lying flat along one side, touching the leg."
    " Rags of burgundy cloak under it tie everything together. Everything is fused low to the ground; no thin loose bones, nothing sticking up.",
    "a skeleton in rusty armour lying on its back with a pack, a round shield and a sword",
    ["a skeleton lying down, long and low", "armour on it", "a shield or a sword beside it"], ["a living person", "a standing or sitting figure", "a coffin"],
    size=(34, 70, 16), base=False, rooms=[DEN, CORR, TRAP, COLL, CHASM], note="painted lying down, long axis = depth")
add("adventurer-remains--s2", "adventurer-remains", 2, "a dead adventurer sitting slumped against a pack",
    "The same kind of dead adventurer SITTING slumped: the armoured skeleton sits on the floor leaning back against its big bulging pack, legs stretched out in front, helm askew on the skull,"
    " chin on the breastplate, one gloved hand resting on a squat iron lantern (dark, unlit) beside the hip. About 3 ft wide, 3.3 ft long and 2.5 ft tall, one solid mass.",
    "a skeleton in rusty armour sitting slumped against a pack, one hand on a lantern",
    ["a skeleton sitting slumped", "armour and a helmet on it", "a pack behind it"], ["a living person", "a lit, glowing lantern", "a wall behind it"],
    size=(36, 40, 30), base=False, parent="adventurer-remains", what="a skeleton in rusted armour with a pack, shield and sword", rooms=[DEN, CORR, CELL, COLL])
add("carcass-ribcage", "carcass-ribcage", 1, "the picked ribcage of a large beast",
    "The picked carcass of an ox-sized beast lying on the floor, about 7.5 ft long, 4 ft wide and 3.3 ft tall: a thick knobbly spine along the top, and curving down from it on each side SIX very"
    " FAT ribs (each as thick as an arm, like the timbers of a small upturned boat) reaching the floor, with a big horned skull at one end and a stub of tail bones at the other."
    " Scraps of dark red-brown hide hang between the upper ribs and fill the top of the cage, so the top is closed and only the lower gaps are open. Bone is warm cream with ochre shadows." + CHUNKY,
    "a large animal's ribcage and spine lying on the ground, with a horned skull at one end",
    ["a row of thick curved ribs arching from a spine", "an animal skull at one end"], ["a living animal", "meat on a hook", "thin needle-like ribs", "a human skeleton"],
    size=(50, 90, 40), base=False, rooms=[DEN], note="RISK: ribs; asked for six fat ribs a side with hide closing the top")
add("stalagmite", "stalagmite", 2, "a cluster of three fat stalagmites",
    "A cluster of THREE fat stalagmites rising from one shared mound of flowstone about 2.8 ft across: the tallest 4.5 ft, the others about 3 ft and 1.5 ft, each a thick cone with a blunt"
    " rounded tip and soft drip ridges. Banded in ochre, cream and grey with a wet sheen painted as soft pale highlights (no real gloss).",
    "three thick, blunt cone-shaped cave stalagmites on one mound", ["upright stone cones of different heights", "thick with blunt tips"], ["needle-thin spikes", "crystals", "icicles hanging down", "blue ice"],
    size=(34, 34, 54), base=False, rooms=[DEN, CHASM, FLOOD, COLL, CORR], note="the flowstone mound is its own")
add("stalagmite--s2", "stalagmite", 2, "a low pair of stalagmites",
    "A LOW pair instead of three: two stubby stalagmites about 2.5 ft and 1.3 ft tall on a small shared flowstone mound about 2 ft across, the same banded ochre, cream and grey stone.",
    "two short, thick cone-shaped stalagmites on one small mound", ["two upright stone cones", "thick with blunt tips"], ["needle-thin spikes", "crystals", "blue ice"],
    size=(26, 26, 30), base=False, parent="stalagmite", what="a cluster of fat banded stalagmites on a flowstone mound", rooms=[DEN, CHASM, FLOOD, COLL, CORR])
add("mushroom-cave-giant", "mushroom-cave-giant", 3, "a cluster of fat giant cave mushrooms",
    "A cluster of FIVE fat giant cave mushrooms growing from one mound of dark earth and rock about 3 ft across: the tallest 4 ft, with very thick pale cream stems (as thick as a leg) and"
    " broad domed caps in dusty VIOLET with big cream spots, pale gills under the caps; two small ones at the foot. No glow.",
    "a cluster of large mushrooms with thick pale stems and spotted violet caps", ["several mushrooms of different sizes together", "thick stems and domed caps"],
    ["glowing mushrooms", "red toadstools with white spots", "thin stems", "blue caps"], size=(36, 36, 48), base=False, rooms=[DEN, FLOOD, CHASM], note="the earth mound is its own")

# ================================================================ collapsed hall / chasm / sewer / flooded / shrine
add("collapse-rubble", "collapse-rubble", 1, "a ceiling collapse of broken rock",
    "A ceiling collapse as ONE solid mass about 9 ft wide, 6 ft deep and 6.5 ft tall: a steep slope of big broken rock slabs and boulders (pieces 1 to 3 ft across) packed with smaller rubble,"
    " TALLEST at the back and spilling down toward the front, with ONE snapped timber beam as thick as a thigh sticking out of the slope at an angle. Dark grey-brown rock with paler fresh"
    " breaks, dust on the upper faces." + MOOD,
    "a tall steep heap of big broken rocks and slabs with a broken beam sticking out", ["one large heap of rocks, highest at the back", "big angular blocks"],
    ["a wall or doorway standing in it", "a cave mouth", "small gravel only"], size=(110, 70, 80), base=False, rooms=[COLL, CORR, CHASM])
add("collapse-rubble--s2", "collapse-rubble", 2, "a smaller cone of fallen blocks",
    "A SMALLER fall: a cone-shaped heap about 5 ft across and 5 ft tall of the same broken rock, a few big blocks at the bottom and smaller ones on top, coming to a rough point. No beam.",
    "a cone-shaped heap of broken rocks", ["one heap of rocks about as tall as wide", "angular blocks"], ["a wall or doorway", "a timber beam", "small gravel only"],
    size=(60, 60, 60), base=False, parent="collapse-rubble", what="a ceiling collapse of big broken grey-brown rock slabs", rooms=[COLL, CORR, CHASM, DEN])
add("rubble-pile", "rubble-pile", 1, "a low pile of broken masonry",
    "A LOW pile of broken masonry about 4.7 ft wide, 4 ft deep and 2 ft tall: a dozen squared building blocks (some whole, some split, a piece of a carved moulding among them) tumbled together"
    " in one solid heap with stone chips and pale dust packed between and round them. Blue-grey and warm grey stone with a little ochre mortar clinging to some faces." + MOOD,
    "a low heap of broken squared stone blocks and dust", ["a low heap of squared stone blocks, wider than tall"], ["a standing wall", "round boulders only", "timber beams", "bones"],
    size=(56, 50, 24), base=False, rooms=[COLL, CORR, CELL, SEWER, VAULT])
add("rubble-pile--s2", "rubble-pile", 2, "a few fallen blocks and chips",
    "A much SMALLER scatter fused into one low piece about 3 ft wide and a foot tall: just FOUR of the same squared blocks, two leaning on each other, in a low bed of chips and dust.",
    "a few squared stone blocks in a low bed of chips", ["a few stone blocks together, low"], ["a standing wall", "a tall heap", "bones"],
    size=(36, 30, 14), base=False, parent="rubble-pile", what="a low pile of broken grey masonry blocks and dust", rooms=[COLL, CORR, CELL, SEWER, PUZ])
add("pillar-broken", "pillar-broken", 1, "the stump of a broken stone column",
    "The stump of a round stone column, snapped off at chest height: a square moulded base block 2.8 ft across and 10 in tall, a ring moulding, and above it a round fluted shaft 2 ft across"
    " that ends at about 5 ft in a JAGGED broken top, higher on one side than the other, the break pale and fresh. Two cracks run down from the break." + STONE + MOOD,
    "a short broken stump of a round stone column on a square base, with a jagged top", ["a round column shaft on a square base", "a jagged broken top (not a flat capital)"],
    ["a complete column with a capital", "a statue", "fallen pieces lying around it"], size=(34, 34, 60), base=False, rooms=[COLL, FLOOD, SHRINE, PUZ], note="the square base is its own")
add("column-drums-fallen", "column-drums-fallen", 1, "three fallen column drums with a broken capital",
    "A toppled column lying in a line about 8 ft long: THREE big fluted stone column drums (each 2.7 ft across and about 2 ft long) lying on their sides one after another, slightly out of line"
    " and touching, with a broken square capital lying at the far end and a bed of stone chips under them joining it all into one piece. The same pale grey fluted stone, chipped edges." + MOOD,
    "three big fluted stone column drums lying on their sides in a row, with a broken capital at one end",
    ["several short round column sections lying on their sides in a line", "fluted (grooved) stone"], ["a standing column", "wooden barrels or logs", "a statue"],
    size=(36, 100, 34), base=False, rooms=[COLL, FLOOD, SHRINE], note="painted lying, long axis = depth")
add("shoring-timber", "shoring-timber", 2, "a mine-style timber prop frame",
    "A shoring frame like a mine prop set, 5 ft wide and 8.3 ft tall: TWO very thick, roughly squared timber posts (each a foot thick) leaning in very slightly, carrying a heavy lintel beam"
    " that overhangs a little at both ends, with fat wooden wedges driven in at the joints and two short diagonal braces in the top corners. A stubby iron lantern hook under the middle of the lintel."
    " It holds nothing; you can walk through it. Dark weathered timber with paler adze cuts." + CHUNKY + MOOD,
    "a heavy timber frame of two thick posts and a beam across the top, open in the middle", ["two upright timber posts", "a horizontal beam across their tops", "an open passage between the posts"],
    ["a door or gate in it", "rock or wall around it", "a gallows with a rope", "a lit lantern"], size=(60, 20, 100), base=False, kit="frame", opening="door", rooms=[COLL, CORR, CHASM])
add("ceiling-slab-fallen", "ceiling-slab-fallen", 2, "a great fallen slab of ceiling stone cracked in two",
    "ONE great flat slab of ceiling stone, about 6 ft by 7.5 ft and 10 in thick, lying where it fell, tilted a little, CRACKED in two across the middle with the halves a hand's breadth apart"
    " and one half an inch or two lower, resting on a low bed of smaller rubble that shows round its edges. Its top face still carries a shallow carved panel border. Dark grey-brown stone, pale at the break." + MOOD,
    "a big flat stone slab broken in two, lying tilted on a bed of rubble", ["one large flat slab, much wider than tall", "a crack splitting it in two"],
    ["a standing wall", "a tomb lid with a carved figure", "a tall heap of boulders"], size=(70, 90, 26), base=False, rooms=[COLL, CORR])
add("bridge-stone-slab", "bridge-stone-natural", 1, "a narrow stone slab bridge",
    "A narrow stone bridge as ONE piece, 5 ft wide and 14 ft long: a slightly ARCHED span of big, rough, flat-topped slabs fitted end to end (about six slabs), 14 in thick, with a row of low"
    " kerb stones along both long edges and broken, bitten edges here and there. NOTHING under it: no piers, no supports, no water, no rock, no ground; just the span (it will bridge a painted chasm)."
    " Both short ends are cut flat. Dark grey-brown stone with paler worn treads down the middle. Seen from a three-quarter view so the whole length shows." + MOOD,
    "a long narrow bridge span of big rough stone slabs with low kerb stones, slightly arched, with nothing under it",
    ["one long narrow span, much longer than wide", "made of large stone slabs", "low kerbs along its long edges"],
    ["piers, arches or supports under it", "water, a river or a landscape", "handrails or ropes", "a wooden bridge"],
    size=(60, 170, 30), base=False, kit="bridge", rooms=[CHASM, SEWER, FLOOD], note="own size (lower than the catalog's natural arch); painted along its length, long axis = depth")
add("bridge-plank-rickety", "plank-bridge", 2, "a rickety plank walkway on two logs",
    "A rickety walkway as ONE piece, 3.3 ft wide and 14 ft long: two thick round logs lying side by side as rails, and lashed across them about fourteen very thick, short, uneven planks"
    " with fat rope bindings; ONE plank is missing near the middle (a gap you see the blue background through) and one is cracked. NOTHING under it and no handrails. Grey weathered wood with ochre rope." + CHUNKY + MOOD,
    "a long narrow walkway of thick planks tied across two logs, with one plank missing", ["one long narrow span, much longer than wide", "cross planks on two long logs"],
    ["rope handrails or posts", "water or a landscape under it", "a stone bridge"], size=(40, 170, 14), base=False, kit="bridge", rooms=[CHASM, SEWER, FLOOD, COLL],
    note="own size (the catalog's plank-bridge is a single plank); painted along its length, long axis = depth")
add("stepping-pillar", "stepping-pillars", 2, "the flat top of a rock pillar",
    "ONE stepping pillar: the top two feet of a rough natural rock column about 3.3 ft across, roughly round, with a worn, nearly FLAT top big enough to stand on and craggy sides that are cut"
    " off flat at the bottom (it stands in a painted chasm, so only its top shows). Dark grey-brown rock, paler and smoother on the top where feet have worn it." + MOOD,
    "a short, wide stump of rough rock with a flat top", ["one squat rock column, about as wide as tall or wider", "a flat top"], ["several pillars", "a carved pedestal with mouldings", "water"],
    size=(40, 40, 24), base=False, rooms=[CHASM, FLOOD], note="ONE pillar at its own size under the role stepping-pillars; the room program places several")
add("chasm-post-pair", "bridge-post-rope", 3, "a bridge-end post with a coil of rope",
    "A bridge-end post: ONE very thick round timber post 3.7 ft tall and 10 in across with a carved ball top, set in a small pile of wedged stones 20 in across, a FAT coil of heavy ochre rope"
    " hung over it and resting against it, and one stubby iron lantern hook near the top (no lantern)." + CHUNKY + MOOD,
    "a short thick wooden post with a coil of heavy rope on it", ["one upright thick post", "a coil of rope on it"], ["two posts", "a lantern", "a stretched rope leading away", "a bridge"],
    size=(20, 20, 44), base=False, rooms=[CHASM], note="sku says pair, the mesh is ONE post (the room places two); the wedged stones are its own foot")
add("sewer-grate", "sewer-grate", 1, "a barred sewer outflow arch that stands against a wall",
    "A sewer outflow as ONE flat-backed piece to stand against a wall, about 3.7 ft wide, 3.7 ft tall and 10 in thick: a round arch of big dressed wedge stones on a flat stone sill, its"
    " opening (2.5 ft across) painted very dark, and barred by FOUR very FAT vertical iron bars (each as thick as a wrist) set into the arch and the sill. Green slime streaks down from the sill"
    " and a crust of it lies on the sill's lip. Grey stone, rusty iron. It is ONE thin flat slab like a thick picture frame: a single arch in a single plane, its back a plain flat cut,"
    " NO side arms, NO second arch, NO tunnel or vault running back behind it. Seen almost SQUARE-ON from the front, only slightly from above and to one side, so that its thin edge"
    " (10 in) is plainly visible and plainly thin." + CHUNKY + STONE + MOOD,
    "a round stone arch opening closed by four thick vertical iron bars, with green slime below", ["a round or arched stone opening", "thick vertical bars across it", "a dark interior"],
    ["a whole wall of blocks around it", "a floor drain lying flat", "thin wire bars", "water pouring out"],
    size=(44, 10, 44), base=False, rooms=[SEWER, CELL, FLOOD], note="catalog: wall, mount 0. RISK: bars; the opening behind them is painted dark so a fused sheet still reads")
add("sewer-pipe-mouth", "sewer-outflow", 1, "a big brick-and-stone sewer pipe mouth",
    "The mouth of a big sewer pipe sticking out of a wall, as ONE flat-backed piece 5 ft wide, 2.5 ft deep and 4.7 ft tall: a thick round barrel of dark red-brown brick, ringed at its mouth by big"
    " grey dressed stones, lying horizontally with its back cut flat. Its inside is painted BLACK-GREEN and dark (a deep hollow you can see into), and its lower lip is stained with green slime"
    " that hangs in a fat drip. No bars, no water pouring." + MOOD,
    "the round open end of a large brick sewer pipe ringed with stone, dark inside, slime on its lip", ["a large round pipe or tunnel mouth", "a dark hollow interior", "brick or stone rings"],
    ["iron bars across it", "water pouring out", "a whole wall around it", "a wooden barrel"], size=(60, 30, 56), base=False, rooms=[SEWER, FLOOD],
    note="own size under the role sewer-outflow (the catalog's is a 9 ft tunnel mouth); stands against a wall")
add("sewer-debris-clog", "sewer-debris-clog", 2, "a wet clog of sewer debris",
    "A clog of sewer debris as ONE solid low heap about 4.7 ft wide, 4 ft deep and 2 ft tall: thick broken branches, a smashed half barrel, cream bones and a skull, sodden grey-ochre rags and"
    " a matted mass of leaves and muck packing it all together, wet with green slime. Chunky pieces only; nothing thin sticking out.",
    "a low, wet heap of branches, bones, rags and a broken barrel", ["one low tangled heap, wider than tall", "branches or bones in it"], ["clean stacked firewood", "a creature", "running water"],
    size=(56, 50, 24), base=False, rooms=[SEWER, FLOOD, DEN])
add("sluice-wheel", "sewer-sluice-gate", 2, "a sluice gate in a stone frame with a big hand wheel",
    "A sluice gate as ONE free-standing piece, 4 ft wide, 20 in deep and 5 ft tall: two thick stone posts and a stone sill form a frame; between them a heavy gate of thick dark planks bound"
    " with iron sits CLOSED in its grooves; across the top a heavy iron beam carries a fat screw spindle with a big iron HAND WHEEL (2 ft across, four fat spokes) lying flat on top."
    " Green slime on the lower planks." + CHUNKY + STONE + MOOD,
    "a closed plank sluice gate between two stone posts with a big iron wheel on top", ["a gate panel between two posts", "a spoked wheel on top"],
    ["a ship's wheel on a stand", "water pouring through", "a castle portcullis with spikes"], size=(50, 20, 60), base=False, rooms=[SEWER, FLOOD],
    note="catalog line changed to floor, fp 1 (was a kit edge); the posts and sill are its own")
add("crate-floating", "flotsam-crate", 2, "a half-sunk crate and barrel in a ring of scum",
    "Flotsam as ONE low piece that sits on a water surface, cut off dead FLAT at the waterline underneath: a wooden crate tilted and half sunk (only its upper half shows) and beside it, touching,"
    " a barrel lying on its side, also half sunk, the two joined by a flat ring of pale green-grey scum and a few floating leaves about 3.3 ft across. Wet dark wood with iron hoops." + MOOD,
    "the top halves of a tilted crate and a barrel on its side, joined by a flat patch of scum", ["a crate and a barrel together", "low, as if half sunk"],
    ["visible water or waves around it", "a whole crate standing upright on the ground", "a boat"], size=(40, 36, 14), base=False, rooms=[FLOOD, SEWER],
    note="cut flat at the waterline: the room sits it on the water plane; the scum ring is its own")
add("pillar-flooded", "pillar-waterline", 2, "a square stone pillar with a slimy tide band",
    "A square pillar of dressed grey stone blocks, 2 ft square and 8.3 ft tall, with a plain square plinth (2.5 ft) and a plain square cap. Its bottom THIRD is stained by standing water:"
    " a dark, slimy green-black band with a sharp level tide line at the top, a paler mineral crust just above the line and a few pale drips below. Dry, lighter stone above." + STONE + MOOD,
    "a tall square stone pillar whose lower third is dark and slimy up to a level tide line", ["one tall square pillar of stone blocks", "a darker stained band over the lower part"],
    ["a round column", "water around it", "a statue or torch on it"], size=(30, 30, 100), base=False, rooms=[FLOOD, SEWER], note="the plinth is its own")
add("shrine-wayside", "shrine-wayside", 1, "a small carved stone wayside shrine",
    "A small shrine that stands with its flat back against a wall, 3.7 ft wide, 2 ft deep and 7 ft tall: a two-step stone base; above it an upright stone body with an ARCHED niche, and in the niche"
    " a small seated, HOODED idol figure carved in the same stone (one solid lump, face hidden in the hood); a pointed gable top. In front of the niche a stone offering shelf carrying a shallow"
    " bowl and two fat, UNLIT candle stubs with dark wicks. Moss in the joints, old wax runs on the shelf." + STONE + MOOD,
    "a small upright stone shrine with an arched niche holding a seated hooded figure, and an offering shelf with a bowl and candle stubs",
    ["one upright stone structure, taller than wide", "an arched niche with a small figure in it", "a shelf or step in front"],
    ["a cross or any real-world religious symbol", "a large free-standing statue", "a whole chapel"], size=(44, 24, 84), base=False, light="candle", bench=["fire"],
    rooms=[SHRINE, CORR, CHASM, COLL], note="GENERIC religious id; the stepped base is its own")
add("statue-forgotten-god", "statue-forgotten-god", 2, "a seated, worn stone statue of a forgotten god",
    "A big seated deity of worn grey stone, 8 ft tall on its block: a broad, calm figure sitting cross-legged on a square block throne 3.7 ft across, robed, with a tall plain headdress and a"
    " face worn nearly smooth. One hand rests on the knee; the other arm ends in a BROKEN-OFF stump at the wrist. In its lap sits a wide stone offering bowl. Moss on the shoulders and in the folds,"
    " lichen spots, a crack across the chest. One solid mass; arms close to the body." + ROCKY + MOOD,
    "a large seated stone statue of a robed figure with a worn face and a missing hand, a bowl in its lap",
    ["one large seated stone figure", "a bowl in its lap", "weathered, mossy stone"], ["a recognisable real-world religious figure or symbol", "a living person", "glowing eyes", "raised arms"],
    size=(44, 44, 96), base=False, rooms=[SHRINE, FLOOD, COLL], note="GENERIC religious id; the block throne is its own")
add("offering-bowl", "offering-bowl", 2, "a wide bronze offering bowl of coins and dried flowers",
    "A wide, shallow offering bowl of verdigris-touched BRONZE, 16 in across and 7 in tall on a low foot ring, with a thick rolled rim. It holds a low mound of mixed coins (gold, silver, copper),"
    " ONE fat gold ring with a burgundy stone lying on top, and a few dried ochre and dusty-pink flower heads. Everything inside is one solid mass.",
    "a wide shallow bronze bowl holding coins, a ring and dried flowers", ["one wide shallow bowl", "coins in it"], ["a tall cup or chalice", "a flame", "blue flowers or gems"],
    size=(16, 16, 8), base=False, rooms=[SHRINE, FLOOD, CORR], note="the library has the role (surface, tiny, 10 in): this is a bigger floor-standing sku at its own size")
add("fountain-skull", "fountain-wall-skull", 3, "a wall fountain with a carved stone skull spout",
    "A wall fountain as ONE flat-backed piece, 3 ft wide, 2 ft deep and 4.2 ft tall: an upright stone back slab with a big carved stone SKULL in the middle, its open jaws the spout (a dark round"
    " hole), over a half-round stone basin with a thick moulded rim standing on a short fat pedestal foot. The basin is EMPTY and painted dark inside, with a pale lime crust and green stain where"
    " water used to run. NO water." + STONE + MOOD,
    "a wall fountain: a carved stone skull above a half-round stone basin, dry", ["a skull carved on an upright back slab", "a half-round basin below it"],
    ["water in the basin or flowing", "a real bone skull", "a free-standing round fountain", "blue colour"], size=(36, 24, 50), base=False, bench=["water"], rooms=[SHRINE, SEWER, CORR],
    note="catalog: wall, mount 0; the engine adds water")

# ---------------------------------------------------------------- checks + write
ids = [a["id"] for a in assets]
assert len(ids) == len(set(ids)), [i for i, n in Counter(ids).items() if n > 1]
assert len(assets) == 75, len(assets)
byid = {a["id"]: a for a in assets}
for a in assets:
    assert a["object"] in roles and roles[a["object"]]["size"], a["object"]
    assert a["group"] in ("p1", "p2", "p3", "sib1", "sib2", "sib3") and a["group"][-1] == str(a["prio"]), a["id"]
    assert all(Path(r).exists() or r.startswith(str(HERE / "inputs")) for r in a["refs"]), (a["id"], a["refs"])
    if a["group"].startswith("sib") and a["refs"][0] != CHEST:
        par = Path(a["refs"][0]).stem
        assert par in byid and byid[par]["group"].startswith("p") and byid[par]["prio"] <= a["prio"], (a["id"], par)
    if a.get("twin_of"):
        assert roles[a["object"]]["open_of"] == a["twin_of"], a["id"]
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets: (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(assets), "assets", dict(sorted(Counter(a["group"] for a in assets).items())), "prio", dict(sorted(Counter(a["prio"] for a in assets).items())))
print("bench", dict(Counter(b for a in assets for b in a["bench"])), "hung", sum(1 for a in assets if a.get("hung")), "lights", dict(Counter(a["light"] for a in assets if a.get("light"))),
      "tier dun", sum(1 for a in assets if a.get("tier")), "new roles", len({a["object"] for a in assets if not a.get("tier")}))
