#!/usr/bin/env python3
"""The blind class read (set_blind.py's question, unchanged) asked of PLATES instead of gallery thumbnails: a quick
proxy for "will this kit read as its class" before any pod time is spent on it. Not the verdict: the mesh read is.
    python3 plate_blind.py --ids=a,b [--reads=3]   -> prints, and set/plate-blind.json"""
import concurrent.futures, json, re, shutil, sys, tempfile
from pathlib import Path
HERE = Path(__file__).resolve().parent; SET = HERE / "set"; sys.path.insert(0, str(HERE.parents[1] / "src"))
import plate_gate_batch as pgb
PROMPT = re.search(r'PROMPT = f"""(.*?)"""', (HERE / "set_blind.py").read_text(), re.S).group(1).replace("{CLASSES}", "barbarian, bard, cleric, druid, fighter, monk, paladin, ranger, rogue, sorcerer, warlock, wizard").replace("{{", "{").replace("}}", "}")
ids = next(a.split("=", 1)[1].split(",") for a in sys.argv if a.startswith("--ids=")); reads = int(next((a.split("=")[1] for a in sys.argv if a.startswith("--reads=")), 3))
tmp = Path(tempfile.mkdtemp(prefix="plateblind-", dir=str(SET / "work")))
def one(job):
    from PIL import Image
    i, n = job; im = Image.open(SET / "masked" / f"{i}.png").convert("RGBA"); bg = Image.new("RGBA", im.size, (150, 150, 150, 255)); bg.alpha_composite(im)
    f = tmp / f"figure-{abs(hash(i)) % 100000}-{n}.png"; bg.convert("RGB").resize((768, round(768 * im.size[1] / im.size[0]))).save(f)
    try: r, _ = pgb.vision(pgb.img_part(f, "the figure"), PROMPT); return i, r
    except Exception as e: return i, {"error": str(e)[:200]}
out = SET / "plate-blind.json"; data = json.loads(out.read_text()) if out.exists() else {}
with concurrent.futures.ThreadPoolExecutor(8) as ex:
    for i, r in ex.map(one, [(i, n) for i in ids for n in range(reads)]):
        data.setdefault(i, []).append(r); print(i, "|", r.get("class_guess") or r.get("error"), r.get("class_second"), "|", (r.get("blind") or "")[:150], flush=True)
out.write_text(json.dumps(data, indent=1) + "\n"); shutil.rmtree(tmp, ignore_errors=True)
