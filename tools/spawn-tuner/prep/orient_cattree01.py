"""Front sweep for the cat tree (2026-10-06; a copy of orient_outdoors02.py), added to data/orient.json (keyed by mesh id, see build_data.py).

Run from the tw-birefnet venv (src/plate_gate_batch.py's Gemini helper), after build_data.py and the runtime prep:
  blender --background --python prep/orient_views.py -- prep/orient-sweep-cat-tree-01/list.txt prep/orient-sweep-cat-tree-01/views
  python3 prep/orient_sheets.py prep/orient-sweep-cat-tree-01/views prep/orient-sweep-cat-tree-01/sheets 4 <skus>
  ~/.local/share/tw-birefnet-venv/bin/python prep/orient_cattree01.py [--decide-only]
Same method and rules as the inn-02 sweep (prep/orient_decide.py): gemini-3.8-flash describes each sheet row BLIND
(object, pose, which tile shows the front); the catalog box is the check. A front read with conf >= 0.75 that leaves
the long side along the box's long side -> that yaw (wall things keep the read); otherwise turn -90 only when the long
sides disagree by > 1.15x; kit pieces (fence, hedge, wall sections: already faced by kit_fix) take only the box rule.
The box is the mesh's OWN size where it has one (sku.size), else the catalog's.
Writes prep/orient-sweep-cat-tree-01/{evidence,decisions}.json and merges the yaws into data/orient.json.
"""
import json, sys
from pathlib import Path
TOOL = Path(__file__).resolve().parents[1]; ROOT = TOOL.parents[1]; W = TOOL / "prep/orient-sweep-cat-tree-01"
V2Y = {"A": 0, "B": -90, "C": 180, "D": 90}
MANUAL = {}  # sku: (yaw or None, why)
def long_mismatch(catr, mr, k=1.15): return (catr > k and mr < 1 / k) or (catr < 1 / k and mr > k)
def blind():
    sys.path.insert(0, str(ROOT / "src")); import plate_gate_batch as pgb
    prompt = (W / "prompt_blind.txt").read_text(); ev = {}
    for sheet in sorted((W / "sheets").glob("sheet-*.png")):
        key = json.loads(sheet.with_suffix(".json").read_text())
        rows, _ = pgb.vision(pgb.img_part(sheet, "contact sheet"), prompt)
        for r in rows: ev[key[str(r["row"])]] = r
        print(sheet.name, [(key[str(r["row"])], r["front"], r["conf"]) for r in rows], flush=True)
    (W / "evidence.json").write_text(json.dumps({"blind_flash": ev}, indent=1) + "\n")
def decide():
    lib = json.loads((TOOL / "data/library.json").read_text()); ev = json.loads((W / "evidence.json").read_text())["blind_flash"]
    skus = {s["sku"]: (o, s) for o in lib["objects"].values() for s in o["skus"]}
    orient = json.loads((TOOL / "data/orient.json").read_text()); orient = {k: v for k, v in orient.items() if not k.startswith("cat-tree-01/")}
    dec = {}
    for sku, r in sorted(ev.items()):
        o, rec = skus[sku]; w, d, _ = rec.get("size") or o["size"]; bx, _, bz = rec["bounds"]; catr, mr = w / d, bx / bz
        f, conf = r["front"], r.get("conf", 0)
        base = {"sku": sku, "front": f, "conf": conf, "seen": r["object"], "pose": r["pose"], "cat_wd": round(catr, 2), "mesh_wd": round(mr, 2)}
        if sku in MANUAL: yaw, why = MANUAL[sku]; rule = "manual"
        elif f in V2Y and conf >= 0.75 and o["place"] != "kit":
            yaw = V2Y[f]; turned = mr if yaw in (0, 180) else 1 / mr
            if not long_mismatch(catr, turned, 1.25) or o["place"] == "wall": rule, why = "front", r["why"]
            else: yaw = -90 if long_mismatch(catr, mr) else 0; rule, why = "box", f"front read {f} ({r['why']}) contradicts the box; long side follows the box"
        else: yaw = -90 if long_mismatch(catr, mr) else None; rule, why = "box", "no distinct front; long side follows the box"
        dec[rec["mesh"]] = {**base, "yaw": yaw, "rule": rule, "why": why}
        if yaw is not None: orient[rec["mesh"]] = yaw
    (W / "decisions.json").write_text(json.dumps(dict(sorted(dec.items())), indent=1) + "\n")
    (TOOL / "data/orient.json").write_text(json.dumps(dict(sorted(orient.items())), indent=1) + "\n")
    for k, v in sorted(dec.items()): print(f"{v['sku']:24s} yaw {str(v['yaw']):5s} {v['rule']:6s} front {v['front']:5s} conf {v['conf']} pose {v['pose']:12s} seen {v['seen'][:34]:34s} box {v['cat_wd']} mesh {v['mesh_wd']}")
if __name__ == "__main__":
    if "--decide-only" not in sys.argv: blind()
    decide()
