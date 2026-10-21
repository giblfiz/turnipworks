import test from 'node:test';
import assert from 'node:assert/strict';
import {visibilityPolygon,pointInPolygon,blockingSegments,viewingPawns,computeVision,visibleAt} from '../client/vision.js';
const bounds=[-50,-50,100,100];
const box=(x,z,w,d)=>[[x,z,x+w,z],[x+w,z,x+w,z+d],[x+w,z+d,x,z+d],[x,z+d,x,z]];
const sees=(p,x,z)=>pointInPolygon(x,z,p);
test('corridor sees wall face and interior, never beyond wall',()=>{
 const p=visibilityPolygon([5,2],box(0,0,50,5),{bounds});
 assert.ok(sees(p,48,2)); assert.ok(sees(p,50,2)); assert.ok(!sees(p,51,2)); assert.ok(!sees(p,5,6));
});
test('L-shaped room hides the far side of its inside corner',()=>{
 const p=visibilityPolygon([3,3],[[0,0,20,0],[20,0,20,5],[20,5,5,5],[5,5,5,20],[5,20,0,20],[0,20,0,0]],{bounds});
 assert.ok(sees(p,18,3)); assert.ok(sees(p,3,18)); assert.ok(!sees(p,8,8));
 const q=visibilityPolygon([18,3],[[0,0,20,0],[20,0,20,5],[20,5,5,5],[5,5,5,20],[5,20,0,20],[0,20,0,0]],{bounds});
 assert.ok(!sees(q,3,18));
});
test('closed door blocks; opening and window pass; wide door follows parent override',()=>{
 const e={key:'v:2:0',dir:'v',gx:2,gz:0,kind:'door',spanKeys:['v:2:0','v:2:1']};
 let edges=new Map([[e.key,e],['v:2:1',{key:'v:2:1',dir:'v',gx:2,gz:1,kind:'door-span',spanOf:e.key}]]);
 assert.equal(blockingSegments(edges).length,1);
 assert.equal(blockingSegments(edges,{ov:{kind:'edge',key:e.key,as:'open'}}).length,0);
 edges=new Map([[e.key,{...e,kind:'window'}]]); assert.equal(blockingSegments(edges).length,0);
 assert.equal(blockingSegments(edges,{ov:{kind:'edge',key:e.key,as:'wall'}}).length,1);
});
const seats=[{id:'a',role:'player'},{id:'b',role:'player'},{id:'gm',role:'gm'}];
const pawn=(id,owner,x=2,z=2,y=0)=>({id,kind:'token',owner,x,z,y});
test('own pawn, controlled familiar, shared party and borrowed pawn',()=>{
 const entities={a:pawn('a','a'),f:pawn('f','a',3,3),b:pawn('b','b'),g:pawn('g',null),loan:{...pawn('loan','b'),lender:'a'}};
 assert.deepEqual(viewingPawns(entities,{viewer:'a',seats}).map(p=>p.pawn.id),['a','f']);
 assert.equal(viewingPawns(entities,{viewer:'a',seats,shared:true}).length,4);
});
test('two levels never leak sight; flying pawn uses base floor',()=>{
 const entities={r:{id:'r',kind:'room',recipe:{x:0,z:0,w:4,d:4,y:10}},a:pawn('a','a',2,2,14),b:pawn('b','b',2,2,0)};
 const v=computeVision({entities,edges:[],viewer:'a',seats,bounds});
 assert.ok(visibleAt(v,3,3,10)); assert.ok(!visibleAt(v,3,3,0));
});
test('per-pawn radius is finite only when specified',()=>{
 const v=computeVision({entities:{a:{...pawn('a','a'),visionRadius:5}},edges:[],viewer:'a',seats,bounds});
 assert.ok(visibleAt(v,6,2)); assert.ok(!visibleAt(v,8,2));
});
test('materialized closed doors block at their actual position, open ones do not',()=>{
 const door={kind:'object',cat:'door-plank',x:4,z:3,dims:[5,8,1]};
 assert.equal(blockingSegments([], {door}).length,1);
 assert.equal(blockingSegments([], {door:{...door,open:true}}).length,0);
});



