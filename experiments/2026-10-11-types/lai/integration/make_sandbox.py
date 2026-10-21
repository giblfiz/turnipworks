#!/usr/bin/env python3
"""A scratch copy of the Spawn Tuner with the lair applied, to run the room programs before anything lands.
    python3 make_sandbox.py pristine --pristine     -> sandbox/pristine: MAIN's tuner as it stands (the golden reference)
    python3 make_sandbox.py base                    -> sandbox/base: this worktree's tuner + the lair, on MAIN's library
    python3 make_sandbox.py dun --dun               -> sandbox/dun: the DUNGEON worktree's tuner + the lair, with fake
                                                       meshes and flats for every dungeon spec (its own make_sandbox rules)
The lair must solve in BOTH: on the library as it stands, and with the dungeon batch's meshes (it shares their walls,
hoard, cocoons, eggs and rock). Nothing outside sandbox/ is written.
"""
import argparse, csv, json, pathlib, re, shutil, subprocess, sys
HERE = pathlib.Path(__file__).resolve().parent; D = HERE.parent; WT = D.parents[2]; MAIN = pathlib.Path("<repo>")
DUNWT = pathlib.Path("<repo>"); DUN = DUNWT / "experiments/2026-10-11-types/dun"

def copy_tree(src, dst):
    if dst.exists(): shutil.rmtree(dst)
    dst.mkdir(parents=True)
    for f in ("build_data.py", "index.html", "styles.css"): shutil.copy2(src / f, dst / f)
    shutil.copytree(src / "js", dst / "js"); shutil.copytree(src / "data", dst / "data")
    (dst / "test").mkdir(); [shutil.copy2(p, dst / "test" / p.name) for p in (src / "test").glob("*.mjs")]
    (dst / "prep").mkdir()
    for p in list((src / "prep").glob("*.py")) + list((MAIN / "tools/spawn-tuner/prep").glob("results-*.jsonl")) + list((src / "prep").glob("results-*.jsonl")) + [MAIN / "tools/spawn-tuner/prep/flats-out.json"]: shutil.copy2(p, dst / "prep" / p.name)
    (dst / "assets").symlink_to(MAIN / "tools/spawn-tuner/assets")

def catalog(dst, dun):
    """the catalog the sandbox builds from: this worktree's, plus (--dun) the dungeon worktree's new files"""
    c = dst / "catalog"; shutil.copytree(WT / "catalog", c, ignore=shutil.ignore_patterns("out", "runs"))
    if dun:
        for p in (DUNWT / "catalog").glob("*.md"):
            if not (c / p.name).exists(): shutil.copy2(p, c / p.name)
        # lines the dungeon changed in files both trees have: take the dungeon's line for a role, keeping our set:LAI tag
        for p in (DUNWT / "catalog").glob("*.catalog.md"):
            ours = (c / p.name).read_text().splitlines(); theirs = {m.group(1): l for l in p.read_text().splitlines() if (m := re.match(r"^- \*\*([a-z0-9-]+)\*\*", l))}
            base = {m.group(1): l for l in (MAIN / "catalog" / p.name).read_text().splitlines() if (m := re.match(r"^- \*\*([a-z0-9-]+)\*\*", l))} if (MAIN / "catalog" / p.name).exists() else {}
            out = []
            for l in ours:
                m = re.match(r"^- \*\*([a-z0-9-]+)\*\*", l)
                if m and m.group(1) in theirs and theirs[m.group(1)] != base.get(m.group(1)): l = theirs[m.group(1)]
                out.append(l)
            (c / p.name).write_text("\n".join(out) + "\n")
    return c

