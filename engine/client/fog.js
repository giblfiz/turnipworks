// Viewer-local sight and presentation. Durable exploration is a compact relay union,
// never a history stream. Geometry/raster work runs off the animation frame in a worker.
import { T } from './tuner.js';
import { baseUnder } from '../core/height.js';
import { areaForClient } from '../core/state.js';
import { exploredFor, hasFogCell, unionLevels, GM_CURSOR_THROUGH_FOG } from '../core/fog.js';
import { visibleAt } from './vision.js';
import { rasterVision, subtractLevels, nonempty, exploredInBox } from './fog-grid.js';
import { polyFeet } from '../core/footprint.js';
import { darknessFor, lightKind, lightRadiusOf, lightTable, hintOf } from '../core/darkness.js';
import { darkVisibleAt } from './darksight.js';

export function installFog(app) {
 const states=new Map();let serial=0, sent=0; const started=performance.now();
 app.visionViewer='gm';
 const badge=document.createElement('button');badge.id='visionBadge';badge.hidden=true;badge.onclick=()=>app.setVisionViewer('gm');document.querySelector('#app').append(badge);
 const shared=()=>app.sync.campaign?.defaults?.sharedPartyVision===true;
 // Fog of war is per area (Harry 2026-10-15): the area's own On/Off, else the campaign default (core/state.js RULE_KEYS).
 const enabledFor=area=>{const c=app.sync.campaign,a=c?.areas?.find(x=>x.id===(area||app.area()));return typeof a?.settings?.fogOfWar==='boolean'?a.settings.fogOfWar:c?.defaults?.fogOfWar===true;};
 // Darkness (Harry 2026-10-20; core/darkness.js): the area's own On/Off, else the campaign default; off unless set. It only
 // matters where fog of war is on. The remembered edge of every radius is the Fog of war look's `dark.hint` (ft).
 const darkFor=area=>darknessFor(app.sync.campaign,area||app.area());
 const lookOf=w=>(w?.fx?.fogwar||w?.fogwar)?.params||T.house?.fogwar;
 const hintFor=w=>hintOf(lookOf(w));
 // each kind's reach: the core table, overridden by the look's `reach` / `bright` / `dark.scale` / `dark.dim` (2026-10-21)
 const tableFor=w=>lightTable(lookOf(w)), tableKey=t=>Object.values(t).join(',');
 const viewer=()=>app.gm()?app.visionViewer:app.me();
 const preview=()=>app.gm()&&viewer()!=='gm';
 const active=area=>enabledFor(area)&&(!app.gm()||preview());
 const modeKey=area=>`${viewer()}|${shared()}|${enabledFor(area)}|${darkFor(area)}|${(app.sync.campaign?.seats||[]).map(s=>[s.id,s.role,s.kind,s.creator,!!s.revoked].join(':')).join(',')}`;
 const get=area=>states.get(area||app.area());
 const open=r=>!!r.roof?.off||!!T.walls?.isOutdoor?.(r.recipe?.type);
 function showBadge(){badge.hidden=!preview();badge.dataset.viewer=viewer()||'';badge.textContent=preview()?`Viewing as ${viewer()==='party'?'party':app.sync.campaign?.seats.find(s=>s.id===viewer())?.name||'player'} · return to GM`:'';}
 function visible(x,z,level=0,area){if(!active(area))return true;const s=get(area);return !!s&&!s.pending&&(s.dark?darkVisibleAt(s.dark,x,z,level):visibleAt(s.vision,x,z,level));}
 function explored(x,z,level=0,area){if(!active(area))return true;const s=get(area);return !!s&&(hasFogCell(s.explored,x,z,level)||visible(x,z,level,area));}
 function rule(s,e) {
  if(!active(s.area)||s.world.local)return false;
  if(e.hidden||e.factionMissing)return true;
  if(s.cache.has(e))return s.cache.get(e);
  let known=false;
  if(e.kind==='token')known=visible(e.x,e.z,baseUnder(s.world.view?.entities,e.x,e.z,e.y||0,open).y,s.area);
  else if(e.recipe){const points=polyFeet(e.recipe);const x=points.reduce((a,p)=>a+p[0],0)/points.length,z=points.reduce((a,p)=>a+p[1],0)/points.length;known=explored(x,z,e.recipe.y||0,s.area)||points.some(([x,z])=>explored(x,z,e.recipe.y||0,s.area));
    if(!known)for(let z=e.recipe.z*5;z<(e.recipe.z+e.recipe.d)*5&&!known;z+=5)for(let x=e.recipe.x*5;x<(e.recipe.x+e.recipe.w)*5&&!known;x+=5)known=explored(x+2.5,z+2.5,e.recipe.y||0,s.area);
  }else if(e.kind==='building'){known=Object.values(s.world.view?.entities||{}).some(r=>r.kind==='room'&&r.building===e.id&&!rule(s,r));}
  else {
   const room=s.world.view?.entities[e.room],y=room?.recipe?(room.recipe.y||0):baseUnder(s.world.view?.entities,e.x,e.z,e.y||0,open).y;
   const dx=Math.max(.65,(e.dims?.[0]||0)/2),dz=Math.max(.65,(e.dims?.[2]||0)/2),c=Math.abs(Math.cos(e.rot||0)),n=Math.abs(Math.sin(e.rot||0)),rx=c*dx+n*dz,rz=n*dx+c*dz;
   known=exploredInBox(s.explored,y,e.x-rx,e.z-rz,e.x+rx,e.z+rz)||visible(e.x,e.z,y,s.area);
  }
  s.cache.set(e,!known);return !known;
 }
 function refreshWorld(s,snap=false){
  const w=s.world;s.cache=new WeakMap();w.fogRule=e=>rule(s,e);w.fogActive=active(s.area);w.fogSees=(x,z,y=0)=>visible(x,z,baseUnder(w.view?.entities,x,z,y,open).y,s.area);w.fogKnown=(x,z,y=0)=>explored(x,z,baseUnder(w.view?.entities,x,z,y,open).y,s.area);w.cutGen=(w.cutGen||0)+1;w.passGen=-1;
  const fx=w.fx?.fogwar||w.fogwar;if(!fx)return;
  if(!active(s.area)){fx.setState({enabled:false});return;}
  const floorY=w.fogLevel(); const levels=(s.levels||[]).filter(l=>w.cut==null||l.floorY<=w.cut);
  const sameMask=s.uploadedLevels===s.levels&&s.uploadedCut===w.cut&&s.uploadedFloor===floorY&&fx.enabled;
  if(!sameMask||snap)fx.setState(levels.length?{enabled:true,levels,floorY,revision:++serial,snap}:{enabled:true,width:1,height:1,bounds:[-400,-400,400,400],data:new Uint8Array(4),floorY,revision:++serial,snap:true});
  s.uploadedLevels=s.levels;s.uploadedCut=w.cut;s.uploadedFloor=floorY;
  if(!w.fx)fx.setDecorative(false);
  w.cutPass();
 }
 function create(area,w){
  const url=new URL('./fog-worker.js',import.meta.url);url.search=new URL(import.meta.url).search;
  const worker=new Worker(url,{type:'module'}),s={area,world:w,worker,vision:new Map(),own:{},party:{},explored:{},epoch:-1,cache:new WeakMap(),levels:[],lastSend:0,pending:true,busy:false,geometryKey:null};states.set(area,s);
  worker.onmessage=({data:m})=>{
   s.busy=false;
   if(m.epoch!==s.epoch||m.id!==s.wanted?.id){post(s);return;}
   if(m.error){s.error=m.error;console.error('fog vision',m.error);return;}
   s.pending=false;s.vision=new Map(m.vision);s.dark=m.dark?new Map(m.dark):null;s.levels=m.levels;s.polygonMs=m.polygonMs;s.totalMs=m.totalMs;s.lightsUsed=m.lights??null;
   s.own=unionLevels(s.own,m.ownCells);s.party=unionLevels(s.party,m.partyCells||{});
   const v=app.view(area);s.explored=unionLevels(unionLevels(exploredFor(v?.fog,viewer(),shared()||viewer()==='party'),shared()||viewer()==='party'?s.party:viewer()===app.me()?s.own:{}),m.reach||m.current);
   refreshWorld(s,s.snap);s.snap=false;app.gfx?.wake('vision');
   if(s.area===app.area())for(const id of [...app.sel])if(rule(s,app.ent(id)||{}))app.sel.delete(id);
   app.emit('vision',area);app.refresh();
  };
  worker.onerror=e=>{s.error=e.message;console.error('fog worker',e.message);};
  return s;
 }
 // The lit lights of a dark area, for the worker: lit (not put out), not hidden, a light by the table (core/darkness.js);
 // its radius from `table` (the look's, tableFor), unless the GM gave the thing its own. `kind` rides along for the reach view.
 const kinds=new Map();
 function kindOf(cat){if(!kinds.has(cat))kinds.set(cat,lightKind(cat,T.fire?.fireType?.(cat)||null,app.assets?.lib?.objects?.[cat]?.aff||[]));return kinds.get(cat);}
 function lightsOf(E,table){
  const out=[];
  for(const e of Object.values(E)){
   if(e.kind!=='object'||e.hidden||e.lit===false||!e.cat||!Number.isFinite(e.x)||!Number.isFinite(e.z))continue;
   const kind=kindOf(e.cat);if(!kind)continue;
   const radius=lightRadiusOf(e,kind,table);if(!(radius>0))continue;
   const room=E[e.room]?.recipe?E[e.room]:null;let x=e.x,z=e.z;
   // a wall light's centre can sit in the wall's line: its light starts just inside its own room, never on the far side
   if(room){const p=polyFeet(room.recipe),m=.3;x=Math.min(Math.max(x,Math.min(...p.map(q=>q[0]))+m),Math.max(...p.map(q=>q[0]))-m);z=Math.min(Math.max(z,Math.min(...p.map(q=>q[1]))+m),Math.max(...p.map(q=>q[1]))-m);}
   out.push({id:e.id,kind,x:Math.round(x*1000)/1000,z:Math.round(z*1000)/1000,level:room?(room.recipe.y||0):baseUnder(E,e.x,e.z,e.y||0,open).y,radius});
  }
  return out;
 }
 function post(s){if(s.busy||!s.wanted)return;s.busy=true;s.worker.postMessage(s.wanted);}
 function update(area,w,v,{force=false,snap=false}={}){
  if(w.local||!v)return;
  let s=states.get(area);if(!s)s=create(area,w);s.world=w;
  const epoch=v.fog?.epoch||0;
  if(s.epoch!==epoch){s.wanted=null;s.geometryKey=null;s.epoch=epoch;s.own={};s.party={};s.explored={};s.levels=[];s.vision=new Map();s.dark=null;s.snap=true;force=true;}
  const mode=modeKey(area);
  if(s.mode!==mode){s.wanted=null;s.geometryKey=null;s.mode=mode;s.vision=new Map();s.dark=null;s.levels=[];s.pending=true;s.snap=true;force=true;}
  const E=w.view?.entities||{};
  if(!force&&s.entities===E&&s.fog===v.fog)return;
  const sightChanged=force||s.entities!==E;
  s.entities=E;s.fog=v.fog;s.snap ||= snap;
  s.explored=unionLevels(exploredFor(v.fog,viewer(),shared()||viewer()==='party'),shared()||viewer()==='party'?s.party:viewer()===app.me()?s.own:{});
  // GM's unrestricted picture performs no fog work; it never writes player exploration.
  if(!active(area)){s.wanted=null;s.geometryKey=null;s.pending=false;refreshWorld(s);return;}
  const pawns={},geometryEntities={}; const outdoor=new Set();let x0=-40,z0=-40,x1=40,z1=40;const levels=new Set([0]);
  for(const e of Object.values(E)){
   if(e.kind==='token'){pawns[e.id]=e;x0=Math.min(x0,e.x-30);z0=Math.min(z0,e.z-30);x1=Math.max(x1,e.x+30);z1=Math.max(z1,e.z+30);levels.add(baseUnder(E,e.x,e.z,e.y||0,open).y);}
   else if(e.kind==='room'||e.kind==='building'||e.kind==='edge'||(e.kind==='object'&&(e.fromEdge||/door|gate|portcullis|wall-straight/.test(e.cat||''))))geometryEntities[e.id]=e;
   if(e.kind==='object'&&Number.isFinite(e.x)&&Number.isFinite(e.z)){const dx=Math.max(5,(e.dims?.[0]||0)/2),dz=Math.max(5,(e.dims?.[2]||0)/2);x0=Math.min(x0,e.x-dx);z0=Math.min(z0,e.z-dz);x1=Math.max(x1,e.x+dx);z1=Math.max(z1,e.z+dz);}
   if(e.recipe){x0=Math.min(x0,e.recipe.x*5-30);z0=Math.min(z0,e.recipe.z*5-30);x1=Math.max(x1,(e.recipe.x+e.recipe.w)*5+30);z1=Math.max(z1,(e.recipe.z+e.recipe.d)*5+30);levels.add(e.recipe.y||0);if(T.walls?.isOutdoor?.(e.recipe.type))outdoor.add(e.recipe.type);}
  }
  const bounds=[Math.floor(x0/5)*5,Math.floor(z0/5)*5,Math.ceil(x1/5)*5,Math.ceil(z1/5)*5];
  const dark=darkFor(area);
  const geometry={entities:geometryEntities,edges:[...(w.edges||[])],outdoor:[...outdoor],bounds,levels:[...levels].sort((a,b)=>a-b)};
  const key=w.shellKey+'|'+JSON.stringify(geometryEntities)+'|'+bounds.join();
  // Message geometry only when walls/doors/levels change; pawn moves reuse it.
  const message={id:++serial,epoch,seat:app.me(),viewer:viewer(),shared:shared()||viewer()==='party',seats:app.sync.campaign?.seats||[],pawns,explored:s.explored};
  if(dark){const t=tableFor(w);message.dark=true;message.lights=lightsOf(E,t);message.hint=s.hint=hintFor(w);s.table=tableKey(t);}
  if(s.geometryKey!==key){message.geometry=geometry;s.geometryKey=key;s.geometry=geometry;}
  // Every queued replacement must be self-contained if its predecessor wasn't sent.
  if(s.busy)message.geometry=geometry;
  s.wanted=message;s.pending=sightChanged;refreshWorld(s,s.snap);post(s);
 }
 function tick(now){
  showBadge();
  for(const s of states.values()){
   if(app.worlds.get(s.area)!==s.world){s.worker.terminate();states.delete(s.area);continue;}
   const w=s.world;
   if(s.cut!==w.cut){s.cut=w.cut;refreshWorld(s);}
   if(darkFor(s.area)&&s.hint!=null&&(hintFor(w)!==s.hint||tableKey(tableFor(w))!==s.table)){const v=app.view(s.area);if(v)update(s.area,w,v,{force:true});}
   if(!enabledFor(s.area)||app.gm()||s.pending||now-s.lastSend<2000||app.sync.status!=='live')continue;
   const v=app.view(s.area);if(!v||s.epoch!==(v.fog?.epoch||0))continue;
   const own=subtractLevels(s.own,v.fog?.viewers?.[app.me()]||{}),party=shared()?subtractLevels(s.party,v.fog?.party||{}):{};
   if(!nonempty(own)&&!nonempty(party))continue;
   s.lastSend=now;sent++;app.sync.submit('fog.explore',{epoch:s.epoch,levels:own,...(nonempty(party)&&{partyLevels:party})},s.area);
  }
 }
 app.setVisionViewer=id=>{
  if(!app.gm())return false;if(!['gm','party'].includes(id)&&!app.sync.campaign?.seats.some(s=>s.id===id&&s.role==='player'))return false;
  app.visionViewer=id;showBadge();app.sel.clear();app.hover=null;
  for(const [area,w] of app.worlds){const v=app.view(area);if(!v||w.local)continue;w.sync(preview()?areaForClient(v,false):v,{gmSide:!preview()});update(area,w,v,{force:true,snap:true});}
  app.gfx?.wake('vision');app.refresh();return true;
 };
 app.canSeePawn=(e,area)=>!e||e.kind!=='token'||!active(area)||(!e.hidden&&visible(e.x,e.z,baseUnder(app.worlds.get(area||app.area())?.view?.entities,e.x,e.z,e.y||0,open).y,area));
 // May this seat's cursor / ruler be drawn where this viewer cannot currently see? (GM: only when GM_CURSOR_THROUGH_FOG)
 app.fogShows=(seat,x,z,y,area)=>{if(!active(area)||GM_CURSOR_THROUGH_FOG)return true;if(app.sync.campaign?.seats.find(s=>s.id===seat)?.role!=='gm')return true;const w=app.worlds.get(area||app.area());return visible(x,z,baseUnder(w?.view?.entities,x,z,y||0,open).y,area);};
 app.fog={active,preview,visible,explored,update,tick,dark:darkFor,lightsOf:(area)=>lightsOf(app.view(area)?.entities||{},tableFor(app.worlds.get(area||app.area()))),lightTable:(area)=>tableFor(app.worlds.get(area||app.area())),sceneView:v=>preview()?areaForClient(v,false):v,
  hidden:(e,area)=>{const s=get(area);return s?rule(s,e):false;},
  reset:()=>app.gm()&&app.sync.submit('fog.reset',{area:app.area()}),
  revealHere:()=>{
   if(!app.gm())return;
   const v=app.view(),selected=[...app.sel].map(id=>v.entities[id]).filter(e=>e?.kind==='room'),vision=new Map();
   const add=(level,points)=>{if(!vision.has(level))vision.set(level,[]);vision.get(level).push({points});};
   if(selected.length)for(const r of selected)add(r.recipe.y||0,polyFeet(r.recipe));
   else {
    // The finite area's whole floor plan, including loose scenery outdoors.
    const entities=Object.values(v.entities).filter(e=>!e.hidden),points=entities.flatMap(e=>e.recipe?polyFeet(e.recipe):Number.isFinite(e.x)&&Number.isFinite(e.z)?[[e.x-5,e.z-5],[e.x+5,e.z+5]]:[]);
    if(!points.length)points.push([-40,-40],[40,40]);
    const x0=Math.min(...points.map(p=>p[0])),z0=Math.min(...points.map(p=>p[1])),x1=Math.max(...points.map(p=>p[0])),z1=Math.max(...points.map(p=>p[1]));
    const levels=new Set([0,...entities.filter(e=>e.recipe).map(e=>e.recipe.y||0)]);
    for(const level of levels)add(level,[[x0,z0],[x1,z0],[x1,z1],[x0,z1]]);
   }
   const points=[...vision.values()].flatMap(polys=>polys.flatMap(p=>p.points));if(!points.length)return;
   const bounds=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
   return app.dispatch('fog.reveal',{epoch:v.fog?.epoch||0,levels:rasterVision(vision,bounds)});
  },
  info:()=>({viewer:viewer(),active:active(),dark:darkFor(),cellFeet:1.25,sent,seconds:(performance.now()-started)/1000,areas:[...states.values()].map(s=>({area:s.area,pending:s.pending,error:s.error,polygonMs:s.polygonMs,totalMs:s.totalMs,dark:!!s.dark,lights:s.lightsUsed,hint:s.hint,epoch:s.epoch,bytes:JSON.stringify(app.view(s.area)?.fog||{}).length,levels:s.levels.map(l=>({floorY:l.floorY,width:l.width,height:l.height}))}))})};
 app.on(what=>{if(what==='refresh')for(const [area,s]of states){const v=app.view(area);if(v&&s.mode!==modeKey(area))update(area,s.world,v,{force:true,snap:true});}});
 return app.fog;
}
