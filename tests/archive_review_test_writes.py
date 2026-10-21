"""LEGACY (2026-10-05): the review tests now write to the server's test sandbox (tests/tw_sandbox.py); nothing to archive.
Move only the review page's acceptance-test ratings (keys under fauna-test/) out of the live store.
Never rewrites Harry's records: ratings.jsonl keeps every other line byte-for-byte; latest.json loses only fauna-test/ keys."""
import json, pathlib, os
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[1] / 'server')); from reviews_home import reviews_dir  # the live records are outside the checkout (TW_REVIEWS_DIR)
R = reviews_dir()
arch = R / "fauna-test-ratings-20261002.jsonl"
log, latest = R / "ratings.jsonl", R / "latest.json"
lines = log.read_text().splitlines(keepends=True)
test = [l for l in lines if l.strip() and json.loads(l)["key"].startswith("fauna-test/")]
keep = [l for l in lines if l not in test]
with arch.open("a") as fh:
    fh.writelines(test)
if log.read_text().splitlines(keepends=True) != lines:
    raise SystemExit("ratings.jsonl changed underneath; rerun")
tmp = log.with_suffix(".tmp"); tmp.write_text("".join(keep)); os.replace(tmp, log)
d = json.loads(latest.read_text())
gone = [k for k in d if k.startswith("fauna-test/")]
for k in gone: d.pop(k)
tmp = latest.with_suffix(".tmp2"); tmp.write_text(json.dumps(d, indent=1)); os.replace(tmp, latest)
print(f"archived {len(test)} log lines, dropped {len(gone)} latest keys; kept {len(keep)} lines, {len(d)} keys")
