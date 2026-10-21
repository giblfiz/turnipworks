#!/usr/bin/env python3
"""Apply the Smithy & workshop integration to a Spawn Tuner tree (idempotent: run it again after editing the sources here).

    python3 apply_smi.py [--tree ../../../../tools/spawn-tuner] [--check]

Same three kinds of edit as the castle / crypt / mansion apply.py: appended blocks between `// >>> smi:<id>` and
`// <<< smi:<id>` (replaced whole on a second run), an inserted line beside an anchor that must occur once, and one
block of room types in build_data.py between `# >>> smi:room-types` markers. An anchor that no longer matches stops
the run before anything is written."""
import argparse, pathlib, pprint, re, sys, importlib.util
HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("rt", HERE / "room_types.py"); rt = importlib.util.module_from_spec(spec); spec.loader.exec_module(rt)
ap = argparse.ArgumentParser(); ap.add_argument("--tree", type=pathlib.Path, default=HERE.parents[3] / "tools/spawn-tuner"); ap.add_argument("--check", action="store_true")
a = ap.parse_args(); tree = a.tree.resolve(); texts, log, bad = {}, [], []
def get(f):
    if f not in texts: texts[f] = (tree / f).read_text()
    return texts[f]
def tail(f, hid, body, c="//"):
    t = get(f); a0, a1 = f"{c} >>> smi:{hid}", f"{c} <<< smi:{hid}"; block = f"{a0}\n{body.rstrip()}\n{a1}\n"
    if a0 in t: t = re.sub(re.escape(a0) + r".*?" + re.escape(a1) + r"\n", lambda _: block, t, flags=re.S); log.append(f"tail    {f} {hid} (replaced)")
    else: t = t.rstrip("\n") + "\n\n" + block; log.append(f"tail    {f} {hid} (+{block.count(chr(10))} lines)")
    texts[f] = t
def insert(f, hid, anchor, text, where="before"):
    t = get(f)
    if text in t: log.append(f"insert  {f} {hid} (already there)"); return
    if t.count(anchor) != 1: bad.append(f"{hid}: anchor occurs {t.count(anchor)} times in {f}: {anchor[:90]!r}"); return
    texts[f] = t.replace(anchor, text if where == "replace" else text + anchor if where == "before" else anchor + text); log.append(f"insert  {f} {hid}")
# ---- build_data.py
rows = "".join("    " + pprint.pformat(r, width=100000, sort_dicts=False) + ",\n" for r in rt.SMI_ROOM_TYPES)
block = ("    # >>> smi:room-types\n    # Smithy & workshop (2026-10-11): nine rooms. ONE workshop program; the craft is a line of data (the workshop skeleton:\n"
         "    # experiments/2026-10-11-types/smi/README.md, js/solver2.js SMI_CRAFTS). The yard is an outdoor room with its own grammar\n" + rows + "    # <<< smi:room-types\n")
t = get("build_data.py")
if "    # >>> smi:room-types\n" in t: texts["build_data.py"] = re.sub(r"    # >>> smi:room-types\n.*?    # <<< smi:room-types\n", lambda _: block, t, flags=re.S); log.append("block   build_data.py room types (replaced)")
else: insert("build_data.py", "room-types", ']\nSHELL = "any-shell"\n', block)
insert("build_data.py", "batch", "    # a remeshed piece set supersedes the whole-object SKU it was split from (bar-counter pieces)\n", rt.BATCH_BLOCK)
insert("build_data.py", "exclusive", rt.EXCLUSIVE_OLD, rt.EXCLUSIVE_ADD)
# ---- js
insert("js/fx/fire.js", "fire", "  return null;\n}\n// small-flame offsets", "  if (/^forge$/.test(id)) return 'brazier';      // smithy: the forge's coal bed, an open fire on a waist-high hearth (type:smi)\n  if (/^kiln-/.test(id)) return 'oven';           // smithy: the potter's kiln, a fire behind its stoke hole (type:smi)\n")
insert("js/buildings.js", "building", "  // TYPES ARRIVING (their rooms land on other branches today)", """  // smithy & workshop (type:smi): the FORGE is the hub and stands open to the street (a smithy's wide door; the stair core and the doors to the
  // other rooms take its back wall, so the forge itself goes on a side wall); the shop front is beside it at the street (as the inn's front desk
  // is: the shop skeleton needs its back wall for the counter); the store opens off the forge; the other workshops behind and in the wing as the
  // plot grows; the smith lives above. The yard (shoeing stocks, hitching rail) is at the back
  SMI: { label: 'Smithy & workshop', full: 60, dials: { loops: 0, pacing: 0, carved: 0 }, storeys: { def: 2, min: 1, max: 2, why: 'the works below, the smith and his household above' },
    hub: { key: 'smi-forge', w: [4, 5, 7], d: [4, 4, 6], share: 0.3 }, hall: 'smi-passage', spare: 'smi-stock', small: 'smi-stock',
    rooms: [
      { key: 'smi-shopfront', floor: 'g', zone: 'side', touch: 'hub', w: [4, 4, 5], from: 50, one: true },
      { key: 'smi-stock', floor: 'g', zone: 'back', touch: 'hub', w: [2, 3, 4], need: true, one: true },
      { key: 'smi-armoury', floor: 'g', zone: 'back', w: [4, 5, 6], from: 70, yard: true },
      { key: 'smi-carpenter', floor: 'g', zone: 'back', w: [4, 5, 6], from: 100, yard: true },
      { key: 'smi-potter', floor: 'g', zone: 'wing', w: [4, 5, 6], from: 140, yard: true },
      { key: 'smi-quarters', floor: 'u', fill: true, w: [3, 4, 5], priv: true },
    ],
    out: [{ key: 'smi-yard', side: 'back', depth: 5, from: 40 }] },
""")
_b = get("buildings/bench.js")   # the bench's list of type codes: one more at its end, whatever landed before
if "'SMI'" not in _b:
    _m = re.search(r"const CODES = \[[^\]]*", _b)
    if _m: texts["buildings/bench.js"] = _b[:_m.end()] + ", 'SMI'" + _b[_m.end():]; log.append("insert  buildings/bench.js bench-code")
    else: bad.append("bench-code: no `const CODES = [` in buildings/bench.js")
tail("js/walls.js", "walls", (HERE / "walls_tail.smi.js").read_text())
tail("js/solver.js", "solver", (HERE / "solver_tail.smi.js").read_text())
tail("js/solver2.js", "solver2", (HERE / "programs.smi.js").read_text())
for l in log: print(l)
if bad: print("\nNOT APPLIED:"); [print("  ", b) for b in bad]; sys.exit(1)
if a.check: print("check only"); sys.exit(0)
for f, t in texts.items(): (tree / f).write_text(t)
print(f"applied to {tree}")
