// Viewer-local sight and presentation. Durable exploration is a compact relay union,
// never a history stream. Geometry/raster work runs off the animation frame in a worker.
import { T } from './tuner.js';
import { sightLevel, isTerrain, levelY, baseUnder } from '../core/height.js'; // (levelY: a room's level over its own ground; a building on a hill sees at the ground's, 2026-10-24)
import { areaForClient } from '../core/state.js';
import { exploredFor, hasFogCell, unionLevels, GM_CURSOR_THROUGH_FOG } from '../core/fog.js';
import { visibleAt } from './vision.js';
import { rasterVision, subtractLevels, nonempty, exploredInBox } from './fog-grid.js';
import { polyFeet } from '../core/footprint.js';
import { darknessFor, lightKind, lightRadiusOf, lightTable, hintOf } from '../core/darkness.js';
import { darkVisibleAt } from './darksight.js';
import { bandsOf, extKey, underSky, holeKey, feetKey } from '../core/exterior.js';
import { isOpening } from '../core/holes.js';
import { isConnector } from '../core/stairs.js';

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
 // A seat always knows where its own pawns are, fog or none (Harry 2026-10-26 on his phone: "100% covered, can't see own pawn")
 const mine=e=>e?.kind==='token'&&!!e.owner&&e.owner===viewer();
 // FOG REPORTS (2026-10-26): Harry's phone showed only fog and no pawn, and no engine here reproduced it. A worker that fails, or
 // sight not there after 20 s, is told to the server the way a boot error is (index.html fail(): a GET that lands in nginx's
 // log as a 404). On dev the first sight is told too, with its timings, to compare a phone with what the box measures.
 const told=new Set(),onDev=document.querySelector('meta[name="tw-channel"]')?.content==='dev';
 function tell(what,s,extra=''){if(told.has(what))return;told.add(what);try{new Image().src=new URL('./__boot-error',import.meta.url).pathname+'?k=fog&m='+encodeURIComponent(`${what} at ${Math.round(performance.now()-s.bornAt)}ms ${extra}`.slice(0,600));}catch{}}
 function showBadge(){badge.hidden=!preview();badge.dataset.viewer=viewer()||'';badge.textContent=preview()?`Viewing as ${viewer()==='party'?'party':app.sync.campaign?.seats.find(s=>s.id===viewer())?.name||'player'} · return to GM`:'';}
 function visible(x,z,level=0,area){if(!active(area))return true;const s=get(area);return !!s&&!s.pending&&(s.dark?darkVisibleAt(s.dark,x,z,level):visibleAt(s.vision,x,z,level));}
 function explored(x,z,level=0,area){if(!active(area))return true;const s=get(area);return !!s&&(hasFogCell(s.explored,x,z,level)||visible(x,z,level,area));}
 // EXTERIORS ABOVE (core/exterior.js): the band a height is drawn in (the highest band at or below it), and what this seat has
 // seen of the outside at that height. Only asked for a spot under the sky (exposedAt): a thing under a roof is ruled as before.
 function bandOf(s,y){const B=s?.bands||[0];let b=B[0]??0;for(const v of B)if(y+.08>=v)b=v;return b;}
 function extSees(s,x,z,y){if(!s||s.dark)return false;const k=extKey(bandOf(s,y));return hasFogCell(s.explored,x,z,k)||visibleAt(s.vision,x,z,k);}
 function extNow(s,x,z,y){if(!s||s.dark)return false;return visibleAt(s.vision,x,z,extKey(bandOf(s,y)));}
 // HOLES AND RAISED FEET (core/exterior.js HOLE, FEET): what a pawn saw down through an opening, and a hilltop pawn's sight of
 // its own floor, kept at the height they are at (the remembered cells hold the opening's cone; the live polygons hold it too)
 const sideKnown=(s,x,z,y)=>{if(!s||s.dark)return false;const b=bandOf(s,y);return hasFogCell(s.explored,x,z,holeKey(b))||hasFogCell(s.explored,x,z,feetKey(b));};
 const sideNow=(s,x,z,y)=>{if(!s||s.dark)return false;const b=bandOf(s,y);return visibleAt(s.vision,x,z,holeKey(b))||visibleAt(s.vision,x,z,feetKey(b));};
 const sideInBox=(s,y,x0,z0,x1,z1)=>{if(!s||s.dark)return false;const b=bandOf(s,y);return exploredInBox(s.explored,holeKey(b),x0,z0,x1,z1)||exploredInBox(s.explored,feetKey(b),x0,z0,x1,z1);};
 const exposedAt=(s,x,z,y)=>underSky(s.world.view?.entities,x,z,y,open); // (2026-11-24 later: at any height: a thing on the ground is seen from a terrace above it)
 function rule(s,e) {
  if(!active(s.area)||s.world.local)return false;
  if(e.hidden||e.factionMissing)return true;
  if(s.cache.has(e))return s.cache.get(e);
  let known=false;
  if(e.kind==='token'){known=mine(e)||visible(e.x,e.z,sightLevel(s.world.view?.entities,e.x,e.z,e.y||0,open),s.area);
   // a pawn standing out in the open higher up (an open terrace, a roof, a hilltop's tower top) is seen from below now
   if(!known){const b=baseUnder(s.world.view?.entities,e.x,e.z,e.y||0,open).y;known=sideNow(s,e.x,e.z,b)||(extNow(s,e.x,e.z,b)&&exposedAt(s,e.x,e.z,b));}}
  else if(e.recipe){const points=polyFeet(e.recipe);const x=points.reduce((a,p)=>a+p[0],0)/points.length,z=points.reduce((a,p)=>a+p[1],0)/points.length;const ly=levelY(s.world.view?.entities,e);known=explored(x,z,ly,s.area)||points.some(([x,z])=>explored(x,z,ly,s.area));
    if(!known)for(let z=e.recipe.z*5;z<(e.recipe.z+e.recipe.d)*5&&!known;z+=5)for(let x=e.recipe.x*5;x<(e.recipe.x+e.recipe.w)*5&&!known;x+=5)known=explored(x+2.5,z+2.5,ly,s.area);
    // its outside seen from below (an upper storey, a hilltop temple): the shell is drawn, the inside stays the fog's (the floor
    // checker; its things by their own rule). Sampled just outside every wall, at its floor's band.
    if(!known&&!s.dark&&!isTerrain(e.recipe))known=sideInBox(s,e.recipe.y||0,e.recipe.x*5,e.recipe.z*5,(e.recipe.x+e.recipe.w)*5,(e.recipe.z+e.recipe.d)*5); // (seen down a hole, or from raised feet)
    if(!known&&!s.dark){const fy=e.recipe.y||0,p=points,n=p.length;
     for(let i=0;i<n&&!known;i++){const [ax,az]=p[i],[bx,bz]=p[(i+1)%n],len=Math.hypot(bx-ax,bz-az)||1,ox=(bz-az)/len*.7,oz=-(bx-ax)/len*.7;
      for(let t=0;t<=len&&!known;t+=2.5){const x=ax+(bx-ax)*t/len,z=az+(bz-az)*t/len;known=extSees(s,x+ox,z+oz,fy)||extSees(s,x-ox,z-oz,fy);}}}
  }else if(e.kind==='building'){known=Object.values(s.world.view?.entities||{}).some(r=>r.kind==='room'&&r.building===e.id&&!rule(s,r));}
  else {
   const room=s.world.view?.entities[e.room],y=room?.recipe?levelY(s.world.view?.entities,room):sightLevel(s.world.view?.entities,e.x,e.z,e.y||0,open);
   const dx=Math.max(.65,(e.dims?.[0]||0)/2),dz=Math.max(.65,(e.dims?.[2]||0)/2),c=Math.abs(Math.cos(e.rot||0)),n=Math.abs(Math.sin(e.rot||0)),rx=c*dx+n*dz,rz=n*dx+c*dz;
   known=exploredInBox(s.explored,y,e.x-rx,e.z-rz,e.x+rx,e.z+rz)||visible(e.x,e.z,y,s.area);
   const h=e.y||0;
   if(!known&&!s.dark){
    // a piece of a room's shell (a wall, a slab, a roof piece: no kind): its outside seen at its height. The exterior is never kept
    // inside a roofed room (fog-worker clearCovered), so only its outer side can answer.
    // (only the remembered cells, which never lie inside a roofed room or under a floor: fog-worker clearCovered. The live
    // polygons do, so a room's inside partition walls seen from a terrace above would show)
    // (not a FLOOR piece: a storey's floor is its inside, seen from in it; from outside you know its walls, not its floor)
    if(!e.kind){known=sideInBox(s,h,e.x-rx,e.z-rz,e.x+rx,e.z+rz);if(!known&&e.layer!=='floor')known=exploredInBox(s.explored,extKey(bandOf(s,h)),e.x-rx,e.z-rz,e.x+rx,e.z+rz);}
    // A THING OUT IN THE OPEN up high (Harry: "a hidden sculpture on top of the pillar ... standing out there right out in the
    // open"): nothing over it, no roofed room round it; known when its own spot's outside is (its centre: a box reaches through walls)
    else known=sideKnown(s,e.x,e.z,h)||(extSees(s,e.x,e.z,h)&&exposedAt(s,e.x,e.z,h)); // (a thing: its centre, seen down a hole or from raised feet)
   }
  }
  s.cache.set(e,!known);return !known;
 }
 function refreshWorld(s,snap=false){
  const w=s.world;s.cache=new WeakMap();w.fogRule=e=>rule(s,e);w.fogActive=active(s.area);w.fogSees=(x,z,y=0)=>visible(x,z,sightLevel(w.view?.entities,x,z,y,open),s.area)||(active(s.area)&&(sideNow(s,x,z,y)||(extNow(s,x,z,y)&&exposedAt(s,x,z,y))));w.fogKnown=(x,z,y=0)=>explored(x,z,sightLevel(w.view?.entities,x,z,y,open),s.area)||(active(s.area)&&(sideKnown(s,x,z,y)||(extSees(s,x,z,y)&&exposedAt(s,x,z,y))));w.cutGen=(w.cutGen||0)+1;w.passGen=-1;w.cutDirty=true; // (cutDirty: which rooms are covered follows what the fog lets this seat see: world.js cutSets, 2026-11-05)
  const fx=w.fx?.fogwar||w.fogwar;if(!fx)return;
  // (first person, surfaces/fpv.js: w.fogDrawOff. The fog of war's LOOK is drawn for a camera above the floor: at eye level its
  // never-seen checkerboard sheets, known-wall faces and bank read as torn walls and floating planes (Gemini r6). What is
  // withheld stays withheld (fogRule above, the relay's own): only the overlay is not drawn while looking.)
  if(!active(s.area)||w.fogDrawOff){fx.setState({enabled:false});if(w.fogDrawOff)w.cutPass();return;}
  // (first person, surfaces/fpv.js: w.eyeLevel caps the levels as the cut does, at the pawn's own: an upper storey's never-seen floor is not a sheet floating in the sky)
  const floorY=w.fogLevel(), capY=w.eyeLevel!=null?w.eyeLevel:w.cut; const levels=(s.levels||[]).filter(l=>capY==null||l.floorY<=capY);
  const sameMask=s.uploadedLevels===s.levels&&s.uploadedCut===capY&&s.uploadedFloor===floorY&&fx.enabled;
  if(!sameMask||snap)fx.setState(levels.length?{enabled:true,levels,floorY,revision:++serial,snap}:{enabled:true,width:1,height:1,bounds:[-400,-400,400,400],data:new Uint8Array(4),floorY,revision:++serial,snap:true});
  s.uploadedLevels=s.levels;s.uploadedCut=capY;s.uploadedFloor=floorY;
  if(!w.fx)fx.setDecorative(false);
  w.cutPass();
 }
 function create(area,w){
  const url=new URL('./fog-worker.js',import.meta.url);url.search=new URL(import.meta.url).search;
  const worker=new Worker(url,{type:'module'}),s={area,world:w,worker,vision:new Map(),own:{},party:{},explored:{},epoch:-1,cache:new WeakMap(),levels:[],lastSend:0,pending:true,busy:false,geometryKey:null,bornAt:performance.now()};states.set(area,s);
  worker.onmessage=({data:m})=>{
   s.busy=false;
   if(m.epoch!==s.epoch||m.id!==s.wanted?.id){post(s);return;}
   if(m.error){s.error=m.error;console.error('fog vision',m.error);tell('error',s,m.error);return;}
   s.pending=false;s.vision=new Map(m.vision);s.dark=m.dark?new Map(m.dark):null;s.levels=m.levels;s.polygonMs=m.polygonMs;s.totalMs=m.totalMs;s.lightsUsed=m.lights??null;
   s.own=unionLevels(s.own,m.ownCells);s.party=unionLevels(s.party,m.partyCells||{});
   const v=app.view(area);s.explored=unionLevels(unionLevels(exploredFor(v?.fog,viewer(),shared()||viewer()==='party'),shared()||viewer()==='party'?s.party:viewer()===app.me()?s.own:{}),m.reach||m.current);
   refreshWorld(s,s.snap);s.snap=false;app.gfx?.wake('vision');
   if(!s.firstAt){s.firstAt=performance.now();if(onDev||s.firstAt-s.bornAt>8000){const E=app.view(area)?.entities||{},own=Object.values(E).filter(mine),l=s.levels?.[0];
    tell('first',s,`worker ${Math.round(m.totalMs)}ms polygons ${Math.round(m.polygonMs)}ms levels ${s.levels?.length} mask ${l?.width}x${l?.height} pawns ${own.length} seen ${own.filter(e=>visible(e.x,e.z,sightLevel(E,e.x,e.z,e.y||0,open),area)).length} maxTex ${app.gfx?.renderer?.capabilities?.maxTextureSize??'?'} dark ${!!s.dark}`);}}
   if(s.area===app.area())for(const id of [...app.sel])if(rule(s,app.ent(id)||{}))app.sel.delete(id);
   app.emit('vision',area);app.refresh();
  };
  worker.onerror=e=>{s.error=e.message;console.error('fog worker',e.message);tell('onerror',s,`${e.message} ${e.filename||''}:${e.lineno||''}`);};
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
   out.push({id:e.id,kind,x:Math.round(x*1000)/1000,z:Math.round(z*1000)/1000,level:room?levelY(E,room):sightLevel(E,e.x,e.z,e.y||0,open),radius});
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
  // THE FOG LIES WHERE MY PAWN STANDS (2026-11-01, Harry: "Sammy Sample can see the walls of his room, but none of the objects
  // in the room, and can't see his own pawn"). With the view on all levels the fog used to lie on the ground whatever the
  // viewer was doing upstairs, and the atmosphere's depth pass (fx/atmos.js lowz) drops whatever stands over cells unseen ON
  // ITS LEVEL, known walls excepted, so a pawn on an upper storey, its floor and its furniture all went under the ground's
  // bank. A new player's view IS on all levels and the "Cut to lv N" offer only comes when a pawn changes floor, so nothing
  // told them. The view itself is left alone (surfaces/cut.js: only the viewer changes it): this is world.js fogLevel's level.
  {const own=active(area)?Object.values(E).filter(mine):[],t=own.find(e=>e.main)||own[0],lv=t?sightLevel(E,t.x,t.z,t.y||0,open):0;w.viewerLevel=lv>0?lv:null;}
  s.explored=unionLevels(exploredFor(v.fog,viewer(),shared()||viewer()==='party'),shared()||viewer()==='party'?s.party:viewer()===app.me()?s.own:{});
  // GM's unrestricted picture performs no fog work; it never writes player exploration.
  if(!active(area)){s.wanted=null;s.geometryKey=null;s.pending=false;refreshWorld(s);return;}
  const pawns={},geometryEntities={}; const outdoor=new Set();let x0=-40,z0=-40,x1=40,z1=40;const levels=new Set([0]);
  for(const e of Object.values(E)){
   if(e.kind==='token'){pawns[e.id]=e;x0=Math.min(x0,e.x-30);z0=Math.min(z0,e.z-30);x1=Math.max(x1,e.x+30);z1=Math.max(z1,e.z+30);levels.add(sightLevel(E,e.x,e.z,e.y||0,open));}
   else if(e.kind==='room'||e.kind==='building'||e.kind==='edge'||(e.kind==='object'&&(e.fromEdge||/door|gate|portcullis|wall-straight/.test(e.cat||'')||isOpening(e)||isConnector(e))))geometryEntities[e.id]=e; // (2026-11-25: holes, through pits and stairs too: a pawn looks down through them, vision.js openingShapes)
   if(e.kind==='object'&&Number.isFinite(e.x)&&Number.isFinite(e.z)){const dx=Math.max(5,(e.dims?.[0]||0)/2),dz=Math.max(5,(e.dims?.[2]||0)/2);x0=Math.min(x0,e.x-dx);z0=Math.min(z0,e.z-dz);x1=Math.max(x1,e.x+dx);z1=Math.max(z1,e.z+dz);}
   if(e.recipe){x0=Math.min(x0,e.recipe.x*5-30);z0=Math.min(z0,e.recipe.z*5-30);x1=Math.max(x1,(e.recipe.x+e.recipe.w)*5+30);z1=Math.max(z1,(e.recipe.z+e.recipe.d)*5+30);if(!isTerrain(e.recipe))levels.add(levelY(E,e));if(T.walls?.isOutdoor?.(e.recipe.type))outdoor.add(e.recipe.type);}
  }
  const bounds=[Math.floor(x0/5)*5,Math.floor(z0/5)*5,Math.ceil(x1/5)*5,Math.ceil(z1/5)*5];
  const dark=darkFor(area);
  // (2026-11-24) the fog's picture is cut by HEIGHT: every sight level plus every room's floor and top and every hill's top (core/exterior.js bandsOf)
  const bands=bandsOf(E,[...levels]);s.bands=bands;
  const geometry={entities:geometryEntities,edges:[...(w.edges||[])],outdoor:[...outdoor],bounds,levels:bands,sight:[...levels].sort((a,b)=>a-b)}; // (sight: the old levels, drawn fine; the other bands at the stored cells)
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
   if(s.cut!==w.cut||s.eyeLevel!==w.eyeLevel||s.drawOff!==!!w.fogDrawOff){s.cut=w.cut;s.eyeLevel=w.eyeLevel;s.drawOff=!!w.fogDrawOff;refreshWorld(s);}
   if(s.pending&&!s.firstAt&&active(s.area)&&now-s.bornAt>20000)tell('pending',s,`busy ${s.busy} wanted ${!!s.wanted} error ${s.error||'none'} status ${app.sync.status}`);
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
 app.canSeePawn=(e,area)=>!e||e.kind!=='token'||!active(area)||(!e.hidden&&mine(e))||(!e.hidden&&visible(e.x,e.z,sightLevel(app.worlds.get(area||app.area())?.view?.entities,e.x,e.z,e.y||0,open),area));
 // May this seat's cursor / ruler be drawn where this viewer cannot currently see? (GM: only when GM_CURSOR_THROUGH_FOG)
 app.fogShows=(seat,x,z,y,area)=>{if(!active(area)||GM_CURSOR_THROUGH_FOG)return true;if(app.sync.campaign?.seats.find(s=>s.id===seat)?.role!=='gm')return true;const w=app.worlds.get(area||app.area());return visible(x,z,sightLevel(w?.view?.entities,x,z,y||0,open),area);};
 app.fog={active,preview,visible,explored,update,tick,
  sendNow:()=>{for(const s of states.values())s.lastSend=0;tick(performance.now());}, // what this tab has explored, to the relay now (not in 2 s): a door.open just after first sight is checked against it (core/commands.js doorFogged)
 dark:darkFor,lightsOf:(area)=>lightsOf(app.view(area)?.entities||{},tableFor(app.worlds.get(area||app.area()))),lightTable:(area)=>tableFor(app.worlds.get(area||app.area())),sceneView:v=>preview()?areaForClient(v,false):v,
  hidden:(e,area)=>{const s=get(area);return s?rule(s,e):false;},
  reset:()=>app.gm()&&app.sync.submit('fog.reset',{area:app.area()}),
  revealHere:()=>{
   if(!app.gm())return;
   const v=app.view(),selected=[...app.sel].map(id=>v.entities[id]).filter(e=>e?.kind==='room'),vision=new Map();
   const add=(level,points)=>{if(!vision.has(level))vision.set(level,[]);vision.get(level).push({points});};
   if(selected.length)for(const r of selected)add(levelY(v.entities,r),polyFeet(r.recipe));
   else {
    // The finite area's whole floor plan, including loose scenery outdoors.
    const entities=Object.values(v.entities).filter(e=>!e.hidden),points=entities.flatMap(e=>e.recipe?polyFeet(e.recipe):Number.isFinite(e.x)&&Number.isFinite(e.z)?[[e.x-5,e.z-5],[e.x+5,e.z+5]]:[]);
    if(!points.length)points.push([-40,-40],[40,40]);
    const x0=Math.min(...points.map(p=>p[0])),z0=Math.min(...points.map(p=>p[1])),x1=Math.max(...points.map(p=>p[0])),z1=Math.max(...points.map(p=>p[1]));
    const levels=new Set([0,...entities.filter(e=>e.recipe&&!isTerrain(e.recipe)).map(e=>levelY(v.entities,e))]);
    for(const level of levels)add(level,[[x0,z0],[x1,z0],[x1,z1],[x0,z1]]);
    for(const band of bandsOf(v.entities))if(band>0)add(extKey(band),[[x0,z0],[x1,z0],[x1,z1],[x0,z1]]); // (and the outside at every height above the ground)
   }
   const points=[...vision.values()].flatMap(polys=>polys.flatMap(p=>p.points));if(!points.length)return;
   const bounds=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
   return app.dispatch('fog.reveal',{epoch:v.fog?.epoch||0,levels:rasterVision(vision,bounds)});
  },
  info:()=>({viewer:viewer(),active:active(),dark:darkFor(),cellFeet:1.25,sent,seconds:(performance.now()-started)/1000,areas:[...states.values()].map(s=>({area:s.area,pending:s.pending,error:s.error,polygonMs:s.polygonMs,totalMs:s.totalMs,dark:!!s.dark,lights:s.lightsUsed,hint:s.hint,epoch:s.epoch,bytes:JSON.stringify(app.view(s.area)?.fog||{}).length,levels:s.levels.map(l=>({floorY:l.floorY,width:l.width,height:l.height}))}))})};
 app.on(what=>{if(what==='refresh')for(const [area,s]of states){const v=app.view(area);if(v&&s.mode!==modeKey(area))update(area,s.world,v,{force:true,snap:true});}});
 return app.fog;
}
