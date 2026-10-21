import test from 'node:test';
import assert from 'node:assert/strict';
import {rasterVision,subtractLevels,maskLevels,nonempty,exploredInBox} from '../client/fog-grid.js';
import {unionLevels,hasFogCell,emptyFog,exploreFog} from '../core/fog.js';
import {visibilityPolygon,pointInPolygon,computeVision} from '../client/vision.js';
const poly=points=>new Map([[0,[{points}]]]);
test('scanlines preserve an L-shaped unseen notch, negative cells and separated floors',()=>{
 const points=[[-5,-5],[5,-5],[5,0],[0,0],[0,5],[-5,5]],vision=poly(points);vision.set(10,[{points:[[0,0],[5,0],[5,5],[0,5]]}]);
 const cells=rasterVision(vision,[-5,-5,5,5]);
 for(let z=-4;z<4;z++)for(let x=-4;x<4;x++)assert.equal(hasFogCell(cells,(x+.5)*1.25,(z+.5)*1.25),pointInPolygon((x+.5)*1.25,(z+.5)*1.25,points));
 assert.ok(!hasFogCell(cells,2,2,0));assert.ok(hasFogCell(cells,2,2,10));assert.ok(!hasFogCell(cells,-2,-2,10));
});
test('multiple sight polygons union without filling the unseen gap',()=>{
 const vision=new Map([[0,[{points:[[0,0],[5,0],[5,5],[0,5]]},{points:[[10,0],[15,0],[15,5],[10,5]]}]]]);
 const cells=rasterVision(vision,[0,0,15,5]);assert.deepEqual(cells['0']['0'],[[0,3],[8,11]]);assert.ok(!hasFogCell(cells,7,2));
});
test('delta subtraction splits runs and reconstructs exactly the union',()=>{
 const target={0:{0:[[-5,10]],1:[[1,5]],2:[[4,7]]}},have={0:{0:[[-9,-3],[0,1],[4,6],[9,19]],1:[[0,20]]}};
 const delta=subtractLevels(target,have);assert.deepEqual(delta,{0:{0:[[-2,-1],[2,3],[7,8]],2:[[4,7]]}});
 assert.deepEqual(unionLevels(have,delta),unionLevels(have,target));assert.ok(!nonempty(subtractLevels(target,unionLevels(have,delta))));
 assert.deepEqual(subtractLevels(target,{}),target);
});
test('mask encodes visible R and explored G, leaving unseen black on the correct level',()=>{
 const current={0:{0:[[0,0]]}},explored={0:{0:[[0,1]]},10:{1:[[1,1]]}};
 const [ground,upper]=maskLevels(current,explored,[0,0,2.5,2.5],[0,10]);assert.equal(ground.width,2);assert.equal(ground.height,2);
 assert.deepEqual([...ground.data],[255,255,0,0,0,255,0,0,0,0,0,0,0,0,0,0]);
 assert.deepEqual([...upper.data],[0,0,0,0,0,0,0,0,0,0,0,0,0,255,0,0]);
});
test('texture dimensions stay bounded for large maps without changing the stored grid',()=>{
 const levels={0:{0:[[0,10000]]}},[mask]=maskLevels(levels,levels,[0,0,10000,10000],[0]);
 assert.equal(mask.width,1024);assert.equal(mask.height,1024);assert.equal(mask.data.length,1024*1024*4);assert.deepEqual(levels,{0:{0:[[0,10000]]}});
});

test('fine current vision resolves within a storage cell while explored fills all subpixels',()=>{
 const vision=poly([[0,0],[.4,0],[.4,1.25],[0,1.25]]),stored=rasterVision(vision,[0,0,1.25,1.25]);
 assert.ok(!nonempty(stored)); // centre of the 1.25-ft stored cell is outside sight
 const [mask]=maskLevels(stored,{0:{0:[[0,0]]}},[0,0,1.25,1.25],[0],vision);
 assert.equal(mask.width,4);assert.equal(mask.height,4);
 for(let z=0;z<4;z++)for(let x=0;x<4;x++){
  const offset=(z*4+x)*4;assert.equal(mask.data[offset],x===0?255:0);assert.equal(mask.data[offset+1],255);
 }
});

