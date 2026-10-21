#!/usr/bin/env python3
"""The front sweep for run cult-01: prep/ccm_prep.py's `list` (its `where` table has no cult line and four other type
agents are editing that file) and prep/orient_ccm.py with this run's MANUAL lines. Run from tools/spawn-tuner:
    python3 ../../experiments/2026-10-11-types/clt/integration/orient_cult.py list
    blender --background --python prep/orient_views.py -- prep/orient-sweep-cult-01/list.txt prep/orient-sweep-cult-01/views
    python3 prep/orient_sheets.py prep/orient-sweep-cult-01/views prep/orient-sweep-cult-01/sheets 4 $(python3 prep/ccm_prep.py cult-01 skus)
    ~/.local/share/tw-birefnet-venv/bin/python ../../experiments/2026-10-11-types/clt/integration/orient_cult.py [--decide-only]
"""
import json, sys
from pathlib import Path
TOOL = Path.cwd(); assert (TOOL / "prep/orient_ccm.py").exists(), "run from tools/spawn-tuner"
RUN = "cult-01"; W = TOOL / f"prep/orient-sweep-{RUN}"
MANUAL = json.loads((Path(__file__).parent / "orient_manual.json").read_text()) if (Path(__file__).parent / "orient_manual.json").exists() else {}
if "list" in sys.argv:
    lib = json.loads((TOOL / "data/library.json").read_text())["objects"]
    skus = sorted(s["sku"] for o in lib.values() for s in o["skus"] if s["src"] == RUN and s["kind"] == "mesh")
    W.mkdir(exist_ok=True)
    (W / "list.txt").write_text("".join(f"{TOOL / 'assets/m' / (s + '.glb')}\n" for s in skus))
    base = (TOOL / "prep/orient-sweep-outdoors02/prompt_blind.txt").read_text()
    (W / "prompt_blind.txt").write_text(base.replace("the yard or garden of a fantasy inn", "a hidden underground sanctum").replace("Do not guess from what a yard usually contains", "Do not guess from what such a place usually contains"))
    print(f"{len(skus)} meshes -> {W}/list.txt"); sys.exit()
sys.argv = [sys.argv[0], RUN] + [a for a in sys.argv[1:] if a.startswith("--")]
sys.path.insert(0, str(TOOL / "prep")); import orient_ccm
orient_ccm.MANUAL.update({k: tuple(v) for k, v in MANUAL.items()})
if "--decide-only" not in sys.argv: orient_ccm.blind()
orient_ccm.decide()
