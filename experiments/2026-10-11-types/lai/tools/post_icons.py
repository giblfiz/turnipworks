#!/usr/bin/env python3
"""raw-<key>.png (tools/render_icons.py, 384 px) -> icons/room-<key>.png, 128 px RGBA: cropped to the object, centred with a
6 px margin, a soft dark edge so it holds on the tray's dark and light grounds.  python3 tools/post_icons.py"""
import pathlib
from PIL import Image, ImageFilter, ImageChops
D = pathlib.Path(__file__).resolve().parents[1] / "icons"
for raw in sorted(D.glob("raw-*.png")):
    im = Image.open(raw).convert("RGBA"); box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if not box: print("EMPTY", raw.name); continue
    im = im.crop(box); s = max(im.size); sq = Image.new("RGBA", (s, s), (0, 0, 0, 0)); sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
    sq = sq.resize((116, 116), Image.LANCZOS); out = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    edge = Image.new("RGBA", (128, 128), (0, 0, 0, 0)); a = Image.new("L", (128, 128), 0); a.paste(sq.getchannel("A"), (6, 6))
    halo = a.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.2)); edge.putalpha(halo.point(lambda v: int(v * 0.75))); edge.paste((24, 18, 14), (0, 0, 128, 128), halo)
    edge.putalpha(halo.point(lambda v: int(v * 0.75)))
    out = Image.alpha_composite(out, edge); out.alpha_composite(sq, (6, 6))
    out.save(D / f"room-{raw.stem[4:]}.png"); print(f"room-{raw.stem[4:]}.png")
