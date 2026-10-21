#!/usr/bin/env python3
"""Apply the Market & village integration to a Spawn Tuner tree (idempotent: run it again after editing the sources here).

    python3 apply_mkt.py [--tree ../../../../tools/spawn-tuner] [--check]

Same three kinds of edit as the castle / crypt / mansion apply.py: appended blocks between `// >>> mkt:<id>` and
`// <<< mkt:<id>` (replaced whole on a second run), an inserted line beside an anchor that must occur once, and one
block of room types in build_data.py between `# >>> mkt:room-types` markers. An anchor that no longer matches stops
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
    t = get(f); a0, a1 = f"{c} >>> mkt:{hid}", f"{c} <<< mkt:{hid}"; block = f"{a0}\n{body.rstrip()}\n{a1}\n"
    if a0 in t: t = re.sub(re.escape(a0) + r".*?" + re.escape(a1) + r"\n", lambda _: block, t, flags=re.S); log.append(f"tail    {f} {hid} (replaced)")
    else: t = t.rstrip("\n") + "\n\n" + block; log.append(f"tail    {f} {hid} (+{block.count(chr(10))} lines)")
    texts[f] = t
def insert(f, hid, anchor, text, where="before"):
    t = get(f)
    if text in t: log.append(f"insert  {f} {hid} (already there)"); return
    if t.count(anchor) != 1: bad.append(f"{hid}: anchor occurs {t.count(anchor)} times in {f}: {anchor[:90]!r}"); return
    texts[f] = t.replace(anchor, text + anchor if where == "before" else anchor + text); log.append(f"insert  {f} {hid}")
# ---- build_data.py
rows = "".join("    " + pprint.pformat(r, width=100000, sort_dicts=False) + ",\n" for r in rt.MKT_ROOM_TYPES)
block = ("    # >>> mkt:room-types\n    # Market & village (2026-10-11): twelve rooms. ONE shop program; a shop's trade is the sku tier it lists first (the shop skeleton:\n"
         "    # experiments/2026-10-11-types/mkt/README.md). The square and the street are outdoor rooms with their own grammar\n" + rows + "    # <<< mkt:room-types\n")
t = get("build_data.py")
if "    # >>> mkt:room-types\n" in t: texts["build_data.py"] = re.sub(r"    # >>> mkt:room-types\n.*?    # <<< mkt:room-types\n", lambda _: block, t, flags=re.S); log.append("block   build_data.py room types (replaced)")
else: insert("build_data.py", "room-types", ']\nSHELL = "any-shell"\n', block)
insert("build_data.py", "batch", "    # a remeshed piece set supersedes the whole-object SKU it was split from (bar-counter pieces)\n", rt.BATCH_BLOCK)
insert("build_data.py", "exclusive", rt.EXCLUSIVE_ANCHOR, rt.EXCLUSIVE_ADD)
# ---- js
insert("js/walls.js", "nolink", "function linkWhy(a, b) {\n", "  if (mktNoLink(a, b)) return null; // market & village: two shop fronts side by side are two businesses (at the end of this file)\n", "after")
insert("js/walls.js", "panel-only", "      if (rule.doorWall === false) {", "      if (rule.only) ok = ok.filter(p => rule.only(p, r, edges)); // market & village: a rule's own filter (the shop window stands only in the street wall)\n")
tail("js/walls.js", "walls", (HERE / "walls_tail.mkt.js").read_text())
tail("js/solver.js", "solver", (HERE / "solver_tail.mkt.js").read_text())
tail("js/solver2.js", "solver2", (HERE / "programs.mkt.js").read_text())
for l in log: print(l)
if bad: print("\nNOT APPLIED:"); [print("  ", b) for b in bad]; sys.exit(1)
if a.check: print("check only"); sys.exit(0)
for f, t in texts.items(): (tree / f).write_text(t)
print(f"applied to {tree}")
