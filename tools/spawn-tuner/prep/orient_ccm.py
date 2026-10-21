"""DRAFT (copy to tools/spawn-tuner/prep/orient_ccm.py: a new file). Front sweep for ONE run of the castle / crypt / mansion
batch, added to data/orient.json (keyed by mesh id, see build_data.py). prep/orient_outdoors02.py with the run as an argument.

Run from the tw-birefnet venv (src/plate_gate_batch.py's Gemini helper), after build_data.py and the runtime prep:
  python3 prep/ccm_prep.py crypt-01 list            # prep/orient-sweep-crypt-01/list.txt + prompt_blind.txt
  blender --background --python prep/orient_views.py -- prep/orient-sweep-crypt-01/list.txt prep/orient-sweep-crypt-01/views
  python3 prep/orient_sheets.py prep/orient-sweep-crypt-01/views prep/orient-sweep-crypt-01/sheets 4 $(python3 prep/ccm_prep.py crypt-01 skus)
  ~/.local/share/tw-birefnet-venv/bin/python prep/orient_ccm.py crypt-01 [--decide-only]
Same method and rules as the inn-02 sweep (prep/orient_decide.py): gemini-3.8-flash describes each sheet row BLIND
(object, pose, which tile shows the front); the catalog box is the check. A front read with conf >= 0.75 that leaves
the long side along the box's long side -> that yaw (wall things keep the read); otherwise turn -90 only when the long
sides disagree by > 1.15x; kit pieces (fence, hedge, wall sections: already faced by kit_fix) take only the box rule.
The box is the mesh's OWN size where it has one (sku.size), else the catalog's.
Writes prep/orient-sweep-<run>/{evidence,decisions}.json and merges the yaws into data/orient.json (only keys of this run
are replaced). prep/orient_decide.py already carries every orient-sweep-*/decisions.json through an inn-02 re-run.
"""
import json, sys
from pathlib import Path
RUN = next(a for a in sys.argv[1:] if not a.startswith("--"))  # crypt-01 | castle-01 | mansion-01 | vertical-01
TOOL = Path(__file__).resolve().parents[1]; ROOT = TOOL.parents[1]; W = TOOL / f"prep/orient-sweep-{RUN}"
V2Y = {"A": 0, "B": -90, "C": 180, "D": 90}
MANUAL = {  # sku: (yaw or None, why)
    # farmstead (hut-01): meshed with their long side front to back; the blind read names the long side as the front (B)
    "beehive-skep": (-90, "two skeps side by side on a bench: the long side is the front (blind read B; the mesh lies front to back)"),
    "rural-milk-churn-tall": (-90, "two pails side by side: the pair's long side is the front (the mesh lies front to back)"),
    # kit panels take the box rule only, EXCEPT a panel whose two faces differ: its worked face must look into the room
    # (look.js: a wall piece's local +Z faces the owner room = tile A). Measured by ray-casting both faces (relief depth).
    "wall-crypt-niches--crypt-stone--s2": (180, "niches are on the -Z face (measured: relief std 0.35 of the depth on -Z, 0.04 on +Z; blind read front C)"),
    "wall-shop-window--half-timber": (180, "wizard-01: the display bay is on the +Z face (blind read front A) and must look OUT to the street, away from the owner room"),
    # temple (tem-01): measured on the runtime mesh (surface area by thirds along the long axis; low geometry by side), not read
    "flavor-buttress--sun": (90, "the pier is at -X (67% of the area in that third): the pier stands out in the room, the half-arch leans back to the wall"),
    "flavor-buttress--moon": (90, "the pier is at -X (73% of the area in that third)"),
    "pulpit": (90, "the stair is on +X (low geometry 16% there, 4% on -X): the panelled tub faces the room, the stair is behind"),
}
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
    orient = json.loads((TOOL / "data/orient.json").read_text()); orient = {k: v for k, v in orient.items() if not k.startswith(RUN + "/")}
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
