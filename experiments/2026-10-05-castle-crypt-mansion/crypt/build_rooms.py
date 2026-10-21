#!/usr/bin/env python3
"""Crypt rooms for the integration agent: writes rooms.json and flats.json and checks every id against the catalog,
the library (what already has a mesh) and this batch's assets.json.   python3 build_rooms.py"""
import json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src"))
import catalog_tool as ct
roles = {}
for p in sorted((ROOT / "catalog").glob("*.catalog.md")):
    roles.update(ct.parse_catalog(p)[0])
recipes = {}
for p in [ROOT / "catalog/room-recipes.md"] + sorted((ROOT / "catalog").glob("rooms-*.md")):
    recipes.update({r["id"]: r for r in ct.parse_recipes(p)[0]})
LIB = json.loads((ROOT / "tools/spawn-tuner/data/library.json").read_text())["objects"]
HAVE = {r for r, o in LIB.items() if o["skus"]}                      # mesh or flat image exists today
NEW = {a["object"] for a in json.loads((HERE / "assets.json").read_text())["assets"]}

FAMILY = "crypt-stone"
F_SLAB, F_BONE = {"id": "floor-tomb-slabs", "status": "new"}, {"id": "floor-bone-strewn", "status": "new"}
def ex(*ids): return [{"id": i, "status": "exists"} for i in ids]
WALL_LIGHTS = ["torch-sconce", "torch-bracket-rough"]
COMMON_LIGHT = {"torch": "torch-sconce / torch-bracket-rough on the walls, one every 10-12 ft, alternating sides; never on a niche or ossuary panel",
                "note": "no windows anywhere: every crypt room must get at least one light"}

