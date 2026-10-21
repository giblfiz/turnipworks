#!/usr/bin/env python3
"""Standalone visibility-pass readbacks. No campaign is created. Run through tw-slot."""
import asyncio, json, os, re, subprocess, sys, tempfile
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tests')); import tw_sandbox

async def run(url):
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--enable-gpu'])
        page=await browser.new_page(viewport={'width':1920,'height':1080},device_scale_factor=2)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        await page.goto(url)
        result=await page.evaluate('''async()=>{
          const T=await import('three');const {createFogWar}=await import('/tuner/js/fx/fogwar.js');
          const {EffectComposer,RenderPass,EffectPass,ToneMappingEffect,ToneMappingMode}=await import('postprocessing');
          const r=new T.WebGLRenderer({preserveDrawingBuffer:true});r.setPixelRatio(2);r.setSize(1920,1080);document.body.append(r.domElement);
          const s=new T.Scene();s.background=new T.Color('#ff0000');
          const c=new T.OrthographicCamera(-15,15,8.4375,-8.4375,.1,100);c.position.set(0,30,0);c.up.set(0,0,-1);c.lookAt(0,0,0);c.updateMatrixWorld();
          const floor=new T.Mesh(new T.PlaneGeometry(30,20),new T.MeshBasicMaterial({color:'#f00000'}));floor.rotation.x=-Math.PI/2;s.add(floor);
          const box=new T.Mesh(new T.BoxGeometry(3,8,3),new T.MeshBasicMaterial({color:'#00ff00'}));box.position.set(-10,4,0);s.add(box);
          const fog=createFogWar({renderer:r,camera:c,scene:s,decorative:()=>false});
          const data=new Uint8Array(60*40*4);for(let z=0;z<40;z++)for(let x=0;x<60;x++){let k=(z*60+x)*4;data[k]=x>=40?255:0;data[k+1]=x>=20?255:0;data[k+3]=255;}
          fog.setState({enabled:true,bounds:[-15,-10,15,10],width:60,height:40,data,revision:1});
          const gl=r.getContext();const pixel=x=>{const a=new Uint8Array(4);gl.readPixels(x,1080,1,1,gl.RGBA,gl.UNSIGNED_BYTE,a);return [...a];};
          fog.beginPlain();r.render(s,c);fog.endPlain();
          const plain=[pixel(640),pixel(1920),pixel(3200)];
          r.setRenderTarget(null);r.render(s,c);const baseline=pixel(3200);
          const comp=new EffectComposer(r);comp.addPass(new RenderPass(s,c));comp.addPass(fog.pass);comp.render();
          const post=[pixel(640),pixel(1920),pixel(3200)];
          const before=r.info.programs.length;
          for(let i=0;i<8;i++){fog.setDecorative(i%2===0);fog.setState({enabled:true,bounds:[-15,-10,15,10],width:60,height:40,data,revision:i+2});fog.frame(16,i*100);comp.render();}
          const programs=[before,r.info.programs.length];
          fog.setDecorative(false);comp.render();
          const state=(bytes,revision,extra={})=>({enabled:true,bounds:[-15,-10,15,10],width:60,height:40,data:bytes,revision,...extra});
          const allCurrent=new Uint8Array(data.length),allExplored=new Uint8Array(data.length),allUnseen=new Uint8Array(data.length);
          for(let k=0;k<data.length;k+=4){allCurrent[k]=255;allCurrent[k+1]=255;allExplored[k+1]=255;}
          fog.frame(16,1000);fog.setState(state(data,20,{snap:true}));comp.render();const transitionStart=pixel(640);
          fog.setState(state(allCurrent,21));comp.render();const transitionZero=pixel(640);
          fog.frame(16,1200);comp.render();const transitionMid=pixel(640);
          fog.frame(16,1500);comp.render();const transitionEnd=pixel(640);
          fog.setState(state(allUnseen,22));comp.render();const resetImmediate=pixel(640);
          fog.setDecorative(true);fog.setState(state(allExplored,23,{snap:true}));comp.render();const stillA=pixel(1920);
          fog.frame(16,9000);comp.render();const stillB=pixel(1920);
          const upper=new T.Mesh(new T.PlaneGeometry(15,20),new T.MeshBasicMaterial({color:'#0000ff'}));upper.rotation.x=-Math.PI/2;upper.position.set(7.5,10,0);s.add(upper);
          fog.setDecorative(false);fog.setState({enabled:true,floorY:10,revision:24,snap:true,levels:[state(allExplored,0,{floorY:0}),state(allCurrent,0,{floorY:10})]});comp.render();
          const levels=[pixel(1920-300),pixel(3200)];upper.visible=false;
          fog.setState(state(data,25,{snap:true}));comp.render();
          // The actual final-effect boundary: tone mapping into an intermediate
          // target must not cause our final output to apply gamma twice.
          const toneFog=createFogWar({renderer:r,camera:c});toneFog.setDecorative(false);toneFog.setState(state(allCurrent,1));
          const toneComp=new EffectComposer(r);toneComp.addPass(new RenderPass(s,c));toneComp.addPass(new EffectPass(c,new ToneMappingEffect({mode:ToneMappingMode.ACES_FILMIC})));
          toneComp.render();const toneBaseline=pixel(3200);toneComp.addPass(toneFog.pass);toneComp.render();const toneMasked=pixel(3200);
          comp.render();
          fog.setState(state(allCurrent,26,{snap:true}));comp.render();const auxOutsideBefore=pixel(3200);
          r.setViewport(100,100,300,200);r.setScissor(100,100,300,200);r.setScissorTest(true);
          fog.renderPlain(s,c.clone());const auxOutsideAfter=pixel(3200),auxInsideBytes=new Uint8Array(4);gl.readPixels(500,400,1,1,gl.RGBA,gl.UNSIGNED_BYTE,auxInsideBytes);
          const auxViewport=r.getViewport(new T.Vector4()).toArray(),auxScissor=r.getScissorTest(),auxInside=[...auxInsideBytes];
          r.setViewport(0,0,1920,1080);r.setScissor(0,0,1920,1080);r.setScissorTest(false);
          fog.setState(state(data,27,{snap:true}));comp.render();
          box.position.y=14;fog.setState({enabled:true,floorY:10,revision:40,snap:true,levels:[state(allCurrent,0,{floorY:0}),state(allUnseen,0,{floorY:10})]});comp.render();const flyerUnprotected=pixel(640);
          fog.setFlyers([box]);comp.render();const flyerProtected=pixel(640);
          const blocker=new T.Mesh(new T.PlaneGeometry(4,4),new T.MeshBasicMaterial({color:'#0000ff'}));blocker.rotation.x=-Math.PI/2;blocker.position.set(-10,19,0);s.add(blocker);comp.render();const flyerOccluded=pixel(640);
          blocker.visible=false;box.position.y=4;fog.setFlyers([]);fog.setState(state(data,41,{snap:true}));comp.render();
          const {createLighting,LIGHT_DEFAULTS}=await import('/tuner/js/fx/lighting.js');
          const lighting=createLighting({renderer:r,scene:s,camera:c});const lightParams=structuredClone(LIGHT_DEFAULTS);lightParams.ao.strength=0;lightParams.bloom.strength=0;lightParams.grade.vignette=0;lighting.set(lightParams);lighting.setViewer({aa:false});lighting.setSize(1920,1080);
          const gateFog=createFogWar({renderer:r,camera:c});gateFog.setDecorative(false);lighting.setFogWarPass(gateFog.pass);
          r.setClearColor('#00ffff');r.clear();lighting.render(16);const disabledFirst=pixel(3200);
          gateFog.setState(state(allUnseen,1,{snap:true}));lighting.render(16);const enabledAfter=pixel(3200);
          gateFog.setState({enabled:false});lighting.render(16);const disabledAgain=pixel(3200);
          const farCam=new T.PerspectiveCamera(55,1920/1080,.1,100000);farCam.position.set(1000,100,1050);farCam.lookAt(1000,0,1000);farCam.updateMatrixWorld();
          const farFog=createFogWar({renderer:r,camera:farCam});farFog.setState(state(allUnseen,1,{bounds:[-2000,-2000,2000,2000],snap:true}));farFog.frame(16,4000);
          // (2026-10-17 fog-of-war look: never-seen ground is a 2.5-ft checker; precision is checked with the flat floor, the checker for clean squares)
          const P0=farFog.params;farFog.set({...P0,base:{...P0.base,style:'solid'}});farFog.renderPlain(s,farCam);
          const strip=new Uint8Array(1024*4);gl.readPixels(1000,1080,1024,1,gl.RGBA,gl.UNSIGNED_BYTE,strip);let seaMaxJump=0;for(let i=4;i<strip.length;i+=4)seaMaxJump=Math.max(seaMaxJump,Math.abs(strip[i]-strip[i-4]));
          farFog.set(P0);farFog.renderPlain(s,farCam);const cstrip=new Uint8Array(1024*4);gl.readPixels(1000,1080,1024,1,gl.RGBA,gl.UNSIGNED_BYTE,cstrip);
          const cv=[];for(let i=0;i<cstrip.length;i+=4)cv.push(cstrip[i+1]);const cLo=Math.min(...cv),cHi=Math.max(...cv);let cEdges=0;for(let i=1;i<cv.length;i++)if((cv[i]-(cLo+cHi)/2)*(cv[i-1]-(cLo+cHi)/2)<0)cEdges++;const checker={lo:cLo,hi:cHi,edges:cEdges};
          fog.setState(state(data,28,{snap:true}));comp.render();
          const rulerMaterial=new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.25,depthWrite:false});
          const ruler=new T.Mesh(new T.PlaneGeometry(30,20),rulerMaterial);ruler.rotation.x=-Math.PI/2;ruler.position.y=20;s.add(ruler);
          fog.setState(state(allUnseen,50,{snap:true}));fog.setOverlays([ruler]);comp.render();const overlayLeft=pixel(640),overlayRight=pixel(3200);
          const overlayRestored=rulerMaterial.depthTest===true&&rulerMaterial.depthWrite===false&&c.layers.mask===1&&ruler.layers.mask===1;
          fog.setOverlays([]);ruler.visible=false;fog.setState(state(data,51,{snap:true}));comp.render();
          const packFog=createFogWar({renderer:r,camera:c}),largeData=new Uint8Array(640*720*4);new Uint32Array(largeData.buffer).fill(0x0000ffff);const packTimes=[];
          for(let i=0;i<12;i++){packFog.frame(16,i*1000);packFog.setState({enabled:true,bounds:[0,0,200,225],width:640,height:720,data:largeData,revision:i});if(i>3)packTimes.push(packFog.stats().fogwar_pack_ms);}
          packTimes.sort((a,b)=>a-b);const packMedian=packTimes[packTimes.length>>1];packFog.dispose();
          window.probe={r,s,c,fog,comp};
          const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');let times=[];
          if(ext){const orig=fog.pass.render.bind(fog.pass);for(let i=0;i<60;i++){const q=gl.createQuery();fog.pass.render=(...args)=>{gl.beginQuery(ext.TIME_ELAPSED_EXT,q);orig(...args);gl.endQuery(ext.TIME_ELAPSED_EXT);};comp.render();fog.pass.render=orig;
            let polls=0;while(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){if(++polls>2500)throw new Error('GPU timer query timed out');await new Promise(resolve=>setTimeout(resolve,4));}
            if(!gl.getParameter(ext.GPU_DISJOINT_EXT))times.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);}}
          times.sort((a,b)=>a-b);return {plain,post,baseline,programs,transitionStart,transitionZero,transitionMid,transitionEnd,resetImmediate,stillA,stillB,levels,toneBaseline,toneMasked,auxOutsideBefore,auxOutsideAfter,auxInside,auxViewport,auxScissor,disabledFirst,enabledAfter,disabledAgain,seaMaxJump,checker,flyerUnprotected,flyerProtected,flyerOccluded,packMedian,packTimes,overlayLeft,overlayRight,overlayRestored,gpu_ms:times.length?times.slice(5,-5).reduce((a,b)=>a+b)/Math.max(1,times.length-10):null,gpu_samples:times.length};
        }''')
        out=ROOT/'experiments/2026-10-13-fog/shots';out.mkdir(parents=True,exist_ok=True)
        await page.screenshot(path=str(out/'fogpass-flat.png'))
        await page.evaluate('probe.fog.setDecorative(true);probe.fog.frame(16,4000);probe.comp.render()')
        await page.screenshot(path=str(out/'fogpass-decorative.png'))
        await browser.close()
        checks={}
        for route in ('plain','post'):
            a,b,c=result[route]
            checks[route+'_opaque_unseen']=max(a[:3])-min(a[:3])<12 and a[1]>70
            checks[route+'_explored_translucent']=b[0]>b[1]+35 and b[1]>30
            checks[route+'_current_clear']=c[0]>200 and c[1]<8
        checks['clear_color_preserved']=result['plain'][2]==result['baseline'] and result['post'][2]==result['baseline']
        checks['no_shader_recompile']=result['programs'][0]==result['programs'][1]
        checks['transition_starts_opaque']=result['transitionZero']==result['transitionStart']
        checks['transition_clears_gradually']=result['transitionZero'][1]<result['transitionMid'][1]<result['transitionEnd'][1]
        checks['reset_opaque_immediately']=result['resetImmediate']==result['plain'][0]
        checks['explored_decorative_still']=result['stillA']==result['stillB']
        checks['level_lower_explored']=result['levels'][0][0]>result['levels'][0][1]+35 and result['levels'][0][1]>30
        checks['level_upper_current']=result['levels'][1][2]>240 and result['levels'][1][0]<8
        checks['tone_color_preserved']=result['toneBaseline']==result['toneMasked']
        checks['aux_outside_unchanged']=result['auxOutsideBefore']==result['auxOutsideAfter']
        checks['aux_clear_color_preserved']=result['auxInside']==result['baseline']
        checks['aux_viewport_preserved']=result['auxViewport']==[100,100,300,200] and result['auxScissor']
        checks['disabled_final_pass_routes_to_screen']=result['disabledFirst'][0]>150 and result['disabledFirst'][1]<30
        checks['enabled_final_pass_masks']=max(result['enabledAfter'][:3])-min(result['enabledAfter'][:3])<12
        checks['disabled_again_restores_picture']=result['disabledFirst']==result['disabledAgain']
        checks['far_camera_sea_continuous']=result['seaMaxJump']<=3
        checks['far_camera_checker_clean']=result['checker']['hi']-result['checker']['lo']>=5 and 8<=result['checker']['edges']<=80
        checks['flyer_base_vision_overrides_fragment_level']=result['flyerProtected']==[0,255,0,255] and result['flyerUnprotected']==result['plain'][0]
        checks['flyer_walls_still_occlude']=result['flyerOccluded']==result['plain'][0]
        checks['overlay_readable_in_unseen']=result['overlayLeft'][0]>result['plain'][0][0]+15
        checks['transparent_overlay_reveals_no_underlying_shape']=result['overlayLeft']==result['overlayRight']
        checks['overlay_render_state_restored']=result['overlayRestored']
        checks['no_browser_errors']=not errors
        print(json.dumps({'checks':checks,'results':result,'errors':errors},indent=2),flush=True)
        if not all(checks.values()):raise RuntimeError('fog pass checks failed')

with tempfile.TemporaryDirectory(prefix='tw-fogpass-') as tmp:
    site=Path(tmp);(site/'tuner').symlink_to(ROOT/'tools/spawn-tuner')
    text=(ROOT/'tools/spawn-tuner/index.html').read_text();imports=re.search(r'<script type="importmap">.*?</script>',text,re.S).group(0).replace('"./js/','"/tuner/js/')
    (site/'index.html').write_text('<!doctype html><html><head>'+imports+'</head><body style="margin:0"></body></html>')
    proc=subprocess.Popen([sys.executable,'-m','http.server','18889','--bind','127.0.0.1','--directory',tmp],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        import time;time.sleep(.5);asyncio.run(run('http://127.0.0.1:18889/'))
    finally:proc.terminate();proc.wait()
