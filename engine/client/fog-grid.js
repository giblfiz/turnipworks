// Scanline raster of sight polygons. Rows are inclusive runs of 1.25-ft cells.
import { FOG_CELL } from '../core/fog.js';
import { polyFeet } from '../core/footprint.js';
import { isExtKey, isSideKey, EXT } from '../core/exterior.js';
// An entry may carry `minus` (rooms: its cells inside them are left out: a raised pawn's level sight never covers the rooms
// under its feet) or `within` (a polygon: only its cells inside it count: the cone through a hole). Rastered on its own.
export function rasterVision(vision, bounds, cell = FOG_CELL) {
  const out = {};
  for (const [level, all] of vision) {
    const rows = {}, polygons = all.filter(p => !p.minus?.length && !p.within), special = all.filter(p => p.minus?.length || p.within);
    for (const p of special) {
      let r = rasterVision(new Map([[0, [{ points: p.points }]]]), bounds, cell)[0] || {};
      if (p.within) for (const w of p.within) r = intersectRows(r, rasterVision(new Map([[0, [{ points: w }]]]), bounds, cell)[0] || {});
      if (p.minus?.length) { const k = p.minus.map(m => m.id).join(',') + '|' + cell + '|' + bounds.join(','); if (!FEET.has(k)) FEET.set(k, footRows(p.minus, bounds, cell)); r = subtractRows(r, FEET.get(k)); }
      for (const [z, runs] of Object.entries(r)) (rows[z] ||= []).push(...runs.map(q => [...q]));
    }
    for (const { points } of polygons) {
      if (points.length < 3) continue;
      const lo = Math.max(Math.floor(bounds[1] / cell), Math.floor(Math.min(...points.map(p => p[1])) / cell));
      const hi = Math.min(Math.ceil(bounds[3] / cell), Math.ceil(Math.max(...points.map(p => p[1])) / cell));
      for (let z = lo; z < hi; z++) {
        const y = (z + .5) * cell, cuts = [];
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const a = points[j], b = points[i];
          if ((a[1] > y) !== (b[1] > y)) cuts.push(a[0] + (y-a[1])*(b[0]-a[0])/(b[1]-a[1]));
        }
        cuts.sort((a,b)=>a-b);
        for (let i=0;i+1<cuts.length;i+=2) {
          const a=Math.max(Math.floor(bounds[0]/cell),Math.ceil(cuts[i]/cell-.5+1e-7));
          const b=Math.min(Math.ceil(bounds[2]/cell)-1,Math.floor(cuts[i+1]/cell-.5-1e-7));
          if(a<=b)(rows[z] ||= []).push([a,b]);
        }
      }
    }
    for(const [z,runs] of Object.entries(rows)) {
      runs.sort((a,b)=>a[0]-b[0]); const joined=[];
      for(const r of runs) { const last=joined.at(-1);if(last && r[0]<=last[1]+1)last[1]=Math.max(last[1],r[1]);else joined.push([...r]); }
      rows[z]=joined;
    }
    out[level]=rows;
  }
  return out;
}
export function subtractLevels(a,b) {
 const out={};
 for(const [level,rows] of Object.entries(a||{}))for(const [z,runs]of Object.entries(rows)) {
  const have=b?.[level]?.[z]||[], diff=[];
  for(const [lo,hi]of runs){let x=lo;for(const [l,h]of have){if(h<x)continue;if(l>hi)break;if(l>x)diff.push([x,Math.min(hi,l-1)]);x=Math.max(x,h+1);if(x>hi)break;}if(x<=hi)diff.push([x,hi]);}
  if(diff.length)((out[level] ||= {})[z]=diff);
 }
 return out;
}
export const nonempty = levels => Object.values(levels||{}).some(rows=>Object.keys(rows).length);
// fineRaster(bounds, step): the fine current-sight rows instead of rastering `vision` (a dark area: client/darksight.js)
// compose(floorY) -> [{ key, within?: [room], hills?, minus?: [room] }]: what that band's mask is made of (core/exterior.js
// bandParts, 2026-11-24: a band is a HEIGHT; its mask unions the sight level of that height, the exterior seen there and the
// sight levels of the rooms spanning it, each clipped to its rooms). Without it a band is its own level, as before.
export function maskLevels(current, explored, bounds, levels, vision = null, fineRaster = null, compose = null, coarse = null) {
 const fineStep=Math.max(vision ? .3125 : FOG_CELL,(bounds[2]-bounds[0])/1024,(bounds[3]-bounds[1])/1024);
 const coarseStep=Math.max(FOG_CELL,(bounds[2]-bounds[0])/1024,(bounds[3]-bounds[1])/1024);
 const frame=step=>{const width=Math.ceil((bounds[2]-bounds[0])/step),height=Math.ceil((bounds[3]-bounds[1])/step);return {step,width,height,actual:[bounds[0],bounds[1],bounds[0]+width*step,bounds[1]+height*step]};};
 const F=frame(fineStep),C=fineStep===coarseStep?F:frame(coarseStep);
 // (the exterior's sight, core/exterior.js, is drawn at the stored 1.25-ft cells: it is far off and large, and rastering it
 // fine for every band cost more than all the rest of the mask)
 const near = vision && [...vision.keys()].some(isSideKey) ? new Map([...vision].filter(([k])=>!isSideKey(k))) : vision;
 const fine = vision ? (fineRaster ? fineRaster(F.actual, fineStep) : rasterVision(near, F.actual, fineStep)) : null;
 const rowsOf=(rooms,cell,b)=>{if(!rooms?.length)return null;const k=rooms.map(r=>r.id).join(',')+'|'+cell+'|'+b.join(',');if(!FEET.has(k)){if(FEET.size>256)FEET.clear();FEET.set(k,footRows(rooms,b,cell));}return FEET.get(k);};
 const clip=(rows,part,cell,b)=>{if(!rows)return null;let out=rows;const w=rowsOf(part.within,cell,b),m=rowsOf(part.minus,cell,b);if(part.within)out=w?intersectRows(out,w):{};if(m)out=subtractRows(out,m);return out;};
 return levels.map(floorY=>{
  // a band that is no one's sight level (a roof top, a hilltop room's floor: core/exterior.js) is drawn at the stored cells
  const R=coarse?.(floorY)?C:F,{step,width,height}=R,useFine=fine&&R===F;
  const data=new Uint8Array(width*height*4),pixels=new Uint32Array(data.buffer);
  const parts=compose?compose(floorY):[{key:floorY}];
  const sources=[];
  for(const part of parts)sources.push([clip(explored?.[part.key],part,FOG_CELL,bounds),1,FOG_CELL]);
  for(const part of parts){const f=useFine&&!isSideKey(part.key);sources.push([f?clip(fine[part.key],part,step,R.actual):clip(current?.[part.key],part,FOG_CELL,bounds),0,f?step:FOG_CELL]);}
  for(const [rows,channel,cell]of sources)for(const [zs,runs]of Object.entries(rows||{})) {
   const y0=Math.max(0,Math.ceil((+zs*cell-bounds[1])/step-.5)),y1=Math.min(height-1,Math.floor(((+zs+1)*cell-bounds[1])/step-.5));
   for(const [a,b]of runs){const start=Math.max(0,Math.ceil((a*cell-bounds[0])/step-.5)),end=Math.min(width-1,Math.floor(((b+1)*cell-bounds[0])/step-.5));
    for(let y=y0;y<=y1;y++)if(start<=end){if(channel===1)pixels.fill(0x0000ff00,y*width+start,y*width+end+1);else pixels.fill(0x0000ffff,y*width+start,y*width+end+1);}
   }
  }
  return {floorY,bounds:R.actual,width,height,data};
 });
}
// room footprints rastered for the composition, kept until the walls or rooms change (the worker calls resetFootprints on
// every new geometry message): a pawn's step re-rasters nothing but its own sight
const FEET=new Map();
export const resetFootprints=()=>FEET.clear();
// a room list's floor cells (cell centres inside its footprints), as rows of runs at `cell` (the raster's own index space)
export const footRows=(rooms,bounds,cell=FOG_CELL)=>rasterVision(new Map([[0,rooms.map(r=>({points:polyFeet(r.recipe)}))]]),bounds,cell)[0]||{};
export function intersectRows(a,b){
 const out={};
 for(const [z,runs]of Object.entries(a||{})){const other=b?.[z];if(!other)continue;const keep=[];
  for(const [lo,hi]of runs)for(const [l,h]of other){const s=Math.max(lo,l),e=Math.min(hi,h);if(s<=e)keep.push([s,e]);}
  if(keep.length)out[z]=keep.sort((p,q)=>p[0]-q[0]);}
 return out;
}
export const subtractRows=(a,b)=>subtractLevels({0:a},{0:b})[0]||{};
// THE EXTERIOR NEVER LIES INSIDE A ROOFED ROOM (core/exterior.js): clear every exterior key's cells inside the roofed rooms
// spanning its band. `covered(band)` -> [room].
export function clearCovered(levels,covered,bounds,cell=FOG_CELL){
 const out={...levels};
 for(const k of Object.keys(levels||{})){if(!isExtKey(k))continue;const rooms=covered(+k-EXT);if(rooms.length){const key=rooms.map(r=>r.id).join(',')+'|'+cell+'|'+bounds.join(',');if(!FEET.has(key))FEET.set(key,footRows(rooms,bounds,cell));out[k]=subtractRows(levels[k],FEET.get(key));}}
 return out;
}

// Conservative geometry culling: a corner in memory is enough to draw the whole
// mesh; the final fog pass still masks its unknown fragments.
export function exploredInBox(levels, level, x0, z0, x1, z1) {
 const rows=levels?.[level];if(!rows)return false;
 const a=Math.floor(x0/FOG_CELL),b=Math.floor(x1/FOG_CELL);
 for(let z=Math.floor(z0/FOG_CELL),end=Math.floor(z1/FOG_CELL);z<=end;z++)if(rows[z]?.some(([lo,hi])=>lo<=b&&hi>=a))return true;
 return false;
}