rooms = [
 {"key": "crypt-antechamber", "label": "Antechamber", "outdoor": False, "cells": [4, 3], "family": FAMILY, "role": "passageway with a focal piece",
  "floors": ex("floor-flagstone-damp", "floor-flagstone-large") + [F_SLAB] + ex("floor-flagstone-broken"),
  "recipes": ["cry-antechamber"],
  "focal": ["statue-weeping-angel", "monument-urn-draped"],
  "reads_as": "the mourning statue (or draped-urn monument) centred on the far wall, a brazier each side of it, stone benches along the side walls; the way in is the iron gate",
  "reuse": ["torch-sconce", "torch-bracket-rough", "brazier-tripod", "torch-stand", "pillar-square", "decal-cobweb"],
  "program": {"closest": "desk", "why": "one axial focal piece opposite the main door, flanked symmetrically (ROOMS.md principle 8); the rest hugs the walls and the middle stays clear as a through-way",
   "focal_rule": "focal piece centred on the wall opposite the main door, facing it; if that wall has the onward door, put the focal in the centre of the room instead and let the path pass either side",
   "flank": "2 x brazier-standing (or brazier-tripod, rite-sacred-flame-bowl), one each side of the focal, 3-4 ft off it",
   "walls": "bench-stone along each side wall (1 per 10 ft of wall, max 4); urn-decorative in the two corners of the door wall; pedestal-display only in rooms of 20 cells or more",
   "centre": "empty (walking line door -> focal -> onward door)",
   "doors": "main door = crypt-gate-iron in wall-doorway--crypt-stone; other doors = door-crypt; one blind wall panel may be swapped for tomb-door-sealed--crypt-stone (a style roll, 1 in 3)",
   "hung": "rite-memorial-plaque (2-4, at 54 in, spaced along the side walls above the benches), burial-urn-niche (0-2, mount 36 in), rite-death-mask (0-1)",
   "counts": {"12 cells": "1 focal, 2 braziers, 2 benches, 2 urns, 2 plaques, 2 wall torches", "24 cells": "1 focal, 2 braziers, 4 benches, 4 urns, 1 pedestal, 4 plaques, 2 urn niches, 4 wall torches, 2 pillars"},
   "lights": {**COMMON_LIGHT, "brazier": "brazier-standing, brazier-tripod, rite-sacred-flame-bowl (the flanking pair)", "candle": "candle-drippings-mound at the focal's foot (1 in 2)"},
   "density": "about 4 props per 100 sq ft"}},

 {"key": "crypt-vault", "label": "Burial vault", "outdoor": False, "cells": [5, 4], "family": FAMILY, "role": "terminal",
  "floors": [F_SLAB] + ex("floor-flagstone-damp", "floor-flagstone-large", "floor-flagstone-broken"),
  "recipes": ["cry-burial-vault", "cry-crypt", "cry-royal-tomb"],
  "focal": ["sarcophagus", "effigy-knight", "stone-coffin-lidless"],
  "reads_as": "sarcophagi in the middle of the floor (one centred, or rows of them), burial-niche wall panels along the long walls, tall candle stands at the tomb's corners",
  "reuse": ["torch-sconce", "torch-bracket-rough", "candlestand-pricket", "candle-tree", "candlestick-floor", "pillar-square", "decal-cobweb"],
  "program": {"closest": "bedroom", "why": "small: one tomb promoted to the centre like the fine-room bed; from about 25 cells it becomes an aisle room (store / dormitory grammar) with 'sarcophagus' as the row item",
   "focal_rule": "under 20 cells: ONE sarcophagus in the centre, long axis along the room's long axis, foot toward the main door. 20 cells and up: rows of sarcophagi, long axis across the room, 4 ft aisles, a 5 ft cross aisle at the door end; mix skus s1/s2/s3 so neighbours differ; the far-end centre tomb is effigy-knight when present (the 'founder')",
   "open_state": "about 1 tomb in 6 is placed OPEN (sarcophagus-open--s1 or --s1--lidoff), never the founder; only sarcophagus--s1 has a matching twin, so an open tomb is always the s1 design",
   "walls": "long walls: swap 1 in 2 plain wall panels for wall-crypt-niches--crypt-stone (s1 empty / s2 wrapped bodies / s3 bones, rolled per panel, never on a door edge and never both sides of a corner). Against the remaining plain wall: coffin (0-3, some stacked two high is NOT supported: single only), stone-coffin-lidless (0-1), bench-stone (0-1), urn-decorative in corners",
   "centre": "the tombs; tomb-slab (mesh) or decal-grave-ledger (flat) in the floor of the cross aisle, 0-2",
   "on_things": "rite-canopic-jars-set at the foot of 1 tomb in 4 (on the floor beside it); skull-single / candle-drippings-mound on a closed lid, 1 in 5",
   "hung": "rite-memorial-plaque on plain panels (1 per 15 ft), rite-death-mask (0-1), burial-urn-niche (0-2)",
   "counts": {"20 cells": "1-2 sarcophagi, 4 niche panels, 2 coffins, 4 candle stands, 2 wall torches, 2 urns", "40 cells": "6 sarcophagi (1 open, 1 effigy), 8 niche panels, 3 coffins, 6 candle stands, 4 wall torches, 2 pillars, 2 ledgers"},
   "lights": {**COMMON_LIGHT, "candle": "rite-pillar-candle-tall (or candlestand-pricket / candle-tree / candlestick-floor) at the head corners of the focal tomb: 2 for one tomb, 2 per row end in an aisle room"},
   "density": "floor coverage 25-30% by tombs in an aisle vault"}},

 {"key": "crypt-ossuary", "label": "Ossuary", "outdoor": False, "cells": [4, 4], "family": FAMILY, "role": "terminal",
  "floors": [F_BONE] + ex("floor-earth-packed", "floor-flagstone-broken", "floor-flagstone-damp"),
  "recipes": ["cry-ossuary", "cry-catacombs"],
  "focal": ["ossuary-shrine", "skull-pile"],
  "reads_as": "the bone shrine on the far wall, walls faced with skulls (ossuary-wall panels), a skull-faced pillar or two and bone troughs along the sides",
  "reuse": ["torch-bracket-rough", "pillar-square", "decal-cobweb"],
  "program": {"closest": "store", "why": "a storeroom of bones: the walls carry the stock, the floor carries heaps and troughs, one axial focal on the far wall",
   "focal_rule": "ossuary-shrine centred on the wall opposite the door (a 'wall' piece, flat back to the wall); if absent, a large skull-pile in the centre",
   "walls": "swap 2 in 3 plain panels for ossuary-wall--crypt-stone (s2, the arched-niche one, at most once per wall); the panel behind the shrine stays plain. catacomb-shelf-bones (s1/s2) against the remaining plain panels, 1-3; charnel-trough along a side wall, 1 per 15 ft",
   "centre": "ossuary-pillar where a support would go (2 from 16 cells, 4 from 30, on a grid, never in the door-shrine line); skull-pile and bones-pile in the corners and at pillar feet (like with like: heaps cluster), 2-5",
   "scatter": "decal-bones-scatter thinly over the floor (flat), never on the door-shrine path",
   "hung": "burial-urn-niche (0-2) on plain panels only",
   "counts": {"16 cells": "1 shrine, 5 ossuary panels, 2 pillars, 1 trough, 1 shelf, 3 heaps, 2 lights", "30 cells": "1 shrine, 9 ossuary panels, 4 pillars, 2 troughs, 3 shelves, 5 heaps, 4 lights"},
   "lights": {"torch": "torch-bracket-rough on plain panels only, 2-4", "candle": "candle-drippings-mound either side of the shrine; skull-candle on troughs and shelves' tops (surface, 1-3); rite-bone-candelabra on the shrine's altar top (surface, 0-1); rite-pillar-candle-tall flanking the shrine in big rooms", "note": COMMON_LIGHT["note"]},
   "density": "about 6 props per 100 sq ft"}},

 {"key": "crypt-catacomb", "label": "Catacomb corridor", "outdoor": False, "cells": [6, 2], "family": FAMILY, "role": "passageway",
  "floors": ex("floor-flagstone-damp", "floor-earth-packed", "floor-flagstone-broken") + [F_BONE],
  "recipes": ["cry-catacomb-corridor", "cry-catacombs"],
  "focal": ["wall-crypt-niches", "catacomb-shelf-bones"],
  "reads_as": "both long walls lined with burial-niche panels, wall torches between them, the odd coffin or bone heap pushed against a wall",
  "reuse": ["torch-sconce", "torch-bracket-rough", "lantern-wall-iron", "decal-cobweb"],
  "program": {"closest": "hallway", "why": "door -> door walking line down the middle, everything else alternates along the long sides",
   "focal_rule": "the key feature is the WALLS: on both long sides swap 2 in 3 plain panels for wall-crypt-niches--crypt-stone (s1/s2/s3 rolled per panel; runs of 2-3 niche panels, then one plain panel that carries the torch)",
   "walls": "against plain panels only, alternating sides to slow the run: catacomb-shelf-bones (1 per 25 ft), coffin on the floor along the wall (0-2), stone-coffin-lidless (0-1), rite-mummified-remains on the floor along the wall (0-1)",
   "centre": "clear 3 ft walking line; skull-pile / bones-pile only in end corners and dead ends (1-3)",
   "scatter": "decal-bones-scatter and decal-moss, thin; decal-cobweb in top corners and across unused doorways",
   "hung": "burial-urn-niche on plain panels (0-2); rite-memorial-plaque beside a niche run (0-2)",
   "counts": {"12 cells (30 ft)": "8 niche panels of 12 long-wall panels, 2-3 wall torches, 1 shelf, 1 coffin, 1 heap", "24 cells (60 ft)": "16 niche panels, 5 wall torches, 2 shelves, 2 coffins, 1 lidless coffin, 2 heaps"},
   "lights": {"torch": "torch-sconce / torch-bracket-rough (or lantern-wall-iron) on the plain panels between niche runs, alternating sides, one every 12-15 ft: darker than other rooms on purpose", "candle": "candle-drippings-mound on the floor under one niche panel (0-2)", "note": COMMON_LIGHT["note"]},
   "density": "about 3 props per 100 sq ft plus the wall panels"}},

 {"key": "crypt-chapel", "label": "Chapel of rest", "outdoor": False, "cells": [4, 5], "family": FAMILY, "role": "terminal",
  "floors": [F_SLAB] + ex("floor-flagstone-square", "floor-flagstone-large", "floor-checker-stone", "floor-flagstone-damp"),
  "recipes": ["cry-chapel-of-rest"],
  "focal": ["altar-stone", "rite-funeral-pall", "rite-funeral-bier"],
  "reads_as": "the altar on the far short wall, a pall-draped coffin on its bier lying in the middle before it with a tall candle at each corner, rows of stone benches facing the altar",
  "reuse": ["candelabra", "candle-tree", "candlestand-pricket", "candlestick-floor", "sconce-candle-single", "torch-sconce", "vase-flowers", "flowers-dried", "pillar-square"],
  "program": {"closest": "common", "why": "no existing program is a chapel; it is an axial focal (the altar, as the hearth on a short wall) plus the aisle grammar with benches as the row item, all facing the focal. A new small 'chapel' program is the honest fit and the castle chapel can share it",
   "focal_rule": "altar-stone centred on the SHORT wall opposite the door, 1.5 ft off the wall. rite-funeral-pall (or the empty rite-funeral-bier, 1 in 4) on the centre line 5-6 ft in front of the altar, long axis on the room's axis: this is the second key feature and is dropped only under 15 cells",
   "rows": "bench-stone (s1/s2; pew when its mesh exists) in two blocks either side of a 4 ft centre aisle, facing the altar, rows 3.5 ft apart, starting 4 ft behind the bier and stopping 4 ft short of the door wall; 1 bench per side per row",
   "flank": "statue-weeping-angel or monument-urn-draped in ONE corner beside the altar (0-1); urn-decorative pair on the altar wall corners; lectern beside the altar on the door-side left when its mesh exists",
   "on_things": "on the altar: rite-altar-cloth (flat) under candelabra x2 at the ends + one of rite-offering-candles-tray / reliquary / tome-holy in the middle; vase-flowers or flowers-dried at the bier's foot",
   "ceiling": "censer-hanging over the bier or rite-sanctuary-lamp over the altar front (one of each at most)",
   "hung": "rite-memorial-plaque along the side walls (2-4); sconce-candle-single between them",
   "counts": {"20 cells": "1 altar, 1 pall/bier, 4 corner candles, 4-6 benches, 1 statue, 1 hanging lamp, 2 plaques, 2 altar candelabra", "36 cells": "1 altar, 1 pall/bier, 4 corner candles, 10 benches, 1 statue, 2 urns, 1 sand tray, censer + lamp, 4 plaques, 4 wall sconces"},
   "lights": {"candle": "rite-pillar-candle-tall (or candlestand-pricket / candle-tree / candlestick-floor) at the FOUR corners of the bier; candelabra on the altar; rite-memorial-sand-tray against a side wall near the door (from 24 cells); sconce-candle-single on side walls", "lantern": "rite-sanctuary-lamp (ceiling)", "torch": "torch-sconce only on the door wall", "note": COMMON_LIGHT["note"] + "; the brightest crypt room, candle-lit"},
   "density": "about 5 props per 100 sq ft"}},

 {"key": "crypt-embalming", "label": "Embalming room", "outdoor": False, "cells": [4, 3], "family": FAMILY, "role": "uses room (staff)",
  "floors": ex("floor-flagstone-damp", "floor-flagstone-square", "floor-flagstone-large", "floor-tile-kitchen-small"),
  "recipes": ["cry-embalming-workroom", "cry-embalming-room"],
  "focal": ["embalming-table", "rite-corpse-on-slab"],
  "reads_as": "the stone table in the middle of the room (empty or with a shrouded body), a salt tub beside it, shelves of jars on one wall and coffins waiting against another",
  "reuse": ["table-kitchen-prep", "shelving-freestanding", "shelf-wall", "washstand", "basin-stone", "bucket", "bucket-slop", "jar-lidded-stoneware", "storage-jar", "oil-jar", "candle", "candlestick", "lantern-hanging", "lantern-wall-iron"],
  "program": {"closest": "kitchen", "why": "a work room: a central work table with standing room all round, a work line of shelves and a prep table on the walls, storage in the corners",
   "focal_rule": "the slab in the centre, long axis along the room's long axis, 3 ft clear on all four sides; rite-corpse-on-slab 2 times in 3, the empty embalming-table otherwise. From 24 cells: a second slab parallel to the first, 5 ft apart, one empty and one occupied",
   "companions": "natron-tub within reach of the slab's foot end (the drain spout end); bucket or bucket-slop under the spout; linen-wrappings-basket by the head end",
   "walls": "one wall = the work line: table-kitchen-prep (carrying rite-embalming-tools, rite-canopic-jars-set, candlestick) + shelving-freestanding x1-2 (jars: rite-canopic-jar, jar-lidded-stoneware, storage-jar, oil-jar; rite-burial-shroud-folded). Opposite wall: coffin x1-2 on the floor, coffin-maker-stack in a corner (from 16 cells), rite-mummified-remains on the floor by the door = finished work (0-1). washstand or basin-stone on the door wall",
   "ceiling": "lantern-hanging over the slab; censer-hanging in a corner (0-1)",
   "hung": "shelf-wall above the prep table; rite-death-mask (0-2) on the wall",
   "counts": {"12 cells": "1 slab, 1 tub, 1 prep table, 1 shelving, 1 coffin, 1 bucket, 1 basket, 6 jars, 2 lights", "24 cells": "2 slabs, 1 tub, 2 prep tables, 2 shelving, 2 coffins + stack, washstand, 12 jars, 4 lights"},
   "lights": {"lantern": "lantern-hanging over the slab (ceiling), lantern-wall-iron on the work-line wall", "candle": "candlestick / candle on the prep table", "note": COMMON_LIGHT["note"]},
   "density": "about 8 props per 100 sq ft"}},

 {"key": "crypt-relic", "label": "Relic chamber", "outdoor": False, "cells": [3, 3], "family": FAMILY, "role": "terminal (the reward room)",
  "floors": ex("floor-flagstone-square", "floor-checker-stone") + [F_SLAB] + ex("floor-flagstone-large", "floor-flagstone-damp"),
  "recipes": ["cry-relic-chamber", "cry-grave-offerings"],
  "focal": ["reliquary-shrine", "pedestal-display", "sarcophagus"],
  "reads_as": "the gold reliquary shrine in the centre (or on the far wall) with a fire bowl each side, treasure against the walls: an open chest of gold, coin heaps, grave goods, urns",
  "reuse": ["chest-ironbound", "chest-plain", "coin-stack", "torch-sconce", "torch-bracket-rough", "brazier-tripod", "candlestand-pricket", "pillar-square"],
  "program": {"closest": "desk", "why": "one axial focal (as the front-desk counter) with a symmetric pair of lights; treasure is edge fill like a storeroom's",
   "focal_rule": "reliquary-shrine centred opposite the door, 2 ft off the far wall (in rooms of 16 cells and up: dead centre). Without it: pedestal-display in the centre carrying reliquary / casket-ornate / reliquary-hand",
   "flank": "rite-sacred-flame-bowl x2 (or brazier-standing / brazier-tripod), one each side of the focal",
   "walls": "chest-treasure in a far corner angled 15-30 degrees toward the door (the reward shot); chest-ironbound / chest-plain along the side walls (1-3); coin-pile and rite-grave-goods-pile beside the chests (like with like); urn-decorative pair on the door wall; pedestal-display x2 on the side walls carrying reliquary-hand, rite-relic-bone-fragment, casket-ornate, urn-ashes-small (from 12 cells); monument-urn-draped in a corner (from 20 cells)",
   "doors": "exactly one door: door-crypt (shut) or crypt-gate-iron (you can see the gold through the bars); a tomb-door-sealed--crypt-stone panel may stand in for a second door",
   "hung": "rite-death-mask (1-2) on the far wall either side of the shrine",
   "counts": {"9 cells": "1 shrine, 2 fire bowls, 1 treasure chest, 1 coin pile, 1 chest, 2 urns", "20 cells": "1 shrine, 2 fire bowls, 1 treasure chest, 2 coin piles, 1 grave goods, 3 chests, 2 pedestals with relics, 2 urns, 1 monument, 2 masks"},
   "lights": {"brazier": "rite-sacred-flame-bowl / brazier-standing / brazier-tripod flanking the focal", "candle": "candlestand-pricket in the door-wall corners (0-2)", "torch": "torch-sconce on the door wall only", "note": COMMON_LIGHT["note"]},
   "density": "about 7 props per 100 sq ft"}},
]

