// Scanline raster of sight polygons. Rows are inclusive runs of 1.25-ft cells.
import { FOG_CELL } from '../core/fog.js';
export function rasterVision(vision, bounds, cell = FOG_CELL) {
  const out = {};
  for (const [level, polygons] of vision) {
    const rows = {};
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
export function maskLevels(current, explored, bounds, levels, vision = null, fineRaster = null) {
 const step=Math.max(vision ? .3125 : FOG_CELL,(bounds[2]-bounds[0])/1024,(bounds[3]-bounds[1])/1024);
 const width=Math.ceil((bounds[2]-bounds[0])/step),height=Math.ceil((bounds[3]-bounds[1])/step);
 const actual=[bounds[0],bounds[1],bounds[0]+width*step,bounds[1]+height*step];
 const fine = vision ? (fineRaster ? fineRaster(actual, step) : rasterVision(vision, actual, step)) : null;
 return levels.map(floorY=>{
  const data=new Uint8Array(width*height*4),pixels=new Uint32Array(data.buffer);
  for(const [source,channel,cell]of [[explored,1,FOG_CELL],[fine||current,0,fine?step:FOG_CELL]])for(const [zs,runs]of Object.entries(source?.[floorY]||{})) {
   const y0=Math.max(0,Math.ceil((+zs*cell-bounds[1])/step-.5)),y1=Math.min(height-1,Math.floor(((+zs+1)*cell-bounds[1])/step-.5));
   for(const [a,b]of runs){const start=Math.max(0,Math.ceil((a*cell-bounds[0])/step-.5)),end=Math.min(width-1,Math.floor(((b+1)*cell-bounds[0])/step-.5));
    for(let y=y0;y<=y1;y++)if(start<=end)pixels.fill(channel===1?0x0000ff00:0x0000ffff,y*width+start,y*width+end+1);
   }
  }
  return {floorY,bounds:actual,width,height,data};
 });
}

// Conservative geometry culling: a corner in memory is enough to draw the whole
// mesh; the final fog pass still masks its unknown fragments.
export function exploredInBox(levels, level, x0, z0, x1, z1) {
 const rows=levels?.[level];if(!rows)return false;
 const a=Math.floor(x0/FOG_CELL),b=Math.floor(x1/FOG_CELL);
 for(let z=Math.floor(z0/FOG_CELL),end=Math.floor(z1/FOG_CELL);z<=end;z++)if(rows[z]?.some(([lo,hi])=>lo<=b&&hi>=a))return true;
 return false;
}
