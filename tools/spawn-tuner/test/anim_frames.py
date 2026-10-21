"""Capture an in-animation as a frame sequence (top-down, slow-mo) -> contact sheet.  python anim_frames.py URL OUT.png"""
import sys, time, json
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
url, out = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1300, 'height': 800})
    pg.goto(url); pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
    pg.evaluate("void tuner.createRoom('common', 4, 3, 6, 4)")
    pg.wait_for_function('tuner.rooms().length === 1 && tuner.episodes() === 0', timeout=90000)
    pg.evaluate("tuner.cam.preset('top', {x:35, z:25}); tuner.cam.dist = 48; tuner.cam.update()")
    # pause, replay, then scrub through the episode deterministically (software GL is too slow for real-time frames)
    pg.evaluate("tuner.replay('in')")
    total = pg.evaluate("tuner.scrubTotal()")
    frames = []
    for k in range(12):
        t = total * k / 11
        pg.evaluate(f"tuner.scrubTo({t})")
        time.sleep(0.15)
        path = f'/tmp/scratch/f{k:02d}.png'
        pg.locator('#c').screenshot(path=path)
        frames.append((path, t, pg.evaluate('tuner.visibleCount()')))
    b.close()
ims = [Image.open(f[0]).convert('RGB').resize((400, 270)) for f in frames]
sheet = Image.new('RGB', (4 * 400, 3 * 290), 'white'); d = ImageDraw.Draw(sheet)
for i, (im, (pth, t, n)) in enumerate(zip(ims, frames)):
    x, y = (i % 4) * 400, (i // 4) * 290
    sheet.paste(im, (x, y + 20)); d.text((x + 4, y + 4), f'FRAME {i + 1}  t={t:.0f} ms  visible={n}', fill='black')
sheet.save(out)
print(json.dumps([(round(t), n) for _, t, n in frames]))
