// Compact explored floor plans. Coordinates are 1.25-ft cells; rows contain
// sorted inclusive x runs. Only exploration is stored, never current visibility.
export const FOG_CELL = 1.25;
// Other people's cursors, pings and rulers draw over vision fog (Harry 2026-10-15), dimmed where the viewer cannot see
// the spot. The GM's live cursor and ruler are the exception: the GM lingers in a room they are preparing, and the
// pointer would give the ambush away. false = a player does not see the GM's cursor wherever they cannot currently see.
// A GM PING is deliberate and always shows. Flip to true to let the GM's cursor through as well.
export const GM_CURSOR_THROUGH_FOG = false;
export const emptyFog = () => ({epoch:0,viewers:{},party:{},revealed:{}});
export function levelsProblem(levels) {
  if(!levels || typeof levels!=='object' || Array.isArray(levels)) return 'levels must be an object';
  let count=0;
  for(const [level,rows] of Object.entries(levels)) {
    if(!/^-?\d+(\.\d+)?$/.test(level) || !Number.isFinite(+level) || Math.abs(+level)>1000 || !rows || typeof rows!=='object' || Array.isArray(rows)) return 'invalid fog level';
    for(const [z,runs] of Object.entries(rows)) {
      if(!/^-?\d+$/.test(z) || Math.abs(+z)>80000 || !Array.isArray(runs)) return 'invalid fog row';
      for(const r of runs) if(!Array.isArray(r)||r.length!==2||!r.every(x=>Number.isInteger(x)&&Math.abs(x)<=80000)||r[0]>r[1]||++count>16000) return 'invalid fog run';
    }
  }
  return null;
}
export function unionRuns(a=[],b=[]) {
  const out=[];
  for(const r of [...a,...b].sort((a,b)=>a[0]-b[0]||a[1]-b[1])) { const last=out.at(-1); if(last&&r[0]<=last[1]+1)last[1]=Math.max(last[1],r[1]);else out.push([...r]); }
  return out;
}
export function unionLevels(a={},b={}) {
  const out={...a};
  for(const [level,rows] of Object.entries(b)) { const dest=out[level]={...a[level]};for(const [z,runs] of Object.entries(rows))dest[z]=unionRuns(dest[z],runs); }
  return out;
}
export function mergeFog(a=emptyFog(),b=emptyFog()) {
  const viewers={...a.viewers};for(const [id,levels] of Object.entries(b.viewers||{}))viewers[id]=unionLevels(viewers[id],levels);
  return {epoch:a.epoch||0,viewers,party:unionLevels(a.party,b.party),revealed:unionLevels(a.revealed,b.revealed)};
}
export function exploreFog(fog,viewer,levels,epoch) {
  fog ||= emptyFog();if(epoch!==fog.epoch)return fog;
  return {...fog,viewers:{...fog.viewers,[viewer]:unionLevels(fog.viewers?.[viewer],levels)},party:unionLevels(fog.party,levels)};
}
export function fogFor(fog,viewer,shared=false,gm=false) {
  fog ||= emptyFog();if(gm)return fog;
  return {epoch:fog.epoch,viewers:viewer&&fog.viewers?.[viewer]?{[viewer]:fog.viewers[viewer]}:{},party:shared?(fog.party||{}):{},revealed:fog.revealed||{}};
}
export function hasFogCell(levels,x,z,level=0) {
  const gx=Math.floor(x/FOG_CELL),gz=Math.floor(z/FOG_CELL);
  return !!levels?.[level]?.[gz]?.some(([a,b])=>gx>=a&&gx<=b);
}
export const exploredFor=(fog,viewer,shared=false)=>unionLevels(shared?fog?.party:fog?.viewers?.[viewer],fog?.revealed);
