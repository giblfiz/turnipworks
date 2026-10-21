"""Turn the inn-02 front sweep into data/orient.json, keyed by mesh id (see build_data.py mesh_id).

Run from anywhere after build_data.py:  python3 tools/spawn-tuner/prep/orient_decide.py
Inputs: data/library.json (mesh ids), prep/orient-sweep-inn02/evidence.json (vision reads + geometric probes),
the pre-inn-02 library (git 5e3ccc8) for migrating the old sku-keyed orient.json.
Writes data/orient.json and prep/orient-sweep-inn02/decisions.json (rule + numbers behind every entry).

Sweep method (2026-10-02): prep/orient_views.py renders each runtime GLB from glTF +Z, +X, -Z, -X (tiles A-D);
prep/orient_sheets.py makes 4-object sheets; gemini-3.8-flash describes each row BLIND (object, pose, which tile shows
the front) with prompt_blind.txt; a text-only call then matches the blind description against the catalog entry;
suspects got a single-object gemini-3.1-pro read. prep/orient_probe.py measures the tall end (headboards, chair
backs) and flat sides. Vision is triage; the catalog box is the check:
  * a front read with conf >= 0.75 that leaves the mesh's long side along the catalog's long side -> that yaw;
  * a front read that contradicts the catalog box: wall items keep the read (the face matters more than 2 in of
    footprint); floor/table things fall back to the box;
  * no front (round, symmetric, food) or a weak read -> turn -90 only when the long sides disagree by > 1.15x;
  * kit pieces (stretched per axis, already stood up and faced along Z by blender_runtime kit_fix) take only the box
    rule: which face of a wall piece is "inside" is the wall code's business, not a vision read's.
Yaw convention (three.js, + = counter-clockwise from above) turns the raw front to +Z: A 0, B -90, C 180, D 90.
"""

import json
import pathlib
import subprocess

TOOL = pathlib.Path(__file__).resolve().parents[1]
ROOT = TOOL.parents[1]
V2Y = {"A": 0, "B": -90, "C": 180, "D": 90}
MANUAL = {  # sku: (yaw or None, why) -- read by hand from the evidence
    "rural-manger-wall--s4": (180, "read C/D (45 deg); the flat-side probe puts the back on +Z, so the front is C"),
    "lute": (0, "front read A (the lute's face) against a deeper-than-wide box: kept the read, it leans on a stand"),
}
# mesh-level failures, flagged in the ratings (masking + tagged note) instead of turned; see LAB_NOTES 2026-10-02
FLAGGED = {
    "fish": "a flat cut-out standing on its edge (bounds 0.72 x 1.0 x 0.13, tallest axis up) where the catalog has a fish lying on a table; "
            "flash and pro both read it as fish hanging from a strap",
    "roast-pig": "hollow shell: a large part of the side and back is missing (flash: 'incomplete hollow mesh'; pro: same)",
    "settle--s2": "an L-shaped corner seat (square footprint, a chair grown into a bench) where the catalog has a 60 x 20 in straight settle",
    "wall-window-small--rough-timber": "kit wall piece whose window opening is filled with melted geometry (flash read a four-way cross partition)",
}
# legacy orient.json fixes, measured 2026-10-02 on the same (inn-01) meshes: the 10-01 sweep read the headboard as the
# front on these beds; Harry's own bed-canopy correction (-90 -> 0) went the same way as these
LEGACY_FIX = {
    "bed-canopy": (0, "headboard read as the front in the 10-01 sweep; Harry corrected it to 0 on 10-01 17:11; blind read A agrees"),
    "bed-single--common--s1": (-90, "blind read: footboard on B (+X); probe: the -X end is the tall one (1.00 vs 0.73)"),
    "sickbed": (-90, "blind read: footboard on B (+X); probe: the -X end is the tall one (1.00 vs 0.79)"),
}


def long_mismatch(catr, mr, k=1.15):
    return (catr > k and mr < 1 / k) or (catr < 1 / k and mr > k)


