#!/usr/bin/env python3
"""A scratch copy of the Spawn Tuner (this worktree's, with the dungeon registrations) built with FAKE meshes and flats for
every dungeon spec, so the room programs can be run before the real meshes exist. Modelled on the castle batch's
make_sandbox.py; nothing outside sandbox/ is written.
    python3 make_sandbox.py dev [--accept all|p1+sib1]      -> sandbox/dev
    python3 make_sandbox.py pristine --pristine              -> sandbox/pristine: a plain copy of MAIN's tuner (golden reference)
Catalog and recipes are read from this worktree; other batches' models from the main tree (git-ignored there).
"""
import argparse, csv, json, pathlib, re, shutil, subprocess, sys
HERE = pathlib.Path(__file__).resolve().parent; D = HERE.parent; WT = D.parents[2]; MAIN = pathlib.Path("<repo>")
sys.path.insert(0, str(WT / "src"))
FLATS = {"seamless": ["floor-cut-rock", "floor-cut-rock--v2", "floor-cut-rock--v3", "floor-water-flooded", "floor-water-flooded--v2", "floor-flagstone-dungeon", "floor-flagstone-dungeon--v2"],
         "decals": ["chasm-strip--s1", "chasm-strip--s2", "chasm-strip-wide--s1", "sewer-channel-strip--s1", "sewer-channel-strip--s2", "pit-open--s1", "rune-tile--s1", "rune-tile--s2", "rune-tile--s3", "rune-tile--s4",
                    "floor-mosaic--s1", "decal-glyph-warding--s1", "decal-glyph-warding--s2", "decal-cracks--s1", "decal-cracks--s2", "decal-rubble-scatter--s1", "decal-rubble-scatter--s2", "decal-straw-scatter--s1",
                    "decal-straw-scatter--s2", "decal-slime--s1", "decal-slime--s2", "decal-scorch--s1", "decal-claw-marks--s1", "decal-web-floor--s1", "decal-drag-marks--s1"]}

def copy_tree(src, dst):
    if dst.exists(): shutil.rmtree(dst)
    dst.mkdir(parents=True)
    for f in ("build_data.py", "index.html", "styles.css"): shutil.copy2(src / f, dst / f)
    shutil.copytree(src / "js", dst / "js"); shutil.copytree(src / "data", dst / "data")
    (dst / "test").mkdir(); [shutil.copy2(p, dst / "test" / p.name) for p in (src / "test").glob("*.mjs")]
    (dst / "prep").mkdir()
    for p in list((src / "prep").glob("*.py")) + list((src / "prep").glob("results-*.jsonl")) + [src / "prep/flats-out.json"]: shutil.copy2(p, dst / "prep" / p.name)
    (dst / "assets").symlink_to(MAIN / "tools/spawn-tuner/assets")

def fake(dst, mode):
    import catalog_tool as ct
    roles = {}
    for p in sorted((WT / "catalog").glob("*.catalog.md")): roles.update(ct.parse_catalog(p)[0])
    cols = ["sku", "object", "group", "lane", "gen", "family", "tier", "shape", "place", "fp", "mat", "pri", "desc", "hint", "open_of", "mount", "flags", "note", "size", "source"]
    spec = {x["id"]: x for x in json.loads((D / "assets.json").read_text())["assets"]}
    live = {k["sku"] for o in json.loads((MAIN / "tools/spawn-tuner/data/library.json").read_text())["objects"].values() for k in o["skus"]}
    rows, res = [], []
    (dst / "fake/dun/models").mkdir(parents=True, exist_ok=True)
    for src, x in spec.items():
        if mode != "all" and x.get("group") not in mode.split("+"): continue
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
    for folder, names in FLATS.items():
        (dst / "fake/dun/flats" / folder).mkdir(parents=True, exist_ok=True)
        for n in names: (dst / "fake/dun/flats" / folder / (n + (".png" if folder == "seamless" else ".jpg"))).write_bytes(b"")
    (dst / "prep/results-fake.jsonl").write_text("".join(json.dumps(r) + "\n" for r in res))
    return len(rows)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("name"); ap.add_argument("--accept", default="all"); ap.add_argument("--pristine", action="store_true"); ap.add_argument("--real", action="store_true")
    a = ap.parse_args(); dst = HERE / "sandbox" / a.name
    if a.pristine: copy_tree(MAIN / "tools/spawn-tuner", dst); print("pristine copy of MAIN's tuner at", dst); return
    copy_tree(WT / "tools/spawn-tuner", dst)
    n = 0 if a.real else fake(dst, a.accept)
    bd = (dst / "build_data.py").read_text()
    reps = [('ROOT = pathlib.Path(__file__).resolve().parents[2]', f'ROOT = pathlib.Path({str(MAIN)!r}); WT = pathlib.Path({str(WT)!r})  # sandbox: other batches from MAIN, the catalog from this worktree'),
            ('sys.path.insert(0, str(ROOT / "src"))', 'sys.path.insert(0, str(WT / "src"))')]
    if not a.real: reps += [('DUN = ROOT / "experiments/2026-10-11-types/dun"', f'DUN = pathlib.Path({str(dst / "fake/dun")!r})'), ('dun_manifest = ROOT / "catalog/runs/dun-01/manifest.tsv"', f'dun_manifest = pathlib.Path({str(dst / "fake/runs/dun-01/manifest.tsv")!r})')]
    else: reps += [('DUN = ROOT / "experiments/2026-10-11-types/dun"', 'DUN = WT / "experiments/2026-10-11-types/dun"')]
    for old, new in reps:
        assert bd.count(old) == 1, old; bd = bd.replace(old, new)
    bd = bd.replace('ROOT / "catalog', 'WT / "catalog')
    (dst / "build_data.py").write_text(bd)
    r = subprocess.run([sys.executable, str(dst / "build_data.py"), "--list-unbuilt"], capture_output=True, text=True)
    (dst / "build_data.log").write_text(r.stdout + r.stderr)
    print(f"sandbox {a.name}: fake meshes {n}; build_data exit {r.returncode}"); print("\n".join((r.stdout + r.stderr).splitlines()[-30:]))
    if r.returncode: sys.exit(r.returncode)
if __name__ == "__main__": main()
