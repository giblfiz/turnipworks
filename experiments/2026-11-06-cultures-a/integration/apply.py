#!/usr/bin/env python3
"""Apply the culture packs' integration to the tree (idempotent: run it again after editing the sources here).

    python3 integration/apply.py jpn [chn ind] [--check]

Edits, all marked: appended blocks between `// >>> <id>` and `// <<< <id>` (replaced whole on a second run) in
tools/spawn-tuner/js/walls.js and js/solver2.js (the shared `ca:solver2` skeleton once, then one block per culture), and
one-line hooks beside an anchor that must occur once (build_data.py: the import, the room types, the batch, the
exclusive tiers; core/height.js: the roofs; client/pack.js: rooms never packed as cells; engine/tools/build_types.py:
the genre `cultures`, the labels and the order). An anchor that no longer matches stops the run before anything is written.
Every culture's data lives in its own files (tools/spawn-tuner/cultures_a.py, catalog/objects-<culture>.catalog.md,
catalog/rooms-<culture>.md, this folder): the hooks only read them."""
import argparse, re, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ap = argparse.ArgumentParser(); ap.add_argument("codes", nargs="+"); ap.add_argument("--check", action="store_true")
a = ap.parse_args()
texts, log, bad = {}, [], []
def get(f):
    if f not in texts: texts[f] = (ROOT / f).read_text()
    return texts[f]
def tail(f, hid, body, c="//"):
    t = get(f); a0, a1 = f"{c} >>> {hid}", f"{c} <<< {hid}"; block = f"{a0}\n{body.rstrip()}\n{a1}\n"
    if a0 in t: t = re.sub(re.escape(a0) + r"\n.*?" + re.escape(a1) + r"\n", lambda _: block, t, flags=re.S); log.append(f"tail    {f} {hid} (replaced)")
    else: t = t.rstrip("\n") + "\n\n" + block; log.append(f"tail    {f} {hid} (+{block.count(chr(10))} lines)")
    texts[f] = t
def insert(f, hid, anchor, text, where="after"):
    t = get(f)
    if text.strip() in t: log.append(f"insert  {f} {hid} (already there)"); return
    if t.count(anchor) != 1: bad.append(f"{hid}: anchor occurs {t.count(anchor)} times in {f}: {anchor[:90]!r}"); return
    texts[f] = t.replace(anchor, text + anchor if where == "before" else anchor + text); log.append(f"insert  {f} {hid}")

BD = "tools/spawn-tuner/build_data.py"
insert(BD, "import", "from factions import faction_data, add_faction_assets\n", "from cultures_a import CULTURE_ROOM_TYPES, CULTURE_TIERS, add_cultures_a  # culture packs A: Japan, China, India (2026-11-06)\n")
insert(BD, "room-types", 'SHELL = "any-shell"\n', "ROOM_TYPES += CULTURE_ROOM_TYPES  # culture packs A (cultures_a.py): Japan, China, India\n", where="before")
insert(BD, "batch", "    add_faction_assets(skus, ROOT, mesh_id)\n", "    add_cultures_a(skus, ROOT, load_manifest)  # culture packs A: their meshes and flats (cultures_a.py)\n")
insert(BD, "exclusive", '    EXCLUSIVE |= {"lai"}  # type:lai (Monster lair, 2026-10-12)\n', "    EXCLUSIVE |= CULTURE_TIERS  # culture packs A: jpn, chn, ind (every mesh but the wall kit)\n")
# js: the shared skeleton once, then each culture's blocks
tail("tools/spawn-tuner/js/solver2.js", "ca:solver2", (HERE / "ca.solver2.js").read_text())
for c in a.codes:
    tail("tools/spawn-tuner/js/walls.js", f"{c}:walls", (HERE / f"{c}.walls.js").read_text())
    tail("tools/spawn-tuner/js/solver2.js", f"{c}:solver2", (HERE / f"{c}.solver2.js").read_text())
# roofs (core/height.js): by wall family, and the room types whose roof does not follow it
ROOFS = {"jpn": ("ROOF_BY_FAMILY['jpn-shoji'] = 'slate'; ROOF_BY_FAMILY['jpn-shrine'] = 'shingle'; ROOF_BY_TYPE['jpn-teahouse'] = 'shingle'; // jpn: grey tile on the house (slate until a kawara style exists), cypress-bark-like shingle on the shrine and the tea house\n"),
         "chn": ("ROOF_BY_FAMILY['chn-brick'] = 'slate'; ROOF_BY_FAMILY['chn-temple'] = 'slate'; // chn: grey tile (slate until a tongwa style exists)\n"),
         "ind": ("ROOF_BY_FAMILY['ind-lime'] = 'plaster'; ROOF_BY_FAMILY['ind-sandstone'] = 'flagstone'; ROOF_BY_FAMILY['ind-temple'] = 'flagstone'; // ind: flat terraces (lime on the haveli and bazaar, stone on palace and temple)\n")}
for c in a.codes:
    insert("engine/core/height.js", f"roof-{c}", "ROOF_BY_TYPE.cathedral = 'slate';", ROOFS[c], where="before")
# client/pack.js: outdoor rooms are open ground beside a building, never packed as one of its cells
APART = {"jpn": ["jpn-shrine-court", "jpn-garden", "jpn-shrine", "jpn-dojo", "jpn-teahouse"], "chn": ["chn-market", "chn-courtyard", "chn-temple", "chn-teahouse"], "ind": ["ind-haveli", "ind-stepwell", "ind-mandapa", "ind-durbar"]}  # a dragged building packs the house (and its shop); the shrine, the temple, the tea house, the dojo and the grounds are drawn on their own
for c in a.codes:
    insert("engine/client/pack.js", f"apart-{c}", "\nexport function packRooms(rect, rooms) {",
           f"\nfor (const k of {APART[c]!r}) APART.add(k); // {c}: the grounds and the buildings that stand alone (culture packs A) are drawn, never packed as cells of a house".replace('"', "'"), where="before")
