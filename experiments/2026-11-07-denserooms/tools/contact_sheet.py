"""Before / after contact sheet for Harry: one row a room (its name, old -> new density), the table view before and after.
    python3 contact_sheet.py SHOTS_ROOT OUT.png keys..."""
import sys, json, os
from PIL import Image, ImageDraw, ImageFont
root, outp, keys = sys.argv[1], sys.argv[2], sys.argv[3:]
here = os.path.dirname(os.path.abspath(__file__))
B = json.load(open(f'{here}/../before.json')); A = json.load(open(f'{here}/../after.json'))
T = {t['key']: t for t in json.load(open(f'{here}/../../../tools/spawn-tuner/data/rooms.json'))}
W, H, PAD, LAB = 760, 620, 12, 46
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22); small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
except Exception: font = small = ImageFont.load_default()
def crop(im):  # to what differs from the background (the corner's colour), a little margin
    from PIL import ImageChops
    bg = Image.new('RGB', im.size, im.getpixel((2, 2))); box = ImageChops.difference(im, bg).convert('L').point(lambda v: 255 if v > 24 else 0).getbbox()
    if not box: return im
    m = 16; return im.crop((max(0, box[0] - m), max(0, box[1] - m), min(im.width, box[2] + m), min(im.height, box[3] + m)))
def dens(J, k):
    c = T[k]['cells']; rows = [r for r in J[k]['rows'] if [r['w'], r['d']] == c]
    return sum(r['density'] for r in rows) / len(rows), sum(r['cov'] for r in rows) / len(rows)
COLS = 3; TW, TH = 400, 840; CW = 2 * TW + 3 * PAD; CH = TH + LAB + 2 * PAD
rows = (len(keys) + COLS - 1) // COLS
sheet = Image.new('RGB', (COLS * CW + PAD, 50 + rows * CH), (24, 24, 28)); dr = ImageDraw.Draw(sheet)
dr.text((PAD, PAD), 'Denser City / Cyberpunk rooms, 2026-11-07. Each pair: BEFORE (left), AFTER (right); default size, seed 11, table view', fill=(235, 235, 235), font=font)
for n, k in enumerate(keys):
    x0, y0 = (n % COLS) * CW + PAD, 50 + (n // COLS) * CH
    (d0, c0), (d1, c1) = dens(B, k), dens(A, k)
    dr.text((x0, y0), f"{T[k]['label']} ({T[k]['cells'][0] * 5}x{T[k]['cells'][1] * 5} ft)", fill=(240, 220, 150), font=font)
    dr.text((x0, y0 + 26), f"{d0:.1f} -> {d1:.1f} props/100 sq ft (target {B[k]['target']} -> {A[k]['target']}); floor {c0 * 100:.0f}% -> {c1 * 100:.0f}%", fill=(210, 210, 210), font=small)
    for i, side in enumerate(('before', 'after')):
        p = f'{root}/{side}/{k}-default-11-table.png'
        if os.path.exists(p): im = Image.open(p).convert('RGB'); im.thumbnail((TW, TH)); sheet.paste(im, (x0 + i * (TW + PAD), y0 + LAB + 8))
sheet.save(outp, quality=88); print(outp, sheet.size)
