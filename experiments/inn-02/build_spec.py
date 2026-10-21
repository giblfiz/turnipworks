#!/usr/bin/env python3
"""Build the inn-02 batch spec: experiments/inn-02/assets.json (prompts + gate criteria per SKU) and
catalog/runs/inn-02/manifest.tsv (the frozen SKU list, same columns as inn-01 plus group / open_of / ref).

Groups (Harry 2026-10-02 + the 300–600 scope change):
  open      OPEN state of every openable inn object, edited from its own closed plate (two-state swap)
  regen     the 52 inn-01 problem assets (model <=2 or masking-flagged), prompts corrected from Harry's notes
  wall      wall-mounted lights (UNLIT) with iron / brass / wood and common / fine variants
  ground    floor and table lights (UNLIT)
  fire      open central fireplaces (UNLIT: logs and ash, no fire)
  vessel    empty vessels for the water shader (EMPTY, deep, hollow)
  firekit   fire-side kit
  gaps      objects the room grammars want but had no mesh (solver v2 run over 880 rooms)
  vary      extra variants of the most-placed props (break visible repetition)
  inn       anything else that obviously completes an inn (TAV catalog lines with no mesh)
Run: python3 experiments/inn-02/build_spec.py
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / "experiments/inn-02"
sys.path.insert(0, str(ROOT / "src"))
import catalog_tool as ct  # noqa: E402

STYLE = (ROOT / "style/heroic-handpainted.object.md").read_text()
STYLE_REF = ROOT / "style-references/heroic-handpainted-tavern-v1.png"
INN01 = ROOT / "experiments/2026-09-30-inn-01-500"
INN01B = ROOT / "experiments/2026-09-30-inn-01b"
WALLS = ROOT / "experiments/2026-10-01-walls"
STABLE = ROOT / "experiments/2026-10-01-stable"

UNLIT = ("UNLIT, IMPORTANT: this light source is shown cold and unlit. No flame, no fire, no glow, no embers, no light "
         "rays, no bright highlights from a flame and no warm light cast on the object. Candle wicks are short and dark, "
         "torch heads are charred black and unlit, lamp wicks are dark, braziers and fire pits hold cold logs, charcoal "
         "and grey ash only. Flame and light are added later by the game engine.")
EMPTY = ("EMPTY, IMPORTANT: the vessel is completely empty and dry inside, with no water or any liquid. Seen from a high "
         "three-quarter view looking down INTO it, so the inner walls and the inner floor are clearly visible and the "
         "interior reads as deep and hollow. A water surface is added later by the game engine.")
UNLIT_GATE = "UNLIT: no flame, fire, glow, embers or emitted light anywhere (dark wicks / charred torch heads / cold ash are correct)"
EMPTY_GATE = "EMPTY: no water or liquid inside; the interior is visible and reads as deep and hollow"

roles = {}
for path in sorted((ROOT / "catalog").glob("*.catalog.md")):
    roles.update(ct.parse_catalog(path)[0])
library = json.loads((ROOT / "tools/spawn-tuner/data/library.json").read_text())["objects"]
inn01 = {r["sku"]: r for r in csv.DictReader((ROOT / "catalog/runs/inn-01/manifest.tsv").open(), delimiter="\t")}
inn01b_assets = {a["id"]: a for a in json.loads((INN01B / "assets.json").read_text())["assets"]}

assets: list[dict] = []
rows: list[dict] = []


def size_text(role):
    w, d, h = role["size"]
    return f"Real-world size about {w:g} in wide × {d:g} in deep × {h:g} in tall — keep these proportions."


def catalog_detail(role, variant="base version", extra=""):
    text = (f"{role['desc']}. {size_text(role)} Function and context: {role['hint']}. Primary material family: "
            f"{role['mat']}. Variant: {variant}. Show exactly this one object and nothing else. Prioritize a clean "
            f"silhouette readable from an elevated game camera.")
    return text + (" " + extra if extra else "")


def add(sku, obj, group, subject, detail, gate_desc, must=(), must_not=(), refs=None, gate_refs=(), prompt=None,
        tier="", shape="", family="", note=""):
    role = roles[obj]
    if sku in {a["id"] for a in assets}:
        raise SystemExit(f"duplicate sku {sku}")
    flags = []
    if "lit" in role["aff"] or group in ("wall", "ground", "fire"):
        flags.append("unlit")
        detail = detail + " " + UNLIT
        must = list(must) + [UNLIT_GATE]
    if group == "vessel":
        flags.append("empty")
        detail = detail + " " + EMPTY
        must = list(must) + [EMPTY_GATE]
    assets.append({
        "id": sku, "object": obj, "group": group, "source": "generate", "lane": "3d",
        "subject": subject, "detail": detail,
        "prompt": prompt if prompt is not None else STYLE.format(subject=subject, detail=detail),
        "refs": [str(p) for p in (refs if refs is not None else [STYLE_REF])],
        "gate_refs": [str(p) for p in gate_refs],
        "gate": {"desc": gate_desc, "must": list(must), "must_not": list(must_not)},
        "flags": flags, "note": note,
    })
    rows.append({"sku": sku, "object": obj, "group": group, "lane": "3d", "gen": role["gen"], "family": family,
                 "tier": tier, "shape": shape, "place": role["place"], "fp": role["fp"], "mat": role["mat"],
                 "pri": role["pri"], "desc": role["desc"], "hint": role["hint"], "open_of": role.get("open_of") or "",
                 "mount": "" if role.get("mount") is None else f"{role['mount']:g}",
                 "flags": ",".join(flags), "note": note})


# ---------------------------------------------------------------------------------------------- 2. REGEN (first:
# open versions of regenerated skus are edited from the NEW plate)
FIX = {  # Harry's inn-01 notes -> prompt corrections
    "acorns-pile": "Mesh broke apart. Make it a compact, touching mound of about a dozen LARGE chunky acorns with caps, fused into one solid low heap, no loose stragglers.",
    "bard-lute-broken": "Harry: a SMASHED lute. A lute whose round wooden body is cracked open and splintered, the neck snapped and bent back but still attached by slack strings. One object.",
    "barrel--s2": "A plain standing barrel: wooden staves and iron hoops ONLY. NO spout, NO tap, NO handles, NO rings, NO lid fittings.",
    "bench-long--s3": "A backless long bench: one thick plank seat on stout splayed legs. Nothing on it, nothing else.",
    "candlestick--fine": "A fine brass candlestick: round foot, turned stem, drip pan, one candle.",
    "carrot-pile": "A small bundle of five or six thick orange carrots lying together side by side, tops trimmed short, touching as one compact clump.",
    "cheese-shelf-aging": "A freestanding wooden shelf unit holding round cheese wheels on its shelves. Nothing on the ground around or under it: no floor, no debris, no straw.",
    "cheese-wheel--s1": "A whole round cheese wheel with a waxed rind. NO handles, NO rings, NO straps, NO cords: it is just cheese.",
    "dice-and-cup": "A leather dice cup standing upright with three chunky oversized dice resting against its base, all touching as one compact group.",
    "door-reinforced--dressed-stone": "A heavy iron-banded wooden door in a dressed-stone frame. Plain wood and dark iron only: NO glowing, NO coloured liquid, NO purple, NO goo.",
    "egg-fried-pan": "A cast-iron frying pan with ONE short, thick, straight handle (this object really has a handle) and two fried eggs inside. The handle is a simple solid bar.",
    "mash-tun": "A large round wooden mash-tun vat with iron hoops. One thick wooden mash paddle stands inside it, its handle leaning against the rim. The paddle is chunky and clearly attached.",
    "pretzel": "A plain baked pretzel. NO handle, NO padlock, NO metal, NO ring: just the knotted dough.",
    "pumpkin-carved": "A carved pumpkin lantern with a face cut into it. NO handles, NO rings, NO wire bail. Dark, unlit inside: no candle glow.",
    "rural-curry-comb": "Harry did not recognise it. A horse curry comb: an oval wooden back with rows of short blunt metal teeth on the underside and a leather hand strap over the top (this object really has the strap). Tilted so the teeth are visible. Hand-sized.",
    "rural-manure-barrow": "A wheelbarrow with exactly ONE wheel at the front, two handles at the back and two short legs, its bed heaped with manure.",
    "sauerkraut-crock": "A stoneware crock with its heavy lid sitting down INSIDE the rim, closed, no gap at all between lid and crock: one solid object.",
    "sign-hanging--s1": "A sturdy wooden tavern sign board hanging from a thick iron wall bracket by two short chunky chains. The board is painted with a simple plump turnip picture, no text. Bracket, chains and board form one connected object.",
    "sign-hanging--s3": "A wooden tavern sign hanging from an iron bracket, painted with a clearly recognisable plump turnip: round purple-and-cream root with a green leafy top. No text.",
    "stable-stall--rough-timber": "A rough-timber horse-stall partition about 10 ft long and 5 ft tall seen from its broad side: thick horizontal planks below, upright bars above, a stout post at each end. One straight panel, nothing else: NO floor, NO hay, NO horse.",
    "tankard-dented": "A dented pewter tankard with exactly ONE handle on its side and a hinged lid. No extra handles, rings or loops.",
    "torch-sconce--s3": "A wall torch: a wooden torch held in a forged iron wall sconce with a back plate.",
    "wall-corner-inner--dressed-stone": "Harry: too much in one. An INSIDE corner, as seen from inside a room looking into the corner: ONLY two short dressed-stone wall sections, each about 2.5 ft long and 9 ft tall, meeting at a 90° concave corner that points AWAY from the viewer, both stone faces facing the viewer. Nothing else: NO floor, NO furniture, NO extra walls.",
    "wardrobe--common--s3": "A tall plain wooden wardrobe with two doors, closed, standing on short feet. Clean, sturdy, symmetrical.",
}
MASK_FIX = ("Previous version had a bad background mask. Keep the WHOLE object well inside the frame with a generous "
            "margin, every part clearly separated from the perfectly uniform chroma-blue background (blue visible "
            "through real gaps), no floor, no shadow.")
REGEN = ("acorns-pile bard-lute-broken barrel--s2 bed-double--common bench-long--s3 bowl--s1 bread-loaf--s1 candlestick--fine "
         "carrot-pile cart-hand cask-rack cauldron chair-plain--common--s2 cheese-shelf-aging cheese-wheel--s1 "
         "chicken-roast-whole clothes-folded--common counter-shop cup-pewter cupboard--s1 dice-and-cup "
         "door-reinforced--dressed-stone egg-fried-pan jug-puzzle jug-stoneware-large mash-tun onion-sliced "
         "potato-sack-open pretzel pumpkin-carved rural-curry-comb rural-manger-wall rural-manure-barrow rural-oat-sack "
         "sauerkraut-crock sign-hanging--s1 sign-hanging--s3 stable-stall--rough-timber table-trestle--s2 tankard-dented "
         "torch-sconce--s3 trade-loaf-tray-rising trade-tincture-rack vinegar-jug wagon wall-corner-inner--dressed-stone "
         "wall-corner-inner--rough-timber wall-doorway--rough-timber wall-straight--dressed-stone "
         "wall-window-small--rough-timber wardrobe--common--s3 wardrobe--fine--s1").split()
assert len(REGEN) == 52
WALL_DESIGN = {
    "wall-corner-inner--rough-timber": "An INSIDE corner, as seen from inside a room looking into the corner: two short rough-timber plank wall sections, each about 2.5 ft long and 9 ft tall, meeting at a 90° concave corner that points AWAY from the viewer, both plank faces facing the viewer, a corner post at the back. Nothing else: NO floor, NO base slab, NO roof, NO furniture.",
    "wall-doorway--rough-timber": "ONE rough-timber plank wall section about 5 ft wide and 9 ft tall with an EMPTY door-sized opening through it (no door leaf), a timber frame around the opening. Nothing else: NO floor, NO base slab, NO roof. Both side edges are clean vertical cuts.",
    "wall-straight--dressed-stone": "Coursed, dressed blue-gray stone blocks. ONE single straight wall section standing upright, about 5 ft wide x 9 ft tall x 1 ft thick. NO floor, NO base slab, NO roof, NO corner return. Both side edges are clean vertical cuts.",
    "wall-window-small--rough-timber": "ONE rough-timber plank wall section about 5 ft wide and 9 ft tall with a small window opening at chest height closed by a pair of wooden shutters. NO floor, NO base slab, NO roof. Both side edges are clean vertical cuts.",
}
for sku in REGEN:
    row = inn01[sku]
    role = roles[row["object"]]
    base = inn01b_assets.get(sku, {}).get("detail") or catalog_detail(role)
    fix = FIX.get(sku, "")
    if sku in WALL_DESIGN:
        base = WALL_DESIGN[sku] + " " + size_text(role)
    extra = " ".join(x for x in (("Correction: " + fix) if fix else "", MASK_FIX) if x)
    add(sku, row["object"], "regen", row["desc"], base + " " + extra, row["desc"] + (f" ({fix})" if fix else ""),
        tier=row["tier"], shape=row["shape"], family=row["family"], note="regen of inn-01 problem asset")

# ---------------------------------------------------------------------------------------------- 1. OPEN versions
OPEN_PROSE = {
    "lid": ("with its lid swung fully OPEN, hinged at the back edge and tilted back about 100 degrees so it stands nearly "
            "upright behind the box",
            "The open top reveals a deep, EMPTY, clearly hollow interior: darker shadowed inner walls on all four sides and "
            "the inside floor visible well below the rim. Nothing inside."),
    "doors": ("with its front doors swung wide OPEN to the sides on their hinges",
              "The open front reveals a deep, EMPTY interior: darker shadowed back and side walls and bare shelves or a "
              "bare hanging rail. Nothing inside."),
    "oven": ("with its iron oven door swung OPEN to the side on its hinge",
             "The open mouth reveals the dark, deep, EMPTY domed baking chamber inside. No fire, no coals, no glow."),
    "door": ("with its door leaf swung wide OPEN about 90 degrees on its side hinges, so the leaf now sticks straight out from the frame toward the viewer (seen nearly edge-on, its thick edge and inner face visible) and the doorway beside it is completely empty",
             "The doorway is now a clear open passage: you can see straight through the frame. Keep the frame, wall "
             "surround and every detail of the leaf identical. The leaf is NOT in the plane of the wall and NOT missing: it is turned outward on its hinges."),
    "doors2": ("with BOTH door leaves swung wide OPEN outward about 90 degrees on their side hinges, each leaf now sticking straight out from its side of the frame toward the viewer (seen nearly edge-on) and the whole doorway between them completely empty",
               "The doorway is now a clear open passage: you can see straight through the frame. Keep the frame, wall "
               "surround and every detail of the leaves identical. Neither leaf stays in the plane of the wall: both are turned outward on their hinges."),
    "casement": ("with its glazed casement window leaves swung OPEN inward on their side hinges",
                 "The window opening is now clear: you can see straight through it. Keep the wall section, frame and panes identical; do NOT add shutters."),
    "shutters": ("with its window shutters swung fully OPEN outward to the sides",
                 "The window opening is now clear: you can see straight through it. Keep the wall section identical."),
}
OPENABLE = {  # closed object -> (open object, prose kind)
    "chest-ironbound": ("chest-ironbound-open", "lid"), "chest-plain": ("chest-plain-open", "lid"),
    "linen-chest": ("linen-chest-open", "lid"), "strongbox": ("strongbox-open", "lid"),
    "cupboard": ("cupboard-open", "doors"), "wardrobe": ("wardrobe-open", "doors"),
    "salt-box": ("salt-box-open", "lid"), "rural-grooming-box": ("rural-grooming-box-open", "lid"),
    "smith-farrier-box": ("smith-farrier-box-open", "lid"), "bread-oven": ("bread-oven-open", "oven"),
    "door-plank": ("door-plank-open", "door"), "door-reinforced": ("door-reinforced-open", "door"),
    "door-barn-double": ("door-barn-double-open", "doors2"), "door-double-grand": ("door-double-grand-open", "doors2"),
    "wall-window-small": ("wall-window-small-open", "shutters"),
}
SRC_DIR = {"inn-01": INN01 / "inputs", "inn-01b": INN01B / "inputs", "walls-01": WALLS / "inputs"}
STYLE_TAIL = STYLE.split("\n\n", 1)[1].rsplit("\n\nSpecific design:", 1)[0]  # geometry/finish/palette/avoid/presentation


def open_prompt(closed_desc, size, kind):
    action, inside = OPEN_PROSE[kind]
    view = ("Camera: a three-quarter view from above, looking INTO the open interior so the hollow reads clearly and deeply."
            if kind in ("lid", "doors", "oven") else "Camera: a three-quarter view from slightly above, as in the supplied image.")
    return (f"Edit task. The supplied image shows this object ({closed_desc}) in the Turnip Works hand-painted house style. Show the "
            f"SAME object: identical colours, materials, ironwork, carving, proportions (about {size}) and painting "
            f"style. Do not redesign it.\n\nShow this same object {action}. {inside} Thick, chunky parts so the open "
            f"shape reconstructs cleanly in 3D. {view}\n\n{STYLE_TAIL}")


def add_open(closed_obj, sku, plate, group="open"):
    open_obj, kind = OPENABLE[closed_obj]
    if sku == "wall-window-small--noble-interior":
        kind = "casement"
    role = roles[closed_obj]
    w, d, h = role["size"]
    suffix = sku[len(closed_obj):]  # '--s1', '--fine--s1', ''
    osku = open_obj + suffix
    action = OPEN_PROSE[kind][0]
    must = [f"the object is shown {action.split(',')[0].replace('with ', 'with ')}",
            "it is the SAME object as the REFERENCE (same design, colours, materials, proportions), only opened"]
    if kind in ("lid", "doors", "oven"):
        must.append("the open interior is EMPTY and visibly deep and hollow, not a shallow or flat surface")
    add(osku, open_obj, group, roles[open_obj]["desc"], f"open state of {sku}",
        f"{role['desc']} shown OPEN ({action})", must=must, refs=[plate], gate_refs=[plate],
        prompt=open_prompt(role["desc"], f"{w:g} × {d:g} × {h:g} in when closed", kind),
        shape=suffix.strip("-"), note=f"open_of {sku}")


for closed_obj in OPENABLE:
    for s in library[closed_obj]["skus"]:
        if s.get("piece") == "leaf":
            continue  # leaf-only doors rotate at runtime; no swap mesh needed
        if s["sku"] in REGEN:
            plate = RUN / "inputs" / f"{s['sku']}.jpg"  # phase 2: edit from the new inn-02 plate
            add_open(closed_obj, s["sku"], plate, group="open-p2")
        else:
            add_open(closed_obj, s["sku"], SRC_DIR[s["src"]] / f"{s['sku']}.jpg")

# ---------------------------------------------------------------------------------------------- 3-6. new lights etc.
V = {  # object -> [(sku suffix, tier, variant prose)]
    # wall
    "lantern-wall-iron": [("common", "common", "plain blackened iron: a square lantern with horn panes on a simple straight iron bracket arm with a wall plate"),
                          ("fine", "fine", "fine wrought iron: a glazed lantern with a peaked cap hanging from a scrolled iron bracket with a decorative wall plate"),
                          ("hex", "common", "a hexagonal iron lantern with glass panes on a stout L-shaped iron bracket")],
    "lantern-wall-brass": [("common", "common", "plain warm brass: a square glazed lantern on a straight brass bracket"),
                           ("fine", "fine", "ornate polished brass: a tall lantern with frosted amber panes (opaque, not see-through) and a domed cap on a curling brass bracket and an engraved wall plate")],
    "lantern-wall-horn": [("s1", "common", "a squat wooden-framed lantern with pale horn panes hanging from a thick wooden arm pegged to a wall board")],
    "lantern-pierced-tin": [("cone", "common", "a cylindrical pierced-tin candle lantern with a conical top and a ring, hanging from an iron wall hook on a small wall plate; the tin is punched with a pattern of holes"),
                            ("square", "common", "a square pierced-tin candle lantern with a pyramid top hanging from an iron wall hook on a small wall plate; punched hole pattern")],
    "sconce-candle-single": [("iron", "common", "blackened iron: a flat iron back plate with one curved arm and a drip cup holding a single candle"),
                             ("brass", "fine", "polished brass: an oval brass back plate with one curved arm and a drip pan holding a single candle"),
                             ("wood", "common", "a turned wooden back board with a short iron arm and cup holding a single candle")],
    "sconce-candle-double": [("iron", "common", "blackened iron: a wall plate with two curving arms, each ending in a drip cup with a candle"),
                             ("wood", "common", "a carved wooden back board with two iron arms, each holding a candle in a cup")],
    "sconce-candle-triple": [("iron", "common", "blackened wrought iron: a wall plate with three arms (middle one higher), each with a drip cup and a candle"),
                             ("brass", "fine", "polished brass with gentle scrolls: a wall plate with three arms, each with a drip pan and a candle")],
    "sconce-reflector": [("tin", "common", "a round crimped tin reflector dish behind a single candle in a cup on a short shelf arm"),
                         ("brass", "fine", "a tall oval polished brass reflector plate behind a single candle in a brass cup")],
    "candle-box-sconce": [("s1", "common", "a small open-fronted plain wooden box hung on the wall with a candle standing inside on its floor"),
                          ("s2", "common", "a small open-fronted wooden candle box with a scalloped top, painted dusty teal, a candle standing inside")],
    "rushlight-holder-wall": [("s1", "common", "a chunky iron rushlight nip (scissor-like clamp holding a short rush) on a stout wooden wall block"),
                              ("s2", "common", "an iron rushlight nip with a candle-socket counterweight, mounted on an iron spike in a wooden wall block")],
    "torch-bracket-rough": [("s1", "common", "a crude bent iron strap ring nailed to a timber block on the wall, holding one wooden torch tilted outward"),
                            ("s2", "common", "a rough forged iron spike bracket with a cage cup, holding one wooden torch tilted outward")],
    "torch-bracket-fine": [("iron", "fine", "a fine forged iron bracket with scrollwork and a decorative wall plate, holding one wooden torch tilted outward in a cage cup"),
                           ("brass", "fine", "a polished brass wall bracket with a ring cup and a round wall plate, holding one wooden torch tilted outward")],
    "lamp-wall-shelf": [("clay", "common", "a plain wooden plank shelf on two brackets with a small clay oil lamp sitting on it"),
                        ("brass", "fine", "a carved wooden wall shelf with a small brass oil lamp sitting on it")],
    "lamp-wall-bracket": [("iron", "common", "an iron oil lamp hanging from a short chain on a simple iron wall bracket"),
                          ("brass", "fine", "a brass oil lamp with a round reservoir hanging from an elegant brass wall bracket")],
    "cresset-wall": [("s1", "common", "an iron cage basket on a stout wall bracket, holding cold split logs"),
                     ("s2", "common", "a round iron cresset bowl with upturned prongs on a wall bracket, holding cold charred wood")],
    "rural-lantern-barn": [("s2", "common", "a battered tin barn lantern with a wire guard hanging on one big iron nail driven into a short wall board"),
                           ("s3", "common", "a sooty iron barn lantern with a bail handle hanging from a hooked nail on a short plank of barn wall")],
    # ground
    "candle-tree": [("iron", "common", "blackened wrought iron: a central pole on a broad splayed iron foot with a ring of curving arms at two heights, each holding a candle"),
                    ("brass", "fine", "polished brass: a turned brass column on a round foot with tiers of arms holding candles"),
                    ("wood", "common", "a turned wooden pole on a cross-foot with iron cups on short arms holding candles")],
    "torch-stand": [("iron", "common", "a tall blackened wrought-iron stand on splayed iron feet with a cage cup at the top holding one wooden torch"),
                    ("wood", "common", "a stout wooden post on a cross-foot with an iron cup at the top holding one wooden torch")],
    "brazier-tripod": [("iron", "common", "a wide iron bowl on three tall curved iron legs, holding cold charcoal and grey ash"),
                       ("bronze", "fine", "a bronze bowl with a decorated rim on three lion-footed bronze legs, holding cold charcoal and grey ash")],
    "fire-basket-stand": [("s1", "common", "an open iron cage basket on a single pole with three feet, filled with cold split logs"),
                          ("s2", "common", "a squat iron fire basket on four short legs, filled with cold split logs")],
    "oil-lamp": [("s1", "", "a plain round red-clay oil lamp with a spout and a finger loop"),
                 ("s2", "", "a green-glazed clay oil lamp with a long spout"),
                 ("s3", "", "a clay oil lamp with three spouts in a row")],
    "lamp-oil-brass": [("common", "common", "a plain brass oil lamp with a round reservoir, a short spout and a ring handle"),
                       ("fine", "fine", "an ornate brass oil lamp on a small pedestal foot with a long spout")],
    "lamp-pole": [("iron", "common", "a tall iron pole on a tripod foot with an iron oil lamp on a small dish at the top"),
                  ("brass", "fine", "a tall turned brass pole on a round foot with a brass oil lamp and small reflector at the top")],
    "lantern-post-indoor": [("wood", "common", "a square wooden post on a cross-foot base with an iron arm and a hanging lantern near the top"),
                            ("iron", "common", "a short iron post on a weighted round foot with a glazed lantern mounted on top")],
    "candlestand-pricket": [("iron", "common", "a tall iron pricket stand on splayed feet with a wide drip pan and a ring of spikes holding thick candles"),
                            ("brass", "fine", "a tall brass church pricket candlestand with a broad tray of spikes holding several thick candles")],
    "candlestick-floor": [("iron", "common", "a tall plain iron floor candlestick on a splayed foot holding one thick candle"),
                          ("wood", "common", "a tall turned wooden floor candlestick with an iron drip pan holding one thick candle")],
    "rushlight-holder": [("s1", "", "an iron rushlight clip on a tall thin stand with a wooden block foot"),
                         ("s2", "", "an iron rushlight clip with a candle-socket counterweight on a tripod iron stand")],
    # fire
    "firepit-stone-round": [("fieldstone", "", "a ring of rough fieldstones around a shallow pit holding a few cold logs and grey ash"),
                            ("dressed", "", "a neat ring of dressed stone blocks around a pit holding cold logs and grey ash")],
    "hearth-raised-square": [("s1", "", "a waist-low square stone platform with a raised stone kerb, its top holding a cold log stack and grey ash")],
    "firepit-sunken": [("s1", "", "a square pit sunk into the floor, edged by a low flat stone kerb, cold logs and ash at the bottom")],
    "fire-ring-iron": [("s1", "", "a low round iron ring on short legs, holding cold logs and grey ash")],
    "hearth-central-hood": [("s1", "", "a low round stone hearth with cold logs and ash, and above it a large funnel-shaped wooden-and-plaster smoke hood hanging from chains, centred over the hearth")],
    "firepit-log-spit": [("s1", "", "a ring of stones around cold logs and ash, with two forked iron uprights and an empty iron spit with a crank across the top")],
    "hearth-central": [("s1", "", "an open central hearth: a low ring of flat stones with cold logs and grey ash in the middle")],
}
GROUP_OF = {**{o: "wall" for o in ("lantern-wall-iron", "lantern-wall-brass", "lantern-wall-horn", "lantern-pierced-tin",
                                   "sconce-candle-single", "sconce-candle-double", "sconce-candle-triple", "sconce-reflector",
                                   "candle-box-sconce", "rushlight-holder-wall", "torch-bracket-rough", "torch-bracket-fine",
                                   "lamp-wall-shelf", "lamp-wall-bracket", "cresset-wall", "rural-lantern-barn")},
            **{o: "ground" for o in ("candle-tree", "torch-stand", "brazier-tripod", "fire-basket-stand", "oil-lamp",
                                     "lamp-oil-brass", "lamp-pole", "lantern-post-indoor", "candlestand-pricket",
                                     "candlestick-floor", "rushlight-holder")},
            **{o: "fire" for o in ("firepit-stone-round", "hearth-raised-square", "firepit-sunken", "fire-ring-iron",
                                   "hearth-central-hood", "firepit-log-spit", "hearth-central")}}
WALL_HINT = ("Wall-mounted: show it as it hangs on a wall, with its flat wall plate, board or bracket base at the back, "
             "seen from the front at a three-quarter angle; NO wall behind it, just the fitting itself.")
for obj, vs in V.items():
    role = roles[obj]
    for suf, tier, prose in vs:
        sku = f"{obj}--{suf}"
        extra = WALL_HINT if role["place"] == "wall" else ""
        add(sku, obj, GROUP_OF[obj], role["desc"], catalog_detail(role, prose, extra), f"{role['desc']}: {prose}",
            tier=tier, shape=suf)

# vessels (EMPTY) and fire kit
VESSEL = [
    ("water-trough", "water-trough--empty", "a long wooden animal water trough of thick planks on short legs"),
    ("horse-trough-stone", "horse-trough-stone--empty", "a long stone horse trough carved from blocks, with a small spout at one end"),
    ("ewer-and-basin", "ewer-and-basin--empty", "a wide ceramic washbasin with a matching tall water jug (ewer) standing inside it"),
    ("rain-barrel", "rain-barrel--open", "a tall wooden rain barrel with iron hoops and an OPEN top (no lid)"),
    ("well", "well--open", "a round stone well with a low wall and an OPEN top: no roof, no windlass, no bucket; a deep dark round shaft"),
    ("bucket", "bucket--empty", "a plain wooden bucket with iron hoops and a rope bail handle"),
    ("washtub", "washtub--empty", "a wide shallow wooden laundry tub with two stave lugs"),
]
for obj, sku, prose in VESSEL:
    role = roles[obj]
    add(sku, obj, "vessel", role["desc"], catalog_detail(role, prose), f"{role['desc']}: {prose}", shape=sku.split("--")[1])
FIREKIT = [
    ("woodpile", "woodpile--s1", "a neat waist-high stack of split firewood logs, ends facing out"),
    ("woodpile", "woodpile--s2", "a low untidy heap of split logs and branches leaning together"),
    ("fire-irons", "fire-irons", "a poker, tongs and shovel leaning together in a small iron stand, chunky parts"),
    ("poker-set", "poker-set--common", "a fireplace poker, tongs and shovel hanging on a stout iron stand with a round base"),
    ("bellows-hand", "bellows-hand", "a pair of hand bellows: two carved wooden boards with leather sides and a brass nozzle"),
    ("smith-soot-bucket", "smith-soot-bucket", "a dented iron ash bucket with a bail handle and a small lid propped on the rim"),
    ("firewood-basket", "firewood-basket", "a round wicker basket filled with kindling sticks and a few split logs"),
    ("kindling-bundle", "kindling-bundle", "a bundle of kindling sticks tied with twine"),
]
for obj, sku, prose in FIREKIT:
    role = roles[obj]
    add(sku, obj, "firekit", role["desc"], catalog_detail(role, prose), f"{role['desc']}: {prose}",
        shape=sku.split("--")[1] if "--" in sku else "")

# ---------------------------------------------------------------------------------------------- (b) grammar gaps
STABLE_P = (STABLE / "prompts/stable-stall-partition.md").read_text().rsplit("Specific design: ", 1)[1].strip()
STABLE_G = (STABLE / "prompts/stable-stall-gate.md").read_text().rsplit("Specific design: ", 1)[1].strip()
STABLE_M = (STABLE / "prompts/rural-manger-wall--s2.md").read_text().rsplit("Specific design: ", 1)[1].strip()
GAPS = [  # (object, sku, design prose or None for catalog default)
    ("privy-stall-partition", "privy-stall-partition--s1", "A single wooden privy stall partition panel about 4 ft deep and 6 ft tall: vertical rough planks with a top rail, the bottom few inches open. Seen from the side at a slight angle. One panel, nothing else: NO floor, NO toilet, NO walls."),
    ("privy-stall-partition", "privy-stall-partition--s2", "A single privy stall partition panel about 4 ft deep and 6 ft tall: a timber frame with horizontal planks and a heart-shaped cut-out near the top. One panel, nothing else: NO floor, NO walls."),
    ("privy-stall-door", "privy-stall-door--s1", "ONLY the door leaf of a privy stall, as if lifted off its hinges: vertical planks with a Z-brace and a wooden latch, about 2.5 ft wide and 5 ft tall, a crescent-moon cut-out near the top. NO frame, NO posts, NO walls, NO floor."),
    ("privy-stall-door", "privy-stall-door--s2", "ONLY the door leaf of a privy stall, as if lifted off its hinges: rough vertical planks with two iron strap hinges and a ring pull, about 2.5 ft wide and 5 ft tall. NO frame, NO posts, NO walls, NO floor."),
    ("stable-stall-back", "stable-stall-back--s1", "A long solid wooden stall back wall about 10 ft long and 5 ft tall seen from its broad side: thick horizontal planks top to bottom, a stout post at each end and a top rail. One straight panel. NO floor, NO hay, NO horse."),
    ("stable-stall-back", "stable-stall-back--s2", "A long stall back wall about 10 ft long and 5 ft tall: vertical boards between a heavy bottom rail and a top rail, a post at each end, a single iron hay hook on its face. One straight panel. NO floor, NO hay."),
    ("stable-stall-partition", "stable-stall-partition--s2", STABLE_P.replace("a row of vertical iron bars above", "a row of turned wooden spindles above")),
    ("stable-stall-partition", "stable-stall-partition--s3", STABLE_P.replace("thick horizontal planks on the lower two-thirds", "rough diagonal-braced planks on the lower two-thirds")),
    ("stable-stall-gate", "stable-stall-gate--s2", STABLE_G.replace("vertical planks, a top rail", "diagonal planks in a chevron, a top rail")),
    ("stable-stall-gate", "stable-stall-gate--s3", STABLE_G.replace("vertical planks, a top rail, an iron latch and strap hinges", "a solid lower half of planks with an open row of wooden bars above, an iron latch and strap hinges")),
    ("rural-manger-wall", "rural-manger-wall--s3", STABLE_M.replace("slatted V-shaped hay rack above a small plank feed trough", "iron-barred hay rack above a deep stone-lined feed box")),
    ("rural-manger-wall", "rural-manger-wall--s4", STABLE_M.replace("about 4 ft wide", "about 3 ft wide, built into a corner-style angled box,")),
    ("bunk-bed", "bunk-bed--s1", None), ("bunk-bed", "bunk-bed--s2", "a sturdier bunk with a short ladder at one end and straw mattresses"),
    ("cot", "cot--s1", None), ("cot", "cot--s2", "a cot with a canvas sling bed on crossed wooden legs"),
    ("bedroll", "bedroll--s1", None), ("bedroll", "bedroll--s2", "a bedroll laid out flat with a folded blanket and a small pillow"),
    ("trunk-travel", "trunk-travel--s1", None), ("trunk-travel", "trunk-travel--s2", "a domed trunk covered in green-painted leather with brass corners"),
    ("chair-armed", "chair-armed--common", "a sturdy carved wooden armchair, plain"), ("chair-armed", "chair-armed--fine", "a richly carved armchair with a burgundy cushion"),
    ("chair-armed", "chair-armed--s2", "a heavy oak armchair with slatted back and thick square arms"),
    ("chair-upholstered", "chair-upholstered--s2", "a wingback armchair upholstered in moss green"),
    ("chair-upholstered", "chair-upholstered--s3", "a low upholstered fireside chair in dusty teal fabric with wooden feet"),
    ("dresser-plates", "dresser-plates--s1", None), ("dresser-plates", "dresser-plates--s2", "a painted dusty-teal kitchen dresser with plates standing on its rack"),
    ("basin-stone", "basin-stone--s1", None), ("basin-stone", "basin-stone--s2", "a stone sink trough on two stone legs with a drain lip"),
    ("utensil-rack-wall", "utensil-rack-wall--s2", "a wooden wall batten with iron hooks holding a ladle, skimmer and two small pans"),
    ("utensil-rack-wall", "utensil-rack-wall--s3", "an iron bar rack on the wall with hanging spoons, a sieve and a skillet"),
    ("knife-rack-wall", "knife-rack-wall--s2", "a wooden wall block with slots holding three kitchen knives"),
    ("pot-hook-chain", "pot-hook-chain--s2", "a short hanging iron trammel hook with a ratchet bar"),
    ("towel-hanging", "towel-hanging", None), ("plate-stack-pewter", "plate-stack-pewter", None),
    ("tankard-wooden", "tankard-wooden", None), ("mug-wooden", "mug-wooden", None),
    ("mirror-wall", "mirror-wall--common", "a small square mirror in a plain wooden frame"),
    ("mirror-wall", "mirror-wall--fine", "an oval mirror in a carved and gilded frame"),
]
for obj, sku, prose in GAPS:
    role = roles[obj]
    kit = role["place"] == "kit" or obj.startswith("rural-manger")
    detail = (prose + " " + size_text(role)) if (prose and kit) else catalog_detail(role, prose or "base version")
    add(sku, obj, "gaps", role["desc"], detail, f"{role['desc']}" + (f": {prose[:160]}" if prose else ""),
        shape=sku.split("--", 1)[1] if "--" in sku else "")

# ---------------------------------------------------------------------------------------------- (c) variants
VARY = [
    ("stool-bar", "stool-bar--s2", "a round-seated bar stool on four splayed legs with a foot ring"),
    ("stool-bar", "stool-bar--s3", "a square-seated tall stool with stretchers and a worn seat"),
    ("stool-bar", "stool-bar--s4", "a tall stool with a solid square seat and a footrest board joining its legs"),
    ("chair-plain", "chair-plain--common--s4", "a simple ladder-back wooden chair with a rush seat"),
    ("chair-plain", "chair-plain--common--s5", "a sturdy plank chair with a solid back board and a heart cut-out"),
    ("table-side", "table-side--s2", "a small round side table on a single turned pedestal"),
    ("table-side", "table-side--s3", "a small square side table with a drawer"),
    ("bench-long", "bench-long--s4", "a long plank bench with slab ends"),
    ("bench-long", "bench-long--s5", "a long bench with a low back rail"),
    ("table-round-small", "table-round-small--s2", "a small round tavern table on four stout splayed legs"),
    ("table-round-small", "table-round-small--s3", "a small round table on a heavy central post with a cross foot"),
    ("table-square", "table-square--common--s4", "a square tavern table with thick turned legs and stretchers"),
    ("barrel", "barrel--s4", "a squat fat barrel with wide iron hoops"),
    ("barrel", "barrel--s5", "a tall slim barrel with wooden hoops"),
    ("sack", "sack--s4", "a tied burlap sack slumped against itself"),
    ("sack", "sack--s5", "a fat stencil-marked grain sack, tied at the neck"),
    ("flour-sack-open", "flour-sack-open--s2", "an open flour sack with the neck rolled down and a scoop in it"),
    ("flour-sack-open", "flour-sack-open--s3", "a half-empty open flour sack slumped to one side"),
    ("crate", "crate--s4", "a slatted crate with gaps between boards"),
    ("crate", "crate--s5", "a long low crate with rope handles"),
    ("cask-rack", "cask-rack--s2", "a two-tier wooden rack holding three casks on their sides, each with a wooden tap"),
    ("wine-rack", "wine-rack--s2", "a diamond-lattice wooden wine rack with bottles in some cells"),
    ("vegetable-basket-mixed", "vegetable-basket-mixed--s2", "a square wicker basket of cabbages, carrots and leeks"),
    ("apple-basket", "apple-basket--s2", "a tall wicker basket heaped with red and green apples"),
    ("potato-pile", "potato-pile--s2", "a low heap of brown potatoes in a shallow wooden tray"),
    ("turnip-basket", "turnip-basket--s2", "a round wicker basket of purple-and-white turnips with leafy tops"),
    ("shelving-freestanding", "shelving-freestanding--s2", "a tall open wooden shelving unit with four shelves and cross bracing, empty"),
    ("shelving-freestanding", "shelving-freestanding--s3", "a heavy plank shelving unit with three shelves holding a few jars and a box"),
    ("coat-pegs", "coat-pegs--s2", "a wall board with five wooden pegs, one holding a cloak"),
    ("key-hook-board", "key-hook-board--s2", "a small wall board with brass hooks holding iron keys"),
    ("chest-plain", "chest-plain--s4", "a plain wooden chest with rope handles and a flat lid"),
    ("bed-straw-pallet", "bed-straw-pallet--s2", "a straw-stuffed pallet with a rough wool blanket"),
    ("bed-straw-pallet", "bed-straw-pallet--s3", "a low wooden frame holding a straw mattress"),
    ("bed-single", "bed-single--common--s4", "a simple single bed with a headboard and a patchwork quilt"),
    ("bed-canopy", "bed-canopy--s2", "a canopy bed with moss-green hangings and turned posts"),
    ("tankard", "tankard--common--s4", "a wooden-staved tankard with iron hoops and one handle"),
    ("tankard-of-ale", "tankard-of-ale--s2", "a pewter tankard full of ale with a foam head"),
    ("tankard-of-ale", "tankard-of-ale--s3", "a wooden tankard full of dark ale with a foam head"),
    ("mug-of-ale", "mug-of-ale--s2", "a glazed clay mug of ale with a little foam"),
    ("mug-of-ale", "mug-of-ale--s3", "a squat stoneware mug of ale"),
    ("pitcher", "pitcher--common--s4", "a tall green-glazed clay pitcher with one handle"),
    ("plate", "plate--common--s4", "a plain round wooden plate (trencher)"),
    ("plate", "plate--common--s5", "a cream-glazed earthenware plate with a teal rim"),
    ("lantern-hanging", "lantern-hanging--s4", "a square iron lantern hanging from a short chain with a ring"),
    ("lantern-hanging", "lantern-hanging--s5", "a round pierced-tin lantern hanging from a hook"),
    ("candle", "candle--s4", "a thick short candle on a small saucer"),
    ("candle", "candle--s5", "a tall tapered candle in a plain clay holder"),
    ("candlestick", "candlestick--common--s2", "a plain iron candlestick with a ring handle and one candle"),
    ("chandelier-ring", "chandelier-ring--s2", "a square wooden cross-beam chandelier with candles on iron cups"),
    ("chandelier-ring", "chandelier-ring--s3", "a two-tier iron ring chandelier with candles"),
    ("hay-bale", "hay-bale--s4", "a loose round hay bale tied with twine"),
]
for obj, sku, prose in VARY:
    role = roles[obj]
    add(sku, obj, "vary", role["desc"], catalog_detail(role, prose), f"{role['desc']}: {prose}",
        shape=sku.split("--")[-1])
add_open("chest-plain", "chest-plain--s4", RUN / "inputs/chest-plain--s4.jpg", group="open-p2")

# ---------------------------------------------------------------------------------------------- (d) inn completeness
INN = ("dough-trough pastry-tray price-board cup-wooden spoon-jar utensil-rack baskets-stack jars-preserves footstool "
       "rocking-chair bench-village quench-trough lantern-post poultry-plucked-hanging butcher-block horseshoes-pile "
       "map-rolled rural-straw-bundle hand-mirror trencher-stack platter-pewter-oval mallet-meat firkin trade-hop-sack-open "
       "trade-bung-mallet trade-spigots-box trade-bread-crate-delivery trade-sign-pretzel trade-apron-bloody "
       "trade-salting-trough cloak-hanging bundle-wrapped pack-saddlebags keg-small storage-jar bottle-cluster platter "
       "apple-pile roast-fowl roast-pig fish game-brace-hanging chopping-block craft-saddle-horse-stand carrot-basket "
       "vegetable-crate-mixed bread-braided bread-rolls-basket cake-round grain-sack-open cheese-stack cheese-board "
       "meat-raw-joint ham-whole-glazed ham-sliced porridge-bowl soup-cauldron-full feast-platter-meats bread-pile "
       "onion-pile cabbage-crate turnip-stew-bowl rural-feed-sack-open rural-harness-draft hat-wide-brim letters-bundle "
       "cup-leather horn-drinking-banded platter-board-handled plate-ceramic plate-stack-wood bowl-wood-large bowl-clay "
       "bowl-pewter bowl-stack bread-basket-cloth salt-cellar-plain dutch-oven cutting-board-round flask-hip "
       "wineskin-full pitcher-of-milk trade-cheese-aging-shelf rural-mounting-block rural-tack-trunk "
       "rural-horse-blanket-folded saddle feed-bag rural-feed-scoop kettle kettle-copper trivet roasting-pan "
       "stein-stoneware mug-large tankard-horn serving-tray board-game knucklebones lute dish-tub bottles-empty-crate "
       "cider-press bath-screen-cloth boots-row carpetbag flowers-dried demijohn jar-lidded-stoneware pitcher-glazed "
       "trade-ale-jugs-crate trade-barrel-chalked trade-ale-taster-stool trade-yeast-crock pie sausage-string").split()
for obj in INN:
    role = roles[obj]
    if obj in library:
        raise SystemExit(f"{obj} already has a mesh")
    add(obj, obj, "inn", role["desc"], catalog_detail(role), role["desc"])

VARY2 = [  # single-mesh props the v2 solver places 100+ times in 880 rooms
    ("broom", "broom--s2", "a besom broom of twigs bound to a crooked stick"),
    ("lantern-hand", "lantern-hand--s2", "a round tin hand lantern with a bail handle and horn windows"),
    ("bridle-hanging", "bridle-hanging--s2", "a leather bridle with a brass-studded browband hanging from a wooden peg"),
    ("privy-seat-single", "privy-seat-single--s2", "a boxed wooden privy seat with a hinged lid, lid closed"),
    ("dish-rag-hanging", "dish-rag-hanging--s2", "a striped linen cloth draped over a wooden wall peg"),
    ("ledger-accounts", "ledger-accounts--s2", "a thick closed ledger bound in green leather with brass corners"),
    ("garlic-braid", "garlic-braid--s2", "a short braid of red-skinned garlic bulbs hanging from a loop"),
    ("coin-stack", "coin-stack--s2", "three short stacks of copper and silver coins side by side"),
    ("water-jug-basin", "water-jug-basin--s2", "a tall cream jug standing in a teal-glazed basin"),
    ("ham-hanging", "ham-hanging--s2", "a cured ham in netting hanging from a hook"),
    ("rural-saddle-riding", "rural-saddle-riding--s2", "a dark brown riding saddle with a rolled blanket strapped behind"),
    ("notice-board", "notice-board--s2", "a wall board framed in timber with a small peaked roof, pinned with blank papers"),
    ("key-ring", "key-ring--s2", "a big iron ring holding four chunky keys"),
    ("rural-water-bucket-stable", "rural-water-bucket-stable--s2", "a tall iron-hooped stable bucket with a rope handle"),
    ("saddle-rack", "saddle-rack--s2", "a wall-mounted wooden saddle bracket shaped like an inverted V"),
    ("grain-bin-stable", "grain-bin-stable--s2", "a lidded wooden oat bin with a sloping lid and iron hasp"),
    ("desk-writing", "desk-writing--s2", "a slant-top writing desk on four legs with a small drawer"),
    ("ledger-counter-bell", "ledger-counter-bell--s2", "an open register book next to a brass hand bell"),
    ("onion-string", "onion-string--s2", "a string of red onions hanging from a loop"),
    ("horse-collar", "horse-collar--s2", "a padded draught-horse collar with wooden hames"),
    ("hay-pile", "hay-pile--s2", "a loose heap of hay with a pitchfork-worked top"),
    ("bucket-slop", "bucket-slop--s2", "a lidded wooden slop pail with rope handle, lid on"),
    ("feed-trough", "feed-trough--s2", "a hollowed-log feed trough on two short cross-legs"),
    ("candelabra", "candelabra--common", "a plain iron three-branch candelabra"),
    ("quilt-rack", "quilt-rack--s2", "a wooden quilt rack with a folded patchwork quilt over its rail"),
    ("cook-hearth-spit", "cook-hearth-spit--s2", "a deep brick kitchen hearth with an iron spit and a pot crane, cold logs and ash"),
    ("fireplace-wall", "fireplace-wall--s3", "a stone fireplace with a heavy timber mantel beam, cold logs and ash on the hearth"),
    ("rural-horse-brasses", "rural-horse-brasses--s2", "a leather strap hung with four round horse brasses"),
    ("vase-flowers", "vase-flowers--s2", "a clay jug holding a bunch of wildflowers"),
    ("table-kitchen-prep", "table-kitchen-prep--s2", "a heavy kitchen work table with a thick scrubbed top and a lower shelf"),
    ("towel-stack", "towel-stack--s2", "a short stack of folded linen towels"),
    ("trophy-head", "trophy-head--s2", "a stag's antlers mounted on a carved wooden shield board"),
    ("pitchfork", "pitchfork--s2", "a three-tined wooden hay fork"),
    ("shield-display", "shield-display--s2", "a kite shield painted burgundy and ochre hung on the wall"),
    ("settle", "settle--s2", "a high-backed wooden settle bench with arms"),
    ("back-bar-shelves", "back-bar-shelves--s2", "a tall back-bar shelf unit with three shelves and a small cupboard below, empty"),
    ("bed-double", "bed-double--common--s2", "a double bed with a plain headboard and a wool blanket"),
    ("table-trestle", "table-trestle--s4", "a long trestle table with X-shaped trestles"),
]
for obj, sku, prose in VARY2:
    role = roles[obj]
    add(sku, obj, "vary", role["desc"], catalog_detail(role, prose), f"{role['desc']}: {prose}", shape=sku.split("--")[-1])
INN3 = ("cat-bed-basket washboard-tub carcass-hanging fish-gutting-board salt-block spice-jars walnuts-pile pretzel-rack "
        "tart-fruit goose-roast leg-of-mutton sausage-coil potato-crate roast-slices-plate rural-halter-rope "
        "rural-saddle-soap-tin rural-horseshoe-nails-box shaving-kit feather-duster music-stand cup-glass-green "
        "wassail-bowl tureen-ceramic dish-covered-pewter butter-dish pie-dish sieve-wooden-drum mortar-wood scoop-flour "
        "decanter-glass-plain carafe-glass jug-of-cider trade-fermenting-crock trade-lard-crock").split()
for obj in INN3:
    role = roles[obj]
    if obj in library:
        raise SystemExit(f"{obj} already has a mesh")
    add(obj, obj, "inn", role["desc"], catalog_detail(role), role["desc"])

# ---------------------------------------------------------------------------------------------- write
RUN.mkdir(parents=True, exist_ok=True)
(RUN / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
out = ROOT / "catalog/runs/inn-02"
out.mkdir(parents=True, exist_ok=True)
cols = ["sku", "object", "group", "lane", "gen", "family", "tier", "shape", "place", "fp", "mat", "pri", "desc", "hint",
        "open_of", "mount", "flags", "note"]
with (out / "manifest.tsv").open("w", newline="") as fh:
    w = csv.DictWriter(fh, cols, delimiter="\t")
    w.writeheader()
    w.writerows(rows)
from collections import Counter  # noqa: E402
c = Counter(a["group"] for a in assets)
(out / "summary.txt").write_text(f"inn-02: {len(assets)} SKUs\n" + "\n".join(f"  {k:8s} {v}" for k, v in c.items()) + "\n")
print(len(assets), dict(c))
