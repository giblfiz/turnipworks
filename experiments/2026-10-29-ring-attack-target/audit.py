#!/usr/bin/env python3
"""Audit: every command that can be drawn on the selection ring (closed buttons, the open circle, nested arcs) with no
painting in ui-icons/manifest.json for a set. Reads the live registry in a real page (local relay + static server).

  TW_PORTS=a,b python3 audit.py > audit.json
"""
import asyncio, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18957,18958').split(','))
procs, tmp = [], []
def start_local():
    for port in (RP, SP):
        with socket.socket() as sk:
            if sk.connect_ex(('127.0.0.1', port)) == 0: sys.exit(f'port {port} is in use')
    data = tempfile.mkdtemp(prefix='tw-ringshot-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'


JS = """async () => {
  const M = await import(new URL('menu.js', location.href).href);
  const man = await (await fetch(new URL('../../tuner/assets/ui-icons/manifest.json', location.href))).json();
  const has = (id, set) => (man.actions?.[id]?.variants || []).some(v => v.set === set);
  const off = (id) => M.RING_CUT.some(x => x.endsWith('.') ? id.startsWith(x) : id === x) || M.NOT_IN_MENU.includes(id);
  const title = (c) => { try { return String(c.short || (typeof c.title === 'function' ? c.title(tw.registry.ctx()) : c.title) || c.id); } catch { return c.id; } };
  const rows = tw.registry.all().filter(c => (c.ring || c.menu) && !c.stub && !off(c.id)).map(c => ({ id: c.id, title: title(c), icon: typeof c.icon === 'string' ? c.icon : '(toggle)', group: c.group, ring: !!c.ring, menu: !!c.menu, hidden: !!c.hidden, charcoal: has(c.id, 'charcoal'), parchment: has(c.id, 'parchment') }));
  const lists = (M.MENU || []).filter(e => e.list && !off(e.list)).map(e => ({ id: e.list, title: e.title, icon: e.icon, list: true, charcoal: has(e.list, 'charcoal'), parchment: has(e.list, 'parchment') }));
  return { missing: [...rows, ...lists].filter(r => !r.charcoal || !r.parchment), counts: { commands: rows.length, lists: lists.length } };
}"""
async def main():
    page = start_local()
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
        pg = await (await b.new_context(viewport={'width': 1280, 'height': 820})).new_page(); await pg.goto(page)
        await pg.fill('#newCampaign input[name=gm]', 'Harry'); await pg.fill('#newCampaign input[name=name]', 'TEST audit (throwaway)'); await pg.click('#newCampaign button')
        await pg.wait_for_function('window.tw?.ready?.() && tw.registry', timeout=90000)
        print(json.dumps(await pg.evaluate(JS), indent=1))
        await b.close()
try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
