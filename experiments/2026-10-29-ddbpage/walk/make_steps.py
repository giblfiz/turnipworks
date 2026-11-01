# The help page's step pictures: real screenshots of the walk (Chrome 146, a fresh profile, Beyond20 2.21.0 from the Web
# Store), each with a plain highlight box on what to click, the address field blurred (a table's address holds a seat link),
# cropped round the target; and the whole marked screen, for a click-through.   python3 make_steps.py OUTDIR
import json, os, sys
from PIL import Image, ImageDraw, ImageFilter
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True); D = os.path.dirname(os.path.abspath(__file__)); DATE = '20261029e'
T = json.load(open(os.path.join(D, 'targets.json')))
T.update({'w02-add-hover': {'x': 1181, 'y': 221, 'w': 147, 'h': 40}, 'w04-add-ext-hover': {'x': 890, 'y': 318, 'w': 108, 'h': 32},
          's31-sheet-tab': {'x': 10, 'y': 6, 'w': 236, 'h': 30}, 's33-back-to-table': {'x': 250, 'y': 6, 'w': 236, 'h': 30}})
T['s19b-typed'] = T['s19-box-click']
# measured from the pixels (native dialogs, tabs) or the page's own layout (VIEW), after Gemini's check of the first marks
T.update({'w02-add-hover': {'x': 1181, 'y': 221, 'w': 92, 'h': 39}, 'w04-add-ext-hover': {'x': 875, 'y': 291, 'w': 127, 'h': 39},
          's05-view': {'x': 233, 'y': 709, 'w': 62, 'h': 41}, 's22-allow': {'x': 935, 'y': 251, 'w': 67, 'h': 39},
          's26-close-options': {'x': 1031, 'y': 187, 'w': 13, 'h': 12}, 's28-table-tab': {'x': 276, 'y': 6, 'w': 235, 'h': 30},
          's33-back-to-table': {'x': 276, 'y': 6, 'w': 235, 'h': 30}, 's31-sheet-tab': {'x': 38, 'y': 6, 'w': 235, 'h': 30}})
CENTRE = {'s30-connected': (800, 620), 'w10-install-tabs': (800, 280)}
STEPS = ['w02-add-hover', 'w04-add-ext-hover', 'w10-install-tabs', 's08-puzzle-hover', 's10-pin-hover', 's05-view', 's06-parse-ok', 's07-features',
         's12-icon-hover', 's14-options-link-hover', 's16-advanced-hover', 's19-box-click', 's19b-typed', 's20-apply', 's22-allow', 's26-close-options',
         's28-table-tab', 's29-reload', 's30-connected', 's31-sheet-tab', 's32-initiative', 's33-back-to-table', 's34-link']
OMNI = (108, 50, 1336, 86)   # the address field (back / forward / reload stay; the extension icons stay)
CW, CH = 1000, 562
for n, name in enumerate(STEPS, 1):
    im = Image.open(os.path.join(D, 'shots', name + '.png')).convert('RGB')
    im.paste(im.crop(OMNI).filter(ImageFilter.GaussianBlur(9)), OMNI[:2])
    r = T.get(name)
    if r:
        d = ImageDraw.Draw(im); p = 7
        d.rounded_rectangle((r['x'] - p, r['y'] - p, r['x'] + r['w'] + p, r['y'] + r['h'] + p), radius=8, outline=(232, 64, 30), width=5)
        cx, cy = r['x'] + r['w'] / 2, r['y'] + r['h'] / 2
    else: cx, cy = CENTRE.get(name, (800, 300))
    x0 = int(min(max(cx - CW / 2, 0), 1600 - CW)); y0 = int(min(max(cy - CH / 2, 0), 900 - CH))
    im.crop((x0, y0, x0 + CW, y0 + CH)).save(os.path.join(OUT, f'step-{n:02d}-{DATE}.jpg'), quality=82)
    im.save(os.path.join(OUT, f'step-{n:02d}-full-{DATE}.jpg'), quality=80)
    print(n, name, (x0, y0), bool(r))
