#!/usr/bin/env python3
"""Contact sheets for Harry (after ../2026-11-07-cyberpunk-pawns/contact.py): all nine dinosaurs, the set's old
tyrannosaur and triceratops beside the seven new ones, each with its name, height and base; and the two flying poses.
    python3 contact.py [thumbs|plates|lean|table]
thumbs: the gallery thumbnails (the new ones from set/published/thumbs, the old two from the main set's);
plates: the accepted plates; lean/table: the in-game crops (shots/<id>-<mode>.png, table_shots.py). Writes to USB."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
HERE = Path(__file__).resolve().parent; USB = Path('/mnt/usb/turnip-works/lanes-2026-11-07/dinos')
MAINSET = Path('experiments/2026-10-06-figures/set')
mode = sys.argv[1] if len(sys.argv) > 1 else 'thumbs'
ORDER = ['foe-tyrannosaur', 'foe-triceratops', 'foe-velociraptor', 'foe-ankylosaurus', 'foe-stegosaurus', 'foe-spinosaurus', 'foe-brontosaurus', 'foe-pterodactyl', 'foe-quetzalcoatlus']
rows = {f['id']: f for f in json.loads((MAINSET / 'published/manifest.json').read_text())['figures'] if f['id'] in ORDER}
mine = HERE / 'set/published/manifest.json'
if mine.exists(): rows.update({f['id']: f for f in json.loads(mine.read_text())['figures']})
fly = {f['id']: f for f in json.loads((HERE / 'set/published/fly/manifest.json').read_text())['figures']} if (HERE / 'set/published/fly/manifest.json').exists() else {}
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17); big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 28)
except Exception: font = big = ImageFont.load_default()
SIZE = {5: 'medium', 10: 'large', 15: 'huge', 20: 'gargantuan'}


def pic(i, f, flying=False):
    if mode == 'plates':
        p = HERE / 'set/inputs' / f'{i}{"-fly" if flying else ""}.jpg'
        return p if p.exists() else MAINSET / 'inputs' / f'{i}.jpg'
    if mode == 'thumbs':
        if flying: return HERE / 'set/published/fly' / (f.get('thumb') or '-')
        own = HERE / 'set/published' / (f.get('thumb') or '-')
        return own if own.exists() else MAINSET / 'published' / (f.get('thumb') or '-')
    return HERE / 'shots' / f'{i}{"-fly" if flying else ""}-{mode}.png'


S, COLS, LBL = 300, 5, 46
items = [(i, rows[i], False) for i in ORDER if i in rows] + [(i, rows[i], True) for i in ORDER if i in fly and i in rows]
n = len(items); R = (n + COLS - 1) // COLS
sheet = Image.new('RGB', (COLS * S, 64 + R * (S + LBL)), (30, 28, 26)); d = ImageDraw.Draw(sheet)
d.text((16, 16), f'Turnip Works dinosaurs ({mode}): the set\'s two (first) and the seven new, then the flying poses', fill=(240, 232, 210), font=big)
for k, (i, f, flying) in enumerate(items):
    x, y = (k % COLS) * S, 64 + (k // COLS) * (S + LBL)
    p = pic(i, f, flying)
    if p.exists():
        im = Image.open(p).convert('RGB'); im.thumbnail((S - 8, S - 8)); sheet.paste(im, (x + (S - im.width) // 2, y + (S - im.height) // 2))
    else: d.text((x + 20, y + S // 2), '(no picture yet)', fill=(200, 90, 80), font=font)
    name = f['name'] + (' (flying)' if flying else '') + ('' if i in ('foe-tyrannosaur', 'foe-triceratops') else '  NEW')
    d.text((x + 8, y + S + 4), name[:30], fill=(240, 232, 210), font=font)
    sub = f"span {fly[i]['span_ft']} ft · h {fly[i]['height_ft']} ft" if flying else f"{f['height_ft']} ft · {SIZE.get(f['base_ft'], '?')} ({f['base_ft']}-ft base)"
    d.text((x + 8, y + S + 24), sub, fill=(170, 160, 140), font=font)
out = USB / f'contact-dinos-{mode}.jpg'; sheet.save(out, quality=88); print(out)
