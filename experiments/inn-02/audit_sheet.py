"""Contact sheets for an independent second-model audit of the gates: each tile = accepted plate | its RGBA cut-out on
magenta, labelled with a number; a key file maps numbers to SKU + what the gate was asked to check."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
RUN = Path(__file__).resolve().parent
ids = sys.argv[2].split(",") if len(sys.argv) > 2 else None
name = sys.argv[1]
assets = {a["id"]: a for a in json.loads((RUN / "assets.json").read_text())["assets"]}
man = json.loads((RUN / "gate-manifest.json").read_text())["assets"]
acc = [k for k, v in man.items() if v.get("status") == "accepted" and (ids is None or k in ids)]
font = ImageFont.load_default(size=22)
N = 6
for page in range(0, len(acc), N):
    chunk = acc[page:page + N]
    sheet = Image.new("RGB", (3 * 520, 2 * 290), "white")
    key = []
    for i, k in enumerate(chunk):
        plate = Image.open(RUN / "inputs" / f"{k}.jpg").convert("RGB").resize((256, 256))
        rgba = Image.open(RUN / "masked" / f"{k}.png").convert("RGBA").resize((256, 256))
        cut = Image.new("RGB", (256, 256), (255, 0, 255)); cut.paste(rgba, mask=rgba.split()[3])
        x, y = (i % 3) * 520, (i // 3) * 290
        sheet.paste(plate, (x + 2, y + 30)); sheet.paste(cut, (x + 260, y + 30))
        ImageDraw.Draw(sheet).text((x + 4, y + 2), f"#{i+1}", fill="black", font=font)
        g = assets[k]["gate"]
        key.append(f"#{i+1} [{k}]: must be {g['desc']}" + (("; " + "; ".join(g["must"])) if g["must"] else ""))
    out = RUN / "audit" / f"{name}-{page // N + 1}.jpg"
    sheet.save(out, quality=88)
    (out.with_suffix(".key.txt")).write_text("\n".join(key) + "\n")
    print(out)
