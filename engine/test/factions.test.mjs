import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CampaignRuntime } from '../relay/campaign.js';
import { makeTokens } from '../relay/tokens.js';
import { newArea, areaForClient } from '../core/state.js';
import { REGISTRY, parseArgs, inverseOf } from '../core/commands.js';
import { planFactionChange, effectiveFaction, explicitFaction } from '../core/factions.js';
import { factionCatalog, resolveFaction } from '../core/faction-catalog.js';
import { planOps } from '../core/buildplan.js';
import { loadRoomgen } from '../relay/server.js';
const lib = JSON.parse(readFileSync(new URL('../../tools/spawn-tuner/data/library.json', import.meta.url)));
const hasFaction = (o, shape) => lib.objects[o.cat]?.skus.find(s => s.sku === o.sku)?.shape === shape;
const types = JSON.parse(readFileSync(new URL('../../tools/spawn-tuner/data/rooms.json', import.meta.url)));
let checks = 0;
const eq = (a,b,why) => { assert.deepEqual(a,b,why); checks++; };
const B = 'bld_test0001', R = 'room_test001', R2 = 'room_test002', O = 'obj_test0001';
const piece = (id,room=R) => ({ id,kind:'object',cat:'flavor-banner',sku:'flavor-banner--sun',url:'assets/flat/flavor-banner--sun.webp',flat:true,name:'Sun banner',room,x:7,y:5,z:9,rot:1.2,quat:[0,0,0,1],s:[2,3,4],dims:[2,6,.05],pinned:true,hidden:false,parent:'obj_parent01' });
let area = {order:2,entities:{[B]:{id:B,kind:'building',gen:{code:'TEM',flavor:'sun'}},[R]:{id:R,kind:'room',building:B,order:1,recipe:{type:'temple-nave'}},[R2]:{id:R2,kind:'room',building:B,order:2,recipe:{type:'temple-shrine',flavor:'moon'}},[O]:piece(O),obj_test0002:piece('obj_test0002',R2),obj_chair001:{id:'obj_chair001',kind:'object',cat:'chair',room:R,x:3,z:5}}};
const change = (id,flavor) => {
 const args=planFactionChange(area.entities,id,flavor,lib,types);
 eq(parseArgs('faction.set',args).error,undefined,'payload parses');
 eq(REGISTRY['faction.set'].check({area},args),null,'payload validates');
 const before=area, inv=inverseOf(area,'faction.set',args);
 area=REGISTRY['faction.set'].apply(area,args);
 eq(REGISTRY[inv.type].apply(area,inv.args),before,'undo restores exact bytes');
 return args;
};
eq(effectiveFaction(area.entities,O,lib,types),'sun','building to room to object');
const original=structuredClone(area.entities[O]),chair=structuredClone(area.entities.obj_chair001);
change(B,'spiders'); eq(area.entities[O].sku,'flavor-banner--spiders','building inherited'); eq(area.entities.obj_test0002.sku,'flavor-banner--sun','room override untouched'); eq(area.entities[B].gen.flavor,'spiders','regeneration recipe follows');
for(const k of ['x','y','z','rot','quat','s','dims','parent','pinned']) eq(area.entities[O][k],original[k],`preserve ${k}`);
eq(area.entities.obj_chair001,chair,'neutral furniture untouched');
change(R,'moon'); eq(area.entities[O].sku,'flavor-banner--moon','room override'); change(O,'devils'); change(B,'sun'); eq(area.entities[O].sku,'flavor-banner--devils','object override'); change(O,'inherit'); eq(area.entities[O].sku,'flavor-banner--moon','object inherit'); change(R,'inherit'); eq(area.entities[O].sku,'flavor-banner--sun','room inherit'); eq(explicitFaction(area.entities[R]),null,'inherit absent');
delete area.entities.obj_test0002; change(B,'moon'); eq(area.entities.obj_test0002,undefined,'deleted stays deleted');
const bad=planFactionChange(area.entities,R,'sun',lib,types); bad.swaps.push({id:'obj_chair001',sku:'chair--sun'}); eq(!!REGISTRY['faction.set'].check({area},bad),true,'out of scope rejected');
const moved=planFactionChange(area.entities,R,'sun',lib,types); moved.swaps[0].x=999; eq(!!REGISTRY['faction.set'].check({area},moved),true,'transform injection rejected');
area.entities.obj_legacy01={...piece('obj_legacy01'),cat:'banner-wall',sku:'banner-wall--castle'}; change(R,'sun'); eq(area.entities.obj_legacy01.cat,'flavor-banner','existing heraldry banner adopts slot');
// Future faction discovered from assets, including an arbitrary future slot; no ID list to update.
const fake=structuredClone(lib); for (const cat of ['flavor-banner','flavor-idol']) fake.objects[cat].skus.push({...fake.objects[cat].skus[0],shape:'test-future',sku:cat+'--test-future'});
fake.objects['flavor-future']={id:'flavor-future',skus:[{shape:'test-future',sku:'flavor-future--test-future',url:'assets/test.webp',kind:'flat'}]};
eq(resolveFaction(fake,'test-future'),'test-future','future command'); eq(factionCatalog(fake).slots.includes('flavor-future'),true,'future slot discovery');
let args=planFactionChange(area.entities,R,'test-future',fake,types); eq(args.swaps.every(s=>s.sku.endsWith('--test-future')),true,'future faction swaps');
area.entities.obj_censer01={...piece('obj_censer01'),cat:'flavor-censer',sku:'flavor-censer--sun'};
args=planFactionChange(area.entities,R,'test-future',fake,types); area=REGISTRY['faction.set'].apply(area,args); eq(area.entities.obj_censer01.factionMissing,true,'missing slot suppressed'); eq(area.entities.obj_censer01.hidden,true,'no mixed symbols'); change(R,'moon'); eq(area.entities.obj_censer01.hidden,false,'available slot restored'); eq(area.entities.obj_censer01.x,7,'suppressed edits retained');
// Room visibility and missing assets are independent: neither room reveal nor faction restoration may leak a slot.
{
 let a=REGISTRY['room.spawn'].apply(newArea('tbl_hidefact1','TEST faction hiding (throwaway)'),{id:R,building:B,type:'common',x:0,z:0,w:4,d:4,seed:1});
 a=REGISTRY['object.place'].apply(a,{...piece(O),cat:'flavor-censer',sku:'flavor-censer--sun',parent:'obj_secretpar'});
 const missing={id:R,flavor:'test-future',swaps:[{id:O,missing:true}]};
 const restored={id:R,flavor:'moon',swaps:[{id:O,cat:'flavor-censer',sku:'flavor-censer--moon',url:'assets/moon.glb',flat:false,name:'Secret attached censer',faction:'moon'}]};
 const flag=(ids,hidden)=>{a=REGISTRY['entity.flag'].apply(a,{ids,hidden});};
 const suppress=()=>{a=REGISTRY['faction.set'].apply(a,missing);};
 const restore=()=>{a=REGISTRY['faction.set'].apply(a,restored);};
 const unseen=()=>!JSON.stringify(areaForClient(a,false)).includes(O)&&!JSON.stringify(areaForClient(a,false)).includes('obj_secretpar');
 suppress(); flag([R],true);
 eq(a.entities[O].factionWasHidden,true,'room hide updates suppressed slot visibility intent');
 const hidden=structuredClone(a), inv=inverseOf(a,'faction.set',restored); restore();
 eq(a.entities[O].hidden,true,'available faction stays hidden inside hidden room'); eq(unseen(),true,'hidden restored slot and attachment id absent from player snapshot');
 eq(REGISTRY[inv.type].apply(a,inv.args),hidden,'undo faction restoration preserves suppression and hiding');
 a=hidden; flag([R],false);
 eq(a.entities[O].hidden,true,'room reveal keeps missing asset suppressed'); eq(a.entities[O].factionWasHidden,false,'room reveal updates suppressed visibility intent'); eq(unseen(),true,'missing parented slot absent from revealed-room projection');
 restore(); eq(a.entities[O].hidden,false,'available slot appears after room is revealed');
 suppress(); flag([O],true); restore(); eq(a.entities[O].hidden,true,'explicit hide while suppressed survives restoration');
 suppress(); flag([O],false); eq(unseen(),true,'explicit reveal cannot expose a missing asset'); restore(); eq(a.entities[O].hidden,false,'explicit reveal takes effect once asset is available');
 suppress(); flag([B],true); flag([B],false); eq(unseen(),true,'building reveal also preserves missing-slot suppression');
 // Legacy snapshot made before this repair: false historical flag under a currently hidden room.
 flag([R],true); a.entities[O]={...a.entities[O],factionWasHidden:false}; a=JSON.parse(JSON.stringify(a)); restore();
 eq(a.entities[O].hidden,true,'restoration checks current room hiding even with legacy stale flag'); eq(unseen(),true,'legacy snapshot restoration does not expose attachment or asset payload');
}
const gen=await loadRoomgen(new URL('../../tools/spawn-tuner/js/',import.meta.url).pathname,new URL('../../tools/spawn-tuner/data/',import.meta.url).pathname,{orientApi:''});
for (const type of ['temple-nave','temple-shrine','cult-sanctum']) for(const seed of [11,12]) {
 const args={id:R,type,x:0,z:0,w:5,d:8,seed,flavor:'spiders'};
 const L=gen.solve({},args,1); const slots=L.objects.filter(o=>o.cat.startsWith('flavor-'));
 eq(slots.length>0,true,`${type} has symbols`); eq(slots.every(o=>hasFaction(o, 'spiders')),true,`${type} one faction`);
 const spawned=REGISTRY['room.spawn'].apply({order:0,entities:{}},{...args,layout:L}); eq(spawned.entities[R].recipe.flavor,'spiders','spawn persistence');
 const reroll=gen.solve(spawned.entities,{id:R,type,seed:seed+1},1); eq(reroll.objects.filter(o=>o.cat.startsWith('flavor-')).every(o=>hasFaction(o, 'spiders')),true,'reroll inheritance');
}
// A generated cult building stores its choice on the building, leaving every room inherited.
let serial=0;
const plan={seed:91,rooms:[{id:'a',type:'cult-sanctum',x:0,z:0,w:5,d:6,y:0,level:0,links:{}},{id:'b',type:'cult-passage',x:5,z:0,w:3,d:6,y:0,level:0,links:{}}],stairs:[]};
const built=planOps(plan,{roomgen:gen,entities:{},order:0,building:B,name:'Cult',newId:p=>`${p}_faction${++serial}`,gen:{code:'CLT',flavor:'spiders'}});
const done=built.ops.reduce((a,op)=>REGISTRY[op.type].apply(a,op.args),{order:0,entities:{}});
eq(done.entities[B].gen.flavor,'spiders','generated building remembers faction');
eq(Object.values(done.entities).filter(e=>e.kind==='room').every(e=>!e.recipe.flavor),true,'generated rooms inherit');
eq(Object.values(done.entities).filter(e=>e.cat?.startsWith('flavor-')).every(e=>hasFaction(e, 'spiders')),true,'generated building single faction');
// Authoritative relay: GET needs only id+faction; forged/partial client swaps never enter the journal.
const dir=mkdtempSync(join(tmpdir(),'tw-faction-relay-'));
let rt;
try {
 const made=CampaignRuntime.create({id:'cmp_faction01',dir,name:'TEST factions (throwaway)',gmName:'GM',tokens:makeTokens('test'),roomgen:gen}); rt=made.rt;
 const aid=Object.keys(rt.state.areas)[0], who=made.gmSeat;
 const send=(type,args)=>rt.dispatch(who,{type,area:aid,args});
 eq(send('room.spawn',{id:R,type:'temple-nave',x:0,z:0,w:5,d:8,seed:11}).ok,true,'relay generated room');
 eq(send('faction.set',{id:R,flavor:'spiders',swaps:[{id:'obj_unrelated',url:'bad'}]}).ok,true,'relay ignores forged preview');
 eq(Object.values(rt.state.areas[aid].entities).filter(o=>o.cat?.startsWith('flavor-')).every(o=>hasFaction(o, 'spiders')),true,'relay canonical complete swap');
 eq(send('faction.set',{id:R,flavor:'moon'}).ok,true,'GET minimal faction command');
 eq(send('faction.set',{id:R,flavor:'not-real'}).ok,false,'unknown faction rejected');
 eq(send('batch',{ops:[{type:'faction.set',args:{id:R,flavor:'sun'}},{type:'faction.set',args:{id:R,flavor:'devils'}}]}).ok,true,'batch canonicalized sequentially');
 eq(Object.values(rt.state.areas[aid].entities).filter(o=>o.cat?.startsWith('flavor-')).every(o=>hasFaction(o, 'devils')),true,'batch final faction');
 const saved=JSON.parse(JSON.stringify(rt.state.areas[aid].entities));
 rt.close(); rt=new CampaignRuntime({id:'cmp_faction01',dir,tokens:makeTokens('test'),roomgen:gen}); rt.load();
 eq(rt.state.areas[aid].entities,saved,'save and relay restart preserve faction state');
 eq(send('undo',{}).ok,true,'faction batch undo after restart');
 eq(rt.state.areas[aid].entities[R].recipe.flavor,'moon','undo restores inherited recipe');
 eq(send('redo',{}).ok,true,'faction redo after restart');
 eq(rt.state.areas[aid].entities[R].recipe.flavor,'devils','redo restores faction');
 // Exercise actual recipient log projections, not merely renderer/snapshot filtering.
 rt.roomgen={...gen,factionChange:(E,id,flavor)=>planFactionChange(E,id,flavor,fake,types)};
 const player='seat_factionpl', slot='obj_secretfact';
 eq(send('seat.create',{id:player,kind:'human',role:'player',name:'Player',location:aid}).ok,true,'projection player created');
 eq(send('object.place',{id:slot,cat:'flavor-censer',sku:'flavor-censer--sun',url:'assets/secret-censer.glb',name:'Secret attached censer',room:R,parent:'obj_secretpar',x:5,z:5}).ok,true,'parented faction slot placed');
 const last=()=>rt.entryFor(player,rt.tails.get(aid).at(-1));
 const noSlot=()=>![slot,'obj_secretpar','secret-censer'].some(value=>JSON.stringify(last()).includes(value));
 eq(send('faction.set',{id:R,flavor:'test-future'}).ok,true,'relay suppresses missing slot');
 eq(send('entity.flag',{ids:[R],hidden:true}).ok,true,'relay hides room with missing slot');
 eq(send('faction.set',{id:R,flavor:'moon'}).ok,true,'relay restores faction inside hidden room');
 eq(noSlot(),true,'restored hidden faction log contains no slot id, attachment or asset path');
 eq(send('faction.set',{id:R,flavor:'test-future'}).ok,true,'relay suppresses slot again');
 eq(send('entity.flag',{ids:[R],hidden:false}).ok,true,'relay reveals room with suppressed slot');
 eq(noSlot(),true,'room reveal log contains no suppressed slot id, attachment or asset path');
 const suppressed=JSON.parse(JSON.stringify(rt.state.areas[aid].entities));
 rt.close(); rt=new CampaignRuntime({id:'cmp_faction01',dir,tokens:makeTokens('test'),roomgen:gen}); rt.load();
 eq(rt.state.areas[aid].entities,suppressed,'suppression and visibility intent survive restart');
 eq(send('faction.set',{id:R,flavor:'moon'}).ok,true,'restore available faction after restart');
 eq(rt.state.areas[aid].entities[slot].hidden,false,'visible room restores available slot after restart');
 rt.close(); rt=null;
} finally { rt?.close(); rmSync(dir,{recursive:true,force:true}); }
console.log(`factions: ${checks} checks passed`);
