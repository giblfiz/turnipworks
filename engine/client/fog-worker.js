import { computeVision } from './vision.js';
import { rasterVision, maskLevels, clearCovered, resetFootprints } from './fog-grid.js';
import { bandParts, blindAt } from '../core/exterior.js';
import { isOpening } from '../core/holes.js';
import { unionLevels } from '../core/fog.js';
import { darkSight, rasterDark, sightForClient } from './darksight.js';
let geometry=null;
// Darkness (client/darksight.js): light polygons and wall segments live until the walls change (a new geometry message)
let lightCache=new Map(),wallCache=new Map();
self.onmessage=({data:m})=>{
 try {
  if(m.geometry){geometry=m.geometry;lightCache=new Map();wallCache=new Map();resetFootprints();}
  const start=performance.now(), entities={...geometry.entities,...m.pawns};
  const isOpen=r=>!!r.roof?.off||geometry.outdoor.includes(r.recipe?.type);
  const options={entities,edges:new Map(geometry.edges),seats:m.seats,bounds:geometry.bounds,isOpen};
  // a band's mask is composed (core/exterior.js bandParts); the fog keeps the band heights in geometry.levels
  const compose=b=>bandParts(entities,b,isOpen),covered=b=>blindAt(entities,b,isOpen),sight=new Set(geometry.sight||geometry.levels),coarse=b=>!sight.has(b);
  if(m.dark){dark(m,options,start,compose,coarse);return;}
  const seeing={...options,bands:geometry.levels,openings:Object.values(geometry.entities).filter(isOpening)};
  const own=computeVision({...seeing,viewer:m.seat}),shown=m.shared||m.viewer==='party'?computeVision({...seeing,party:true}):m.viewer===m.seat?own:computeVision({...seeing,viewer:m.viewer});
  const polygonMs=performance.now()-start;
  // (the exterior never keeps the inside of a roofed room: cleared before it is remembered or sent)
  const current=clearCovered(rasterVision(shown,geometry.bounds),covered,geometry.bounds),ownCells=shown===own?current:clearCovered(rasterVision(own,geometry.bounds),covered,geometry.bounds);
  const explored=unionLevels(m.explored||{},current);
  const levels=maskLevels(current,explored,geometry.bounds,geometry.levels,shown,null,compose,coarse);
  self.postMessage({id:m.id,epoch:m.epoch,vision:[...shown],current,ownCells,partyCells:m.shared?current:null,levels,polygonMs,totalMs:performance.now()-start},levels.map(l=>l.data.buffer));
 }catch(e){self.postMessage({id:m.id,epoch:m.epoch,error:String(e.stack||e)});}
};
// A DARK AREA: seen = line of sight AND (darkvision OR lit); the hint band past every radius joins explored only.
// `current` stays what is seen (the fog pass's R channel, the pawn rule); `reach` (seen + hint) is what joins explored.
function dark(m,options,start,compose=null,coarse=null){
 const ctx={...options,lights:m.lights||[],hint:m.hint||0,cache:lightCache,walls:wallCache};
 const own=darkSight({...ctx,viewer:m.seat}),shown=m.shared||m.viewer==='party'?darkSight({...ctx,party:true}):m.viewer===m.seat?own:darkSight({...ctx,viewer:m.viewer});
 const polygonMs=performance.now()-start,b=geometry.bounds;
 const S=rasterDark(shown,b),O=shown===own?S:rasterDark(own,b);
 const explored=unionLevels(m.explored||{},S.reach);
 const levels=maskLevels(S.current,explored,b,geometry.levels,shown,(actual,step)=>rasterDark(shown,actual,step,{hint:false}).current,compose,coarse);
 const lights=[...shown.values()].reduce((n,L)=>n+L.lights,0);
 self.postMessage({id:m.id,epoch:m.epoch,vision:[...shown].map(([l,L])=>[l,L.los.map(points=>({points}))]),dark:sightForClient(shown),current:S.current,reach:S.reach,ownCells:O.reach,partyCells:m.shared?S.reach:null,levels,polygonMs,lights,totalMs:performance.now()-start},levels.map(l=>l.data.buffer));
}
