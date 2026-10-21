#!/usr/bin/env python3
"""The hut-01 batch block for tools/spawn-tuner/build_data.py (the run manifest and the flats folder), by the dungeon's rules.
Replaces `# >>> type:hut-batch` ... `# <<< type:hut-batch`, or inserts it before "# a remeshed piece set supersedes"; adds the
exclusive tier line.     python3 build_batch.py [tuner dir]"""
import pathlib, re, sys
HERE = pathlib.Path(__file__).resolve().parent
T = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parents[3] / "tools/spawn-tuner"
BLOCK = '''    # >>> type:hut-batch
    # Farmstead (2026-10-12): one run folder (hut-01) and its flats, by the castle / crypt / mansion / dungeon rules: a sku name
    # that exists is never replaced; every farm mesh but the wall kit carries the exclusive tier `hut` (older rooms' recipes name
    # some of these roles: the mansion's garden asks for a bee skep and a dovecote, and a room must not gain a thing by this
    # batch: test/golden.mjs). A room type of another kind takes them by adding 'hut' to its `tiers`.
    HUT = ROOT / "experiments/2026-10-11-types/hut"
    for path in sorted((HUT / "flats/seamless").glob("*.png")):
        if path.stem not in skus:
            obj, _, var = path.stem.partition("--")
            skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "", "shape": var or "v1", "src": "hut-flats-01", "plate": path, "piece": "", "opaque": True}
    hut_manifest = ROOT / "catalog/runs/hut-01/manifest.tsv"
    hut_skipped = []
    for row in (load_manifest(hut_manifest) if hut_manifest.exists() else []):
        glb = HUT / "models" / f"{row['source']}.glb"
        if not glb.exists():
            continue
        if row["sku"] in skus:
            hut_skipped.append(row["sku"])
            continue
        row = dict(row)
        if row["family"] != "wattle-daub":
            row["tier"] = "hut"
        flags = set(filter(None, (row.get("flags") or "").split(",")))
        skus[row["sku"]] = {**row, "src": "hut-01", "glb": glb, "piece": "", "hung": "hung" in flags, "fit": "box" if row.get("gen") == "kit" and row.get("size") and row["place"] != "kit" else "",
                            **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
    if hut_skipped:
        print(f"farmstead: {len(hut_skipped)} sku names already in the library, NOT replaced: {', '.join(hut_skipped[:8])}")
    # <<< type:hut-batch
'''
EXCL = '    EXCLUSIVE |= {"hut"}  # type:hut (Farmstead, 2026-10-12)\n'
p = T / "build_data.py"; s = p.read_text(); pat = re.compile(r"    # >>> type:hut-batch\n.*?    # <<< type:hut-batch\n", re.S); anchor = "    # a remeshed piece set supersedes"
if pat.search(s): s = pat.sub(lambda m: BLOCK, s)
else: assert s.count(anchor) == 1; s = s.replace(anchor, BLOCK + anchor)
if EXCL not in s:
    m = re.search(r"    EXCLUSIVE = \{[^\n]*\n(    EXCLUSIVE \|= [^\n]*\n)*", s); assert m; s = s[:m.end()] + EXCL + s[m.end():]
p.write_text(s); print("build_data.py: type:hut-batch block and the exclusive tier")