test('upper span of a tall room blocks above its ground windows',()=>{
 const room={id:'r',kind:'room',recipe:{x:0,z:0,w:4,d:4,tall:2}};
 const edge={key:'v:0:0',dir:'v',gx:0,gz:0,kind:'window',sides:[{room:'r'}]};
 assert.equal(blockingSegments([edge],{r:room},0).length,0);
 assert.equal(blockingSegments([edge],{r:room},10).length,1);
});
// The actual tuner's wall engine and repository room catalog, not hand-made
// segments: this catches mismatches in door-span keys and wall overrides.
import {makeRoomGen} from '../core/roomgen.js';
import * as walls from '../../tools/spawn-tuner/js/walls.js';
import * as solver from '../../tools/spawn-tuner/js/solver.js';
import * as solver2 from '../../tools/spawn-tuner/js/solver2.js';
import {readFileSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync(new URL('../tuner-data/'+name,import.meta.url)));
const roomgen=makeRoomGen({walls,solver,solver2,lib:read('library.json'),types:read('types.json'),orient:{},version:'vision-test'});
const fixture=n=>Object.fromEntries(Array.from({length:n},(_,i)=>{const id='r'+i;return [id,{id,kind:'room',order:i,recipe:{type:'bedroom',x:(i%10)*4,z:Math.floor(i/10)*4,w:4,d:4,seed:i+1,wallSeed:i*7+1}}]}));
test('real roomgen edges honor a generated door being opened or replaced',()=>{
 const entities=fixture(2),edges=roomgen.edges(entities).edges;
 const door=[...edges.values()].find(e=>e.kind==='door');assert.ok(door);
 const x=door.gx*5+(door.dir==='h'?2.5:0),z=door.gz*5+(door.dir==='v'?2.5:0);
 const origin=door.dir==='h'?[x,z-1]:[x-1,z],target=door.dir==='h'?[x,z+1]:[x+1,z];
 const p=visibilityPolygon(origin,blockingSegments(edges,entities),{bounds});assert.ok(!sees(p,...target));
 const open={...entities,ov:{id:'ov',kind:'edge',key:door.key,as:'open'}};
 assert.ok(sees(visibilityPolygon(origin,blockingSegments(edges,open),{bounds}),...target));
});
if(process.env.VISION_BENCH) test('50-room measurement (CPU; no GPU claim)',t=>{
 const entities=fixture(50); let edges;
 const times=fn=>{const out=[];for(let i=0;i<120;i++){const start=performance.now();fn(i);if(i>=20)out.push(performance.now()-start);}out.sort((a,b)=>a-b);return {medianMs:out[50],p95Ms:out[95]};};
 const generation=times(()=>{edges=roomgen.edges(entities).edges;});
 const open={...entities};for(const e of edges.values())if(e.kind==='door')open['o'+e.key]={kind:'edge',key:e.key,as:'open'};
 for(const [name,ents] of [['closed',entities],['open',open]]){
  const seg=blockingSegments(edges,ents),one=times(i=>visibilityPolygon([7.5+(i%3)*5,7.5],seg,{bounds:[-50,-50,250,150]}));
  const withPawns={...ents};for(let i=0;i<4;i++)withPawns['p'+i]=pawn('p'+i,'a',7.5+i*20,7.5);
  const four=times(()=>computeVision({entities:withPawns,edges,viewer:'a',seats,bounds:[-50,-50,250,150]}));
  t.diagnostic(JSON.stringify({state:name,rooms:50,edges:edges.size,merged:seg.length,edgeGeneration:generation,onePawn:one,fourPawnsIncludingSegments:four}));
 }
});
test('opening a tall room ground door never opens its upper solid wall',()=>{
 const room={id:'r',kind:'room',recipe:{x:0,z:0,w:4,d:4,tall:2}};
 const edge={key:'v:0:0',dir:'v',gx:0,gz:0,kind:'door',sides:[{room:'r'}]};
 const entities={r:room,op:{kind:'edge',key:edge.key,as:'open'}};
 assert.equal(blockingSegments([edge],entities,0).length,0);assert.equal(blockingSegments([edge],entities,10).length,1);
 entities.upper={kind:'edge',key:'v:0:0@10',as:'open'};assert.equal(blockingSegments([edge],entities,10).length,0);
 delete entities.upper;
 const upper={...edge,key:'v:0:0@10',y:10,kind:'window'};
 assert.equal(blockingSegments([edge,upper],entities,10).length,0);
});
test('collinear simplification preserves corners, narrow sight rays and visible area',()=>{
 const segments=[[0,0,20,0],[20,0,20,5],[20,5,5,5],[5,5,5,20],[5,20,0,20],[0,20,0,0],[10,0,10,2.4999],[10,2.5001,10,5]];
 const opts={bounds:[-5,-5,25,25]},origin=[3,2.5];
 const raw=visibilityPolygon(origin,segments,{...opts,simplify:false}),simple=visibilityPolygon(origin,segments,opts);
 assert.ok(simple.length<raw.length/2);
 const area=p=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-a[1]*b[0];},0))/2;
 assert.ok(Math.abs(area(raw)-area(simple))<1e-7);
 for(let z=.125;z<20;z+=.25)for(let x=.125;x<20;x+=.25)assert.equal(pointInPolygon(x,z,simple),pointInPolygon(x,z,raw));
 for(const z of [2.499,2.49999,2.5,2.50001,2.501])assert.equal(pointInPolygon(15,z,simple),pointInPolygon(15,z,raw));
 assert.ok(pointInPolygon(15,2.5,simple));assert.ok(!pointInPolygon(15,2.501,simple));
});
