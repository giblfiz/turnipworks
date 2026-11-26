// Floor-plan sight. Pure client data: no DOM, three.js or relay filtering.
import { baseUnder, sightLevel, roomTop, sightGround, isTerrain, levelY } from '../core/height.js';
import { holeShapeOf, holeFloor } from '../core/holes.js';
import { stairWalk } from '../core/stairs.js';
import { contains, overlap as overlapRooms } from '../core/footprint.js';
import { caveBlockers, isCaveRockEdge } from '../core/caves.js';
import { underSky, extKey, holeKey, feetKey, bandIn } from '../core/exterior.js';

export const visionRadius = pawn => Number.isFinite(pawn.visionRadius) ? Math.max(0, pawn.visionRadius) : Infinity;
export function viewingPawns(entities, { viewer, seats = [], shared = false, party = false, isOpen = null } = {}) {
  const roster = Array.isArray(seats) ? seats : Object.values(seats);
  const principal = id => { const s = roster.find(s => s.id === id); return s?.kind === 'llm' ? s.creator : id; };
  const players = new Set(roster.filter(s => s.role === 'player' && !s.revoked).map(s => principal(s.id)));
  const who = principal(viewer);
  return Object.values(entities).filter(e => e.kind === 'token' && !e.hidden && e.owner &&
    ((shared || party) ? players.has(principal(e.owner)) : principal(e.owner) === who))
    .map(pawn => ({ pawn, level: sightLevel(entities, pawn.x, pawn.z, pawn.y || 0, isOpen), radius: visionRadius(pawn) })); // (a pawn on a hill sees from the ground's level: core/height.js sightLevel)
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

// BARS (Harry 2026-10-27: "bars / grates as a kind of 'wall' ... and like cage doors"): iron bars, a barred cage door and
// a portcullis are seen through, shut or open, so they never stop sight, light or fog of war here. They stop a thrown die
// (client/diceworld.js: a shut barred door is a box there). A pawn's own move is not blocked by anything in the engine.
// GLASS AND CHAIN-LINK (2026-11-07, the cyberpunk pack; wave 1's open note "vision.js has no rule for them"): shop glass
// (wall-storefront, a special wall PANEL: tuner walls.js PANELS, edge.panel), an office tower's glass wall
// (wall-glass-curtain, the same), the glass shop door, and a chain-link fence section or gate are seen through like bars:
// sight, light and fog of war pass them. Feet do not: `walk` counts them as walls (shut, for the door and the gate).
export const SEE_THROUGH = /^(cell-bars|door-cell-bars|portcullis|wall-storefront|wall-glass-curtain|door-shopfront|fence-chain-link|gate-chain-link)(-|$)/;
export const seeThrough = (cat) => SEE_THROUGH.test(cat || '');
// a generated wall edge whose panel is glass (edge.panel; an override may restate it)
export const seeThroughPanel = (e, o) => !!(e && e.kind === 'wall' && seeThrough(o?.panel || e.panel));
// what stops a BODY (a die, a step in first person): the same edges with their glass panels made plain wall again
// and a shut glass door its plain leaf (bars and chain-link keep theirs: a die may pass through bars, not through glass)
export const GLASS = /^(wall-storefront|wall-glass-curtain|door-shopfront)(-|$)/;
export const solidEdges = (edges) => (edges instanceof Map ? [...edges.values()] : Array.isArray(edges) ? edges : Object.values(edges || {}))
  .map(e => seeThroughPanel(e) ? { ...e, panel: null } : e?.kind === 'door' && !e.open && GLASS.test(e.doorType || '') ? { ...e, doorType: null } : e);
// WALKING (the movement rings, core/walk.js; 2026-11-02): `walk` asks for what stops FEET rather than sight. A window is a
// wall, bars and a shut barred door stop a walker, and a door hidden from the players still stands for the GM side that
// has it (a player's page never receives one). Open doors, opened-up edges and gaps let a walker through, as they do sight.
// UNDER YOUR FEET (2026-11-25; Harry, on a hole in the Dragon Temple's floor: "it's acting like a pillar (you can't see past it
// onto the same level)"). `above`: the height (ft) a viewer's feet are at. One sight level can hold rooms at two heights
// (levelY: a hall on a 10-ft hill and a passage dug into the hill under it both see at 0), so without it the passage's
// walls, 10 ft under the hall's floor, stood in the hall as a box round the hole over it. With it, a wall whose top is at
// or below the viewer's feet blocks nothing for that viewer.
export function blockingSegments(edges, entities = {}, level = 0, { walk = false, above = null } = {}) {
  const values = edges instanceof Map ? [...edges.values()] : Array.isArray(edges) ? edges : Object.values(edges || {});
  const byKey = new Map(values.map(e => [e.key,e])), overrides = new Map(Object.values(entities).filter(e => e.kind === 'edge').map(e => [e.key,e]));
  const out = [];
  // (above) UNDER FOOT: a spot covered, at the viewer's height, by a hill's earth or a floor (a wall of a ground building
  // beside the hill is not: from a hilltop it still hides the inside of that building)
  const floors = above == null ? [] : Object.values(entities).filter(r => r?.kind === 'room' && r.recipe && (isTerrain(r.recipe) ? (r.recipe.y || 0) >= above - 0.5 : Math.abs((r.recipe.y || 0) - above) <= 0.5));
  const underFoot = (x, z) => floors.some(r => contains(r.recipe, x, z));
  // (2026-10-24) `level` is a sight level (core/height.js levelY): the walls of a room that meets the ground (on the open
  // ground, on a hill) stand at level 0, the outdoor surface, and block a pawn on the hilltop; an upper room's at its height
  const gOf = new Map(), ground = (rid) => { if (!gOf.has(rid)) { const r = rid && entities[rid]; gOf.set(rid, r?.kind === 'room' ? sightGround(entities, r) : 0); } return gOf.get(rid); };
  for (const e of values) {
    if (isCaveRockEdge(entities, e) && !overrides.has(e.key)) continue; // (a cave's outside wall: its lip blocks instead, below)
    if (above != null) { const r = entities[e.owner?.room ?? e.sides?.[0]?.room]; if ((r?.kind === 'room' && r.recipe ? roomTop(entities, r) : (e.y || 0) + 10) <= above + 0.5 && underFoot(e.gx * 5 + (e.dir === 'h' ? 2.5 : 0), e.gz * 5 + (e.dir === 'h' ? 0 : 2.5))) continue; }
    const Y = level + ground(e.owner?.room ?? e.sides?.[0]?.room), stacked = (e.y || 0) !== Y;
    if (stacked && !(e.sides || []).some(s => { const r = entities[s.room]; return r?.kind === 'room' && (r.recipe.y || 0) < Y && roomTop(entities,r) > Y; })) continue;
    const key = stacked ? e.key.replace(/@-?\d+$/, '') + (Y ? `@${Y}` : '') : e.key;
    if (stacked && byKey.has(key)) continue; // the real upper room owns this shared wall
    const parent = !stacked && e.spanOf && byKey.get(e.spanOf), o = overrides.get(parent?.key || key), local = overrides.get(key);
    const kind = stacked || local?.as === 'wall' || o?.as === 'wall' ? 'wall' : parent?.kind || e.kind;
    if (local?.as === 'open' || o?.as === 'open' || (!stacked && (e.open || parent?.open)) || (walk ? ['open','gap'] : ['window','open','gap']).includes(kind)) continue;
    if (!['wall','door','door-span',...(walk ? ['window'] : [])].includes(kind)) continue;
    if (!walk && kind !== 'wall' && seeThrough(local?.doorType || o?.doorType || parent?.doorType || e.doorType)) continue; // a generated door swapped for the barred one
    if (!walk && !stacked && kind === 'wall' && !(local?.as === 'wall' || o?.as === 'wall') && seeThroughPanel(e, local)) continue; // shop glass, a glass curtain wall: seen through (feet: a wall)
    const x = e.gx * 5, z = e.gz * 5;
    out.push(e.dir === 'h' ? [x,z,x+5,z] : [x,z,x,z+5]);
  }
  // Materialised walls and doors are ordinary objects. Their replacement edge is
  // open; block at their current position, with the same rotation as the mesh.
  for (const e of Object.values(entities)) {
    if (e.kind !== 'object' || (e.hidden && !walk) || (e.y || 0) - ground(e.room) !== level || e.open) continue;
    if (above != null && (e.y || 0) + (e.dims?.[1] || 9) <= above + 0.5 && underFoot(e.x, e.z)) continue;
    const cat = e.cat || '';
    const door = /(^door-|(^|-)gate(-|$)|portcullis)/.test(cat);
    // (2026-11-07) a see-through barrier that is not a door (bars, glass, a chain-link section: laid by a room's program or
    // by hand, on the wall line or not) is a wall for FEET; before, only one standing in for a generated wall stopped a walker
    const wall = /^wall-straight/.test(cat) || (walk && !door && seeThrough(cat)) || (e.fromEdge && e.layer === 'walls' && !(walk ? /doorway/ : /window|doorway/).test(cat));
    if ((!door && !wall) || /-open$/.test(cat) || (!walk && seeThrough(cat))) continue; // (bars: seen through, above)
    const half = (e.dims?.[0] || 5)/2, a = e.rot || 0, dx = Math.cos(a)*half, dz = -Math.sin(a)*half;
    out.push([e.x-dx,e.z-dz,e.x+dx,e.z+dz]);
  }
  // a CAVE (2026-10-25, core/caves.js): its lip (the rock band's outer edge) and its PILLARS, derived from its squares and seed
  for (const s of caveBlockers(entities, level)) out.push(s);
  return mergeSegments(out);
}

// THE EXTERIOR AT A HEIGHT (2026-11-24, core/exterior.js): what stands at PHYSICAL height `band` (feet: a room's own heights,
// not its sight level) blocks a pawn looking up from under the sky. Everything that is a wall at that height blocks,
// shut or open: a door, a window, a door span, bars and glass (an upper room's inside stays its own until a pawn is in
// it). Only no wall at all lets the view through: an `open` or `gap` edge, or a wall the GM opened up (`as: 'open'`).
export function exteriorSegments(edges, entities = {}, band = 0) {
  const values = edges instanceof Map ? [...edges.values()] : Array.isArray(edges) ? edges : Object.values(edges || {});
  const byKey = new Map(values.map(e => [e.key,e])), overrides = new Map(Object.values(entities).filter(e => e.kind === 'edge').map(e => [e.key,e]));
  const out = [], Y = band;
  for (const e of values) {
    const stacked = (e.y || 0) !== Y;
    if (stacked && !(e.sides || []).some(s => { const r = entities[s.room]; return r?.kind === 'room' && (r.recipe.y || 0) < Y && roomTop(entities,r) > Y; })) continue;
    const key = stacked ? e.key.replace(/@-?\d+$/, '') + (Y ? `@${Y}` : '') : e.key;
    if (stacked && byKey.has(key)) continue;
    const parent = !stacked && e.spanOf && byKey.get(e.spanOf), o = overrides.get(parent?.key || key), local = overrides.get(key);
    if (local?.as === 'open' || o?.as === 'open') continue;
    const kind = stacked || local?.as === 'wall' || o?.as === 'wall' ? 'wall' : parent?.kind || e.kind;
    if (!['wall','door','door-span','window'].includes(kind)) continue;
    const x = e.gx * 5, z = e.gz * 5;
    out.push(e.dir === 'h' ? [x,z,x+5,z] : [x,z,x,z+5]);
  }
  for (const e of Object.values(entities)) {
    if (e.kind !== 'object' || (e.y || 0) !== Y) continue;
    const cat = e.cat || '';
    if (!(/(^door-|(^|-)gate(-|$)|portcullis)/.test(cat) || /^wall-straight/.test(cat) || seeThrough(cat) || (e.fromEdge && e.layer === 'walls' && !/doorway/.test(cat)))) continue;
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
// (an entry's `within` and `minus` hold here as in the raster: fog-grid.js rasterVision)
export const visibleAt = (vision, x, z, level=0) => (vision.get(level)||[]).some(p => pointInPolygon(x,z,p.points) && (!p.within || p.within.every(w => pointInPolygon(x,z,w))) && !p.minus?.some(r => contains(r.recipe,x,z)));
// the `above` cut for a viewer whose feet are at `base` on sight level `level`: only when its feet are above that level's own
// floor (a hilltop: base 10 on level 0), so every other viewer's walls are exactly as before
export const feetCut=(base,level)=>base>level+0.5?base:null;
// STACKED ON ONE LEVEL (2026-11-25): two rooms of the same sight level at different heights over the same ground (a hall on a
// hill, a passage dug into the hill under it: both see at 0). Where they overlap a level-0 cell would mean both; so no pawn's
// level sight is kept there (`minus`), and each pawn's is kept again at the height of its feet (core/exterior.js FEET).
// -> [{ id, recipe: { x, z, w, d } }] the overlaps (by bounding rectangle), cached per entity map and level
const STACKED=new WeakMap();
export function stackedOverlaps(entities,level){
  let m=STACKED.get(entities);if(!m)STACKED.set(entities,m=new Map());if(m.has(level))return m.get(level);
  const rooms=Object.values(entities).filter(r=>r?.kind==='room'&&r.recipe&&!isTerrain(r.recipe)&&levelY(entities,r)===level),out=[];
  for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){const a=rooms[i],b=rooms[j],A=a.recipe,B=b.recipe;
    if(!((A.y||0)>=roomTop(entities,b)-0.5||(B.y||0)>=roomTop(entities,a)-0.5)||!overlapRooms(A,B))continue; // (only rooms one over the other)
    const x=Math.max(A.x,B.x),z=Math.max(A.z,B.z),x1=Math.min(A.x+A.w,B.x+B.w),z1=Math.min(A.z+A.d,B.z+B.d);
    if(x1>x&&z1>z)out.push({id:`ovl:${a.id}:${b.id}`,recipe:{x,z,w:x1-x,d:z1-z}});}
  m.set(level,out);return out;
}
// THE OPENINGS a pawn can look down through: holes, through pits, and a stairwell's cut in the floor above a flight, each
// { id, x, z (its middle), points (its plan), floor (the height of the floor it is cut in), low (the floor under it), drop, level (that floor's sight level) }
export const EYE=5;
export function openingShapes(entities,objects){
  const out=[],rooms=Object.values(entities).filter(r=>r?.kind==='room'&&r.recipe&&!isTerrain(r.recipe));
  const push=(id,points,floor)=>{const x=points.reduce((a,p)=>a+p[0],0)/points.length,z=points.reduce((a,p)=>a+p[1],0)/points.length;
    // the floor right under it: the highest room floor below it there (its own opening, if it has one, is looked through
    // only from its own floor: one opening at a time), else the ground under a hole in an upper floor
    let low=null,under=null;for(const r of rooms){const y=r.recipe.y||0;if(y<floor-0.5&&roomTop(entities,r)<=floor+0.5&&(low==null||y>low)&&contains(r.recipe,x,z)){low=y;under=r;}}
    if(low==null)low=floor>0.5?0:null;if(low==null||floor-low<1)return;
    out.push({id,x,z,points,floor,low,drop:floor-low,level:under?levelY(entities,under):0});};
  for(const o of objects){const S=holeShapeOf(o);
    push(o.id,S.shape==='round'?Array.from({length:24},(_,i)=>[S.x+S.r*Math.cos(i*Math.PI/12),S.z+S.r*Math.sin(i*Math.PI/12)]):[[S.x0,S.z0],[S.x1,S.z0],[S.x1,S.z1],[S.x0,S.z1]],holeFloor(o));}
  for(const [y,cells] of stairWalk(entities).holes)for(const c of cells){const [gx,gz]=c.split(':').map(Number);push(`stair:${y}:${c}`,[[gx*5,gz*5],[gx*5+5,gz*5],[gx*5+5,gz*5+5],[gx*5,gz*5+5]],y);}
  return out;
}
export function computeVision({ entities, edges, ...options }) {
  const out=new Map(), walls=new Map(), outside=new Map();
  const add=(level,entry)=>{if(!out.has(level))out.set(level,[]);out.get(level).push(entry);};
  const wallsAt=(level,feet)=>{const wk=`${level}|${feet}`;if(!walls.has(wk))walls.set(wk,blockingSegments(edges,entities,level,{above:feet}));return walls.get(wk);};
  const openings=options.openings?openingShapes(entities,options.openings):[];
  for(const {pawn,level,radius} of viewingPawns(entities,options)) {
    const base=baseUnder(entities,pawn.x,pawn.z,pawn.y||0,options.isOpen).y,feet=feetCut(base,level);
    const points=visibilityPolygon([pawn.x,pawn.z],wallsAt(level,feet),{bounds:options.bounds,radius,simplify:options.simplify});
    // ON A LEVEL WITH STACKED ROOMS (stackedOverlaps): its level's sight leaves out where they overlap, and is kept again at
    // the height of its feet (core/exterior.js FEET)
    const stacked=stackedOverlaps(entities,level);
    add(level,{pawn:pawn.id,points,...(stacked.length&&{minus:stacked})});
    if(stacked.length&&options.bands?.length)add(feetKey(bandIn(options.bands,base)),{pawn:pawn.id,points});
    // DOWN INTO A HOLE (core/exterior.js HOLE): an opening in the floor its feet are on, in its sight: the floor below seen
    // through it, from the eyes (EYE ft up) past the opening's edges: the opening's plan scaled out from the pawn by
    // (EYE + drop) / EYE, clipped to what the lower level's walls let be seen from under the opening
    // A shaft through several floors: where the cone meets another opening, on down through both (a point on a floor
    // at height y is seen if, from the eyes, it lines up inside every opening above it: each opening's plan scaled out from
    // the pawn by (eyes - y) / (eyes - its floor)); three openings deep at most
    const eyes=base+EYE;
    for(const o of openings){
      if(Math.abs(o.floor-base)>0.5||Math.hypot(o.x-pawn.x,o.z-pawn.z)>radius||!pointInPolygon(o.x,o.z,points))continue;
      const chain=[o];let at=o;
      for(let depth=0;depth<3;depth++){
        const y=at.low,within=chain.map(c=>{const k=(eyes-y)/(eyes-c.floor);return c.points.map(([x,z])=>[pawn.x+(x-pawn.x)*k,pawn.z+(z-pawn.z)*k]);});
        const lowPts=visibilityPolygon([at.x,at.z],wallsAt(at.level,feetCut(y,at.level)),{bounds:options.bounds,radius,simplify:options.simplify});
        add(holeKey(options.bands?.length?bandIn(options.bands,y):y),{pawn:pawn.id,through:o.id,points:lowPts,within});
        const next=openings.find(n=>!chain.includes(n)&&Math.abs(n.floor-y)<=0.5&&within.every(w=>pointInPolygon(n.x,n.z,w)));
        if(!next)break;chain.push(next);at=next;
      }
    }
    // EXTERIORS ABOVE (core/exterior.js): a pawn under the sky also sees, at every band from its feet up, what stands there
    if(!options.bands?.length) continue;
    if(!underSky(entities,pawn.x,pawn.z,base,options.isOpen)) continue;
    const across=band=>{if(!outside.has(band))outside.set(band,exteriorSegments(edges,entities,band));return visibilityPolygon([pawn.x,pawn.z],outside.get(band),{bounds:options.bounds,radius,simplify:options.simplify});};
    for(const band of options.bands) {
      if(band<=0||band<base-1e-6) continue;
      add(extKey(band),{pawn:pawn.id,exterior:true,points:across(band)});
    }
    // LOOKING DOWN (core/exterior.js): from above the ground, every band below its own, as far as it sees across its own band;
    // what lies under a floor or inside a roofed room is cleared from it afterwards (fog-grid clearCovered, exterior blindAt)
    const own=options.bands.reduce((a,b)=>b<=base+1e-6?b:a,-Infinity);
    if(own>0){const points=across(own);for(const band of options.bands)if(band>=0&&band<own-1e-6)add(extKey(band),{pawn:pawn.id,exterior:true,down:true,points});}
  }
  return out;
}