if(process.env.FOG_GRID_BENCH) test('50-room movement storage and batching measurement',async t=>{
 const [{makeRoomGen},walls,solver,solver2,{readFileSync}]=await Promise.all([import('../core/roomgen.js'),import('../../tools/spawn-tuner/js/walls.js'),import('../../tools/spawn-tuner/js/solver.js'),import('../../tools/spawn-tuner/js/solver2.js'),import('node:fs')]);
 const read=n=>JSON.parse(readFileSync(new URL('../tuner-data/'+n,import.meta.url)));
 const roomgen=makeRoomGen({walls,solver,solver2,lib:read('library.json'),types:read('types.json'),orient:{},version:'fog-grid-test'}),entities={};
 for(let i=0;i<50;i++){const id='r'+i;entities[id]={id,kind:'room',order:i,recipe:{type:'bedroom',x:i%10*4,z:Math.floor(i/10)*4,w:4,d:4,seed:i+1,wallSeed:i*7+1}};}
 const edges=roomgen.edges(entities).edges,bounds=[-40,-40,230,130],seats=[{id:'seat_player0001',role:'player'}],seat=seats[0].id;
 // All generated doors open: a connected 50-room floor plan, with exterior windows.
 for(const e of edges.values())if(e.kind==='door')entities['o'+e.key]={kind:'edge',key:e.key,as:'open'};
 let accumulated={},fog=emptyFog(),commands=0,maxDeltaBytes=0,deltaBytes=0;const samples=[],polygonSamples=[],rawPoints=[],simplePoints=[];
 const flush=()=>{const delta=subtractLevels(accumulated,fog.viewers[seat]||{});if(nonempty(delta)){const bytes=JSON.stringify({epoch:0,levels:delta}).length;deltaBytes+=bytes;maxDeltaBytes=Math.max(maxDeltaBytes,bytes);fog=exploreFog(fog,seat,delta,0);commands++;}};
 for(let i=0;i<100;i++){
  const room=i%50,pawn={id:'tok_test0001',kind:'token',owner:seat,x:(room%10)*20+7.5+(i%2)*5,z:Math.floor(room/10)*20+7.5};
  const start=performance.now(),vision=computeVision({entities:{...entities,[pawn.id]:pawn},edges,seats,viewer:seat,bounds});
  polygonSamples.push(performance.now()-start);
  const current=rasterVision(vision,bounds),ownCells=current;accumulated=unionLevels(accumulated,ownCells);maskLevels(current,accumulated,bounds,[0],vision);samples.push(performance.now()-start);
  const raw=computeVision({entities:{...entities,[pawn.id]:pawn},edges,seats,viewer:seat,bounds,simplify:false});
  rawPoints.push(raw.get(0)[0].points.length);simplePoints.push(vision.get(0)[0].points.length);
  assert.deepEqual(rasterVision(raw,bounds,.3125),rasterVision(vision,bounds,.3125));
  // One move per 100 ms, flush at most once per two seconds plus final drain.
  if(i%20===0)flush();
 }
 flush();samples.sort((a,b)=>a-b);polygonSamples.sort((a,b)=>a-b);
 let cells=0,runs=0,rows=0;for(const row of Object.values(accumulated[0]||{})){rows++;runs+=row.length;for(const [a,b]of row)cells+=b-a+1;}
 const jsonBytes=JSON.stringify(fog).length;
 t.diagnostic(JSON.stringify({rooms:50,moves:100,simulatedSeconds:10,commands,deltaBytes,maxDeltaBytes,fogJsonBytes:jsonBytes,levels:1,rows,runs,cells,textureDimensions:[864,544],rawPointsAverage:rawPoints.reduce((a,b)=>a+b,0)/rawPoints.length,simplifiedPointsAverage:simplePoints.reduce((a,b)=>a+b,0)/simplePoints.length,polygonMedianMs:polygonSamples[50],polygonP95Ms:polygonSamples[95],cpuPolygonRasterMaskMedianMs:samples[50],p95Ms:samples[95]}));
 assert.ok(commands<=6);assert.deepEqual(fog.viewers[seat],accumulated);assert.ok(jsonBytes<100000);
});

test('geometry with only an explored corner is retained, including negative cells',()=>{
 const memory={0:{'-1':[[-2,-2]]}};
 assert.ok(exploredInBox(memory,0,-2,-1,9,9));
 assert.ok(!exploredInBox(memory,0,0,0,9,9));
 assert.ok(!exploredInBox(memory,10,-2,-1,9,9));
});
