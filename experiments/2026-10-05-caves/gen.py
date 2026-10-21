#!/usr/bin/env python3
"""Plates for the cave-wall pilot (same script as the slopes pilot) through the project's gates (src/plate_gate_batch.py: blind describe -> match ->
BiRefNet matte -> mask gate), with the plate itself painted by Codex's built-in image tool (`codex exec`, ChatGPT
login: no API spend) instead of the paid Gemini image model. Nothing here calls fal, RunPod or a paid image API.
    python3 gen.py . --workers 3
"""
import subprocess, sys, tempfile, os
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
import plate_gate_batch as pgb

def codex_generate(root, asset, attempt, extra):
    (root / "prompts").mkdir(exist_ok=True); (root / "work").mkdir(exist_ok=True)
    prompt = asset["prompt"] + (f"\n\nCorrections from a rejected previous attempt (fix these): {extra}" if extra else "")
    (root / "prompts" / f"{asset['id']}.try{attempt}.md").write_text(prompt)
    out = root / "work" / f"{asset['id']}.try{attempt}.jpg"
    wd = tempfile.mkdtemp(prefix=f"caves-{asset['id']}-")
    name = "plate"
    full = ("Use your built-in image generation tool. The attached image is the reference described below.\n\n" + prompt +
            f"\nSave the resulting PNG (square, at least 1024 px) into the current directory as {name}.png and print its path and pixel size.")
    cmd = ["codex", "exec", "--skip-git-repo-check", "-C", wd, "-s", "workspace-write"]
    for ref in asset.get("refs", []): cmd += ["-i", str(ref)]
    cmd += ["-"]
    for k in range(2):
        r = subprocess.run(cmd, input=full, capture_output=True, text=True, timeout=1200)
        with open(root / "work" / f"{asset['id']}.codex.log", "a") as f: f.write(r.stdout[-3000:] + r.stderr[-2000:])
        got = os.path.join(wd, f"{name}.png")
        if os.path.exists(got):
            Image.open(got).convert("RGB").save(out, quality=94)
            return out
    raise RuntimeError("codex image failed: " + (r.stderr or r.stdout)[-300:])

pgb.generate = codex_generate
pgb.IMAGE_COST = 0.0
if __name__ == "__main__":
    pgb.main()
