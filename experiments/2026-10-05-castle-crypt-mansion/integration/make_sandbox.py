#!/usr/bin/env python3
"""Build a scratch copy of the Spawn Tuner with the integration drafts applied and FAKE meshes for skus that do not
exist yet, without touching any shared file.

    python3 make_sandbox.py NAME [--scope once,crypt] [--accept all|prio1|p1+sib1] [--types crypt,castle,mansion,vertical] [--pristine]

  sandbox/NAME/            js/, data/, test/, prep/*.py, build_data.py, index.html, styles.css copied from tools/spawn-tuner
  sandbox/NAME/assets      symlink to the real assets folder (nothing is written through it)
  sandbox/NAME/fake/       runs/<src>/manifest.tsv (what tools/make_manifest.py would write if every chosen spec were
                           accepted), ccm/<type>/models/<sku>.glb (placeholder bytes), ccm/flats/seamless/*.png (names only)
  sandbox/NAME/prep/results-fake.jsonl   bounds = the spec's size, largest side 1.0 (as TRELLIS normalises)
`--pristine`: copy only (the golden reference for "the inn is unchanged").
The sandbox build_data.py reads the REAL catalog and ratings (read only) and writes only inside the sandbox.
"""
import argparse, csv, json, pathlib, re, shutil, subprocess, sys
HERE = pathlib.Path(__file__).resolve().parent; B = HERE.parent; ROOT = B.parents[1]; TUNER = ROOT / "tools/spawn-tuner"
SRC = {"crypt": "crypt-01", "castle": "castle-01", "mansion": "mansion-01", "vertical": "vertical-01"}
sys.path.insert(0, str(ROOT / "src"))

def copy_tree(dst):
    if dst.exists(): shutil.rmtree(dst)
    dst.mkdir(parents=True)
    for f in ("build_data.py", "index.html", "styles.css"): shutil.copy2(TUNER / f, dst / f)
    shutil.copytree(TUNER / "js", dst / "js"); shutil.copytree(TUNER / "data", dst / "data")
    (dst / "test").mkdir(); [shutil.copy2(p, dst / "test" / p.name) for p in (TUNER / "test").glob("*.mjs")]
    (dst / "prep").mkdir()
    for p in list((TUNER / "prep").glob("*.py")) + list((TUNER / "prep").glob("results-*.jsonl")) + [TUNER / "prep/flats-out.json"]: shutil.copy2(p, dst / "prep" / p.name)
    (dst / "assets").symlink_to(TUNER / "assets")

def accepted(a, mode):
    if mode == "all": return True
    if mode.startswith("prio"): return a.get("prio", 9) <= int(mode[4:])
    return a.get("group") in mode.split("+")