# engine/client/library-index.js: a culture's new kit pieces are placeable by hand (the fences of its grounds)
HANDKIT = {"jpn": "HAND_KIT.push('fence-bamboo'); // culture packs A (jpn): the tea garden's bamboo fence, a hand kit piece like the wattle fence\n"}
for c in a.codes:
    if c in HANDKIT:
        L = [l for l in get("engine/client/library-index.js").split("\n") if l.startswith("export const HAND_KIT = [")]
        if len(L) == 1: insert("engine/client/library-index.js", f"handkit-{c}", L[0] + "\n", HANDKIT[c])
        else: bad.append("handkit: no single `export const HAND_KIT = [` line in engine/client/library-index.js")
# tools/test_matrix.json: the culture rooms' suite (after the farmstead's)
HUT = '      "suite": "tools/spawn-tuner/test/hut.test.mjs",\n      "command": [\n        "node",\n        "tools/spawn-tuner/test/hut.test.mjs",\n        "tools/spawn-tuner"\n      ],\n      "asserting": true\n    },\n'
insert("tools/test_matrix.json", "suite", HUT, '    {\n      "suite": "tools/spawn-tuner/test/cultures.test.mjs",\n      "command": [\n        "node",\n        "tools/spawn-tuner/test/cultures.test.mjs",\n        "tools/spawn-tuner"\n      ],\n      "asserting": true,\n      "timeout": 1800\n    },\n')
# docs: the rules in words (tools/spawn-tuner/ROOMS.md) and what is still wanted (docs/ASSETS_TO_BUILD.md), one section per culture
def tail_md(f, hid, body):
    t = get(f); a0, a1 = f"<!-- >>> {hid} -->", f"<!-- <<< {hid} -->"; block = f"{a0}\n{body.rstrip()}\n{a1}\n"
    if a0 in t: t = re.sub(re.escape(a0) + r"\n.*?" + re.escape(a1) + r"\n", lambda _: block, t, flags=re.S); log.append(f"tail    {f} {hid} (replaced)")
    else: t = t.rstrip("\n") + "\n\n" + block; log.append(f"tail    {f} {hid} (+{block.count(chr(10))} lines)")
    texts[f] = t
for c in a.codes:
    for f, part in (("tools/spawn-tuner/ROOMS.md", "rooms"), ("docs/ASSETS_TO_BUILD.md", "assets")):
        src = HERE / f"{c}.{part}.md"
        if src.exists(): tail_md(f, f"{c}:{part}", src.read_text())
# js/fx/fire.js: which culture pieces the game lights (a name with lamp/lantern in it already is)
FIRE = {"jpn": "  if (/^jpn-(andon|toro)$/.test(id)) return 'lantern'; // culture packs A: the paper floor lamp and the stone lantern (jpn)\n"}
for c in a.codes:
    if c in FIRE: insert("tools/spawn-tuner/js/fx/fire.js", f"fire-{c}", "  return null;\n}\n// small-flame offsets", FIRE[c], where="before")
# engine/tools/build_types.py: the genre `cultures` (shared with cultures-b: GENRE_OF), labels and menu order
BT = "engine/tools/build_types.py"
if "'key': 'cultures'" in get(BT): pass  # (cultures-b landed the genre first, 2026-11-07: nothing to add)
elif "GENRE_OF =" in get(BT):  # (the sprawl pack brought GENRE_OF and GENRES first, 2026-11-07: the genre joins its list)
    insert(BT, "genre-cultures", "LINE = re.compile(", "GENRES.append({'key': 'cultures', 'label': 'Cultures'})  # culture packs (2026-11-06): cultures-a and cultures-b\n", where="before")
else: insert(BT, "genre-of", "LINE = re.compile(", "GENRE_OF = {}  # a setting code -> its Build tray genre (default fantasy); culture packs (2026-11-06) are genre `cultures`\nGENRES = [{'key': 'fantasy', 'label': 'Fantasy'}, {'key': 'cultures', 'label': 'Cultures'}]\n", where="before")
for c in a.codes:
    C = c.upper(); L = {"jpn": "Japan", "chn": "China", "ind": "India"}[c]
    insert(BT, f"label-{c}", "LINE = re.compile(", f"LABELS['{C}'] = '{L}'; GENRE_OF['{C}'] = 'cultures'  # culture packs A\n", where="before")
t = get(BT)
t2 = t.replace("out.append({'code': code, 'genre': 'fantasy',", "out.append({'code': code, 'genre': GENRE_OF.get(code, 'fantasy'),")
t2 = t2.replace("write(dst, {'genres': [{'key': 'fantasy', 'label': 'Fantasy'}], 'types': out})", "write(dst, {'genres': [g for g in GENRES if any(t['genre'] == g['key'] for t in out)], 'types': out})")
if t2 != t: texts[BT] = t2; log.append(f"replace {BT} genre (2 lines)")
for c in a.codes:
    t = get(BT); C = c.upper()
    if f"'{C}'" not in t[t.index("order = ["):t.index("]", t.index("order = ["))]:
        i = t.index("]", t.index("order = [")); texts[BT] = t[:i] + f", '{C}'" + t[i:]; log.append(f"insert  {BT} order {C}")
for l in log: print(l)
if bad: print("\nNOT APPLIED:"); [print("  ", b) for b in bad]; sys.exit(1)
if a.check: print("check only"); sys.exit(0)
for f, t in texts.items(): (ROOT / f).write_text(t)
print("applied")
