"""Ring Lab v2 browser acceptance. Ratings writes are sandboxed; campaigns are throwaways."""
import json, os, socket, subprocess, sys, tempfile, time
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).resolve().parent)); import tw_sandbox
tw_sandbox.remove_campaigns()
ROOT=Path(__file__).resolve().parents[1]
checks=0
def check(cond,why):
    global checks
    assert cond,why
    checks+=1

def free(port):
    with socket.socket() as s:
        s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
        try:s.bind(('127.0.0.1',port));return True
        except OSError:return False

with tempfile.TemporaryDirectory(prefix='tw-ringlab-') as data:
    web,relay=18852,18853
    site=Path(data)/'site';site.mkdir();os.symlink(ROOT/'engine',site/'engine');os.symlink(ROOT/'tools',site/'tools');os.symlink(ROOT/'tools/spawn-tuner',site/'tuner')
    assert free(web) and free(relay),'test ports busy'
    procs=[subprocess.Popen([sys.executable,'-m','http.server',str(web),'--bind','127.0.0.1'],cwd=site,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL),subprocess.Popen(['node',str(ROOT/'engine/relay/server.js')],env={**os.environ,'PORT':str(relay),'DATA_DIR':data,'ORIENT_API':''},stdout=open(data+'/relay.log','w'),stderr=subprocess.STDOUT)]
    try:
        with sync_playwright() as p:
            gl=['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
            b=p.chromium.launch(headless=True,args=['--no-sandbox',*gl])
            page=b.new_page(viewport={'width':1440,'height':900});tw_sandbox.proxy(page,'http://127.0.0.1:8096')
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)+' STACK '+str(e.stack)[:600]))
            page.goto(f'http://127.0.0.1:{web}/tools/spawn-tuner/ring.html')
            
            try: page.wait_for_function('!!window.ringTuner',timeout=30000)
            except Exception: print('OFFLINE ERRORS',errors, page.locator('body').inner_text()[:300]); raise
            page.evaluate("document.querySelectorAll('details.rl-advanced').forEach(d => d.open = true)")  # (2026-10-20: the rarely needed controls live in one Advanced group)
            check(page.locator('#ring .rl-button').count()>0,'offline renderer loads')
            check(page.locator('a[href="https://turnipworks.net/?ringlab=1"]').count()>0,'live link')
            reg=json.loads((ROOT/'tools/spawn-tuner/ring/registry.json').read_text())['kinds']
            for kind in ['pawn','prop','openable','light','room','building']:
                page.locator('#kind').select_option(kind)
                for seat in ['gm','player']:
                    page.locator('#seat').select_option(seat)
                    for state in ['closed','expanded']:
                        page.locator('#ring-panel [data-role=state]').select_option(state)
                        got=page.locator('#ring .rl-button').evaluate_all('(xs)=>xs.map(x=>x.dataset.id)')
                        exp=[x['id'] for x in reg[f'{kind}:{seat}']['primary']]+(['menu'] if reg[f'{kind}:{seat}']['secondary'] else []) if state=='closed' else [x['id'] for x in reg[f'{kind}:{seat}']['primary']+reg[f'{kind}:{seat}']['secondary']]+(['menu'] if reg[f'{kind}:{seat}']['secondary'] else [])
                        check(got==exp,f'{kind}/{seat}/{state}: {got} != {exp}')
            page.locator('#kind').select_option('pawn');page.locator('#seat').select_option('gm')
            page.locator('#ring-panel [data-role=state]').select_option('expanded');page.locator('#ring [data-id="pawn.cond."]').click()
            check(page.locator('#ring [data-arc=conditions]').count()>0,'Conditions nested arc')
            page.locator('#ring-panel [data-field=labelMode]').select_option('under')
            check(page.locator('#ring textPath').count()>0,'text follows SVG path')
            page.locator('#ring-panel [data-role=copy]').click()
            data_json=json.loads(page.locator('#ring-panel [data-role=json]').input_value())
            check(data_json['version']==2,'v2 JSON copy')
            page.locator('#ring-panel [data-field=radius]').first.fill('301')
            page.locator('#ring-panel [data-role=json]').fill(json.dumps(data_json));page.locator('#ring-panel [data-role=loadJson]').click()
            check(page.evaluate('ringTuner.settings.arcs.closed.radius')==data_json['settings']['arcs']['closed']['radius'],'JSON roundtrip')
            game=b.new_page(viewport={'width':1440,'height':900});tw_sandbox.proxy(game,'http://127.0.0.1:8096')
            game_errors=[];game.on('pageerror',lambda e:game_errors.append(str(e)+' STACK '+str(e.stack)[:600]));game.on('console',lambda m:game_errors.append('CONSOLE '+m.text) if m.type=='error' else None);game.on('requestfailed',lambda r:game_errors.append('REQUEST '+r.url+' '+str(r.failure)))
            url=f'http://127.0.0.1:{web}/engine/client/index.html?ringlab=1&relay=http://127.0.0.1:{relay}&tuner=http://127.0.0.1:{web}/tuner/&api=/api/tw-ratings&boxes&nofx&nointro&faces=1500'
            game.goto(url,wait_until='domcontentloaded',timeout=30000)
            try: game.wait_for_function("window.tw && tw.sync.status==='live' && window.ringLab",timeout=20000)
            except Exception:
                print('GAME ERRORS',game_errors[:20],'state',game.evaluate("({url:location.href,tw:!!window.tw,lab:!!window.ringLab,status:window.tw?.sync?.status,loading:document.querySelector('#twl')?.className,why:document.querySelector('.twl-why')?.textContent})"));raise
            game.wait_for_function("Object.values(tw.entities()).some(e=>e.name==='Mira · raised')",timeout=90000)
            game.evaluate("ringLab.panel.setSettings(ringLab.panel.presets()['Quiet brass · Fauna'])")  # (this suite tunes the separate circle rings; a new lab starts from the house ring since 2026-10-20)
            check(game.evaluate("Object.values(tw.entities()).filter(e=>e.kind==='token').length")>=3,'lab pawns')
            check(game.evaluate("Object.values(tw.entities()).some(e=>e.kind==='building')"),'lab building')
            check(game.evaluate("Object.values(tw.entities()).some(e=>e.kind==='room')"),'lab room')
            check(game.evaluate("Object.values(tw.entities()).some(e=>e.name==='Ring lab door')"),'lab door')
            check(game.evaluate("Object.values(tw.entities()).some(e=>e.name==='Ring lab light')"),'lab light')
            # (2026-10-20: the lab has no renderer of its own any more: the drawer shapes the GAME ring, #ring .rbtn[data-id])
            def frame_on(name,dist=95,pitch=52):
                game.evaluate("""([n,d,p])=>{const e=Object.values(tw.entities()).find(x=>x.name===n);tw.select(e.id);const g=tw.main.grab,r=e.recipe;
                  g.focus.set(r?(r.x+r.w/2)*5:e.x,0,r?(r.z+r.d/2)*5:e.z);g.dist=d;g.pitch=p;g.yaw=-20;g.update();}""",[name,dist,pitch])
                game.wait_for_function("document.querySelectorAll('#ring .rbtn[data-id]').length>0");game.wait_for_timeout(300)
            def lab_state(st):
                game.locator('#ringlab-open').click();game.locator('#ringlab-panel [data-role=state]').select_option(st)
                game.locator('#ringlab-panel [data-role=collapse]').click()
                try: game.wait_for_function("(s)=>tw.ringState()===s",arg=st,timeout=5000)
                except Exception: print('STATE', game.evaluate("({ring:tw.ringState(),panel:ringLab.panel.state(),sel:[...tw.sel],menu:!!document.querySelector('#ring .rbtn[data-menu]'),mode:tw.mode})")); raise
                game.wait_for_timeout(900)  # (the slide: ~520 ms + stagger)
            frame_on('Bram')
            check(game.locator('#ring .rbtn[data-id="pawn.damage"]').count()==1,'live pawn ring')
            check(game.evaluate("tw.ringNodes().filter(n=>n.key==='closed').sort((a,b)=>a.x-b.x).map(n=>n.id)")==[x['id'] for x in reg['pawn:gm']['primary']],'live registry primary')
            check(game.locator('#ringlab-stage').count()==0,'the lab draws no second ring: it shapes the game ring')
            game.locator('#ringlab-open').click()
            check(not game.locator('#ringlab-panel').get_attribute('class').endswith('collapsed'),'drawer opens')
            game.wait_for_function("document.querySelector('#twl')?.hidden",timeout=30000)
            shots=ROOT/'engine/test/shots/ringlab';shots.mkdir(parents=True,exist_ok=True)
            game.screenshot(path=str(shots/'live-table.png'))
            game.locator('#ringlab-panel [data-role=collapse]').click()
            def drag_button(cmd,px=80,dy=None):
                # a real press on the game ring's button, then along the handle's own ray (outward) or straight up (dy)
                b=game.locator(f'#ring .rbtn[data-id="{cmd}"]');check(b.count()==1,cmd+' present')
                r=b.bounding_box();x=r['x']+r['width']/2;y=r['y']+r['height']/2
                game.mouse.move(x,y);game.mouse.down();game.wait_for_timeout(80)
                d=game.evaluate('tw.ringDrag()'); u=(0,-1) if dy is not None else tuple(d['dir'])
                n=px if dy is None else -dy
                for i in range(1,11): game.mouse.move(x+u[0]*n*i/10,y+u[1]*n*i/10);game.wait_for_timeout(20)
                game.mouse.up();game.wait_for_timeout(200)
                return d
            drag_button('pawn.damage')
            game.wait_for_function("Object.values(tw.entities()).find(e=>e.name==='Bram')?.damage>0",timeout=8000)
            check(True,'damage drag commits')
            rot0=game.evaluate("Object.values(tw.entities()).find(e=>e.name==='Bram').rot||0")
            drag_button('edit.rotate',dy=-50)
            game.wait_for_function("(r0)=>Math.abs((Object.values(tw.entities()).find(e=>e.name==='Bram')?.rot||0)-r0)>0.01",arg=rot0,timeout=8000)
            check(True,'turn drag commits')
            lab_state('expanded')
            drag_button('edit.lift',dy=-75)
            game.wait_for_function("Object.values(tw.entities()).find(e=>e.name==='Bram')?.y>0",timeout=8000)
            check(True,'raise drag commits')
            game.wait_for_timeout(500)
            game.locator('#ring .rbtn[data-id="pawn.cond."]').click();game.wait_for_timeout(300)
            check(game.evaluate("tw.ringState()")=='nested' and game.locator('#ring .rbtn[data-nest][data-cmd="pawn.cond.poisoned"]').count()==1,'Conditions open as the grown ring')
            # (the grown ring's first item: the lowest, clear of the HUD whatever the camera; poisoned may sit under the top bar)
            cond=game.evaluate("document.querySelector('#ring .rbtn[data-nest][data-cmd^=\"pawn.cond.\"]').dataset.cmd.slice(10)")
            game.locator(f'#ring .rbtn[data-nest][data-cmd="pawn.cond.{cond}"]').click()
            game.wait_for_function("(c)=>Object.values(tw.entities()).find(e=>e.name==='Bram')?.conditions?.includes(c)",arg=cond,timeout=8000)
            check(True,'Conditions nested command')
            game.wait_for_timeout(900)
            game.locator('#ring .rbtn[data-id="pawn.sheet"]').click()
            check(game.locator('#ring .flyout.sheet').count()>0,'sheet command opens card')
            game.keyboard.press('Escape')
            room_id=game.evaluate("Object.values(tw.entities()).find(e=>e.name==='Ring lab common room').id")
            frame_on('Ring lab common room',120)
            lab_state('expanded')
            fog0=game.evaluate('id=>tw.entities()[id]?.fog',room_id)
            drag_button('room.fog',100)
            game.wait_for_function("([id,f])=>tw.entities()[id]?.fog>=0&&tw.entities()[id]?.fog!==f",arg=[room_id,fog0],timeout=8000)
            check(game.evaluate('tw.ringDragLast')['kind']=='fog','fog drag commits (a drag track on its button)')
            lab_state('expanded')
            game.locator('#ring .rbtn[data-id="faction.set"]').click();game.wait_for_timeout(300)
            check(game.locator('#ring .rbtn[data-nest][data-faction]').count()>0 and game.evaluate("tw.ringState()")=='nested','Faction nested arc on room')
            game.keyboard.press('Escape');game.keyboard.press('Escape')
            door_id=game.evaluate("Object.values(tw.entities()).find(e=>e.name==='Ring lab door').id")
            dims0=game.evaluate('(id)=>tw.entities()[id].dims',door_id)
            frame_on('Ring lab door')
            drag_button('edit.resize',75)
            game.wait_for_function("({id,dims})=>JSON.stringify(tw.entities()[id]?.dims)!==JSON.stringify(dims)",arg={'id':door_id,'dims':dims0},timeout=8000)
            check(True,'resize drag commits')
            lab_state('expanded')
            game.locator('#ring .rbtn[data-id="thing.hide"]').click()
            game.wait_for_function('id=>tw.entities()[id]?.hidden',arg=door_id,timeout=8000)
            check(True,'hide command commits')
            lab_state('expanded')
            game.locator('#ring .rbtn[data-id="thing.hide"]').click()
            game.wait_for_function('id=>!tw.entities()[id]?.hidden',arg=door_id,timeout=8000)
            check(True,'reveal command commits')
            dist0=game.evaluate('tw.main.grab.dist');game.mouse.move(850,700);game.mouse.wheel(0,-380);game.wait_for_timeout(160)
            check(game.evaluate('tw.main.grab.dist')!=dist0,'real wheel zoom with lab ring')
            yaw0=game.evaluate('tw.main.grab.yaw');game.mouse.move(850,700);game.mouse.down(button='middle');game.mouse.move(940,700,steps=7);game.mouse.up(button='middle')
            check(game.evaluate('tw.main.grab.yaw')!=yaw0,'real orbit with lab ring')
            yaw1=game.evaluate('tw.main.grab.yaw');game.keyboard.down('q');game.wait_for_timeout(240);game.keyboard.up('q')
            check(game.evaluate('tw.main.grab.yaw')!=yaw1,'Q camera turn with lab ring')
            game.evaluate('()=>{const g=tw.main.grab;g.focus.set(72,0,32);g.dist=145;g.pitch=62;g.yaw=0;g.update();}')
            for kind,name in [('pawn','Mira · raised'),('room','Ring lab common room'),('building','Ring lab inn')]:
                game.evaluate('(name)=>tw.select(Object.values(tw.entities()).find(e=>e.name===name).id)',name)
                for size in [round(.7+i*.05,2) for i in range(19)]:
                    game.evaluate('(size)=>tw.settings.setPref("ringScale",size)',size)
                    for dist,pitch in [(25,89.5),(90,28)]:
                        game.evaluate('({dist,pitch})=>{const g=tw.main.grab;g.dist=dist;g.pitch=pitch;g.update();}',{'dist':dist,'pitch':pitch})
                        game.wait_for_timeout(80)
                        inside=game.locator('#ring .rbtn[data-id]').evaluate_all('(xs)=>xs.length>0&&xs.every(x=>{const r=x.getBoundingClientRect();return r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1})')
                        check(inside,f'{kind} edge {size}/{dist}/{pitch}')
            game.evaluate("()=>{const e=Object.values(tw.entities()).find(x=>x.name==='Bram');tw.select(e.id);const g=tw.main.grab;g.focus.set(e.x,0,e.z);g.dist=90;g.pitch=50;g.update();ringLab.panel.settings().arcs.closed.start=135;ringLab.panel.settings().arcs.closed.span=0;ringLab.panel.selectState('closed');}")
            check('3–6 sector' in game.locator('#ringlab-panel [data-role=warnings]').inner_text(),'live forbidden sector warning')
            check(not errors,'page errors: '+str(errors))
            # A fresh flag-off seat on this campaign still uses the standard ring.
            tok=game.evaluate("new URLSearchParams(location.hash.slice(1)).get('s')")
            off=b.new_page(viewport={'width':1100,'height':800});off.goto(url.replace('ringlab=1&','')+'#s='+tok,wait_until='domcontentloaded');off.wait_for_function("window.tw && tw.sync.status==='live'",timeout=90000)
            check(off.locator('#ringlab-stage').count()==0 and off.locator('#ring').count()==1,'flag-off ring unchanged')
            b.close()
    finally:
        for proc in procs:proc.terminate()
        for proc in procs:
            try:proc.wait(timeout=10)
            except subprocess.TimeoutExpired:proc.kill()
print('RING LAB:',checks,'checks')