def main():
    lib = json.loads((TOOL / "data/library.json").read_text())
    ev = json.loads((TOOL / "prep/orient-sweep-inn02/evidence.json").read_text())
    blind = ev["blind_flash"]
    skus = {s["sku"]: (o, s) for o in lib["objects"].values() for s in o["skus"]}
    old_lib = json.loads(subprocess.run(["git", "show", "5e3ccc8:tools/spawn-tuner/data/library.json"], cwd=ROOT,
                                        capture_output=True, text=True, check=True).stdout)
    old_src = {s["sku"]: s["src"] for o in old_lib["objects"].values() for s in o["skus"]}
    old_orient = json.loads(subprocess.run(["git", "show", "5e3ccc8:tools/spawn-tuner/data/orient.json"], cwd=ROOT,
                                           capture_output=True, text=True, check=True).stdout)

    orient, decisions = {}, {}
    # 1. migrate the 10-01 sweep: each key goes to the mesh the sku showed when it was measured
    for sku, yaw in old_orient.items():
        o, rec = skus[sku]
        src = old_src[sku]
        mesh = rec["mesh"] if rec["src"] == src else next(w["mesh"] for w in rec.get("was", []) if w["mesh"].startswith(f"{src}/"))
        why = "10-01 front sweep, migrated to the mesh it was measured on"
        if sku in LEGACY_FIX:
            yaw, fix = LEGACY_FIX[sku]
            why += f"; corrected 10-02: {fix}"
        orient[mesh] = yaw
        decisions[mesh] = {"yaw": yaw, "rule": "legacy", "why": why}

    # 2. the inn-02 sweep
    for sku, r in sorted(blind.items()):
        o, rec = skus[sku]
        w, d, _ = o["size"]
        bx, _, bz = rec["bounds"]
        catr, mr = w / d, bx / bz
        f, conf = r["front"], r.get("conf", 0)
        base = {"front": f, "conf": conf, "seen": r["object"], "pose": r["pose"], "cat_wd": round(catr, 2), "mesh_wd": round(mr, 2)}
        if sku in FLAGGED:
            decisions[rec["mesh"]] = {**base, "yaw": None, "rule": "flagged", "why": FLAGGED[sku]}
            continue
        if sku in MANUAL:
            yaw, why = MANUAL[sku]
            rule = "manual"
        elif f in V2Y and conf >= 0.75 and o["place"] != "kit":
            yaw = V2Y[f]
            turned = mr if yaw in (0, 180) else 1 / mr
            if not long_mismatch(catr, turned, 1.25) or o["place"] == "wall":
                rule, why = "front", r["why"]
            else:
                yaw = -90 if long_mismatch(catr, mr) else 0
                rule, why = "box", f"front read {f} ({r['why']}) contradicts the catalog box; long side follows the box"
        else:
            yaw = -90 if long_mismatch(catr, mr) else None
            rule, why = "box", "no distinct front; long side follows the catalog box"
        if yaw is None:
            continue
        orient[rec["mesh"]] = yaw
        decisions[rec["mesh"]] = {**base, "yaw": yaw, "rule": rule, "why": why}

    # later sweeps keep their own evidence and decisions (prep/orient_outdoors02.py): carry their yaws through a re-run
    for other in sorted((TOOL / "prep").glob("orient-sweep-*/decisions.json")):
        if other.parent.name != "orient-sweep-inn02":
            orient.update({mesh: d["yaw"] for mesh, d in json.loads(other.read_text()).items() if d.get("yaw") is not None})
    (TOOL / "data/orient.json").write_text(json.dumps(dict(sorted(orient.items())), indent=1) + "\n")
    (TOOL / "prep/orient-sweep-inn02/decisions.json").write_text(json.dumps(dict(sorted(decisions.items())), indent=1) + "\n")
    from collections import Counter
    print(f"orient.json: {len(orient)} meshes; rules {dict(Counter(d['rule'] for d in decisions.values()))}; "
          f"non-zero inn-02 yaws {sum(1 for k, v in orient.items() if k.startswith('inn-02/') and v)}")


if __name__ == "__main__":
    main()
