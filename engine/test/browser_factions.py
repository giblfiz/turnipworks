#!/usr/bin/env python3
"""Faction UI acceptance; isolated relay locally, disposable campaign live. Always use tw-slot."""
import argparse, asyncio, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright
from faction_ui_checks import run as faction_ui_checks
ROOT=Path(__file__).resolve().parents[2]; sys.path.insert(0,str(ROOT/'tests')); import tw_sandbox
tw_sandbox.remove_campaigns()
ap=argparse.ArgumentParser(); ap.add_argument('--local',action='store_true'); ap.add_argument('--page',default='http://127.0.0.1:8180/'); ap.add_argument('--shots',default=str(ROOT/'engine/test/shots/factions')); A=ap.parse_args()
results=[]; procs=[]; tmp=[]
def check(ok,name,detail=''):
    results.append(bool(ok)); print(('ok   ' if ok else 'FAIL ')+name+(' — '+str(detail) if detail else ''),flush=True)
def free():
    with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
def start():
    rp,sp=free(),free(); data=tempfile.mkdtemp(prefix='tw-factions-'); site=tempfile.mkdtemp(prefix='tw-factions-site-');tmp.extend([data,site])
    os.symlink(ROOT/'engine',site+'/engine');os.symlink(ROOT/'tools/spawn-tuner',site+'/tuner')
    log=open(data+'/relay.log','w')
    procs.append(subprocess.Popen(['node',str(ROOT/'engine/relay/server.js')],env={**os.environ,'PORT':str(rp),'DATA_DIR':data,'ORIENT_API':'','TUNER_DIR':str(ROOT/'tools/spawn-tuner/js'),'TUNER_DATA':str(ROOT/'tools/spawn-tuner/data')},stdout=log,stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable,'-m','http.server',str(sp),'--bind','127.0.0.1'],cwd=site,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL))
    for _ in range(100):
        try:urllib.request.urlopen(f'http://127.0.0.1:{rp}/health');break
        except Exception:time.sleep(.1)
    return f'http://127.0.0.1:{sp}/engine/client/index.html?relay=http://127.0.0.1:{rp}&api='
async def wait(pg,js,timeout=30000):
    await pg.wait_for_function(js,timeout=timeout)
async def idle(pg):await wait(pg,'tw.sync.pendingCount() === 0')
async def cam(pg,x=15,z=20,dist=90,pitch=55):
    await pg.evaluate('([x,z,d,p])=>{const g=tw.main.grab;g.focus.set(x,0,z);g.dist=d;g.pitch=p;g.yaw=0;g.update();tw.main.rule="free"}',[x,z,dist,pitch]);await pg.wait_for_timeout(300)
async def command(pg,text):
    await pg.keyboard.press('/');await pg.locator('#bar input').fill(text);await pg.wait_for_timeout(250);await pg.keyboard.press('Enter');await idle(pg)
async def snap(pg,name):
    Path(A.shots).mkdir(parents=True,exist_ok=True);await pg.screenshot(path=str(Path(A.shots)/(name+'.png')))
