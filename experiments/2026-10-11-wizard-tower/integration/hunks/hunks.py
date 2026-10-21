"""The wizard's tower integration as a list of hunks (see ../apply.py; the method is the castle / crypt / mansion batch's:
experiments/2026-10-05-castle-crypt-mansion/integration/PLAN.md). Paths are relative to tools/spawn-tuner. Tails are
appended between `// >>> wiz:<id>` and `// <<< wiz:<id>`, BELOW the ccm blocks they build on."""
import pprint

def room_type_lines(rows):
    return "".join("    " + pprint.pformat(r, width=100000, sort_dicts=False) + ",\n" for r in rows)

ROOMS_ANCHOR = ']\nSHELL = "any-shell"\n'

def hunks(rt):
    H = []
    add = lambda **k: H.append({"scope": "wizard", **k})
    add(id="data.room-types.wizard", file="build_data.py", kind="before", anchor=ROOMS_ANCHOR,
        text="    # Wizard's tower (2026-10-11): eleven rooms, tower-stone walls (the apothecary shop: half-timber). v2 programs: js/solver2.js (the appended wiz block)\n" + room_type_lines(rt.WIZARD_ROOM_TYPES))
    add(id="data.batch.wizard", file="build_data.py", kind="before",
        anchor="    # a remeshed piece set supersedes the whole-object SKU it was split from (bar-counter pieces)\n", text=rt.BATCH_BLOCK)
    add(id="data.exclusive.wizard", file="build_data.py", kind="replace", old=rt.EXCLUSIVE_OLD, new=rt.EXCLUSIVE_NEW)
    add(id="walls.wizard", file="js/walls.js", kind="tail", src="hunks/walls_tail.wizard.js")
    add(id="solver.wizard", file="js/solver.js", kind="tail", src="hunks/solver_tail.wizard.js")
    add(id="solver2.wizard", file="js/solver2.js", kind="tail", src="programs/40-wizard.js")
    add(id="html.walls.wizard", file="index.html", kind="after", anchor='<option value="noble-interior">panelled plaster</option>', text='<option value="tower-stone">tower stone</option>')
    add(id="fog.wizard", file="data/fog_defaults.json", kind="after", anchor='  "vault": 2.5,\n', text='  "wiz-summoning": 1.5,\n')
    # (prep/ccm_prep.py needs no line since 2026-10-12: its blind prompt falls back to "a fantasy building (a temple, a tower, ...)")
    add(id="fire.wizard", file="js/fx/fire.js", kind="after", anchor="  if (/lantern|lamp/.test(id)) return 'lantern';\n",
        text="  if (/athanor/.test(id)) return 'oven';         // wizard's tower: alch-athanor (the alchemist's brick furnace: a fire behind a stoke hole)\n")
    add(id="fire-anchors.wizard", file="prep/fire_anchors.py", kind="after", anchor="    if re.search(r'lantern|lamp', i): return 'lantern'\n", text="    if 'athanor' in i: return 'oven'\n")
    # prep/flats.py: a LINE-WORK decal (the ritual circle) is keyed everywhere, not only where the blue touches the border, and
    # the two tower medallions fill their plate on purpose: no fade toward the image border (it would eat the outer ring)
    add(id="flats.key.wizard", file="prep/flats.py", kind="replace",
        old="    blue = np.isin(lab, list(edge))\n",
        new="    if not enclosed: blue = np.isin(lab, list(edge))  # (enclosed=True: line work, the wizard's ritual circle: blue between the lines is background too)\n")
    add(id="flats.def.wizard", file="prep/flats.py", kind="replace", old="def key_blue(im):\n", new="def key_blue(im, enclosed=False):\n")
    add(id="flats.call.wizard", file="prep/flats.py", kind="replace",
        old="        rgba, mask = key_blue(im)\n        if job[\"sku\"].startswith((\"rug-hay-scatter\", \"decal-\")):  # floor scatter decals are drawn soft-blended\n            rgba = soften_decal(rgba, mask, blob=job[\"sku\"].startswith(\"decal-dirt\"))\n",
        new="        medallion = job[\"sku\"].startswith((\"decal-ritual-circle\", \"decal-star-floor\"))  # wizard's tower: they fill the plate, edge to edge\n        rgba, mask = key_blue(im, enclosed=job[\"sku\"].startswith(\"decal-ritual-circle\"))\n        if job[\"sku\"].startswith((\"rug-hay-scatter\", \"decal-\")):  # floor scatter decals are drawn soft-blended\n            rgba = soften_decal(rgba, mask, blob=job[\"sku\"].startswith(\"decal-dirt\"), **({\"feather\": 0.001} if medallion else {}))\n")
    add(id="orient.manual.wizard", file="prep/orient_ccm.py", kind="after",
        anchor='    "wall-crypt-niches--crypt-stone--s2": (180, "niches are on the -Z face (measured: relief std 0.35 of the depth on -Z, 0.04 on +Z; blind read front C)"),\n',
        text='    "wall-shop-window--half-timber": (180, "wizard-01: the display bay is on the +Z face (blind read front A) and must look OUT to the street, away from the owner room"),\n')
    return H
