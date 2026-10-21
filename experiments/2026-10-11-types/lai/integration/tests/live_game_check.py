"""Live check of one new type in the GAME: the Build tray lists the type's rooms, one room is built in a throwaway
campaign and photographed (for a blind read). Never opens an existing campaign: it always starts a NEW one, named by you.
  PY=python3
  $PY live_game_check.py CODE ROOMKEY W D OUTDIR [--page https://turnipworks.net/] [--name zz-crypt-check-fauna]
     CODE = the type's catalog code (CRY, CAS, NOB)
"""
import sys, json, time, os
from playwright.sync_api import sync_playwright
opt = lambda k, d: next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == k and i + 1 < len(sys.argv)), d)
code, key, w, d, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
page, name = opt('--page', 'https://turnipworks.net/'), opt('--name', 'zz-crypt-check-fauna')
assert name.startswith('zz-'), 'a throwaway campaign name starts with zz-'
os.makedirs(out, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
    pg = b.new_page(viewport={'width': 1400, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('response', lambda r: errs.append(f'HTTP {r.status} {r.url}') if r.status >= 400 else None)
    pg.goto(page + '?nopost&nointro')
    pg.fill('#newCampaign input[name=name]', name); pg.fill('#newCampaign input[name=gm]', 'fauna-check'); pg.click('#newCampaign button')
    pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000)
    tray = pg.evaluate("(() => { const t = tw.taxonomy.get('t:%s'); return t && { label: t.label, disabled: !!t.disabled, rooms: t.children.map(id => tw.taxonomy.get(id)).map(n => ({ key: n.roomKey, label: n.label, hot: n.hot })) }; })()" % code)
    icons = pg.evaluate("(async () => { const out = []; for (const k of %s) { const r = await fetch('data/icons/room-' + k + '.png', { method: 'HEAD' }); if (!r.ok) out.push(k); } return out; })()" % json.dumps([r['key'] for r in tray['rooms']]))
    rid = pg.evaluate(f"tw.spawnRoom('{key}', 2, 2, {w}, {d}, 4242)")
    pg.wait_for_function(f"!!tw.entities()['{rid}']", timeout=30000); time.sleep(12)
    objs = pg.evaluate(f"Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{rid}').map(e => e.cat)")
    cx, cz = (2 + w / 2) * 5, (2 + d / 2) * 5
    pg.add_style_tag(content='.rlabel { display: none !important; }')  # the room's name floats over it: hidden, or the read is not blind
    for nm, pitch, yaw, dist in (('view-1', 55, 0, max(w, d) * 5 * 1.9 + 20), ('view-2', 50, 40, max(w, d) * 5 * 1.7 + 18), ('view-3', 89, 0, max(w, d) * 5 * 1.8 + 20)):
        pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({cx}, 0, {cz}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()"); time.sleep(3)
        pg.screenshot(path=f'{out}/{nm}.png')
    res = {'page': page, 'campaign': {'name': name, 'id': pg.evaluate('tw.sync.campaign.id')}, 'tray': tray, 'icons_missing': icons, 'room': key, 'objects': len(objs), 'cats': sorted(set(objs)), 'errors': errs[:20]}
    json.dump(res, open(f'{out}/result.json', 'w'), indent=1); print(json.dumps(res)[:1500]); b.close()
