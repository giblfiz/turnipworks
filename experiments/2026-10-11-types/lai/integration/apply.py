#!/usr/bin/env python3
"""Apply the monster lair's integration to a Spawn Tuner tree. Append-only, as the castle / crypt / mansion path
(experiments/2026-10-05-castle-crypt-mansion/integration/PLAN.md) and the dungeon's marked blocks: every edit is a
`>>> type:lai` ... `<<< type:lai` block, replaced whole on a second run, so hand corrections go into THIS folder
(programs.js, walls_tail.js, room_types.py) and are applied again.
    python3 apply.py --tree tools/spawn-tuner [--check]
  js/solver2.js      programs.js appended                 js/walls.js    walls_tail.js appended
  build_data.py      the ROOM_TYPES entries, before the list's closing bracket
  test/lai.test.mjs  copied from tests/
  build_data.py      the lair's derived flats (decal-scorch), before `remeshed = 0`
No other line of any shared file changes (no new wall family of its own, so no index.html option; no new meshes, so no
manifest block and no exclusive tier).
"""
import argparse, pathlib, re, sys, json
HERE = pathlib.Path(__file__).resolve().parent
BLOCK = re.compile(r"\n?(?:[ \t]*(?://|#) >>> type:lai\b.*?(?://|#) <<< type:lai[^\n]*\n)", re.S)

FLATS = """    # >>> type:lai
    # Monster lair: one run folder (lai-01: the signature meshes, 2026-10-12) and its flats, by the dungeon's and the mine's rules:
    # a sku name that exists is never replaced; EVERY lair mesh carries the exclusive tier `lai` (rolled only by room types
    # that list it), so no older room gains a thing by this batch. Its two flats are DERIVED from our own plates
    # (experiments/2026-10-11-types/lai/tools/derive_flats.py): decal-scorch and giant-web-floor, roles that had no image; they carry the tier too (the mine's smelter
    # names decal-scorch in a recipe: test/golden.mjs caught it gaining one).
    LAI = ROOT / "experiments/2026-10-11-types/lai"
    for path in sorted((LAI / "flats/decals").glob("*.jpg")):
        if path.stem not in skus:
            obj, _, var = path.stem.partition("--")
            skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "lai", "shape": var, "src": "lai-flats-01", "plate": path, "piece": ""}
    lai_manifest = ROOT / "catalog/runs/lai-01/manifest.tsv"
    lai_skipped = []
    for row in (load_manifest(lai_manifest) if lai_manifest.exists() else []):
        glb = LAI / "models" / f"{row['source']}.glb"
        if not glb.exists():
            continue
        if row["sku"] in skus:
            lai_skipped.append(row["sku"])
            continue
        row = dict(row)
        if row["family"]:  # (no wall kit in this run: a family column is a shape)
            row["shape"] = "--".join(p for p in (row["family"], row["shape"]) if p)
            row["family"] = ""
        row["tier"] = "lai"
        flags = set(filter(None, (row.get("flags") or "").split(",")))
        skus[row["sku"]] = {**row, "src": "lai-01", "glb": glb, "piece": "", "hung": "hung" in flags, "fit": "",
                            **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
    if lai_skipped:
        print(f"lair: {len(lai_skipped)} sku names already in the library, NOT replaced: {', '.join(lai_skipped[:8])}")
    # <<< type:lai
"""

def room_block():
    ns = {}; exec((HERE / "room_types.py").read_text(), ns)
    lines = ["    # >>> type:lai  Monster lair (2026-10-11): ten rooms in cut-rock walls (shared with the dungeon), no windows; the dens share one skeleton (js/solver2.js laiDen)"]
    lines += ["    " + repr(rt) + "," for rt in ns["LAI_ROOM_TYPES"]]
    lines += ["    # <<< type:lai"]
    return "\n".join(lines) + "\n"

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--tree", required=True); ap.add_argument("--check", action="store_true"); a = ap.parse_args()
    T = pathlib.Path(a.tree).resolve(); todo = []
    for rel, src in (("js/solver2.js", "programs.js"), ("js/walls.js", "walls_tail.js")):
        s = (T / rel).read_text(); body = (HERE / src).read_text().rstrip("\n") + "\n"
        new = BLOCK.sub("", s).rstrip("\n") + "\n\n" + body
        todo.append((T / rel, s, new))
    s = (T / "build_data.py").read_text(); base = BLOCK.sub("\n", s) if "type:lai" in s else s
    base = re.sub(r"^    EXCLUSIVE \|= \{\"lai\"\}.*\n", "", base, flags=re.M)
    m = re.search(r"\n\]\nSHELL = ", base)
    if not m: sys.exit("build_data.py: the end of ROOM_TYPES was not found (anchor `]\\nSHELL = `)")
    base = base[:m.start() + 1] + room_block() + base[m.start() + 1:]
    anchor = "    remeshed = 0\n"  # (after the outdoor decals: a place no other batch's block is inserted at)
    if base.count(anchor) != 1: sys.exit("build_data.py: the flats anchor `remeshed = 0` was not found once")
    base = base.replace(anchor, FLATS + anchor)
    ex = [m for m in re.finditer(r"^    EXCLUSIVE \|= .*\n", base, re.M)]
    if not ex: sys.exit("build_data.py: no `EXCLUSIVE |=` line to follow")
    base = base[:ex[-1].end()] + '    EXCLUSIVE |= {"lai"}  # type:lai (Monster lair, 2026-10-12)\n' + base[ex[-1].end():]
    todo.append((T / "build_data.py", s, base))
    t = HERE / "tests/lai.test.mjs"
    if t.exists(): todo.append((T / "test/lai.test.mjs", (T / "test/lai.test.mjs").read_text() if (T / "test/lai.test.mjs").exists() else "", t.read_text()))
    for path, old, new in todo:
        state = "unchanged" if old == new else "would change" if a.check else "written"
        print(f"  {state:12s} {path.relative_to(T)}  ({new.count(chr(10)) - old.count(chr(10)):+d} lines)")
        if old != new and not a.check: path.write_text(new)

if __name__ == "__main__": main()