def fake_inputs(dst, types, mode):
    """the rows tools/make_manifest.py writes (its family / shape / size / flags rules copied line for line), for every chosen spec"""
    import catalog_tool as ct
    roles = {}
    for p in sorted((ROOT / "catalog").glob("*.catalog.md")): roles.update(ct.parse_catalog(p)[0])
    cols = ["sku", "object", "group", "lane", "gen", "family", "tier", "shape", "place", "fp", "mat", "pri", "desc", "hint", "open_of", "mount", "flags", "note", "size", "source"]
    res, n = [], {}
    live = {k["sku"] for o in json.loads((TUNER / "data/library.json").read_text())["objects"].values() for k in o["skus"]}
    for t in types:
        spec = {x["id"]: x for x in json.loads((B / t / "assets.json").read_text())["assets"]}
        rows = []
        (dst / "fake/ccm" / t / "models").mkdir(parents=True, exist_ok=True)
        for src, x in spec.items():
            if x.get("lane", "3d") != "3d" or not accepted(x, mode): continue
            obj = x["object"]; role = roles.get(obj)
            if not role: print("  no catalog line for", src, obj); continue
            sku = src
            tail = sku.split("--")[1:] if sku.startswith(obj + "--") else sku.partition("--")[2].split("--") if "--" in sku else []
            family, shape = "", "--".join(tail)
            if role["gen"] == "kit" and tail and not re.fullmatch(r"s\d+", tail[0]): family, shape = tail[0], "--".join(tail[1:])
            if x.get("family"): family = x["family"]; shape = "--".join(q for q in tail if q != family)
            sz = x.get("size")
            size = "" if not sz or (role.get("size") and [float(v) for v in sz] == [float(v) for v in role["size"]]) else "x".join(f"{float(v):g}" for v in sz)
            open_of = role.get("open_of") or ""
            if not open_of and x.get("twin_of"): open_of = spec.get(x["twin_of"], {}).get("object", x["twin_of"].split("--")[0])
            flags = [f for f in (("hung" if x.get("hung") else ""), (f"light:{x['light']}" if x.get("light") else ""), ("bench:" + "+".join(x["bench"]) if x.get("bench") else "")) if f]
            rows.append({"sku": sku, "object": obj, "group": x.get("group", ""), "lane": "3d", "gen": role["gen"], "family": family, "tier": x.get("tier", "") or "", "shape": shape,
                         "place": role["place"], "fp": role["fp"], "mat": role["mat"], "pri": role["pri"], "desc": role["desc"], "hint": role["hint"], "open_of": open_of,
                         "mount": "" if role.get("mount") is None else f"{role['mount']:g}", "flags": ",".join(flags), "note": "FAKE (sandbox)", "size": size, "source": src})
            (dst / "fake/ccm" / t / "models" / f"{src}.glb").write_bytes(f"fake {t}/{src}".encode())
            w, d, h = [float(v) for v in (sz or role["size"])]; m = max(w, d, h)
            # (a spec whose sku name is already a live mesh gets no fake bounds: build_data refuses to replace it, and a
            # real runtime job would have overwritten assets/m/<sku>.glb: the collision is reported by build_data)
            if sku not in live: res.append({"sku": sku, "bounds": [round(w / m, 4), round(h / m, 4), round(d / m, 4)], "faces": 5000, "bytes": 150000})
        out = dst / "fake/runs" / SRC[t] / "manifest.tsv"; out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("w", newline="") as fh:
            w_ = csv.DictWriter(fh, fieldnames=cols, delimiter="\t", lineterminator="\n"); w_.writeheader(); w_.writerows(sorted(rows, key=lambda r: r["sku"]))
        n[t] = len(rows)
        # flats: names only (build_data records the plate path; nothing reads the pixels here)
        fl = json.loads((B / t / "flats.json").read_text()); fl = fl["flats"] if isinstance(fl, dict) else fl
        for f in fl:
            kind = f.get("kind", ""); folder = "seamless" if kind in ("floor", "roof-surface") or f.get("seamless") else "decals"
            (dst / "fake/ccm/flats" / folder).mkdir(parents=True, exist_ok=True)
            for v in range(1, int(f.get("variants") or f.get("shapes") or 1) + 1):
                stem = f["id"] if v == 1 and folder == "seamless" else f"{f['id']}--{'v' if folder == 'seamless' else 's'}{v}"
                (dst / "fake/ccm/flats" / folder / (stem + (".png" if folder == "seamless" else ".jpg"))).write_bytes(b"")
    (dst / "prep/results-fake.jsonl").write_text("".join(json.dumps(r) + "\n" for r in res))
    return n

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("name"); ap.add_argument("--scope", default="once,crypt"); ap.add_argument("--accept", default="all")
    ap.add_argument("--types", default="crypt,castle,mansion,vertical"); ap.add_argument("--pristine", action="store_true"); ap.add_argument("--no-flats", action="store_true")
    a = ap.parse_args(); dst = HERE / "sandbox" / a.name
    copy_tree(dst)
    if a.pristine: print(f"pristine copy at {dst}"); return
    n = fake_inputs(dst, a.types.split(","), a.accept)
    if a.no_flats: shutil.rmtree(dst / "fake/ccm/flats", ignore_errors=True)
    subprocess.run([sys.executable, str(HERE / "apply.py"), "--tree", str(dst), "--scope", a.scope, "--quiet"], check=True)
    # point the sandbox build at the real repo (read only) and at the fake run folders
    bd = (dst / "build_data.py").read_text()
    for old, new in (('ROOT = pathlib.Path(__file__).resolve().parents[2]', f'ROOT = pathlib.Path({str(ROOT)!r})  # sandbox: the real repo, read only'),
                     ('CCM = ROOT / "experiments/2026-10-05-castle-crypt-mansion"', f'CCM = pathlib.Path({str(dst / "fake/ccm")!r})  # sandbox: fake models'),
                     ('manifest = ROOT / "catalog/runs" / src / "manifest.tsv"', f'manifest = pathlib.Path({str(dst / "fake/runs")!r}) / src / "manifest.tsv"  # sandbox: fake manifests')):
        assert bd.count(old) == 1, old
        bd = bd.replace(old, new)
    (dst / "build_data.py").write_text(bd)
    r = subprocess.run([sys.executable, str(dst / "build_data.py"), "--list-unbuilt"], capture_output=True, text=True)  # (a sandbox has no assets/flat: list flats anyway)
    (dst / "build_data.log").write_text(r.stdout + r.stderr)
    print(f"sandbox {dst.relative_to(HERE)}: fake meshes {n} (accept={a.accept}), scope {a.scope}; build_data exit {r.returncode}")
    print("\n".join((r.stdout + r.stderr).splitlines()[-48:]))
    if r.returncode: sys.exit(r.returncode)

if __name__ == "__main__":
    main()