def fake_dun(dst, cat):
    sys.path.insert(0, str(WT / "src")); import catalog_tool as ct
    roles = {}
    for p in sorted(cat.glob("*.catalog.md")): roles.update(ct.parse_catalog(p)[0])
    cols = ["sku", "object", "group", "lane", "gen", "family", "tier", "shape", "place", "fp", "mat", "pri", "desc", "hint", "open_of", "mount", "flags", "note", "size", "source"]
    spec = {x["id"]: x for x in json.loads((DUN / "assets.json").read_text())["assets"]}
    live = {k["sku"] for o in json.loads((MAIN / "tools/spawn-tuner/data/library.json").read_text())["objects"].values() for k in o["skus"]}
    rows, res = [], []
    (dst / "fake/dun/models").mkdir(parents=True, exist_ok=True)
    for src, x in spec.items():
        obj = x["object"]; role = roles.get(obj)
        if not role: print("  no catalog line for", src, obj); continue
        tail = src.split("--")[1:] if src.startswith(obj + "--") else src.partition("--")[2].split("--") if "--" in src else []
        family, shape = "", "--".join(tail)
        if role["gen"] == "kit" and tail and not re.fullmatch(r"s\d+", tail[0]): family, shape = tail[0], "--".join(tail[1:])
        sz = x.get("size"); size = "" if not sz or (role.get("size") and [float(v) for v in sz] == [float(v) for v in role["size"]]) else "x".join(f"{float(v):g}" for v in sz)
        flags = [f for f in (("hung" if x.get("hung") else ""), (f"light:{x['light']}" if x.get("light") else "")) if f]
        rows.append({"sku": src, "object": obj, "group": x.get("group", ""), "lane": "3d", "gen": role["gen"], "family": family, "tier": "", "shape": shape, "place": role["place"], "fp": role["fp"], "mat": role["mat"],
                     "pri": role["pri"], "desc": role["desc"], "hint": role["hint"], "open_of": role.get("open_of") or "", "mount": "" if role.get("mount") is None else f"{role['mount']:g}", "flags": ",".join(flags), "note": "FAKE (sandbox)", "size": size, "source": src})
        (dst / "fake/dun/models" / f"{src}.glb").write_bytes(f"fake dun/{src}".encode())
        w, d, h = [float(v) for v in (sz or role["size"])]; m = max(w, d, h)
        if src not in live: res.append({"sku": src, "bounds": [round(w / m, 4), round(h / m, 4), round(d / m, 4)], "faces": 5000, "bytes": 150000})
    out = dst / "fake/runs/dun-01/manifest.tsv"; out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="") as fh:
        w_ = csv.DictWriter(fh, fieldnames=cols, delimiter="\t", lineterminator="\n"); w_.writeheader(); w_.writerows(sorted(rows, key=lambda r: r["sku"]))
    for folder, ext in (("seamless", "png"), ("decals", "jpg")):
        (dst / "fake/dun/flats" / folder).mkdir(parents=True, exist_ok=True)
        for p in (DUN / "flats" / folder).glob(f"*.{ext}"): (dst / "fake/dun/flats" / folder / p.name).write_bytes(b"")
        if folder == "decals":
            for n in ("decal-scorch--s1", "decal-claw-marks--s1", "decal-web-floor--s1", "decal-slime--s1"): (dst / "fake/dun/flats/decals" / f"{n}.jpg").write_bytes(b"")
    (dst / "prep/results-fake.jsonl").write_text("".join(json.dumps(r) + "\n" for r in res))
    return len(rows)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("name"); ap.add_argument("--pristine", action="store_true"); ap.add_argument("--dun", action="store_true"); ap.add_argument("--from", dest="src", default=None)
    a = ap.parse_args(); dst = HERE / "sandbox" / a.name
    if a.pristine: copy_tree(MAIN / "tools/spawn-tuner", dst); print("pristine copy of MAIN's tuner at", dst); return
    copy_tree(pathlib.Path(a.src) if a.src else (DUNWT if a.dun else WT) / "tools/spawn-tuner", dst)
    r = subprocess.run([sys.executable, str(HERE / "apply.py"), "--tree", str(dst)], capture_output=True, text=True); print(r.stdout + r.stderr)
    cat = catalog(dst, a.dun); n = fake_dun(dst, cat) if a.dun else 0
    bd = (dst / "build_data.py").read_text()
    reps = [('ROOT = pathlib.Path(__file__).resolve().parents[2]', f'ROOT = pathlib.Path({str(MAIN)!r}); WT = pathlib.Path({str(WT)!r}); CAT = pathlib.Path({str(cat)!r})  # sandbox: other batches from MAIN, the catalog from the sandbox'),
            ('sys.path.insert(0, str(ROOT / "src"))', 'sys.path.insert(0, str(WT / "src"))')]
    if a.dun: reps += [('DUN = ROOT / "experiments/2026-10-11-types/dun"', f'DUN = pathlib.Path({str(dst / "fake/dun")!r})'), ('dun_manifest = ROOT / "catalog/runs/dun-01/manifest.tsv"', f'dun_manifest = pathlib.Path({str(dst / "fake/runs/dun-01/manifest.tsv")!r})')]
    for old, new in reps:
        assert bd.count(old) == 1, old; bd = bd.replace(old, new)
    bd = bd.replace('LAI = ROOT / "experiments/2026-10-11-types/lai"', 'LAI = WT / "experiments/2026-10-11-types/lai"').replace('lai_manifest = ROOT / "catalog/runs/lai-01/manifest.tsv"', 'lai_manifest = WT / "catalog/runs/lai-01/manifest.tsv"')  # the lair's own flats, models and manifest are in this worktree
    bd = bd.replace('(ROOT / "catalog").glob', 'CAT.glob').replace('ROOT / "catalog/room-recipes.md"', 'CAT / "room-recipes.md"').replace('ROOT / "catalog/sets.md"', 'CAT / "sets.md"')
    (dst / "build_data.py").write_text(bd)
    r = subprocess.run([sys.executable, str(dst / "build_data.py"), "--list-unbuilt"], capture_output=True, text=True)
    (dst / "build_data.log").write_text(r.stdout + r.stderr)
    print(f"sandbox {a.name}: fake dungeon meshes {n}; build_data exit {r.returncode}"); print("\n".join((r.stdout + r.stderr).splitlines()[-14:]))
    if r.returncode: sys.exit(r.returncode)
if __name__ == "__main__": main()
