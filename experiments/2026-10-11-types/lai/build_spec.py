#!/usr/bin/env python3
"""Monster lair (batch lai-01, 2026-10-12): the lair's SIGNATURE meshes, in the dungeon batch's format
(../dun/build_spec.py, itself the castle batch's). Writes assets.json for tools/gen.py and prompts/<id>.spec.md.
Groups: p1/p2/p3 = independent pieces by priority; sib1/sib2 = painted FROM an accepted plate: a parent in a p group of this
file, or (walls, vein slabs, the cracked timber set) the DUNGEON batch's accepted plate of the same rock / the same frame,
so the mine's walls match the dungeon's cut-rock family. Run order: p1, sib1, p2, sib2, p3.
Provenance: text prompts and our own style reference only; the only other pictures supplied are our own accepted plates.
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
DUNIN = MAIN.parent / "3d-vtt-type-dun/experiments/2026-10-11-types/dun/inputs"   # the dungeon batch's accepted plates (until it lands on main they live in its worktree)
if not DUNIN.exists(): DUNIN = MAIN / "experiments/2026-10-11-types/dun/inputs"
roles = {}
for p in sorted((ROOT / "catalog").glob("*.catalog.md")):
    roles.update(ct.parse_catalog(p)[0])
NEW_ROLES = {r for r, v in roles.items() if v["file"] == "objects-lair.catalog.md"}
for p in sorted((MAIN.parent / "3d-vtt-type-dun/catalog").glob("objects-dungeon*.catalog.md")):   # the dungeon batch's roles (shoring-timber): in its worktree until it lands
    for k, v in ct.parse_catalog(p)[0].items(): roles.setdefault(k, v)

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
MOOD = " Lair mood: menace and aftermath, not gore (no blood, no viscera); matte surfaces and a strong, simple silhouette that reads from far above."
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
    if obj not in NEW_ROLES: a["tier"] = "lai"          # a sku under a role the library already has: exclusive to the mine rooms
    if wall: a["generation"], a["family"], a["kit"] = "kit", "cut-rock", "wall"
    if kit: a["kit"] = kit
    if opening: a["opening"] = opening
    if hung: a["hung"] = True
    if light: a["light"] = light
    if twin_of: a["twin_of"] = twin_of
    if note: a["note"] = note
    assets.append(a)



MOUTH, PASS, WARREN, BEAST, SPIDER, LARDER, PIT, HATCH, TROPHY, DRAGON = ("lair-mouth", "lair-passage", "lair-warren", "lair-beast", "lair-spider", "lair-larder", "lair-pit", "lair-hatchery", "lair-trophy", "lair-dragon")
SOLID = " Paint it smooth, as ONE flat solid surface with broad shapes: no loose strands, no thin sticks, no separate small pieces standing free."
TOP = " It will be seen SMALL and FROM ABOVE on a game table, so its TOP must tell what it is at a glance."
GOLD = "warm yellow GOLD coin painted as one solid rippled surface (not separate thin coins), with a few big readable things half buried in it"
BONE = "old ivory-yellow bone with brown staining in the hollows, every bone as thick as a forearm"
ROCK = "natural water-worn grey-brown rock with broad rounded planes, a little ochre and moss green, darker in the cracks"

# ================================================================ the dragon
add("treasure-hoard-heap", "treasure-hoard-heap", 1, "a dragon's hoard: a great mound of gold with a hollow in its top where something huge sleeps",
    "ONE great, broad, low MOUND of treasure, wider than it is tall, like a small hill: " + GOLD + " (the corner of an iron-bound chest, the rim of a round shield, two gold goblets, a crown,"
    " a few gold bars, a sword hilt, three fat red and green gems). In the TOP of the mound is a wide, smooth, shallow oval HOLLOW, like a nest or a dish pressed into the gold by a huge sleeping"
    " body: clearly visible from above, with a raised rim of gold all round it. The sides slump down to the floor in soft folds." + SOLID + TOP + MOOD,
    "a broad low mound of gold treasure with a wide shallow oval hollow pressed into its top",
    ["a single broad mound of gold coin, wider than tall", "a wide shallow hollow or dish in the top of the mound", "a few large treasure objects half buried (chest, shield, goblets, crown)"],
    ["a dragon, creature or person", "a chest standing apart from the mound", "blue gems or blue cloth", "thin coins standing on edge or scattered loose around it"], rooms=[DRAGON])
add("treasure-hoard-heap--s2", "treasure-hoard-heap", 1, "a smaller slumped heap of the same dragon's hoard",
    "A SMALLER heap of the same hoard, about two thirds the size: a rounded slumped mound of the same gold with NO hollow in its top, a spill of coin run out down one side, a dented helmet,"
    " three gold bars and a silver plate half buried in it." + SOLID + TOP + MOOD,
    "a rounded heap of gold coin with a helmet, gold bars and a plate half buried in it",
    ["a single rounded heap of gold coin", "a few large treasure objects half buried"], ["a dragon, creature or person", "blue gems or blue cloth", "a chest standing apart"],
    size=[96, 84, 34], parent="treasure-hoard-heap", what="the great mound of a dragon's hoard", rooms=[DRAGON])
add("dragon-skull", "dragon-skull", 1, "the huge skull of a long-dead dragon, lying on the ground",
    "The skull of a great horned reptile, as long as a cart, lying on the ground: a long heavy snout with a row of FAT blunt teeth, two deep dark eye sockets, a broad crest, and two THICK"
    " curved horns sweeping back (each as thick as a man's leg). The lower jaw lies under it, joined. " + BONE.capitalize() + ", a little moss on the crown. A plain generic dragon: not"
    " any particular published design." + CHUNKY + TOP + MOOD,
    "a huge horned reptile skull lying on the ground, long snout with fat teeth, deep eye sockets, two thick horns sweeping back",
    ["one very large reptilian skull with a long snout", "two thick horns", "deep dark eye sockets"], ["a living creature, flesh or eyes", "a whole skeleton with ribs or legs", "thin spiky horns or needle teeth", "a human skull"],
    rooms=[TROPHY, DRAGON, MOUTH])
add("dragon-eggs", "dragon-eggs", 1, "a clutch of three large dragon eggs bedded in ash and straw",
    "THREE large eggs, each as big as a barrel, standing close together and leaning on one another in a low round bed of grey ash and charred straw with a rim. The eggs are mottled deep red and"
    " bronze with a scaly pattern painted on the shell, matte. One has a hairline crack." + SOLID + TOP + MOOD,
    "three large mottled red-bronze eggs standing together in a low round bed of ash and straw",
    ["exactly three large eggs", "a low round bed or nest under them"], ["a hatchling, creature or claw", "blue eggs", "more than four eggs", "thin twigs sticking out"], rooms=[HATCH, DRAGON])
add("gnawed-carcass", "gnawed-carcass", 1, "what is left of an ox after something huge has eaten: a picked rib cage and haunch",
    "The picked remains of an ox lying on its side: a barrel of SIX very thick curved rib bones still joined to a length of spine, a horned skull at one end, one whole haunch with brown hide"
    " still on it at the other, and a hide flap over part of the ribs. " + BONE.capitalize() + "; the hide is plain dull brown. Old and DRY: no blood, no red meat, no organs." + CHUNKY + TOP + MOOD,
    "the picked rib cage, spine, horned skull and one hide-covered haunch of an ox, lying on its side, dry and old",
    ["a rib cage of thick curved ribs", "a horned animal skull"], ["blood, red meat or organs", "a living animal", "thin needle-like ribs", "a human skeleton"], rooms=[BEAST, DRAGON, MOUTH])

# ================================================================ the spider
add("web-funnel", "web-funnel", 1, "a giant spider's funnel web filling the corner of a cave",
    "A THICK solid mass of pale grey-white spider web shaped to fill a room corner: two flat vertical back faces meeting at a right angle (where the two walls would be), and a bulging front"
    " that slopes down to the floor like a draped tent. In the middle of the front is ONE large round DARK tunnel mouth, big enough for a horse, with a thick rolled rim. Six fat ROPES of web,"
    " each as thick as an arm, run from the mass down to the floor and spread out. Two small wrapped bundles and a few bones are stuck in the web near the mouth. The web is opaque, like"
    " thick felt or wax, with a painted pattern of crossing strands." + SOLID + TOP + MOOD,
    "a thick solid tent-like mass of pale spider web with one large dark round tunnel mouth in its front and fat ropes of web running to the floor",
    ["a solid pale mass of web", "one large dark round tunnel opening", "thick ropes of web reaching the floor"],
    ["a spider or any creature", "thin see-through strands or a flat lacy cobweb", "a rock wall or cave behind it", "blue or purple colour"], rooms=[SPIDER])
add("egg-sacs-floor", "egg-sacs-floor", 1, "a cluster of giant spider egg sacs on the floor",
    "FIVE pale, round, leathery egg sacs the size of pumpkins, stuck together in a heap with thick bands of web, standing on a small pad of web. They are cream and pale grey-green with darker"
    " veins; ONE has split open and is empty and dark inside." + SOLID + TOP + MOOD,
    "a heap of five pale round leathery egg sacs bound together with thick web, one split open",
    ["several round pale sacs stuck together", "thick bands of web holding them"], ["spiders or any creature", "bird eggs with hard smooth shells in a twig nest", "thin strands", "blue colour"], rooms=[SPIDER, HATCH, PASS])

# ================================================================ the beast
add("nest-giant", "nest-giant", 1, "the bed of a great beast: a wide ring of branches, bones and torn bedding",
    "A wide round NEST on the ground, as wide as a wagon is long: a thick raised RING, like a fat doughnut, built of heavy broken branches, big bones and torn cloth packed together, with a"
    " broad shallow trampled HOLLOW in the middle lined with flattened dry grass, fur and a torn red cloak. A horned skull and a dented shield are packed into the ring." + SOLID + TOP + MOOD,
    "a wide round nest: a thick raised ring of branches, bones and rags round a shallow trampled hollow lined with dry grass and fur",
    ["a round raised ring", "a shallow hollow in the middle", "bones built into the ring"], ["an animal, bird or eggs", "thin twigs sticking out", "a neat bird's nest of fine twigs", "blue cloth"], rooms=[BEAST, HATCH])
add("hide-drying-rack", "hide-drying-rack", 1, "a beast hide laced into a pole frame to dry",
    "An upright frame of four THICK poles lashed at the corners, leaning back on two prop poles, with one whole brown-and-cream animal hide stretched inside it and laced to the poles all round"
    " with fat thongs. The hide is a flat solid sheet." + CHUNKY + MOOD,
    "an upright frame of thick lashed poles with an animal hide stretched and laced inside it",
    ["a frame of thick poles", "a hide stretched flat inside the frame"], ["a living animal", "thin sticks or string", "a painting or banner"], rooms=[WARREN, BEAST, LARDER])

# ================================================================ the goblins
add("bone-throne", "bone-throne", 1, "a goblin chieftain's throne of bones standing on a heap of stolen loot",
    "ONE piece: a low square MOUND of stolen goods (two crates, a barrel on its side, grain sacks, a round shield, a rolled carpet, a small chest) heaped into a platform two feet high, and on"
    " top of it a crude high-backed THRONE lashed together from huge bones and tusks, with a great horned beast skull over the back and a dark fur thrown over the seat. Two short torches of"
    " bone stand at the back corners, unlit. Seen from above it is a square heap of loot with a horned seat in the middle. " + BONE.capitalize() + "." + CHUNKY + TOP + MOOD,
    "a crude high-backed throne of big bones with a horned skull over its back, standing on a low heap of crates, sacks, a barrel and a shield",
    ["a high-backed seat made of large bones", "a horned skull on the back of the seat", "a low heap of crates, sacks or barrels under the seat"],
    ["a person, goblin or creature sitting on it", "a polished royal throne of gold or carved wood", "thin spindly bones", "flames or glow", "blue cloth"],
    size=[72, 66, 80], light=None, rooms=[WARREN])
add("bunk-crude", "bunk-crude", 1, "a goblin bunk knocked together from stolen planks",
    "A rough three-level bunk for small creatures: four THICK crooked corner posts and three shallow sleeping shelves made of mismatched planks, an old door and half a cart side, nailed"
    " together askew. Each shelf holds a heap of straw and a ragged blanket (dull red, moss green, ochre). A round shield is nailed on one end and a short ladder of three fat rungs leans on"
    " the front. " + CHUNKY + TOP + MOOD,
    "a crude three-level bunk of mismatched planks on four thick crooked posts, straw and ragged blankets on each shelf, a shield nailed on the end",
    ["three sleeping shelves one above another", "mismatched rough planks", "straw or ragged blankets on the shelves"], ["a person or creature in it", "a neat carpentered bunk bed with turned posts", "thin slats", "blue blankets"], rooms=[WARREN])
add("totem-skull", "totem-skull", 1, "a warning totem: a thick post hung with skulls",
    "A post as thick as a man's thigh and a little taller than a man, set in a small cairn of stones, with a short thick crosspiece near the top. THREE big skulls are fixed to it (a horned"
    " beast skull on top, a human skull on each end of the crosspiece), a bunch of big dark feathers and a strip of red rag hang from it, and crude red-ochre marks are daubed on the post."
    + CHUNKY + TOP + MOOD,
    "a thick wooden post with a crosspiece, three skulls fixed to it, feathers and a red rag, standing in a small pile of stones",
    ["a thick upright post", "at least two skulls on it"], ["thin sticks, string or dangling small bones", "flames or glow", "a scarecrow with clothes", "blue paint"], size=[30, 26, 84], base=False, rooms=[MOUTH, WARREN, PASS])

# ================================================================ rock: the cave mouth, outcrop, boulders, the burnt tree
add("cave-mouth", "cave-mouth", 1, "the mouth of a cave: a dark opening in a hump of natural rock",
    "A free-standing hump of " + ROCK + ", about as wide as a wagon is long and one and a half times a man's height, with ONE big dark cave opening in its front: an irregular arch six feet wide"
    " and seven feet tall, pitch black inside, with a lip of rock over it like a brow. Boulders are piled at both feet of the arch, and long claw gouges score the rock beside it. The back of"
    " the hump is a flat vertical cut (it stands against a wall)." + ROCKY + TOP + MOOD,
    "a hump of natural grey-brown rock with one large dark arched cave opening in its front and boulders at its feet",
    ["one large dark cave opening", "natural rounded rock (not masonry)"], ["built stone blocks, bricks or a carved doorway", "a door, gate or bars", "a creature, eyes or glow in the opening", "trees or grass on it", "a ground disc"],
    size=[120, 60, 108], base=False, rooms=[MOUTH])
add("rock-outcrop", "rock-outcrop", 1, "an outcrop of natural rock",
    "One big hump of " + ROCK + ", taller than a man, broader than tall, with three stepped ledges and one deep fissure; a patch of moss on its top." + ROCKY + MOOD,
    "a big rounded hump of natural grey-brown rock with ledges and a fissure",
    ["one mass of natural rock"], ["built stone blocks or bricks", "a cave opening", "trees", "a ground disc"], size=[110, 90, 80], base=False, rooms=[MOUTH, PASS, BEAST])
add("boulder-pile", "boulder-pile", 1, "three big rounded boulders",
    "THREE big rounded boulders of " + ROCK + " resting against one another, the largest waist high, clearly three separate smooth stones (like giant river pebbles), not a heap of rubble"
    " and not skulls: no holes, no faces." + ROCKY + TOP + MOOD,
    "three large smooth rounded boulders resting together",
    ["three rounded boulders"], ["skulls, bones or faces", "many small stones or rubble", "cut blocks", "a ground disc"], base=False, rooms=[PASS, MOUTH, BEAST, SPIDER, DRAGON])
add("tree-burnt", "tree-burnt", 1, "a dead tree burnt black by dragon fire",
    "A dead, charred tree about nine feet tall: a THICK black trunk split at the top into three short STOUT broken limbs (each as thick as a leg, ending in blunt broken stubs), no twigs, no"
    " leaves. Charcoal black with grey ash on the upper sides and a few cracks showing dull dark red-brown wood. Thick roots spread at its foot." + CHUNKY + MOOD,
    "a charred black dead tree trunk with three short stout broken limbs and no twigs or leaves",
    ["a thick black charred trunk", "a few short stout limbs"], ["leaves or green growth", "thin twigs or fine branches", "flames, embers or glow", "a ground disc"], size=[60, 60, 108], base=False, rooms=[MOUTH])

# ---------------------------------------------------------------- checks + write
ids = [a["id"] for a in assets]
assert len(ids) == len(set(ids)), [i for i, n in Counter(ids).items() if n > 1]
assert len(assets) == 16, len(assets)
byid = {a["id"]: a for a in assets}
for a in assets:
    assert a["object"] in roles and roles[a["object"]]["size"], a["object"]
    assert a["group"] in ("p1", "p2", "p3", "sib1", "sib2", "sib3") and a["group"][-1] == str(a["prio"]), a["id"]
    assert all(Path(r).exists() or r.startswith(str(HERE / "inputs")) for r in a["refs"]), (a["id"], a["refs"])
    if a["group"].startswith("sib"):
        par = Path(a["refs"][0]).stem
        assert par in byid and byid[par]["group"].startswith("p") and byid[par]["prio"] <= a["prio"], (a["id"], par)
    if a.get("twin_of"):
        assert roles[a["object"]]["open_of"] == a["twin_of"], a["id"]
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
(HERE / "prompts").mkdir(exist_ok=True)
for a in assets: (HERE / "prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
print(len(assets), "assets", dict(sorted(Counter(a["group"] for a in assets).items())), "prio", dict(sorted(Counter(a["prio"] for a in assets).items())))
print("bench", dict(Counter(b for a in assets for b in a["bench"])), "hung", sum(1 for a in assets if a.get("hung")), "lights", dict(Counter(a["light"] for a in assets if a.get("light"))),
      "tier lai", sum(1 for a in assets if a.get("tier")), "new roles", len({a["object"] for a in assets if not a.get("tier")}))
