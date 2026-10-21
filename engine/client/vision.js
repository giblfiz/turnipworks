// Floor-plan sight. Pure client data: no DOM, three.js or relay filtering.
import { baseUnder, roomTop } from '../core/height.js';

export const visionRadius = pawn => Number.isFinite(pawn.visionRadius) ? Math.max(0, pawn.visionRadius) : Infinity;
export function viewingPawns(entities, { viewer, seats = [], shared = false, party = false, isOpen = null } = {}) {
  const roster = Array.isArray(seats) ? seats : Object.values(seats);
  const principal = id => { const s = roster.find(s => s.id === id); return s?.kind === 'llm' ? s.creator : id; };
  const players = new Set(roster.filter(s => s.role === 'player' && !s.revoked).map(s => principal(s.id)));
  const who = principal(viewer);
  return Object.values(entities).filter(e => e.kind === 'token' && !e.hidden && e.owner &&
    ((shared || party) ? players.has(principal(e.owner)) : principal(e.owner) === who))
    .map(pawn => ({ pawn, level: baseUnder(entities, pawn.x, pawn.z, pawn.y || 0, isOpen).y, radius: visionRadius(pawn) }));
}

// Segment = [x0,z0,x1,z1]. Merge contiguous grid walls before casting: a 100-ft
// uninterrupted wall has two endpoints, not forty redundant ray directions.
export function mergeSegments(segments) {
  const lines = new Map(), other = [];
  for (const s of segments) {
    const vertical = s[0] === s[2], horizontal = s[1] === s[3];
    if (!vertical && !horizontal) { other.push(s); continue; }
    const constant = vertical ? s[0] : s[1], key = `${vertical ? 'v' : 'h'}:${constant}`;
    if (!lines.has(key)) lines.set(key, { vertical, constant, spans: [] });
    const a = vertical ? s[1] : s[0], b = vertical ? s[3] : s[2];
    lines.get(key).spans.push([Math.min(a,b), Math.max(a,b)]);
  }
  for (const {vertical,constant,spans} of lines.values()) {
    spans.sort((a,b) => a[0]-b[0]); let run = null;
    const emit = () => { if (run) other.push(vertical ? [constant,run[0],constant,run[1]] : [run[0],constant,run[1],constant]); };
    for (const s of spans) { if (run && s[0] <= run[1] + 1e-8) run[1] = Math.max(run[1],s[1]); else { emit(); run = [...s]; } } emit();
  }
  return other;
}

export function blockingSegments(edges, entities = {}, level = 0) {
  const values = edges instanceof Map ? [...edges.values()] : Array.isArray(edges) ? edges : Object.values(edges || {});
  const byKey = new Map(values.map(e => [e.key,e])), overrides = new Map(Object.values(entities).filter(e => e.kind === 'edge').map(e => [e.key,e]));
  const out = [];
  for (const e of values) {
    const stacked = (e.y || 0) !== level;
    if (stacked && !(e.sides || []).some(s => { const r = entities[s.room]; return r?.kind === 'room' && (r.recipe.y || 0) < level && roomTop(entities,r) > level; })) continue;
    const key = stacked ? e.key.replace(/@-?\d+$/, '') + (level ? `@${level}` : '') : e.key;
    if (stacked && byKey.has(key)) continue; // the real upper room owns this shared wall
    const parent = !stacked && e.spanOf && byKey.get(e.spanOf), o = overrides.get(parent?.key || key), local = overrides.get(key);
    const kind = stacked || local?.as === 'wall' || o?.as === 'wall' ? 'wall' : parent?.kind || e.kind;
    if (local?.as === 'open' || o?.as === 'open' || (!stacked && (e.open || parent?.open)) || ['window','open','gap'].includes(kind)) continue;
    if (!['wall','door','door-span'].includes(kind)) continue;
    const x = e.gx * 5, z = e.gz * 5;
    out.push(e.dir === 'h' ? [x,z,x+5,z] : [x,z,x,z+5]);
  }
  // Materialised walls and doors are ordinary objects. Their replacement edge is
  // open; block at their current position, with the same rotation as the mesh.
  for (const e of Object.values(entities)) {
    if (e.kind !== 'object' || e.hidden || (e.y || 0) !== level || e.open) continue;
    const cat = e.cat || '';
    const door = /(^door-|(^|-)gate(-|$)|portcullis)/.test(cat);
    const wall = /^wall-straight/.test(cat) || (e.fromEdge && e.layer === 'walls' && !/window|doorway/.test(cat));
    if ((!door && !wall) || /-open$/.test(cat)) continue;
    const half = (e.dims?.[0] || 5)/2, a = e.rot || 0, dx = Math.cos(a)*half, dz = -Math.sin(a)*half;
    out.push([e.x-dx,e.z-dz,e.x+dx,e.z+dz]);
  }
  return mergeSegments(out);
}