flats = {
 "note": "Flat images wanted for the crypt (free image route; none are meshes). 'status' says whether the catalog line is new in objects-crypt.catalog.md or already existed without an image.",
 "family": FAMILY,
 "flats": [
  {"id": "floor-tomb-slabs", "kind": "floor", "status": "new line", "variants": 4, "rooms": ["crypt-vault", "crypt-chapel", "crypt-antechamber", "crypt-relic"],
   "desc": "Seamless top-down floor of dark, worn tomb paving: big rectangular slate-grey and grey-green slabs in a loose running bond with thin dark joints, edges rounded by centuries of feet, a few slabs cracked. About one slab in six is a carved grave ledger: a slightly paler slab the size of a person (3 ft x 7 ft where it fits the tile, else half-length) with a shallow carved border and one simple emblem (ring-cross, sun-disc, shield, wreath), worn almost flat. NO letters or writing. Damp darkening and a little moss in some joints. Even, shadowless light; tiles on all four edges; reads as stone at table distance, not as a pattern of rectangles."},
  {"id": "floor-bone-strewn", "kind": "floor", "status": "existing line (expansion-environment), no image yet", "variants": 4, "rooms": ["crypt-ossuary", "crypt-catacomb"],
   "desc": "Seamless top-down floor of dark packed grave earth, grey-brown with paler dusty patches, strewn with old bones pressed half into the soil: scattered long bones, ribs, a few vertebrae, a jaw, and here and there a skull seen from above (about one skull per 5-ft tile, never in a regular pattern). Old ivory and tan bone, not white. Sparse enough that the earth is the main read and furniture can stand on it. Even, shadowless light; tiles on all four edges. No blood, no flesh."},
  {"id": "decal-bones-scatter", "kind": "decal", "status": "new line", "variants": 3, "rooms": ["crypt-ossuary", "crypt-catacomb", "crypt-vault"],
   "desc": "Top-down decal on a transparent (keyed) background, about 3 ft x 2.5 ft: a small loose scatter of old bones lying on a floor with a soft contact shadow. Shape 1: a skull, two long bones and a few ribs. Shape 2: a broken ribcage and a pelvis. Shape 3: three long bones, a jaw and finger bones in a rough line. Old ivory and tan. Soft-edged, no ground painted."},
  {"id": "decal-grave-ledger", "kind": "decal", "status": "new line", "variants": 2, "rooms": ["crypt-vault", "crypt-chapel"],
   "desc": "Top-down opaque decal of one grave ledger stone set flush in a floor, 3 ft x 7 ft: a pale grey slab with a carved raised border and a worn emblem. Shape 1: a long-stemmed ring-cross and a small shield at the foot. Shape 2: a sun-disc over a sword laid down the middle. A thin dark joint line round the edge; NO letters. The flat twin of the tomb-slab mesh, for when a walkable marker is wanted."},
  {"id": "decal-moss", "kind": "decal", "status": "existing line (fantasy-core), no image yet", "variants": 3, "rooms": ["crypt-antechamber", "crypt-catacomb", "crypt-ossuary"],
   "desc": "Top-down soft-edged decal on a transparent background: an irregular patch of dark green moss and paler grey-green lichen with a damp darker halo, as it grows along the foot of a wet wall. Three shapes: a long strip for wall feet, a corner fan, a round blotch."},
  {"id": "rite-altar-cloth", "kind": "cloth (surface flat)", "status": "existing line (objects-rites-mil-bard), no image yet", "variants": 1, "rooms": ["crypt-chapel"],
   "desc": "Top-down flat image of an altar cloth, 6 ft x 3 ft: cream linen with a broad burgundy and dull-gold embroidered border and one gold sun-disc in the middle; soft fold lines. Lies on altar-stone. No blue."},
 ]}

