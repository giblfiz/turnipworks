#!/usr/bin/env python3
"""Gemini's blind read of every published figure, from its gallery thumbnail (the mesh as the page draws it, alone,
neutral file name): what is it, what does it hold, is anything malformed; and, without being told, which adventurer
class or what kind of townsperson or monster it is. Flash model, one call a figure, cached in set/blind.json.
    python3 set_blind.py [--ids a,b] [--redo]"""
import concurrent.futures, json, shutil, sys, tempfile
from pathlib import Path
HERE = Path(__file__).resolve().parent; SET = HERE / "set"; sys.path.insert(0, str(HERE.parents[1] / "src"))
import plate_gate_batch as pgb
CLASSES = "barbarian, bard, cleric, druid, fighter, monk, paladin, ranger, rogue, sorcerer, warlock, wizard"
PROMPT = f"""This is one painted miniature figure for a fantasy tabletop game, seen alone. You are not told what it is.
Describe it plainly, then answer. Return JSON:
{{"blind": "<one sentence: what it is, what it wears, what it holds>",
 "kind": "adventurer | townsperson | monster | animal",
 "people": "<human, elf, dwarf, halfling or gnome, orc, tiefling, dragonborn, goblin, ... your best guess>",
 "class_guess": "<if it looks like an adventurer: the ONE class it most looks like, from: {CLASSES}; else null>",
 "class_second": "<your second guess from the same list, or null>",
 "role_guess": "<if a townsperson, monster or animal: its trade or what creature it is, in two or three words; else null>",
 "holding": ["<each thing it holds or carries>"],
 "faults": ["<anything malformed, fused, melted, broken, missing or floating; empty list if none>"]}}"""
out = SET / "blind.json"; data = json.loads(out.read_text()) if out.exists() else {}
ids = next((a.split("=", 1)[1].split(",") for a in sys.argv if a.startswith("--ids=")), None)
stale = SET / "blind-stale"
todo = [p for p in sorted((SET / "published/thumbs").glob("*.webp")) if (ids is None or p.stem in ids) and (p.stem not in data or "--redo" in sys.argv or (stale / p.stem).exists())]
tmp = Path(tempfile.mkdtemp(prefix="figblind-"))
def one(p):
    from PIL import Image
    f = tmp / f"figure-{abs(hash(p.stem)) % 100000}.png"; Image.open(p).convert("RGB").save(f)      # a neutral name; the gate helper sends no file name anyway
    try: r, _ = pgb.vision(pgb.img_part(f, "the figure"), PROMPT); return p.stem, r
    except Exception as e: return p.stem, {"error": str(e)[:200]}
with concurrent.futures.ThreadPoolExecutor(8) as ex:
    for i, r in ex.map(one, todo):
        if "error" not in r: data[i] = r; (stale / i).unlink(missing_ok=True)
        print(i, "|", r.get("class_guess") or r.get("role_guess") or r.get("error"), "|", (r.get("blind") or "")[:110], flush=True)
out.write_text(json.dumps(data, indent=1) + "\n"); shutil.rmtree(tmp, ignore_errors=True)
