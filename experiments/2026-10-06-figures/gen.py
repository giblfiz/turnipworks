#!/usr/bin/env python3
"""Plates for the figures pilot through the project's gates (src/plate_gate_batch.py: blind describe -> match ->
BiRefNet matte -> mask gate), painted by Codex's built-in image tool (`codex exec`, ChatGPT login: no API spend).
The stock semantic gate is for props ("no people"); this one asks the blind observer about a FIGURE (what it is, what it
holds, what is under its feet, which limbs touch) and refuses a base/plinth, a cropped figure, fused limbs, a missing weapon.
    python3 gen.py . --workers 4 --rerolls 2
"""
import json, subprocess, sys, tempfile, os
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
import plate_gate_batch as pgb

def codex_generate(root, asset, attempt, extra):
    (root / "prompts").mkdir(exist_ok=True); (root / "work").mkdir(exist_ok=True)
    prompt = asset["prompt"] + (f"\n\nCorrections from a rejected previous attempt (fix these): {extra}" if extra else "")
    (root / "prompts" / f"{asset['id']}.try{attempt}.md").write_text(prompt)
    out = root / "work" / f"{asset['id']}.try{attempt}.jpg"
    wd = tempfile.mkdtemp(prefix=f"figures-{asset['id']}-")
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

def figure_gate(asset, plate):
    g = asset["gate"]
    blind = """Describe the CANDIDATE image plainly; you are not told what it is meant to be.
First list any text, labels or watermarks. Then:
- how many separate figures or objects are in the image;
- what the figure is (your best name, and a second guess); roughly how tall such a creature would be and its body proportions;
- what it is HOLDING or carrying, in which hand, and whether each held thing is complete end to end (count them);
- its limbs, counted: arms, legs, ears, tail; for each pair of neighbouring parts (leg and leg, arm and body, weapon and body,
  tail and leg) say whether you can see BACKGROUND between them or whether they touch / merge;
- what is directly UNDER its feet: nothing at all, a shadow or dark blob, a disc, a base, a plinth, a rock, a patch of ground;
- whether every part of it is inside the frame, or anything (head, hat, weapon tip, feet, tail) is cut off by the image edge;
- whether it is painted in full colour or looks like an unpainted grey / metal / stone statue; main colours;
- the background (colour, uniformity, floor, horizon, shadows) and the viewing angle.
Return JSON: {"what_i_see": "<one sentence>", "details": "<the full description>", "under_feet": "<what is under the feet>", "held": ["..."], "cropped": true|false}"""
    seen, use1 = pgb.vision(pgb.img_part(plate, "CANDIDATE image"), blind)
    must = "\n".join(f"- {m}" for m in g.get("must", []))
    must_not = "\n".join(f"- {m}" for m in g.get("must_not", []))
    match = f"""You are the semantic gate of a 3D miniature-figure factory. An observer who was NOT told what to expect
described a concept image as follows:

{json.dumps(seen, ensure_ascii=False)}

The image was requested to show: {g['desc']}
Requirements:
- exactly ONE figure, whole, not cropped anywhere, not a grid or multiple views
- recognisably the requested figure
- NOTHING under the feet: refuse any base, disc, plinth, pedestal, rock, ground patch, cast shadow or dark blob
- a plain uniform background, no floor, no scenery, no text
{must}
Must NOT:
{must_not}

Proportions: EVERY figure in this set is a stout, chunky, big-headed tabletop miniature, so an observer may call a human
'a dwarf', 'a gnome' or 'a halfling' only because it looks short and stocky. Do NOT fail a figure for looking short, stocky
or child-sized; judge which people it is only by features (ears, skin colour, horns, tusks, beard, scales, tail).
Judge only from the observer's description; if it does not mention something the spec needs, treat it as missing.
Return JSON: {{"what_i_see": "<the observer's one sentence>", "ok": true|false, "problems": ["<short, specific, fixable>"]}}
Set ok=false for anything that would make the 3D figure wrong (a base, a crop, fused limbs, a missing or incomplete weapon,
the wrong creature); ignore minor painterly details."""
    verdict, use2 = pgb.vision([], match)
    verdict["blind"] = seen
    use = {k: use1.get(k, 0) + use2.get(k, 0) for k in set(use1) | set(use2) if isinstance(use1.get(k, 0), int) and isinstance(use2.get(k, 0), int)}
    return verdict, use

pgb.generate = codex_generate
pgb.semantic_gate = figure_gate
pgb.IMAGE_COST = 0.0
if __name__ == "__main__":
    pgb.main()
