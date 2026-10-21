#!/usr/bin/env python3
"""A scratch copy of the WORKTREE's Spawn Tuner with fake meshes for every spec in ../batch/assets.json (bounds = the
spec's size), built against the MAIN tree's git-ignored batch binaries (read only). For working on the programs before
the meshes exist.   python3 sandbox.py OUTDIR [--real]   (--real: only skus with a real GLB, real manifest)"""
import csv, json, pathlib, re, shutil, subprocess, sys
HERE = pathlib.Path(__file__).resolve().parent; TEMF = HERE.parent; WT = TEMF.parents[2]; MAIN = pathlib.Path("<repo>"); TUNER = WT / "tools/spawn-tuner"
dst = pathlib.Path(sys.argv[1]).resolve(); REAL = "--real" in sys.argv; MAINTEM = pathlib.Path('/tmp/scratch/evtem')
if dst.exists(): shutil.rmtree(dst)
dst.mkdir(parents=True)
for f in ("build_data.py", "index.html", "styles.css"): shutil.copy2(TUNER / f, dst / f)
shutil.copytree(TUNER / "js", dst / "js"); shutil.copytree(TUNER / "data", dst / "data")
(dst / "test").mkdir(); [shutil.copy2(p, dst / "test" / p.name) for p in (TUNER / "test").glob("*.mjs")]
(dst / "prep").mkdir()
for p in list((TUNER / "prep").glob("*.py")) + list((TUNER / "prep").glob("results-*.jsonl")) + [TUNER / "prep/flats-out.json"]: shutil.copy2(p, dst / "prep" / p.name)
(dst / "assets").symlink_to(MAIN / "tools/spawn-tuner/assets")
fo = dst / "prep/flats-out.json"; fo.write_text(json.dumps({**json.loads(fo.read_text()), **json.loads((HERE / "flats-out-tem.json").read_text())}))  # this run's flats (built into the main tree's assets/flat)
sys.path.insert(0, str(WT / "src")); import catalog_tool as ct
roles = {}
for p in sorted((WT / "catalog").glob("*.catalog.md")): roles.update(ct.parse_catalog(p)[0])
cols = ["sku", "object", "group", "lane", "gen", "family", "tier", "shape", "place", "fp", "mat", "pri", "desc", "hint", "open_of", "mount", "flags", "note", "size", "source"]
rows, res = [], []
fake = dst / "fake/tem"; (fake / "batch/models").mkdir(parents=True); (fake / "flats/decals").mkdir(parents=True)
for x in json.loads((TEMF / "batch/assets.json").read_text())["assets"]:
    sku = obj_sku = x["id"]; obj = x["object"]; role = roles[obj]
    tail = sku.split("--")[1:] if sku.startswith(obj + "--") else []
    family, shape = "", "--".join(tail)
    if x.get("family"): family = x["family"]; shape = "--".join(q for q in tail if q != family)
    sz = x.get("size"); size = "" if not sz or [float(v) for v in sz] == [float(v) for v in role["size"]] else "x".join(f"{float(v):g}" for v in sz)
    flags = [f for f in (("hung" if x.get("hung") else ""), (f"light:{x['light']}" if x.get("light") else "")) if f]
    rows.append({"sku": sku, "object": obj, "group": x["group"], "lane": "3d", "gen": role["gen"], "family": family, "tier": "", "shape": shape, "place": role["place"], "fp": role["fp"], "mat": role["mat"], "pri": role["pri"],
                 "desc": role["desc"], "hint": role["hint"], "open_of": "", "mount": "" if role.get("mount") is None else f"{role['mount']:g}", "flags": ",".join(flags), "note": "FAKE", "size": size, "source": sku})
    (fake / "batch/models" / f"{sku}.glb").write_bytes(b"fake")
    w, d, h = [float(v) for v in (sz or role["size"])]; m = max(w, d, h); res.append({"sku": sku, "bounds": [round(w / m, 4), round(h / m, 4), round(d / m, 4)], "faces": 5000, "bytes": 150000})
for s in ("flavor-banner--sun", "flavor-banner--moon", "flavor-sigil--sun", "flavor-sigil--moon", "flavor-relief--sun", "flavor-relief--moon"): (fake / "flats/decals" / f"{s}.jpg").write_bytes(b"")
man = dst / "fake/runs/tem-01/manifest.tsv"; man.parent.mkdir(parents=True)
with man.open("w", newline="") as fh: w_ = csv.DictWriter(fh, fieldnames=cols, delimiter="\t", lineterminator="\n"); w_.writeheader(); w_.writerows(rows)
if not REAL: (dst / "prep/results-fake.jsonl").write_text("".join(json.dumps(r) + "\n" for r in res))
bd = (dst / "build_data.py").read_text()
for old, new in (('ROOT = pathlib.Path(__file__).resolve().parents[2]', f'ROOT = pathlib.Path({str(MAIN)!r}); WT = pathlib.Path({str(WT)!r})'),
                 ('sys.path.insert(0, str(ROOT / "src"))', 'sys.path.insert(0, str(WT / "src"))'),
                 ('sorted((ROOT / "catalog").glob("*.catalog.md"))', 'sorted((WT / "catalog").glob("*.catalog.md"))'),
                 ('[ROOT / "catalog/room-recipes.md"] + sorted((ROOT / "catalog").glob("rooms-*.md"))', '[WT / "catalog/room-recipes.md"] + sorted((WT / "catalog").glob("rooms-*.md"))'),
                 ('TEM = ROOT / "experiments/2026-10-11-types/tem"', f'TEM = pathlib.Path({str(MAINTEM if REAL else fake)!r})'),
                 ('tem_manifest = ROOT / "catalog/runs/tem-01/manifest.tsv"', f'tem_manifest = pathlib.Path({str(WT / "catalog/runs/tem-01/manifest.tsv" if REAL else man)!r})')):
    assert bd.count(old) == 1, old
    bd = bd.replace(old, new)
(dst / "build_data.py").write_text(bd)
r = subprocess.run([sys.executable, str(dst / "build_data.py"), "--list-unbuilt"], capture_output=True, text=True)
(dst / "build_data.log").write_text(r.stdout + r.stderr)
print("build_data exit", r.returncode); print("\n".join(l[:230] for l in (r.stdout + r.stderr).splitlines() if re.search(r"temple|cathedral|Error|Trace|NOT replaced|objects,|skus", l))[:3000])
