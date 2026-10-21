#!/usr/bin/env python3
"""Same temple nave, same seed/camera, every faction; optional unprimed Gemini descriptions."""
import argparse,json,pathlib,time,subprocess,hashlib,shutil,tempfile
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('base');p.add_argument('out',type=pathlib.Path)
p.add_argument('--factions',default='sun,moon,devils,spiders,dragons,skulls,tentacles,nature,sword-shield,death,scales-coin,forge-hammer,sea-storm')
p.add_argument('--smoke',action='store_true',help='Exercise capture plumbing before corbel meshes exist; not acceptance');p.add_argument('--corbels-only',action='store_true');p.add_argument('--seed',type=int,default=11)
p.add_argument('--room-type',default='temple-nave');p.add_argument('--width',type=int,default=6);p.add_argument('--depth',type=int,default=9);p.add_argument('--read',action='store_true')
p.add_argument('--distance-scale',type=float,default=1.9);p.add_argument('--distance-extra',type=float,default=20);p.add_argument('--viewport',default='1500x950')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
BLIND='These are views of a room in a fantasy tabletop game at the distance of players around a table. Describe what you can actually see first. What kind of place is this, and what repeated shapes or symbols distinguish it? Report uncertainty and visible problems; do not guess hidden detail.'
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--enable-gpu'])
    for faction in a.factions.split(','):
        context=browser.new_context(viewport=dict(zip(['width','height'],map(int,a.viewport.split('x')))));pg=context.new_page();errors=[]
        pg.on('pageerror',lambda e:errors.append(str(e)))
        pg.on('response',lambda r:errors.append(f'HTTP {r.status}: {r.url}') if r.status>=400 and '/api/' not in r.url else None)
        if a.corbels_only:
            def library(route):
                resp=route.fetch();lib=resp.json()
                lib['objects']={k:v for k,v in lib['objects'].items() if not k.startswith('flavor-') or k=='flavor-corbel'}
                route.fulfill(response=resp,json=lib)
            pg.route('**/data/library.json*',library)
        response=pg.goto(a.base.rstrip('/')+f'/index.html?nobg&nofx&seed={a.seed}&flavor={faction}')
        if not response or response.status != 200: raise RuntimeError('Tuner URL did not return HTTP 200; check server/port before waiting')
        pg.wait_for_selector('body[data-ready="1"]',timeout=120000)
        pg.evaluate('([kind,w,d])=>{tuner.createRoom(kind,4,5,w,d)}',[a.room_type,a.width,a.depth])
        pg.wait_for_function('tuner.episodes()===0',timeout=300000);time.sleep(2)
        pg.evaluate('tuner.hideLabels(true)');pg.keyboard.press('Escape')
        room=pg.evaluate('tuner.rooms()[0]');layout=pg.evaluate('(id)=>tuner.layoutOf(id)',room['id'])
        tag=f'{faction}-'+('corbels-only' if a.corbels_only else ('nave' if a.room_type=='temple-nave' else a.room_type))
        corbels=[q for q in layout['placements'] if q['id']=='flavor-corbel']
        evidence={'faction':faction,'roomType':a.room_type,'seed':a.seed,'cells':[a.width,a.depth],'corbelsOnly':a.corbels_only,'cameraDistanceScale':a.distance_scale,'cameraDistanceExtra':a.distance_extra,'viewport':a.viewport,'corbelCount':len(corbels),'layout':layout,'errors':errors,'outside':pg.evaluate('tuner.outsideReport(0.6)'),'overlaps':pg.evaluate('tuner.overlapReport(0.35)')}
        stage=pg.locator('#stage').bounding_box();cx,cz=(4+a.width/2)*5,(5+a.depth/2)*5;span=max(a.width,a.depth)*5
        files=[]
        for name,pitch,yaw in [('table',55,0),('table-sw',50,40),('top',89,0)]:
            pg.evaluate('([cx,cz,dist,pitch,yaw])=>{tuner.cam.focus.set(cx,0,cz);tuner.cam.dist=dist;tuner.cam.pitch=pitch;tuner.cam.yaw=yaw;tuner.cam.update()}',[cx,cz,span*a.distance_scale+a.distance_extra,pitch,yaw]);time.sleep(2)
            image=a.out/f'{tag}-{name}.png';pg.screenshot(path=str(image),clip=stage);files.append(image)
        evidence['images']=[{'file':f.name,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in files]
        (a.out/f'{tag}.json').write_text(json.dumps(evidence,indent=2))
        print(f'{tag}: {len(layout["placements"])} pieces, {len(corbels)} corbels, {len(errors)} browser errors',flush=True)
        context.close()
        if errors or layout.get('purposeFail') or (not corbels and not a.smoke):raise RuntimeError(f'{tag}: incomplete browser capture; see evidence')
        if a.read:
            # Neutral basenames prevent asset names from priming the judge. Prompt contains no target motif.
            with tempfile.TemporaryDirectory(prefix='tw-faction-blind-') as td:
                neutral=[]
                for i,f in enumerate(files):
                    q=pathlib.Path(td)/f'view-{i+1}.png';shutil.copy2(f,q);neutral.append(str(q))
                prompt=pathlib.Path(td)/'prompt.txt';prompt.write_text(BLIND)
                result=subprocess.run(['~/fauna-tools/gemini-vision.py','gemini-3.8-flash',str(prompt),*neutral],text=True,capture_output=True)
                (a.out/f'{tag}-blind.txt').write_text(result.stdout+'\n'+result.stderr)
                if result.returncode:raise RuntimeError(f'Vision failed for {tag}; output preserved')
    browser.close()
