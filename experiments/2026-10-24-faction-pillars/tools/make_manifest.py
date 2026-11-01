#!/usr/bin/env python3
"""Accepted meshes of a type folder -> catalog/runs/<SRC_NAME>/manifest.tsv, in the outdoors-02 format
(sku object group lane gen family tier shape place fp mat pri desc hint open_of mount flags note size source).
    python3 tools/make_manifest.py TYPE_DIR SRC_NAME [--out FILE] [--dry-run]
Accepted = verdict `accept` in TYPE_DIR/qa/summary.tsv (qa_gate.py; QADIR/overrides.json already applied there), the
plate accepted in gate-manifest.json, and the GLB present in models/. Everything else is listed with its reason and
left out.
`source` = the file stem in models/. sku = the asset id, unless TYPE_DIR/manifest_overrides.json says otherwise:
    {"rename": {"<id>": "<sku>"}, "size": {"<id>": [w, d, h]}, "object": {"<id>": "<role>"}, "note": {"<id>": "..."}, "tier": {"<id>": "fine"}}
`size` (inches) is written only where the mesh ships at a size other than its catalog line: an override, or the spec's
own size when that differs from the catalog's (a variant sku). Kit pieces are stretched per axis to their box, so give
them a box within about 1.5x of the mesh (qa/<id>.json size_ft_at_auto_scale) in overrides. `family` = the first part
after `--` for kit lines (wall-straight--crypt-stone -> crypt-stone), `shape` = the rest (s2).
`open_of` comes from the catalog line, else from the spec's twin_of (the closed sku's object). `flags` carries
hung / light:<kind> / bench:<...> from the spec for the integration step.
"""
import argparse, csv, json, re, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src"))
import catalog_tool as ct

ap = argparse.ArgumentParser(); ap.add_argument("type_dir", type=Path); ap.add_argument("src_name")
ap.add_argument("--out", type=Path); ap.add_argument("--qa", type=Path); ap.add_argument("--dry-run", action="store_true")
ap.add_argument("--no-plate-check", action="store_true", help="do not require gate-manifest.json to say the plate was accepted")
a = ap.parse_args()
T = HERE.parent if str(a.type_dir) == HERE.parent.name else (a.type_dir.resolve() if a.type_dir.exists() else (HERE.parent / a.type_dir).resolve())
qa = a.qa or T / "qa"
roles = {}
for p in sorted((ROOT / "catalog").glob("*.catalog.md")): roles.update(ct.parse_catalog(p)[0])
spec = {x["id"]: x for x in json.loads((T / "assets.json").read_text())["assets"]}
over = json.loads((T / "manifest_overrides.json").read_text()) if (T / "manifest_overrides.json").exists() else {}
gate = json.loads((T / "gate-manifest.json").read_text())["assets"] if (T / "gate-manifest.json").exists() else {}
summary = list(csv.DictReader((qa / "summary.tsv").open(), delimiter="\t"))
rows, left = [], []
for s in summary:
    src = s["sku"]; x = spec.get(src)
    if s["verdict"] != "accept": left.append((src, s["verdict"] or "not gated", s["reason"][:120])); continue
    if not x: left.append((src, "no spec", "not in assets.json")); continue
    if not (T / "models" / f"{src}.glb").exists() and not a.qa: left.append((src, "no GLB", "models/ has no such file")); continue
    if not a.no_plate_check and gate.get(src, {}).get("status") != "accepted": left.append((src, "plate", "plate not accepted in gate-manifest.json")); continue
    obj = over.get("object", {}).get(src, x["object"]); role = roles.get(obj)
    if not role: left.append((src, "no catalog line", f"object {obj!r} is in no catalog/*.catalog.md")); continue
    sku = over.get("rename", {}).get(src, src)
    tail = sku.split("--")[1:] if sku.startswith(obj + "--") else sku.partition("--")[2].split("--") if "--" in sku else []
    family, shape = "", "--".join(tail)
    if role["gen"] == "kit" and tail and not re.fullmatch(r"s\d+", tail[0]): family, shape = tail[0], "--".join(tail[1:])
    if x.get("family"): family = x["family"]; shape = "--".join(t for t in tail if t != family)
    shape = x.get("shape", shape)  # faction identity is data, independent of collision-safe SKU suffix
    sz = over.get("size", {}).get(src) or x.get("size")
    size = "" if not sz or (role.get("size") and [float(v) for v in sz] == [float(v) for v in role["size"]]) else "x".join(f"{float(v):g}" for v in sz)
    open_of = role.get("open_of") or ""
    if not open_of and x.get("twin_of"): open_of = spec.get(x["twin_of"], {}).get("object", x["twin_of"].split("--")[0])
    flags = [f for f in (("hung" if x.get("hung") else ""), (f"light:{x['light']}" if x.get("light") else ""), ("bench:" + "+".join(x["bench"]) if x.get("bench") else "")) if f]
    note = over.get("note", {}).get(src) or ("mesh gate: " + (s.get("reads_as") or "accepted") + ("; notes: " + s["notes"][:160] if s.get("notes") else ""))
    rows.append({"sku": sku, "object": obj, "group": x.get("group", ""), "lane": "3d", "gen": role["gen"], "family": family, "tier": over.get("tier", {}).get(src, x.get("tier", "")) or "", "shape": shape,
                 "place": role["place"], "fp": role["fp"], "mat": role["mat"], "pri": role["pri"], "desc": role["desc"], "hint": role["hint"],
                 "open_of": open_of, "mount": "" if role.get("mount") is None else f"{role['mount']:g}", "flags": ",".join(flags), "note": note.replace("\t", " "),
                 "size": size, "source": src})
rows.sort(key=lambda r: r["sku"])
dup = {r["sku"] for r in rows if sum(q["sku"] == r["sku"] for q in rows) > 1}
if dup: print("DUPLICATE skus:", sorted(dup)); sys.exit(1)
out = a.out or ROOT / "catalog/runs" / a.src_name / "manifest.tsv"
cols = ["sku", "object", "group", "lane", "gen", "family", "tier", "shape", "place", "fp", "mat", "pri", "desc", "hint", "open_of", "mount", "flags", "note", "size", "source"]
print(f"{T.name}: {len(rows)} accepted rows, {len(left)} left out" + (" (dry run)" if a.dry_run else f" -> {out}"))
for l in left: print("  left out:", *l, sep="\t")
if not a.dry_run:
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, delimiter="\t", lineterminator="\n"); w.writeheader(); w.writerows(rows)
