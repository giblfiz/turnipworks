#!/usr/bin/env python3
"""The eye tyrant's plate: the default set's route (../2026-10-06-figures/gen.py: the Codex painter with its built-in
image tool, the figure gate blind-then-match, the BiRefNet matte, the mask gate), with the gate's vision on agy-run
(agy_vision.py) instead of the paid Gemini API. Writes ./inputs, ./masked, ./rejected, ./work, ./gate-manifest.json.
    python3 plate.py [--rerolls 2] [--redo] [--keep-try1]"""
import json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent; FIG = HERE.parent / "2026-10-06-figures"
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(FIG)); sys.path.insert(0, str(HERE.parents[1] / "src"))
import gen                      # patches plate_gate_batch with the Codex painter and the figure gate
import plate_gate_batch as pgb
import agy_vision
pgb.vision = agy_vision.vision
pgb.GATE_MODEL = "gemini via agy-run (subscription)"
_paint = pgb.generate
def _generate(root, asset, attempt, extra):   # --keep-try1: gate the plate already painted as try 1 (a gate that timed out, not a refusal)
    t1 = root / "work" / f"{asset['id']}.try1.jpg"
    if attempt == 1 and "--keep-try1" in sys.argv and t1.exists():
        (root / "prompts").mkdir(exist_ok=True); (root / "prompts" / f"{asset['id']}.try1.md").write_text(asset["prompt"]); return t1
    return _paint(root, asset, attempt, extra)
pgb.generate = _generate
rer = int(next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == "--rerolls"), 2))
spec = json.loads((HERE / "assets.json").read_text())["assets"][0]
man = HERE / "gate-manifest.json"
state = json.loads(man.read_text()) if man.exists() else {"gate_model": pgb.GATE_MODEL, "assets": {}}
if spec["id"] in state["assets"] and state["assets"][spec["id"]].get("status") == "accepted" and "--redo" not in sys.argv:
    sys.exit(f"{spec['id']} already accepted (--redo to paint again)")
r = pgb.run_asset(HERE, spec, rer, state)
for a in r["attempts"]:
    print(a["try"], a["verdict"], json.dumps(a.get("semantic", {}).get("problems")), "|", (a.get("semantic", {}).get("blind") or {}).get("what_i_see"))