SLOTS="Object.values(tw.entities()).filter(e=>e.kind==='object' && e.room===window.rid && e.cat.startsWith('flavor-'))"
async def main():
    base=start() if A.local else A.page
    url=base+('&' if '?' in base else '?')+'nointro&nopost&faces=1500'
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--enable-gpu','--disable-background-timer-throttling'])
        ctx=await b.new_context(viewport={'width':1400,'height':950});gm=await ctx.new_page();errors=[];gm.on('pageerror',lambda e:errors.append(str(e)))
        await gm.goto(url);await gm.fill('#newCampaign input[name=name]','TEST factions '+time.strftime('%H:%M:%S')+' (throwaway)');await gm.fill('#newCampaign input[name=gm]','Fauna');await gm.click('#newCampaign button');await wait(gm,'window.tw?.ready?.()',90000)
        await gm.evaluate('() => { window.factionShape = e => tw.lib.objects[e.cat]?.skus.find(k => k.sku === e.sku)?.shape; }')
        print('VERSIONS',await gm.evaluate('({client:window.TW_V,engine:tw.roomgen.version})'),flush=True)
        # Real room rectangle gesture.
        await cam(gm,pitch=89,dist=100)
        await gm.evaluate("tw.modes.roomTool('temple-nave',{tool:true})")
        a,c=await gm.evaluate('[tw.screenOf(2.5,2.5,tw.main,0),tw.screenOf(22.5,37.5,tw.main,0)]')
        await gm.mouse.move(a['x'],a['y']);await gm.mouse.down();await gm.mouse.move(c['x'],c['y'],steps=12);await gm.mouse.up()
        await wait(gm,"Object.values(tw.entities()).some(e=>e.kind==='room')");await idle(gm)
        await gm.evaluate("window.rid=Object.values(tw.entities()).find(e=>e.kind==='room').id;tw.modes.cancel()")
        await wait(gm,"document.querySelector('.faction-offer .faction-choice')",10000)
        check(await gm.locator('.faction-offer .faction-row').count()==2,'drag-out offers two emblem rows')
        check(await gm.locator('.faction-offer .faction-choice').evaluate_all('(els)=>els.every(e=>!e.textContent.trim() && e.getAttribute("aria-label") && e.title)'),'offer icons only, named for assistive tools')
        await snap(gm,'offer-current');await gm.locator('.faction-offer [data-faction=moon]').click();await idle(gm)
        check(await gm.evaluate(f'{SLOTS}.length>0 && {SLOTS}.every(e=>factionShape(e) === "moon")'),'Moon button dresses every slot in moon')
        await gm.keyboard.press('Control+z');await idle(gm);check(await gm.evaluate('!tw.entities()[rid].recipe.flavor'),'undo clears explicit room choice')
        await gm.keyboard.press('Control+Shift+z');await idle(gm);check(await gm.evaluate('tw.entities()[rid].recipe.flavor === "moon"'),'redo restores moon')
        # A second seat must see exactly the same object list after changes.
        token=await gm.evaluate("tw.createSeat({kind:'human',role:'player',name:'Faction witness'})")
        pc=await b.new_context(viewport={'width':1000,'height':700});pl=await pc.new_page();await pl.goto(url+'#s='+token);await wait(pl,'window.tw?.ready?.()',90000)
        rid=await gm.evaluate('rid');await pl.evaluate('(id)=>window.rid=id',rid)
        await pl.evaluate('() => { window.factionShape = e => tw.lib.objects[e.cat]?.skus.find(k => k.sku === e.sku)?.shape; }')
        await gm.evaluate('tw.select(rid)');await command(gm,'faction spiders')
        check(await gm.evaluate(f'{SLOTS}.every(e=>factionShape(e) === "spiders")'),'command faction spiders')
        await wait(pl,f'{SLOTS}.length>0 && {SLOTS}.every(e=>factionShape(e) === "spiders")');check(True,'second seat sees faction swaps')
        # Hand edits and deletion survive.
        await gm.evaluate(f'''() => {{ const os={SLOTS}; window.moved=os[0].id;window.deleted=os.find(e=>e.id!==moved && e.cat!=='flavor-banner').id;tw.dispatch('object.move',{{id:moved,x:os[0].x+1.25,z:os[0].z,rot:.8}});tw.dispatch('object.set',{{id:moved,s:os[0].s.map(x=>x*1.2),dims:os[0].dims.map(x=>x*1.2)}});tw.dispatch('entity.flag',{{ids:[moved],pinned:true}});tw.dispatch('object.delete',{{id:deleted}}); }}''');await idle(gm)
        check(await gm.evaluate('tw.entities()[moved].pinned && tw.entities()[moved].rot === .8'),'hand edit setup accepted')
        before=await gm.evaluate('JSON.stringify([tw.entities()[moved].x,tw.entities()[moved].rot,tw.entities()[moved].s,tw.entities()[moved].pinned])')
        await command(gm,'faction sun')
        check(await gm.evaluate('!tw.entities()[deleted]'),'deleted slot stays deleted')
        check(before==await gm.evaluate('JSON.stringify([tw.entities()[moved].x,tw.entities()[moved].rot,tw.entities()[moved].s,tw.entities()[moved].pinned])'),'moved and pinned slot swaps in place')
        # Piece override, then inheritance.
        await gm.evaluate(f"window.banner={SLOTS}.find(e=>e.cat==='flavor-banner').id;tw.select(banner)")
        await command(gm,'faction moon');check(await gm.evaluate('factionShape(tw.entities()[banner]) === "moon"'),'one banner override')
        await gm.evaluate('tw.select(rid)');await command(gm,'faction devils');check(await gm.evaluate('factionShape(tw.entities()[banner]) === "moon"'),'room change preserves banner override')
        await gm.evaluate('tw.select(banner)');await command(gm,'faction inherit');check(await gm.evaluate('!tw.entities()[banner].flavor && factionShape(tw.entities()[banner]) === "devils"'),'banner inherits again')
        await gm.evaluate('tw.clearSelection()');await gm.keyboard.press('/');await gm.locator('#bar input').fill('spider banner');await gm.wait_for_timeout(400)
        check('Spider banner' in await gm.locator('#results').inner_text(),'spider banner search names a placeable object');await snap(gm,'search');await gm.keyboard.press('Enter');check(await gm.evaluate('!!tw.mode'),'search enters placement');await gm.keyboard.press('Escape')
        # Whole building + overridden side room.
        bid=await gm.evaluate("tw.makeBuilding({code:'TEM',x:20,z:0,w:14,d:12,seed:71,storeys:1})");await idle(gm)
        await gm.evaluate('(id)=>tw.setFaction(id,"sun")',bid);await idle(gm)
        rooms=await gm.evaluate('(id)=>Object.values(tw.entities()).filter(e=>e.kind==="room"&&e.building===id).map(e=>e.id)',bid)
        check(len(rooms)>1,'temple building has multiple rooms')
        await gm.evaluate('(id)=>tw.setFaction(id,"moon")',rooms[0]);await idle(gm)
        await gm.evaluate('(id)=>tw.setFaction(id,"spiders")',bid);await idle(gm)
        check(await gm.evaluate('(id)=>tw.entities()[id].recipe.flavor === "moon"',rooms[0]),'building preserves room override')
        check(await gm.evaluate('(ids)=>Object.values(tw.entities()).filter(e=>ids.includes(e.room)&&e.cat?.startsWith("flavor-")).every(e=>factionShape(e) === "spiders")',rooms[1:]),'other rooms follow building')
        await gm.evaluate('(id)=>tw.setFaction(id,"inherit")',rooms[0]);await idle(gm)
        check(await gm.evaluate('(id)=>!tw.entities()[id].recipe.flavor && Object.values(tw.entities()).filter(e=>e.room===id&&e.cat?.startsWith("flavor-")).every(e=>factionShape(e) === "spiders")',rooms[0]),'side room inherits building again')
        # Castle marks only.
        hall=await gm.evaluate("tw.spawnRoom('great-hall',0,20,8,10,22)");await idle(gm)
        furniture=await gm.evaluate('(id)=>JSON.stringify(Object.values(tw.entities()).filter(e=>e.room===id&&!e.cat?.startsWith("flavor-")&&e.cat!=="banner-wall"))',hall)
        await gm.evaluate('(id)=>tw.setFaction(id,"sun")',hall);await idle(gm)
        check(furniture==await gm.evaluate('(id)=>JSON.stringify(Object.values(tw.entities()).filter(e=>e.room===id&&!e.cat?.startsWith("flavor-")&&e.cat!=="banner-wall"))',hall),'great hall furniture unchanged')
        check(await gm.evaluate('(id)=>Object.values(tw.entities()).some(e=>e.room===id&&e.cat==="flavor-banner"&&factionShape(e) === "sun")',hall),'great hall banners become sun marks')
        cult=await gm.evaluate("tw.makeBuilding({code:'CLT',x:40,z:25,w:18,d:14,seed:12,storeys:1})");await idle(gm)
        check(await gm.evaluate('(id)=>new Set(Object.values(tw.entities()).filter(e=>e.cat?.startsWith("flavor-")&&tw.entities()[e.room]?.building===id).map(e=>factionShape(e))).size===1',cult),'generated cult building has one faction')
        await faction_ui_checks(gm,check,snap)
        # Save/reload exact state.
        state=await gm.evaluate('JSON.stringify(tw.entities())');await gm.reload();await wait(gm,'window.tw?.ready?.()',90000);await idle(gm)
        check(state==await gm.evaluate('JSON.stringify(tw.entities())'),'saved faction choices and edits survive reload')
        await gm.evaluate('(id)=>window.rid=id',rid)
        await cam(gm)
        await gm.add_style_tag(content='.rlabel,.blabel,#roomLabels,#buildingLabels { visibility:hidden!important }')
        for faction,letter in [('sun','a'),('spiders','b'),('devils','c')]:
            await gm.evaluate('(f)=>tw.setFaction(rid,f)',faction);await idle(gm);await gm.evaluate('tw.clearSelection();tw.setCut(9,{by:"api"})');await gm.wait_for_timeout(2500);await snap(gm,'blind-'+letter)
        check(not errors,'no page errors',errors[:4]);await b.close()
    print(f'{sum(results)}/{len(results)} passed',flush=True)
    return 0 if all(results) else 1
try:rc=asyncio.run(main())
finally:
    for p in procs:p.terminate()
    for p in procs:
        try:p.wait(timeout=5)
        except subprocess.TimeoutExpired:p.kill()
    for d in tmp:shutil.rmtree(d,ignore_errors=True)
sys.exit(rc)
