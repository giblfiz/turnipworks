#!/usr/bin/env python3
"""gen.py of the castle / crypt / mansion batch, with two changes for a crowded box (2026-10-11: five type agents on one
12 GB card, the BiRefNet matte ran out of GPU memory and three painted plates were lost at the matte step):
  1. the matte runs on the CPU (every .to("cuda") / .half() becomes cpu / float32);
  2. a plate Codex already painted (work/<id>.tryN.jpg from a run that died after painting) is used, not painted again.
Same arguments as gen.py. TW_B must name the batch folder (experiments/2026-10-11-types)."""
import importlib.util, sys, os
from pathlib import Path
import torch
if os.environ.get("TW_MATTE", "cpu") == "cpu":
    _mto, _tto = torch.nn.Module.to, torch.Tensor.to
    fix = lambda a: tuple("cpu" if (isinstance(x, str) and x.startswith("cuda")) else x for x in a)
    torch.nn.Module.to = lambda self, *a, **k: _mto(self, *fix(a), **k)
    torch.Tensor.to = lambda self, *a, **k: _tto(self, *fix(a), **k)
    torch.nn.Module.half = lambda self: self.float()
    torch.Tensor.half = lambda self: self.float()
    torch.nn.Module.cuda = lambda self, *a, **k: self
    torch.Tensor.cuda = lambda self, *a, **k: self
    torch.set_num_threads(int(os.environ.get("TW_MATTE_THREADS", "4")))
GEN = Path(__file__).resolve().parents[3] / "2026-10-05-castle-crypt-mansion/tools/gen.py"
spec = importlib.util.spec_from_file_location("ccm_gen", GEN); gen = importlib.util.module_from_spec(spec); spec.loader.exec_module(gen)
# 3. (same day, load average 60) the CPU matte took over two minutes a plate behind one lock. The plates are painted on a
#    flat chroma-blue ground, so the CHROMA key is tried first (instant); the mask gate judges it as usual, and where it
#    refuses, run_asset()'s "fallback" is the BiRefNet matte (on the CPU) instead of the chroma key over again.
#    gate-manifest.json then says matte "birefnet" for a chroma-first plate and "chroma" for a BiRefNet one: read
#    `matte_first` in the attempt record instead.
sys.path.insert(0, str(gen.ROOT / "src"))
import plate_gate_batch as pgb
if os.environ.get("TW_CHROMA_FIRST", "1") == "1":
    _biref, _chroma, _seen = pgb.birefnet, pgb.chroma_rgba, set()
    def chroma_first(plate, out):
        if _chroma(plate, out):
            _seen.add(str(plate)); return {"verdict": "ok", "matte_first": "chroma"}
        return _biref(plate, out)
    def second(plate, out):
        if str(plate) in _seen:
            rec = _biref(plate, out); return rec.get("verdict") != "fail"
        return _chroma(plate, out)
    pgb.birefnet, pgb.chroma_rgba = chroma_first, second
_paint = gen.codex_generate
def reuse(root, asset, attempt, extra):
    out = root / "work" / f"{asset['id']}.try{attempt}.jpg"
    if out.exists() and not extra:
        print(f"{asset['id']}: using the plate already painted ({out.name})", flush=True)
        return out
    return _paint(root, asset, attempt, extra)
gen.codex_generate = reuse
# 4. a plate that is in masked/ IS accepted, whatever gate-manifest.json says (each run rewrites that file whole from what
#    it loaded at its start, so a run killed and restarted beside another lost eleven accepted records on 2026-10-11)
import json
_root = next((Path(a) for a in sys.argv[1:] if not a.startswith("-")), None)
if _root is not None:
    _root = _root if _root.exists() else Path(os.environ.get("TW_B", ".")) / _root
    _man = _root / "gate-manifest.json"
    if _man.exists() and (_root / "masked").exists():
        _st = json.loads(_man.read_text()); _n = 0
        for _p in (_root / "masked").glob("*.png"):
            if _st["assets"].get(_p.stem, {}).get("status") != "accepted":
                _st["assets"][_p.stem] = {**_st["assets"].get(_p.stem, {}), "id": _p.stem, "status": "accepted", "note": "restored from masked/"}; _n += 1
        if _n: _man.write_text(json.dumps(_st, indent=1) + "\n"); print(f"gate-manifest.json: {_n} accepted plates restored from masked/", flush=True)
gen.main()
