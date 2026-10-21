"""Room icons for the Build tray, rendered from the rooms themselves (128 px RGBA): the image allowance for PAINTED icons was
spent when this type was built, so each icon is the room as the tuner lays it out, seen from a high three-quarter angle,
cut out of the page by difference (one picture with the room, one after deleting it, same camera).
  PY=python3
  $PY make_icons.py BASE_URL OUTDIR API_ORIGIN [--seed 11] [--keys a,b]
Writes OUTDIR/room-<key>.png. Replace them with painted icons (experiments/2026-10-03-build-icons method) when the allowance returns."""
import sys, time, json, os, io
from PIL import Image, ImageChops, ImageFilter
opt = lambda k, d: next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == k and i + 1 < len(sys.argv)), d)
args = [a for a in sys.argv[1:] if not a.startswith('--')]; base, out, api = args[0].rstrip('/'), args[1], args[2]; seed = opt('--seed', '11'); only = [k for k in opt('--keys', '').split(',') if k]
os.makedirs(out, exist_ok=True)
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
    pg0 = b.new_page(); pg0.goto(base + '/data/rooms.json'); types = [t for t in json.loads(pg0.inner_text('body')) if t.get('group') == 'Farmstead' and (not only or t['key'] in only)]; pg0.close()
    for t in types:
        w, d = t['cells']; pg = b.new_page(viewport={'width': 1500, 'height': 950}, device_scale_factor=2)
        pg.route('**/api/tw-ratings/**', lambda route: route.fulfill(response=route.fetch(url=api + route.request.url.split('/api/tw-ratings', 1)[1], method=route.request.method, headers=route.request.headers, post_data=route.request.post_data)))
        pg.goto(base + f'/index.html?nobg&seed={seed}&nofx'); pg.wait_for_selector('body[data-ready="1"]', timeout=120000)
        settle = lambda: (pg.wait_for_function('tuner.episodes() === 0', timeout=300000), time.sleep(0.5))
        pg.evaluate(f"void tuner.createRoom('{t['key']}', 4, 5, {w}, {d})"); settle(); time.sleep(1.0); settle()
        rid = pg.evaluate(f"tuner.rooms().find(r => r.type === '{t['key']}').id")
        pg.evaluate("(() => { tuner.hideLabels(true); })()"); pg.keyboard.press('Escape'); pg.add_style_tag(content='#hint, #hud, #palette { display: none !important; }'); time.sleep(0.3)
        stage = pg.evaluate("(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()")
        cx, cz, span = (4 + w / 2) * 5, (5 + d / 2) * 5, max(w, d) * 5
        pg.evaluate(f"(() => {{ tuner.cam.focus.set({cx}, 2, {cz}); tuner.cam.dist = {span * 1.25 + 14}; tuner.cam.pitch = 42; tuner.cam.yaw = 35; tuner.cam.update(); }})()"); time.sleep(2.5)
        A = Image.open(io.BytesIO(pg.screenshot(clip=stage))).convert('RGB')
        pg.evaluate(f"void tuner.deleteRoom('{rid}')"); time.sleep(0.5); settle(); time.sleep(2.0)
        B = Image.open(io.BytesIO(pg.screenshot(clip=stage))).convert('RGB')
        diff = ImageChops.difference(A, B).convert('L').point(lambda v: 255 if v > 14 else 0).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
        box = diff.point(lambda v: 255 if v > 128 else 0).getbbox()
        if not box: print(t['key'], 'NO DIFFERENCE'); pg.close(); continue
        im = A.convert('RGBA'); im.putalpha(diff); im = im.crop(box); side = max(im.size); sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
        sq.resize((128, 128), Image.LANCZOS).save(f"{out}/room-{t['key']}.png"); print(t['key'], box, flush=True); pg.close()
    b.close()
