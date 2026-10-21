"""LEGACY (2026-10-05): tests now write to the server's test sandbox (tests/tw_sandbox.py), so there is nothing to archive
and no need to run this after a suite. Kept for cleaning up a leak that tests/check_house_look.py reports.
Move only acceptance-test write-backs out of reviews/tuner/*.jsonl (never whole files: Harry's sends live there too)."""
import json, pathlib
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[3] / 'server')); from reviews_home import reviews_dir  # the live records are outside the checkout (TW_REVIEWS_DIR)
D = reviews_dir() / "tuner"
arch = D / "fauna-test-20260930.jsonl"
for kind in ("preset", "layout", "note", "orient", "map", "fx", "fire_anchor", "house", "water_surface", "hinge"):
    f = D / f"{kind}.jsonl"
    if not f.exists():
        continue
    recs = [json.loads(l) for l in f.read_text().splitlines() if l.strip()]
    test = [r for r in recs if r["name"].endswith("acceptance-test") or "acceptance test (Fauna)" in (r.get("note") or "")
            or (kind == "house" and "acceptance-test" in (r.get("note") or ""))]  # "Use in game" notes name the preset
    keep = [r for r in recs if r not in test]
    with arch.open("a") as fh:
        fh.writelines(json.dumps(r) + "\n" for r in test)
    f.write_text("".join(json.dumps(r) + "\n" for r in keep))
    print(f"{kind}: archived {len(test)} test records, kept {len(keep)}")
