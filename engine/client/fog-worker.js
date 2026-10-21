import { computeVision } from './vision.js';
import { rasterVision, maskLevels } from './fog-grid.js';
import { unionLevels } from '../core/fog.js';
import { darkSight, rasterDark, sightForClient } from './darksight.js';
let geometry=null;
// Darkness (client/darksight.js): light polygons and wall segments live until the walls change (a new geometry message)
let lightCache=new Map(),wallCache=new Map();
self.onmessage=({data:m})=>{
 try {
  if(m.geometry){geometry=m.geometry;lightCache=new Map();wallCache=new Map();}
  const start=performance.now(), entities={...geometry.entities,...m.pawns};
  const options={entities,edges:new Map(geometry.edges),seats:m.seats,bounds:geometry.bounds,isOpen:r=>!!r.roof?.off||geometry.outdoor.includes(r.recipe?.type)};
  if(m.dark){dark(m,options,start);return;}
  const own=computeVision({...options,viewer:m.seat}),shown=m.shared||m.viewer==='party'?computeVision({...options,party:true}):m.viewer===m.seat?own:computeVision({...options,viewer:m.viewer});
  const polygonMs=performance.now()-start;
  const current=rasterVision(shown,geometry.bounds),ownCells=shown===own?current:rasterVision(own,geometry.bounds);
  const explored=unionLevels(m.explored||{},current);
  const levels=maskLevels(current,explored,geometry.bounds,geometry.levels,shown);
  self.postMessage({id:m.id,epoch:m.epoch,vision:[...shown],current,ownCells,partyCells:m.shared?current:null,levels,polygonMs,totalMs:performance.now()-start},levels.map(l=>l.data.buffer));
 }catch(e){self.postMessage({id:m.id,epoch:m.epoch,error:String(e.stack||e)});}
};
// A DARK AREA: seen = line of sight AND (darkvision OR lit); the hint band past every radius joins explored only.
// `current` stays what is seen (the fog pass's R channel, the pawn rule); `reach` (seen + hint) is what joins explored.
function dark(m,options,start){
 const ctx={...options,lights:m.lights||[],hint:m.hint||0,cache:lightCache,walls:wallCache};
 const own=darkSight({...ctx,viewer:m.seat}),shown=m.shared||m.viewer==='party'?darkSight({...ctx,party:true}):m.viewer===m.seat?own:darkSight({...ctx,viewer:m.viewer});
 const polygonMs=performance.now()-start,b=geometry.bounds;
 const S=rasterDark(shown,b),O=shown===own?S:rasterDark(own,b);
 const explored=unionLevels(m.explored||{},S.reach);
 const levels=maskLevels(S.current,explored,b,geometry.levels,shown,(actual,step)=>rasterDark(shown,actual,step,{hint:false}).current);
 const lights=[...shown.values()].reduce((n,L)=>n+L.lights,0);
 self.postMessage({id:m.id,epoch:m.epoch,vision:[...shown].map(([l,L])=>[l,L.los.map(points=>({points}))]),dark:sightForClient(shown),current:S.current,reach:S.reach,ownCells:O.reach,partyCells:m.shared?S.reach:null,levels,polygonMs,lights,totalMs:performance.now()-start},levels.map(l=>l.data.buffer));
}