# ---- checks
errs = []
for r in rooms:
    for rid in r["recipes"]:
        if rid not in recipes: errs.append(f"{r['key']}: unknown recipe {rid}")
    for i in r["focal"]:
        if i not in roles: errs.append(f"{r['key']}: focal {i} not in catalog")
        elif i not in NEW and i not in HAVE: errs.append(f"{r['key']}: focal {i} has no mesh and is not in this batch")
    for i in r["reuse"]:
        if i not in HAVE: errs.append(f"{r['key']}: reuse {i} has nothing in the library")
    for f in r["floors"]:
        if f["id"] not in roles: errs.append(f"{r['key']}: floor {f['id']} not in catalog")
        if (f["status"] == "exists") != (f["id"] in HAVE): errs.append(f"{r['key']}: floor {f['id']} status {f['status']} disagrees with the library")
    slots = {}
    for rid in r["recipes"]:
        for s, ids in recipes.get(rid, {"slots": {}})["slots"].items(): slots.setdefault(s, []).extend(ids)
    ids = sorted({i for v in slots.values() for i in v if i in roles})
    r["coverage"] = {"have_mesh_or_flat": sorted(i for i in ids if i in HAVE), "in_this_batch": sorted(i for i in ids if i in NEW and i not in HAVE),
                     "still_missing": sorted(i for i in ids if i not in HAVE and i not in NEW)}
