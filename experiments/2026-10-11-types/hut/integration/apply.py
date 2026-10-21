#!/usr/bin/env python3
"""Put solver2_tail.js into a tuner tree's js/solver2.js: replaces the `// >>> type:hut` ... `// <<< type:hut` block, or appends it.
    python3 apply.py [tuner dir]      (default: this worktree's tools/spawn-tuner)"""
import pathlib, re, sys
HERE = pathlib.Path(__file__).resolve().parent
T = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parents[3] / "tools/spawn-tuner"
tail = (HERE / "solver2_tail.js").read_text().rstrip("\n") + "\n"
p = T / "js/solver2.js"; s = p.read_text()
pat = re.compile(r"// >>> type:hut\n.*?// <<< type:hut\n", re.S)
s = pat.sub(lambda m: tail, s) if pat.search(s) else s.rstrip("\n") + "\n\n" + tail
p.write_text(s); print("solver2.js: type:hut block", len(tail.splitlines()), "lines")
wt = (HERE / "walls_tail.js").read_text().rstrip("\n") + "\n"; p = T / "js/walls.js"; s = p.read_text()
s = pat.sub(lambda m: wt, s) if pat.search(s) else s.rstrip("\n") + "\n\n" + wt
p.write_text(s); print("walls.js: type:hut block", len(wt.splitlines()), "lines")
ih = T / "index.html"; s = ih.read_text()
if "wattle-daub" not in s:
    a = '<option value="half-timber">half-timber</option>'; assert s.count(a) == 1; ih.write_text(s.replace(a, a + '<option value="wattle-daub">wattle and daub</option>')); print("index.html: Walls select has wattle and daub")
