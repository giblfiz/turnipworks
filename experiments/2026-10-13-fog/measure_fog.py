#!/usr/bin/env python3
"""Direct GPU timer around fog pass on the existing common-room/town fixtures.
Run with tw-slot. Local throwaway campaigns only; Medium except density forced
native to measure actual 3840x2160 (Medium normally caps the ratio at 1.5).
The injected three-state floor plan isolates pass cost from visibility CPU work.
"""
import json, os, shutil, sys, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
os.environ.setdefault('TW_MM_REPO',str(ROOT));os.environ.setdefault('TW_MM_PORTS','18276,18903')
sys.path.insert(0,str(ROOT/'experiments/2026-10-06-megamap'));import mm,layout
from playwright.sync_api import sync_playwright
mm.tw_sandbox.remove_campaigns()
OUT=Path(__file__).parent/'results';OUT.mkdir(exist_ok=True)
MEASURE='''async ({decorative,n})=>{
 const w=tw.worldOf(tw.area()),fog=w.fx.fogwar,gl=document.querySelector('#c').getContext('webgl2'),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 if(!ext)throw new Error('GPU timer extension unavailable');
 tw.gfx.timing(false);globalThis.__gpuWrap=true;fog.setDecorative(decorative);
 const samples=[],pending=[],original=fog.pass.render.bind(fog.pass);let issued=0;
 fog.pass.render=(...args)=>{
  if(issued>=n){original(...args);return;}
  const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);original(...args);gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(q);issued++;
 };
 const start=performance.now();
 try{while(samples.length<n&&performance.now()-start<30000){
   for(let i=pending.length-1;i>=0;i--){const q=pending[i];if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){if(!gl.getParameter(ext.GPU_DISJOINT_EXT))samples.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);pending.splice(i,1);}}
   await new Promise(resolve=>setTimeout(resolve,20));
 }}finally{fog.pass.render=original;for(const q of pending)gl.deleteQuery(q);}
 samples.sort((a,b)=>a-b);const trimmed=samples.slice(0,Math.floor(samples.length*.95));
 return {samples:samples.length,gpu_ms:trimmed.reduce((a,b)=>a+b,0)/trimmed.length,p50:samples[samples.length>>1],p95:samples[Math.floor(samples.length*.95)],programs:w.fx.stats().programs,buffer:tw.gfx.info().buffer,levels:fog.stats().fogwar_levels};
}'''
INJECT='''async ([cx,cz,levels])=>{
 const w=tw.worldOf(tw.area()),fog=w.fx.fogwar;
 const T=await import('three');
 const figure=new T.Mesh(new T.CapsuleGeometry(1.2,5,8,16),new T.MeshStandardMaterial({color:0x3366ff}));
 figure.position.set(cx,4,cz);w.scene.add(figure);fog.setFlyers([figure]);
 // Keep one figure in the depth-exemption draw while normal GM policy runs.
 fog.setFlyers=()=>{};
 const width=256,height=256,data=new Uint8Array(width*height*4);
 for(let z=0;z<height;z++)for(let x=0;x<width;x++){const k=(z*width+x)*4;data[k]=x>=170?255:0;data[k+1]=x>=85?255:0;}
 fog.setState({enabled:true,floorY:0,snap:true,revision:90001,levels:levels.map(floorY=>({floorY,bounds:[cx-128,cz-128,cx+128,cz+128],width,height,data}))});
 // Hold the artificial three-state mask while the GM's normal policy runs.
 window.restoreFogSet=fog.setState;fog.setState=()=>{};
 return fog.stats();
}'''
def run(p,name,rs,cx,cz,dist):
    b=p.chromium.launch(headless=True,args=mm.ARGS+mm.UNCAPPED)
    try:
        ctx=b.new_context(viewport=mm.VIEWPORT,device_scale_factor=2);pg=ctx.new_page();errors=[]
        pg.on('pageerror',lambda e:errors.append(str(e)));pg.set_default_timeout(180000);mm.tw_sandbox.proxy(pg,mm.API)
        pg.goto(mm.page_url());pg.fill('#newCampaign input[name=name]',f'TEST fog GPU {name} (throwaway)');pg.fill('#newCampaign input[name=gm]','Fauna-fog-gpu');pg.click('#newCampaign button')
        pg.wait_for_function('window.tw && tw.ready && tw.ready()',timeout=300000)
        pg.evaluate("tw.settings.setGfx('medium');tw.settings.setPref('density','native')")
        built=0
        for row in rs:
            rid=pg.evaluate('([t,x,z,w,d,seed,y])=>tw.spawnRoom(t,x,z,w,d,seed,undefined,y)',list(row[:7]))
            if not rid:raise RuntimeError(f'room rejected: {row}')
            pg.wait_for_function('(id)=>!!tw.entities()[id]&&tw.sync.pendingCount()===0',arg=rid,timeout=60000);built+=1
            if built%10==0:print(f'{name}: built {built}/{len(rs)}',flush=True)
        pg.evaluate(mm.cam_js(cx,cz,dist));ok,seconds,state=mm.wait_settled(pg,timeout=600);mm.wait_seated(pg,120)
        pg.evaluate(mm.cam_js(cx,cz,dist));pg.mouse.move(5,5)
        if not ok:raise RuntimeError(f'{name} did not settle: {state}')
        pg.evaluate(INJECT,[cx,cz,sorted(set(row[6] for row in rs))]);pg.wait_for_timeout(2000)
        result={'scene':name,'rooms':built,'dpr':2,'preset':'Medium, native density','visibleFigureMask':True,'load':mm.load_now(),'renderer':pg.evaluate(mm.GPU_JS),'rounds':[],'errors':errors}
        for round in range(3):
            for decorative in (False,True):
                r=pg.evaluate(MEASURE,{'decorative':decorative,'n':120});r.update(round=round,decorative=decorative);result['rounds'].append(r);print(name,json.dumps(r),flush=True)
        with (OUT/f'gpu-{name}.json').open('w') as f:json.dump(result,f,indent=2)
        return result
    finally:b.close()

data=mm.start_local()
try:
    with sync_playwright() as p:
        room=run(p,'common',[('common',200,200,6,5,7101,0)],1015,1012,62)
        rs,lots=layout.rooms(100)
        assert len(rs)==104,len(rs)
        town=run(p,'town104',rs,lots[0]['x']+40,lots[0]['z']+22,110)
        for result in (room,town):
            best={str(d):min(r['gpu_ms'] for r in result['rounds'] if r['decorative']==d) for d in (False,True)}
            print(result['scene'],'best',json.dumps(best),flush=True)
finally:mm.stop();shutil.rmtree(data,ignore_errors=True)