for f in flats["flats"]:
    if f["id"] not in roles or roles[f["id"]]["gen"] != "flat": errs.append(f"flat {f['id']} is not a flat catalog line")
if errs: sys.exit("\n".join(errs))
out = {"type": "crypt", "genre": "fantasy", "family": FAMILY, "shell_recipe": "cry-shell",
       "wall_kit": {"straight": ["wall-straight--crypt-stone", "wall-straight--crypt-stone--s2"], "doorway": "wall-doorway--crypt-stone", "window": None,
                    "special_panels": ["wall-crypt-niches--crypt-stone", "wall-crypt-niches--crypt-stone--s2", "wall-crypt-niches--crypt-stone--s3", "ossuary-wall--crypt-stone", "ossuary-wall--crypt-stone--s2", "tomb-door-sealed--crypt-stone"],
                    "corners": "none specified: borrow dressed-stone (FAMILY_FALLBACK crypt-stone -> dressed-stone), as log-cabin borrows rough-timber",
                    "doors": {"default": "door-crypt--leaf", "main": "crypt-gate-iron", "fallback_existing": "door-reinforced--dressed-stone"},
                    "rule": "special panels REPLACE a plain wall-straight panel on a wall edge (they are 'kit edge' pieces 18-24 in thick: keep their room face flush with the plain wall's room face and let the extra thickness go outward); never on an edge that has a door, never used for an exterior corner"},
       "hung_ids": ["burial-urn-niche", "rite-death-mask", "rite-memorial-plaque"],
       "ceiling_ids": ["censer-hanging", "rite-sanctuary-lamp"],
       "lights": {"candle": ["rite-pillar-candle-tall", "rite-memorial-sand-tray", "candle-drippings-mound", "skull-candle", "rite-bone-candelabra", "rite-offering-candles-tray"],
                  "brazier": ["brazier-standing", "rite-sacred-flame-bowl"], "lantern": ["rite-sanctuary-lamp"],
                  "reused": {"torch": ["torch-sconce", "torch-bracket-rough", "torch-stand"], "brazier": ["brazier-tripod"], "candle": ["candlestand-pricket", "candle-tree", "candlestick-floor", "candelabra", "candlestick", "candle", "sconce-candle-single"], "lantern": ["lantern-hanging", "lantern-wall-iron"]}},
       "rooms": rooms}
(HERE / "rooms.json").write_text(json.dumps(out, indent=1) + "\n")
(HERE / "flats.json").write_text(json.dumps(flats, indent=1) + "\n")
reuse = sorted({i for r in rooms for i in r["reuse"]})
allreuse = sorted({i for r in rooms for i in r["coverage"]["have_mesh_or_flat"]})
print(len(rooms), "rooms;", len(flats["flats"]), "flats;", "reused roles named in programs:", len(reuse), "; recipe roles already in the library:", len(allreuse))
for r in rooms: print(f"  {r['key']:18s} have {len(r['coverage']['have_mesh_or_flat']):2d}  batch {len(r['coverage']['in_this_batch']):2d}  missing {r['coverage']['still_missing']}")
