#!/usr/bin/env python3
"""Blind pairs for the detail tiers: the original against each lighter tier (and against itself, as a control), same
camera, random order, neutral file names. Gemini says whether they differ and which is lower detail.
    python3 tier_judge.py   -> gemini/tier-*.txt and tier/judge.json"""
import json, random, shutil, subprocess, concurrent.futures
from pathlib import Path
H = Path(__file__).resolve().parent; random.seed(7); jobs = []
for view in ("table", "lean", "closeF", "closeW"):
    for tier in ("full", "5k256", "5k512", "20k1024", "20kbake"):
        for rep in (1, 2):
            first_is_tier = random.random() < 0.5; d = H / "shots/tiers/pairs" / f"{view}-{tier}-{rep}"; d.mkdir(parents=True, exist_ok=True)
            a, b = H / f"shots/tiers/t-full-{view}.png", H / f"shots/tiers/t-{tier}-{view}.png"
            shutil.copy(b if first_is_tier else a, d / "picture-one.png"); shutil.copy(a if first_is_tier else b, d / "picture-two.png")
            jobs.append((view, tier, rep, first_is_tier, d))
def run(j):
    view, tier, rep, first, d = j
    r = subprocess.run(["python3", "~/fauna-tools/gemini-vision.py", "gemini-2.5-pro", str(H / "gemini/tierpair.txt"), str(d / "picture-one.png"), str(d / "picture-two.png")], capture_output=True, text=True, timeout=600)
    (H / "gemini" / f"tier-{view}-{tier}-{rep}.txt").write_text(r.stdout + r.stderr[-300:])
    g = lambda k: next((l.split(":", 1)[1].strip().lower() for l in r.stdout.splitlines() if l.strip().upper().startswith(k)), "?")
    low = g("LOWER_DETAIL"); picked = "tier" if (("one" in low) == first and ("one" in low or "two" in low)) else ("original" if ("one" in low or "two" in low) else "cannot tell")
    return {"view": view, "tier": tier, "rep": rep, "said": g("SAME_OR_DIFFERENT"), "picked_as_lower": picked, "how_much": g("HOW_MUCH")}
with concurrent.futures.ThreadPoolExecutor(8) as ex: res = list(ex.map(run, jobs))
(H / "tier/judge.json").write_text(json.dumps(res, indent=1) + "\n")
for r in res: print(r)
