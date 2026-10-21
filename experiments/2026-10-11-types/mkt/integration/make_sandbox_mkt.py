#!/usr/bin/env python3
"""A scratch copy of THIS worktree's Spawn Tuner with FAKE meshes for the market specs that have no mesh yet (bounds =
the spec's size), so the programs and the tests run before the pod has made anything. Modelled on the castle / crypt /
mansion make_sandbox.py.   python3 make_sandbox_mkt.py [NAME=dev] [--pristine]
  sandbox/NAME/   js/, data/, test/, prep, build_data.py   (git-ignored)
The sandbox build reads the MAIN tree for every older batch's binaries (they are git-ignored, so this worktree has none)
and this worktree for the catalog. `--pristine`: a copy of the MAIN tree's tuner as it stands (the golden reference)."""
import csv, json, pathlib, re, shutil, subprocess, sys
HERE = pathlib.Path(__file__).resolve().parent; MKT = HERE.parent; ROOT = MKT.parents[2]; MAIN = pathlib.Path("<repo>")
name = next((a for a in sys.argv[1:] if not a.startswith("--")), "dev"); pristine = "--pristine" in sys.argv; REAL = "--real" in sys.argv  # --real: the accepted meshes and their manifest (catalog/runs/mkt-01), no fakes
SRC = (MAIN if pristine else ROOT) / "tools/spawn-tuner"; dst = HERE / "sandbox" / name
if dst.exists(): shutil.rmtree(dst)
dst.mkdir(parents=True)
for f in ("build_data.py", "index.html", "styles.css"): shutil.copy2(SRC / f, dst / f)
shutil.copytree(SRC / "js", dst / "js"); shutil.copytree(SRC / "data", dst / "data")
(dst / "test").mkdir(); [shutil.copy2(p, dst / "test" / p.name) for p in (SRC / "test").glob("*.mjs")]
(dst / "prep").mkdir()
for p in list((MAIN / "tools/spawn-tuner/prep").glob("*.py")) + list((MAIN / "tools/spawn-tuner/prep").glob("results-*.jsonl")) + [MAIN / "tools/spawn-tuner/prep/flats-out.json"]: shutil.copy2(p, dst / "prep" / p.name)
(dst / "assets").symlink_to(MAIN / "tools/spawn-tuner/assets")
if pristine: print(f"pristine copy of the main tree's tuner at {dst}"); sys.exit(0)
sys.path.insert(0, str(ROOT / "src")); import catalog_tool as ct
roles = {}
for p in sorted((ROOT / "catalog").glob("*.catalog.md")): roles.update(ct.parse_catalog(p)[0])
cols = ["sku", "object", "group", "lane", "gen", "family", "tier", "shape", "place", "fp", "mat", "pri", "desc", "hint", "open_of", "mount", "flags", "note", "size", "source"]
spec = {x["id"]: x for x in json.loads((MKT / "assets.json").read_text())["assets"]}
real = {}  # skus the real batch has already accepted and built (runtime bounds exist): those are not faked
for p in (ROOT / "tools/spawn-tuner/prep").glob("results-mkt*.jsonl"):
    for line in p.read_text().splitlines(): real[json.loads(line)["sku"]] = line
rows, res = [], []
(dst / "fake/models").mkdir(parents=True)
for src, x in spec.items():
    obj = x["object"]; role = roles[obj]; sku = src
    tail = sku.split("--")[1:] if sku.startswith(obj + "--") else []
    family, shape = "", "--".join(tail)
    if role["gen"] == "kit" and tail and not re.fullmatch(r"s\d+", tail[0]): family, shape = tail[0], "--".join(tail[1:])
    sz = x.get("size")
    size = "" if not sz or [float(v) for v in sz] == [float(v) for v in role["size"]] else "x".join(f"{float(v):g}" for v in sz)
    flags = [f for f in (("hung" if x.get("hung") else ""), (f"light:{x['light']}" if x.get("light") else ""), ("bench:" + "+".join(x["bench"]) if x.get("bench") else "")) if f]
    rows.append({"sku": sku, "object": obj, "group": x.get("group", ""), "lane": "3d", "gen": role["gen"], "family": family, "tier": x.get("tier", "") or "", "shape": shape, "place": role["place"], "fp": role["fp"],
                 "mat": role["mat"], "pri": role["pri"], "desc": role["desc"], "hint": role["hint"], "open_of": role.get("open_of") or "", "mount": "" if role.get("mount") is None else f"{role['mount']:g}",
                 "flags": ",".join(flags), "note": "FAKE (sandbox)", "size": size, "source": src})
    (dst / "fake/models" / f"{src}.glb").write_bytes(f"fake mkt/{src}".encode())
    w, d, h = [float(v) for v in (sz or role["size"])]; m = max(w, d, h)
    res.append(real.get(sku) or json.dumps({"sku": sku, "bounds": [round(w / m, 4), round(h / m, 4), round(d / m, 4)], "faces": 5000, "bytes": 150000}))
with (dst / "fake/manifest.tsv").open("w", newline="") as fh:
    w_ = csv.DictWriter(fh, fieldnames=cols, delimiter="\t", lineterminator="\n"); w_.writeheader(); w_.writerows(sorted(rows, key=lambda r: r["sku"]))
if not REAL: (dst / "prep/results-mktfake.jsonl").write_text("".join(r + "\n" for r in res))
for p in (ROOT / "tools/spawn-tuner/prep").glob("results-mkt*.jsonl"): shutil.copy2(p, dst / "prep" / p.name)
bd = (dst / "build_data.py").read_text()
for old, new in (('ROOT = pathlib.Path(__file__).resolve().parents[2]', f'ROOT = pathlib.Path({str(MAIN)!r}); CATW = pathlib.Path({str(ROOT / "catalog")!r})  # sandbox: binaries from the main tree, the catalog from this worktree'),
                 ('(ROOT / "catalog").glob("*.catalog.md")', 'CATW.glob("*.catalog.md")'), ('ROOT / "catalog/room-recipes.md"', 'CATW / "room-recipes.md"'), ('(ROOT / "catalog").glob("rooms-*.md")', 'CATW.glob("rooms-*.md")'),
                 ('ROOT / "catalog/sets.md"', 'CATW / "sets.md"'),
                 ('MKT = ROOT / "experiments/2026-10-11-types/mkt"', f'MKT = pathlib.Path({str(MKT if REAL else dst / "fake")!r})  # sandbox'),
                 ('mkt_manifest = ROOT / "catalog/runs/mkt-01/manifest.tsv"', f'mkt_manifest = pathlib.Path({str(ROOT / "catalog/runs/mkt-01/manifest.tsv" if REAL else dst / "fake/manifest.tsv")!r})  # sandbox')):
    assert bd.count(old) == 1, old
    bd = bd.replace(old, new)
(dst / "build_data.py").write_text(bd)
r = subprocess.run([sys.executable, str(dst / "build_data.py")], capture_output=True, text=True)
(dst / "build_data.log").write_text(r.stdout + r.stderr)
print(f"sandbox {dst}: {len(rows)} fake meshes; build_data exit {r.returncode}")
print("\n".join((r.stdout + r.stderr).splitlines()[-22:]))
sys.exit(r.returncode)
