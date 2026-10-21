#!/usr/bin/env python3
"""Apply the temple & chapel integration to a repo tree (the worktree, a sandbox copy, or main at landing).
    python3 apply.py --root /path/to/repo [--check]
The same three kinds of edit as experiments/2026-10-05-castle-crypt-mansion/integration/apply.py: a tail block appended
between `// >>> tem:<id>` markers (re-applying replaces it), an insert next to an anchor that must occur exactly once,
a replaced line. Nothing is written if any anchor fails. Paths are relative to the repo root."""
import argparse, pathlib, pprint, re, sys, importlib.util
HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("room_types", HERE / "room_types.py"); rt = importlib.util.module_from_spec(spec); spec.loader.exec_module(rt)
T = "tools/spawn-tuner/"
rows = "    # Temple & chapel (2026-10-11): ten rooms, temple-stone walls; `flavors` = which flavor slots dress the room (js/solver2.js, the tem block)\n" + "".join("    " + pprint.pformat(r, width=100000, sort_dicts=False) + ",\n" for r in rt.TEMPLE_ROOM_TYPES)
H = [
    dict(id="data.batch", file=T + "build_data.py", kind="before", anchor="    # a remeshed piece set supersedes the whole-object SKU it was split from (bar-counter pieces)\n", text=rt.BATCH_BLOCK),
    dict(id="data.room-types", file=T + "build_data.py", kind="before", anchor=']\nSHELL = "any-shell"\n', text=rows),
    dict(id="data.exclusive", file=T + "build_data.py", kind="after", anchor='    EXCLUSIVE = {"crypt", "castle", "noble", "storey", "ccm"}  # sku tiers rolled only by room types that list them in `tiers` (the batch block above)\n',
         text='    EXCLUSIVE |= {"temple"}  # temple & chapel (2026-10-11)\n'),
    dict(id="walls", file=T + "js/walls.js", kind="tail", src="walls-tem.js"),
    dict(id="solver", file=T + "js/solver.js", kind="tail", src="solver-tem.js"),
    dict(id="solver2", file=T + "js/solver2.js", kind="tail", src="programs-tem.js"),
    dict(id="html.walls", file=T + "index.html", kind="after", anchor='<option value="noble-interior">panelled plaster</option>', text='<option value="temple-stone">temple stone</option>'),
    dict(id="main.flavor", file=T + "js/main.js", kind="replace",  # (the cult branch's exact line: types:flavor)
         old="function solverOpts() { return { orient, minStars: +$('#minStars').value, hideMasking: $('#hideMasking').checked, scaleVariety: +$('#variety').value, sizeRule: $('#sizeRule').value }; }\n",
         new="function solverOpts() { return { orient, minStars: +$('#minStars').value, hideMasking: $('#hideMasking').checked, scaleVariety: +$('#variety').value, sizeRule: $('#sizeRule').value, ...(qs.get('flavor') && { flavor: qs.get('flavor') }) }; } // (?flavor=spiders: the flavor of every religious room, solver2.js types:flavor)\n"),
    dict(id="fire.censer", file=T + "js/fx/fire.js", kind="after", anchor="  if (/sand-tray/.test(id)) return 'stubs';      // crypt: rite-memorial-sand-tray (a tray of thin candles)\n",
         text="  if (/^flavor-censer/.test(id)) return 'candle'; // flavor slots: the standing candle-holder of a sanctum or temple (types:flavor)\n"),
    dict(id="fire-anchors.censer", file=T + "prep/fire_anchors.py", kind="after", anchor="    if 'sand-tray' in i: return 'stubs'\n", text="    if i.startswith('flavor-censer'): return 'candle'\n"),
    dict(id="roof", file="engine/core/height.js", kind="replace",
         old="export const ROOF_DEFAULT = 'thatch';\n", new="ROOF_BY_FAMILY['temple-stone'] = 'slate'; // temple & chapel (2026-10-11)\nexport const ROOF_DEFAULT = 'thatch';\n"),
]
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--root", required=True, type=pathlib.Path); ap.add_argument("--check", action="store_true"); a = ap.parse_args()
    texts, log, bad = {}, [], []
    for h in H:
        f = h["file"]; t = texts.get(f) if f in texts else (a.root / f).read_text()
        if h["kind"] == "tail":
            body = (HERE / h["src"]).read_text(); a0, a1 = f"// >>> tem:{h['id']}", f"// <<< tem:{h['id']}"; block = f"{a0}\n{body.rstrip()}\n{a1}\n"
            if a0 in t: t = re.sub(re.escape(a0) + r".*?" + re.escape(a1) + r"\n", lambda _: block, t, flags=re.S); log.append(f"tail    {f} (replaced)")
            else: t = t.rstrip("\n") + "\n\n" + block; log.append(f"tail    {f} (+{block.count(chr(10))} lines)")
        elif h["kind"] in ("before", "after"):
            m = re.search(r"    # >>> tem:" + re.escape(h["id"]) + r"\n.*?    # <<< tem:" + re.escape(h["id"]) + r"\n", t, flags=re.S) if ">>> tem:" in h["text"] else None
            if m: t = t.replace(m.group(0), h["text"]); log.append(f"insert  {f} {h['id']} (replaced)")
            elif h["text"] in t: log.append(f"insert  {f} {h['id']} (already there)")
            elif h["id"] == "data.room-types" and "'key': 'temple-nave'" in t: bad.append(f"{h['id']}: room types already there but changed: edit build_data.py by hand")
            elif t.count(h["anchor"]) != 1: bad.append(f"{h['id']}: anchor occurs {t.count(h['anchor'])} times in {f}")
            else: t = t.replace(h["anchor"], h["text"] + h["anchor"] if h["kind"] == "before" else h["anchor"] + h["text"]); log.append(f"insert  {f} {h['id']}")
        else:
            if h["new"] in t: log.append(f"replace {f} {h['id']} (already there)")
            elif t.count(h["old"]) != 1: bad.append(f"{h['id']}: line to replace occurs {t.count(h['old'])} times in {f}")
            else: t = t.replace(h["old"], h["new"]); log.append(f"replace {f} {h['id']}")
        texts[f] = t
    print("\n".join(log))
    if bad: print("NOT APPLIED:", *bad, sep="\n  "); sys.exit(1)
    if a.check: print("check only"); return
    for f, t in texts.items(): (a.root / f).write_text(t)
    print(f"applied to {len(texts)} files under {a.root}")
main()
