#!/usr/bin/env python3
"""Apply the integration drafts to a Spawn Tuner tree (the sandbox today; tools/spawn-tuner at integration time).

    python3 apply.py --tree sandbox/crypt --scope once,crypt            # apply
    python3 apply.py --tree ../../../tools/spawn-tuner --scope once,crypt --check   # dry run: do all anchors still match?

Every edit is one of three kinds, listed in hunks/hunks.py:
  tail      a block appended at the END of a file between `// >>> wiz:<id>` and `// <<< wiz:<id>` marker lines (re-applying
            replaces the block). Most of the integration is tails: the registries in walls.js / solver.js / solver2.js
            are mutable module-level tables, so new room types can register themselves below everyone else's code.
  insert    one or two lines put before / after an ANCHOR line that must occur exactly once in the file.
  replace   an exact line swapped for another (the few places where an existing line has to change).
An anchor that no longer matches exactly once (someone edited that line) stops the run before anything is written.
Scopes: `once` = type-independent machinery, then `crypt`, `castle`, `mansion`, `vertical`.
"""
import argparse, importlib.util, pathlib, pprint, re, sys
HERE = pathlib.Path(__file__).resolve().parent

def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--tree", required=True, type=pathlib.Path); ap.add_argument("--scope", default="wizard")
    ap.add_argument("--check", action="store_true"); ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args(); tree = a.tree.resolve(); scopes = a.scope.split(",")
    H = load(HERE / "hunks/hunks.py", "hunks").hunks(load(HERE / "room_types.py", "room_types"))
    todo = [h for h in H if h["scope"] in scopes]
    texts, log, bad = {}, [], []
    def get(f):
        if f not in texts: texts[f] = (tree / f).read_text()
        return texts[f]
    for h in todo:
        f = h["file"]
        if not (tree / f).exists(): bad.append(f"{h['id']}: no file {f}"); continue
        t = get(f)
        if h["kind"] == "tail":
            body = (HERE / h["src"]).read_text() if "src" in h else h["text"]
            c = h.get("comment", "//"); a0, a1 = f"{c} >>> wiz:{h['id']}", f"{c} <<< wiz:{h['id']}"
            block = f"{a0}\n{body.rstrip()}\n{a1}\n"
            if a0 in t: t = re.sub(re.escape(a0) + r".*?" + re.escape(a1) + r"\n", lambda _: block, t, flags=re.S); log.append(f"tail    {f}  {h['id']}  (replaced)")
            else: t = t.rstrip("\n") + "\n\n" + block; log.append(f"tail    {f}  {h['id']}  (+{block.count(chr(10))} lines)")
        elif h["kind"] in ("before", "after"):
            if h["text"] in t: log.append(f"insert  {f}  {h['id']}  (already there)"); texts[f] = t; continue
            n = t.count(h["anchor"])
            if n != 1: bad.append(f"{h['id']}: anchor occurs {n} times in {f}: {h['anchor'][:90]!r}"); continue
            t = t.replace(h["anchor"], h["text"] + h["anchor"] if h["kind"] == "before" else h["anchor"] + h["text"]); log.append(f"insert  {f}  {h['id']}  (+{h['text'].count(chr(10))} lines)")
        elif h["kind"] == "replace":
            if h["new"] in t and h["old"] not in t: log.append(f"replace {f}  {h['id']}  (already there)"); texts[f] = t; continue
            n = t.count(h["old"])
            if n != 1: bad.append(f"{h['id']}: line to replace occurs {n} times in {f}: {h['old'][:90]!r}"); continue
            t = t.replace(h["old"], h["new"]); log.append(f"replace {f}  {h['id']}")
        texts[f] = t
    if not a.quiet:
        for l in log: print(l)
    if bad:
        print("\nNOT APPLIED, anchors that do not match:"); [print("  ", b) for b in bad]; sys.exit(1)
    if a.check: print(f"check only: {len(todo)} hunks in {len(texts)} files would apply cleanly"); return
    for f, t in texts.items(): (tree / f).write_text(t)
    print(f"applied {len(todo)} hunks to {len(texts)} files under {tree}")

if __name__ == "__main__":
    main()
