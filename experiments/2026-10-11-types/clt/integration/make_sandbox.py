#!/usr/bin/env python3
"""A sandbox tuner tree for the cult sanctum before (or beside) its real meshes: a copy of THIS worktree's
tools/spawn-tuner with a fake cult-01 run: manifest rows exactly as tools/make_manifest.py writes them (it is run, with a
fake QA summary that accepts every spec), placeholder GLB bytes, bounds = the spec's size with the largest side 1.0 (as
TRELLIS normalises), flat names from flats/gen.py `list`. Nothing here is committed (sandbox/ is in .gitignore).
    python3 make_sandbox.py [NAME=cult] [--accept all|p1+sib1|...]
"""
import csv, json, pathlib, shutil, subprocess, sys
HERE = pathlib.Path(__file__).resolve().parent; B = HERE.parent; ROOT = B.parents[2]; TUNER = ROOT / "tools/spawn-tuner"
args = [a for a in sys.argv[1:] if not a.startswith("--")]; name = args[0] if args else "cult"
accept = sys.argv[sys.argv.index("--accept") + 1] if "--accept" in sys.argv else "all"
dst = HERE / "sandbox" / name
if dst.exists(): shutil.rmtree(dst)
dst.mkdir(parents=True)
for f in ("build_data.py", "index.html", "styles.css"): shutil.copy2(TUNER / f, dst / f)
shutil.copytree(TUNER / "js", dst / "js"); shutil.copytree(TUNER / "data", dst / "data")
(dst / "test").mkdir(); [shutil.copy2(p, dst / "test" / p.name) for p in (TUNER / "test").glob("*.mjs")]
(dst / "prep").mkdir()
for p in list((TUNER / "prep").glob("*.py")) + [q for q in (TUNER / "prep").glob("results-*.jsonl") if "cult" not in q.name] + [TUNER / "prep/flats-out.json"]: shutil.copy2(p, dst / "prep" / p.name)
(dst / "assets").symlink_to((TUNER / "assets").resolve())
specs = [a for a in json.loads((B / "assets.json").read_text())["assets"] if accept == "all" or a.get("group") in accept.split("+")]
fake = dst / "fake"; (fake / "clt/models").mkdir(parents=True); (fake / "qa").mkdir()
with (fake / "qa/summary.tsv").open("w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=["sku", "verdict", "reason", "reads_as", "notes"], delimiter="\t", lineterminator="\n"); w.writeheader()
    for a in specs: w.writerow({"sku": a["id"], "verdict": "accept", "reason": "", "reads_as": "FAKE (sandbox)", "notes": ""})
out = fake / "runs/cult-01/manifest.tsv"
subprocess.run([sys.executable, str(B / "tools/make_manifest.py"), str(B), "cult-01", "--qa", str(fake / "qa"), "--no-plate-check", "--out", str(out)], check=True, stdout=subprocess.DEVNULL)
live = {s["sku"] for o in json.loads((TUNER / "data/library.json").read_text())["objects"].values() for s in o["skus"]}
over = json.loads((B / "manifest_overrides.json").read_text()).get("size", {}) if (B / "manifest_overrides.json").exists() else {}
res = []
by = {a["id"]: a for a in specs}
for row in csv.DictReader(out.open(), delimiter="\t"):
    a = by[row["source"]]; w_, d_, h_ = [float(v) for v in (over.get(a["id"]) or a["size"])]; m = max(w_, d_, h_)
    (fake / "clt/models" / f"{row['source']}.glb").write_bytes(f"fake clt/{row['source']}".encode())
    if row["sku"] not in live: res.append({"sku": row["sku"], "bounds": [round(w_ / m, 4), round(h_ / m, 4), round(d_ / m, 4)], "faces": 5000, "bytes": 150000})
(dst / "prep/results-fake.jsonl").write_text("".join(json.dumps(r) + "\n" for r in res))
names = subprocess.run([sys.executable, str(B / "flats/gen.py"), "list"], capture_output=True, text=True).stdout.split()
for n in names:
    if n.startswith("room-"): continue
    folder = "seamless" if n.startswith("floor-") else "decals"
    (fake / "clt/flats" / folder).mkdir(parents=True, exist_ok=True); (fake / "clt/flats" / folder / (n + (".png" if folder == "seamless" else ".jpg"))).write_bytes(b"")
bd = (dst / "build_data.py").read_text()
for old, new in (('ROOT = pathlib.Path(__file__).resolve().parents[2]', f'ROOT = pathlib.Path({str(ROOT)!r})  # sandbox: the worktree, read only'),
                 ('CLT = ROOT / "experiments/2026-10-11-types/clt"', f'CLT = pathlib.Path({str(fake / "clt")!r})  # sandbox: fake models'),
                 ('clt_manifest = ROOT / "catalog/runs/cult-01/manifest.tsv"', f'clt_manifest = pathlib.Path({str(out)!r})  # sandbox: fake manifest')):
    assert bd.count(old) == 1, old
    bd = bd.replace(old, new)
(dst / "build_data.py").write_text(bd)
r = subprocess.run([sys.executable, str(dst / "build_data.py"), "--list-unbuilt"], capture_output=True, text=True)
(dst / "build_data.log").write_text(r.stdout + r.stderr)
print(f"sandbox {dst}: {len(res)} fake meshes of {len(specs)} specs (accept={accept}); build_data exit {r.returncode}")
print("\n".join(l for l in (r.stdout + r.stderr).splitlines() if "cult" in l or "Traceback" in l or "Error" in l or "NOT" in l)[:3000])
