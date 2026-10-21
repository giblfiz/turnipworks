"""Offline Ring Tuner v2 acceptance; rating writes use tw_sandbox."""
import json, os, socket, subprocess, sys, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).resolve().parent)); import tw_sandbox
ROOT=Path(__file__).resolve().parents[1];checks=0

def ok(value,label):
    global checks
    assert value,label
    checks+=1

with tempfile.TemporaryDirectory(prefix='tw-ringbench-') as data:
    site=Path(data)/'site';site.mkdir();os.symlink(ROOT/'engine',site/'engine');os.symlink(ROOT/'tools',site/'tools');os.symlink(ROOT/'tools/spawn-tuner',site/'tuner')
    port=18854
    with socket.socket() as sock:
        sock.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
        try:sock.bind(('127.0.0.1',port))
        except OSError:raise SystemExit('ring bench port in use')
    server=subprocess.Popen([sys.executable,'-m','http.server',str(port),'--bind','127.0.0.1'],cwd=site,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
            page=browser.new_page(viewport={'width':1440,'height':900});tw_sandbox.proxy(page,'http://127.0.0.1:8096')
            fixture={'sets':[{'id':'painted','name':'Painted fixture'}],'actions':{'pawn.damage':{'variants':[{'set':'painted','alt':0,'file':'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3Ccircle cx="12" cy="12" r="10" fill="red"/%3E%3C/svg%3E'},{'set':'painted','alt':1,'file':'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3Ccircle cx="12" cy="12" r="10" fill="blue"/%3E%3C/svg%3E'}]}}}
            page.route('**/assets/ui-icons/manifest.json*',lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps(fixture)))
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(f'http://127.0.0.1:{port}/tools/spawn-tuner/ring.html');page.wait_for_function('!!window.ringTuner');page.evaluate("document.querySelectorAll('details.rl-advanced').forEach(d => d.open = true)")  # (2026-10-20: rarely needed controls are in one Advanced group)
            reg=json.loads((ROOT/'tools/spawn-tuner/ring/registry.json').read_text())['kinds']
            for name in ['Current game · baseline','Mockup 11 · close reading','Tight horseshoe','Quiet brass · Fauna']:
                page.locator('#ring-panel [data-role=preset]').select_option(name);page.locator('#ring-panel [data-role=loadPreset]').click()
                for kind in ['pawn','prop','openable','light','room','building']:
                    page.locator('#kind').select_option(kind)
                    for seat in ['gm','player']:
                        page.locator('#seat').select_option(seat)
                        for state in ['closed','expanded']:
                            page.locator('#ring-panel [data-role=state]').select_option(state)
                            got=page.locator('#ring .rl-button').evaluate_all('(xs)=>xs.map(x=>x.dataset.id)')
                            c=reg[f'{kind}:{seat}'];exp=[x['id'] for x in c['primary']]+(['menu'] if c['secondary'] else []) if state=='closed' else [x['id'] for x in c['primary']+c['secondary']]+(['menu'] if c['secondary'] else [])
                            ok(got==exp,f'{name}/{kind}/{seat}/{state}')
                            bad=page.evaluate('ringTuner.layout.bad')
                            ok('3–6 sector' not in bad,f'{name}/{kind}/{seat}/{state} forbidden sector: {bad}')
                page.locator('#kind').select_option('pawn');page.locator('#seat').select_option('gm');page.locator('#ring-panel [data-role=state]').select_option('expanded')
                page.screenshot(path=str(Path(data)/({'Current game · baseline':'current','Mockup 11 · close reading':'mockup-11','Tight horseshoe':'tight','Quiet brass · Fauna':'quiet-brass'}[name]+'.png')))
            for mode in ['hover','below','over','under']:
                page.locator('#ring-panel [data-field=labelMode]').select_option(mode)
                ok(page.locator('#ring textPath').count()>0 if mode in ['over','under'] else page.locator('#ring .rl-tip').count()>0,'labels '+mode)
            page.locator('#ring-panel [data-field=iconSet]').select_option('painted')
            page.locator('#ring-panel [data-field=pickIcons]').check()
            image=page.locator('#ring [data-id="pawn.damage"] img');ok(image.count()==1,'fixture icon')
            first=image.get_attribute('src');page.locator('#ring [data-id="pawn.damage"]').click();ok(image.get_attribute('src')!=first,'alternate cycles')
            page.locator('#ring-panel [data-field=iconSet]').select_option('line (current)');ok(page.locator('#ring [data-id="pawn.damage"] svg').count()==1,'line baseline')
            page.locator('#ring-panel [data-role=copy]').click();raw=json.loads(page.locator('#ring-panel [data-role=json]').input_value());ok(raw['version']==2,'copy v2')
            page.locator('#ring-panel [data-role=json]').fill(json.dumps({'version':1,'settings':{'radius':178,'arcStart':0}}));page.locator('#ring-panel [data-role=loadJson]').click()
            ok(page.evaluate('ringTuner.settings.arcs.closed.radius')==178,'load v1')
            ok(page.evaluate('ringTuner.settings.arcs.closed.start')==0,'v1 zero angle')
            page.locator('#ring-panel [data-role=json]').fill(json.dumps(raw));page.locator('#ring-panel [data-role=loadJson]').click();ok(page.evaluate('ringTuner.settings.arcs.closed.radius')==raw['settings']['arcs']['closed']['radius'],'JSON roundtrip')
            page.locator('#ring-panel [data-role=name]').fill('Ring v2 sandbox');page.locator('#ring-panel [data-role=save]').click();page.wait_for_timeout(450)
            ok('Saved' in page.locator('#ring-panel [data-role=status]').inner_text(),'sandbox save')
            page.locator('#ring-panel [data-role=compare]').click();ok(page.locator('#ring .rl-compare').count()==1,'A/B split')
            ok(not errors,'page errors: '+str(errors));print('RING TUNER:',checks,'checks')
            browser.close()
    finally:
        server.terminate();server.wait(timeout=10)
