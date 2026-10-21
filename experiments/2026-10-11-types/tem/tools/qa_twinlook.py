#!/usr/bin/env python3
"""The twin LOOK check (the crypt agent's by-hand call, made a script): ONE blind Gemini call per pair on the two four-view
sheets (qa/<sku>.sheet.jpg). Gemini is not told the two are related. Pairs: every twin_of in assets.json, or A:B given.
    python3 tools/qa_twinlook.py TYPE_DIR [closed:open ...]   -> TYPE_DIR/qa-extra/twinlook-<open>.json, one line each
Fields: second_state, second_hollow, same_design, confidence, differences, at_table_distance_would_pass_as_same_object."""
import json, re, subprocess, sys, tempfile, os
from pathlib import Path
GV = "~/fauna-tools/gemini-vision.py"; MODEL = os.environ.get("QA_MODEL", "gemini-3.8-flash")
T = Path(sys.argv[1])
if not T.exists(): T = Path(__file__).resolve().parent.parent / sys.argv[1]
spec = {a["id"]: a for a in json.loads((T / "assets.json").read_text())["assets"]}
pairs = [tuple(p.split(":")) for p in sys.argv[2:]] or [(v["twin_of"], k) for k, v in spec.items() if v.get("twin_of")]
PROMPT = """Two sheets, each showing ONE 3D model from four cameras (far from above with a 5 ft 9 in grey scale figure; close from low; straight above; close from high). You are not told what they are or whether they are related.
Describe the model on the first sheet, then the model on the second sheet. Then compare: is the second the SAME designed object as the first (same construction, materials, colours, ornaments, proportions) in a different state (opened, lid off, door swung, raised), or a different design?
Return ONLY JSON: {"first": "...", "second": "...", "second_state": "closed | open | other", "second_hollow": true|false, "inside": "...", "same_design": true|false, "confidence": 0-1, "matches": ["..."], "differences": ["..."], "colour_match": "same | slightly different | clearly different", "at_table_distance_would_pass_as_same_object": true|false}"""
(T / "qa-extra").mkdir(exist_ok=True)
for a, b in pairs:
    sa, sb = T / "qa" / f"{a}.sheet.jpg", T / "qa" / f"{b}.sheet.jpg"
    if not sa.exists() or not sb.exists(): print(b, "sheet missing"); continue
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f: f.write(PROMPT)
    out = None
    for _ in range(3):
        r = subprocess.run(["python3", GV, MODEL, f.name, str(sa), str(sb)], capture_output=True, text=True, timeout=300)
        m = re.search(r"\{.*\}", r.stdout, re.S)
        if r.returncode == 0 and m:
            try: out = json.loads(m.group(0)); break
            except json.JSONDecodeError: pass
    os.unlink(f.name)
    if not out: print(b, "no answer"); continue
    out["pair"] = [a, b]; (T / "qa-extra" / f"twinlook-{b}.json").write_text(json.dumps(out, indent=1))
    print(f"{b} vs {a}: same_design {out.get('same_design')} conf {out.get('confidence')} state {out.get('second_state')} hollow {out.get('second_hollow')} colour {out.get('colour_match')} table-distance-same {out.get('at_table_distance_would_pass_as_same_object')} | diff: {'; '.join(out.get('differences', []))[:260]}")