const cross = (ax,az,bx,bz) => ax*bz-az*bx;
export function visibilityPolygon(origin, segments, { bounds = [-2048,-2048,2048,2048], radius = Infinity, simplify = true } = {}) {
  if (radius <= 0) return [];
  const [ox,oz] = origin, [x0,z0,x1,z1] = bounds;
  const all = [...segments,[x0,z0,x1,z0],[x1,z0,x1,z1],[x1,z1,x0,z1],[x0,z1,x0,z0]];
  const angles = [];
  for (const s of all) for (let i=0;i<4;i+=2) { const a=Math.atan2(s[i+1]-oz,s[i]-ox); angles.push(a-1e-7,a,a+1e-7); }
  if (Number.isFinite(radius)) for (let i=0;i<128;i++) angles.push(i*Math.PI/64-Math.PI);
  angles.sort((a,b)=>a-b);
  const points=[];
  for (const a of angles) {
    const dx=Math.cos(a), dz=Math.sin(a); let near=radius;
    for (const s of all) {
      const sx=s[2]-s[0], sz=s[3]-s[1], den=cross(dx,dz,sx,sz);
      if (Math.abs(den)<1e-12) continue;
      const px=s[0]-ox,pz=s[1]-oz,t=cross(px,pz,sx,sz)/den,u=cross(px,pz,dx,dz)/den;
      if(t>=-1e-8 && u>=-1e-8 && u<=1+1e-8 && t<near) near=Math.max(0,t);
    }
    if (Number.isFinite(near)) points.push([ox+dx*near,oz+dz*near]);
  }
  return simplify ? simplifyPolygon(points) : points;
}

// Endpoint rays often hit the same wall hundreds of times. Keep only its ends
// before the scanline raster. A point is removable only if it lies BETWEEN its
// neighbours on their segment: shadow-edge reversals and corner epsilon rays
// must survive. The 1e-9-ft tolerance absorbs floating arithmetic, not features.
export function simplifyPolygon(points, tolerance = 1e-9) {
  if (points.length < 4) return points;
  const same = (a,b) => Math.abs(a[0]-b[0]) <= tolerance && Math.abs(a[1]-b[1]) <= tolerance;
  const between = (a,b,c) => {
    const ax=b[0]-a[0], az=b[1]-a[1], bx=c[0]-b[0], bz=c[1]-b[1];
    if (ax*bx+az*bz < 0) return false;
    const dx=c[0]-a[0], dz=c[1]-a[1], area=ax*dz-az*dx;
    return area*area <= tolerance*tolerance*(dx*dx+dz*dz);
  };
  const out=[];
  for(const p of points) {
    if(out.length && same(out.at(-1),p)) continue;
    while(out.length>1 && between(out.at(-2),out.at(-1),p))out.pop();
    out.push(p);
  }
  if(out.length>1 && same(out[0],out.at(-1)))out.pop();
  // Close the ring without repeatedly shifting the array.
  let start=0;
  while(out.length-start>3) {
    if(between(out.at(-2),out.at(-1),out[start]))out.pop();
    else if(between(out.at(-1),out[start],out[start+1]))start++;
    else break;
  }
  return start ? out.slice(start) : out;
}

export function pointInPolygon(x,z,points, tolerance = 1e-6) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const [ax,az]=points[j],[bx,bz]=points[i], dx=bx-ax,dz=bz-az, len=dx*dx+dz*dz;
    if(len>0) { const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/len)); if(Math.hypot(x-ax-t*dx,z-az-t*dz)<=tolerance) return true; }
    if((az>z)!==(bz>z) && x<(bx-ax)*(z-az)/(bz-az)+ax) inside=!inside;
  }
  return inside;
}
export const visibleAt = (vision, x, z, level=0) => (vision.get(level)||[]).some(p => pointInPolygon(x,z,p.points));
export function computeVision({ entities, edges, ...options }) {
  const out=new Map(), walls=new Map();
  for(const {pawn,level,radius} of viewingPawns(entities,options)) {
    if(!walls.has(level)) walls.set(level,blockingSegments(edges,entities,level));
    const points=visibilityPolygon([pawn.x,pawn.z],walls.get(level),{bounds:options.bounds,radius,simplify:options.simplify});
    if(!out.has(level)) out.set(level,[]);
    out.get(level).push({pawn:pawn.id,points});
  }
  return out;
}
