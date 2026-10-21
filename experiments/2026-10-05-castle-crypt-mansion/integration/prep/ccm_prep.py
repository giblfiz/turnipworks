#!/usr/bin/env python3
"""DRAFT (copy to tools/spawn-tuner/prep/ccm_prep.py: a new file). The per-run lists the prep steps need, cut from what
build_data.py just wrote, so a run can be prepared without redoing the whole library.   Run from tools/spawn-tuner.

    python3 prep/ccm_prep.py RUN jobs     -> prep/jobs-<run>.json   this run's runtime / ladder jobs ("force": true), from prep/jobs.json
    python3 prep/ccm_prep.py RUN list     -> prep/orient-sweep-<run>/list.txt (one shipped GLB per line) + prompt_blind.txt
    python3 prep/ccm_prep.py RUN skus     -> the run's mesh skus on one line (for orient_sheets.py)
    python3 prep/ccm_prep.py RUN check    -> every mesh sku of the run has runtime bounds, a shipped GLB and (non-kit) an orient decision
RUN = crypt-01 | castle-01 | mansion-01 | vertical-01  (the `src` build_data.py gives the run's skus)
"""
import json, sys
from pathlib import Path
TOOL = Path(__file__).resolve().parents[1]
run, what = sys.argv[1], sys.argv[2]
lib = json.loads((TOOL / "data/library.json").read_text())["objects"]
mine = [(o, s) for o in lib.values() for s in o["skus"] if s["src"] == run and s["kind"] == "mesh"]
skus = sorted(s["sku"] for _, s in mine)
tag = run.replace("-", "")
if what == "jobs":
    jobs = [{**j, "force": True} for j in json.loads((TOOL / "prep/jobs.json").read_text()) if j["sku"] in set(skus)]
    (TOOL / f"prep/jobs-{tag}.json").write_text(json.dumps(jobs, indent=1)); print(f"{len(jobs)} jobs -> prep/jobs-{tag}.json")
elif what == "list":
    W = TOOL / f"prep/orient-sweep-{run}"; W.mkdir(exist_ok=True)
    (W / "list.txt").write_text("".join(f"{TOOL / 'assets/m' / (s + '.glb')}\n" for s in skus))
    base = (TOOL / "prep/orient-sweep-outdoors02/prompt_blind.txt").read_text()
    where = {"crypt-01": "a crypt or tomb", "castle-01": "a castle", "mansion-01": "a grand house", "vertical-01": "the stairs and roofs of a building"}[run]
    (W / "prompt_blind.txt").write_text(base.replace("the yard or garden of a fantasy inn", where).replace("Do not guess from what a yard usually contains", "Do not guess from what such a place usually contains"))
    print(f"{len(skus)} meshes -> {W}/list.txt (+ prompt_blind.txt: check its wording once)")
elif what == "skus": print(" ".join(skus))
elif what == "check":
    orient = json.loads((TOOL / "data/orient.json").read_text()); W = TOOL / f"prep/orient-sweep-{run}/decisions.json"
    dec = json.loads(W.read_text()) if W.exists() else {}
    bad = [(s["sku"], why) for o, s in mine for why in (["no runtime bounds"] if "bounds" not in s else []) + ([] if (TOOL / "assets/m" / f"{s['sku']}.glb").exists() else ["no assets/m GLB"]) + ([] if o["place"] == "kit" or s["mesh"] in dec else ["no orient decision"])]
    print(f"{run}: {len(mine)} mesh skus, {len(bad)} problems"); [print("  ", *b) for b in bad]; sys.exit(1 if bad else 0)
