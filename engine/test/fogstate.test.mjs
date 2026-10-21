import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {CampaignRuntime} from '../relay/campaign.js';
import {makeTokens} from '../relay/tokens.js';
import {unionLevels,levelsProblem,hasFogCell,exploredFor} from '../core/fog.js';
import {applyArea,parseArgs} from '../core/commands.js';
import {ClientSync} from '../core/client-sync.js';
const levels=(x,z=0,y=0)=>({[y]:{[z]:[[x,x]]}});
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tw-fog-')),tokens=makeTokens('fog-tests');
 let {rt,gmSeat:gm}=CampaignRuntime.create({id:'cmp_fog00001',dir,name:'TEST Fog (throwaway)',gmName:'GM',tokens});
 const area=rt.state.areaOrder[0],a='seat_player0001',b='seat_player0002',other='area_other0001';
 const send=(who,type,args={},where=area)=>rt.dispatch(who,{type,args,area:where});
 for(const id of [a,b])assert.ok(send(gm,'seat.create',{id,kind:'human',role:'player',name:id,color:'#aabbcc'}).ok);
 assert.ok(send(gm,'area.create',{id:other,name:'Other'}).ok);
 const con=(seat)=>({seat,subs:new Set(),messages:[],send(m){this.messages.push(m);},close(){}});
 t.after(()=>{rt.close();fs.rmSync(dir,{recursive:true,force:true});});
 return {get rt(){return rt;},gm,a,b,area,other,send,con,reload(){rt.close();rt=new CampaignRuntime({id:'cmp_fog00001',dir,tokens});rt.load();return rt;}};
}
test('compact row union is immutable, idempotent and validates bad input',()=>{
 const a={'0':{'0':[[0,2],[5,6]]}},b={'0':{'0':[[2,5]],'-1':[[-4,-2]]}};
 const c=unionLevels(a,b);assert.deepEqual(c['0']['0'],[[0,6]]);assert.deepEqual(unionLevels(c,b),c);assert.deepEqual(a['0']['0'],[[0,2],[5,6]]);
 assert.ok(levelsProblem(JSON.parse('{"__proto__":[]}')));assert.ok(levelsProblem({'0':{'0':[[3,1]]}}));assert.ok(levelsProblem({'0':{'0':[[Infinity,4]]}}));
 assert.equal(levelsProblem(levels(-2,-3,-10)),null);
});
test('own exploration persists, party unions, no writes to named other viewer',t=>{
 const f=fixture(t);assert.ok(f.send(f.a,'fog.explore',{epoch:0,levels:levels(2),viewer:f.b}).ok);
 assert.ok(f.send(f.b,'fog.explore',{epoch:0,levels:levels(9)}).ok);
 const fog=f.rt.state.areas[f.area].fog;
 assert.deepEqual(fog.viewers[f.a],levels(2));assert.deepEqual(fog.viewers[f.b],levels(9));
 assert.deepEqual(fog.party['0']['0'],[[2,2],[9,9]]);
 assert.equal((f.rt.undo.get(f.area)||[]).length,0);
 assert.ok(!f.send(f.a,'fog.explore',{epoch:0,levels:{},partyLevels:levels(20)}).ok);
 assert.ok(f.send(f.gm,'campaign.set',{defaults:{sharedPartyVision:true}}).ok);
 assert.ok(f.send(f.a,'fog.explore',{epoch:0,levels:{},partyLevels:levels(20)}).ok);
 assert.ok(!hasFogCell(f.rt.state.areas[f.area].fog.viewers[f.a],25,0));assert.ok(hasFogCell(f.rt.state.areas[f.area].fog.party,25,0));
 const saved=structuredClone(f.rt.state.areas[f.area].fog);f.reload();assert.deepEqual(f.rt.state.areas[f.area].fog,saved);
});
test('snapshots, logs, inverse logs and catch-up do not leak other viewer records',t=>{
 const f=fixture(t);f.send(f.a,'fog.explore',{epoch:0,levels:levels(2)});f.send(f.b,'fog.explore',{epoch:0,levels:levels(91)});
 const c=f.con(f.a);f.rt.subscribe(c,f.area);const snap=c.messages.find(m=>m.t==='snap');
 assert.deepEqual(Object.keys(snap.state.fog.viewers),[f.a]);assert.deepEqual(snap.state.fog.party,{});
 for(const entry of f.rt.tails.get(f.area)) {const e=f.rt.entryFor(f.a,entry);assert.equal(e.type,'fog.view');assert.ok(!JSON.stringify(e).includes('91'));assert.ok(!JSON.stringify(e).includes(f.b+'":'));}
 const gm=f.con(f.gm);f.rt.subscribe(gm,f.area);assert.deepEqual(Object.keys(gm.messages.find(m=>m.t==='snap').state.fog.viewers).sort(),[f.a,f.b]);
 const client=new ClientSync({transport:{},token:'unused'});client.areas.set(f.area,{confirmed:snap.state,pending:[],want:true});client.me=f.a;
 f.send(f.gm,'fog.reset',{area:f.area});f.send(f.gm,'undo',{});
 const tail=f.rt.tails.get(f.area).filter(e=>e.seq>snap.state.seq).map(e=>f.rt.entryFor(f.a,e));
 client.applyEntries(tail);assert.deepEqual(Object.keys(client.view(f.area).fog.viewers),[f.a]);assert.ok(!JSON.stringify(tail).includes('91'));
});
test('campaign reset is atomic, undoable across hidden areas, and epochs reject in-flight writes',t=>{
 const f=fixture(t);f.send(f.a,'fog.explore',{epoch:0,levels:levels(2)});f.send(f.gm,'fog.reveal',{epoch:0,levels:levels(6)},f.other);
 const before=f.rt.r;assert.ok(f.send(f.gm,'fog.reset',{area:f.area}).ok);assert.equal(f.rt.r,before+1);
 for(const id of [f.area,f.other]){assert.equal(f.rt.state.areas[id].fog.epoch,1);assert.deepEqual(f.rt.state.areas[id].fog.revealed,{});}
 assert.ok(!f.send(f.a,'fog.explore',{epoch:0,levels:levels(80)}).ok);
 assert.ok(f.send(f.a,'fog.explore',{epoch:1,levels:levels(5)}).ok);
 assert.ok(f.send(f.gm,'undo',{}).ok);
 assert.equal(f.rt.state.areas[f.area].fog.epoch,2);
 assert.deepEqual(f.rt.state.areas[f.area].fog.viewers[f.a]['0']['0'],[[2,2],[5,5]]);
 assert.deepEqual(f.rt.state.areas[f.other].fog.revealed,levels(6));
 assert.ok(!f.send(f.a,'fog.explore',{epoch:1,levels:levels(80)}).ok);
 // Passive exploration must not erase the GM's redo stack.
 f.send(f.gm,'fog.explore',{epoch:2,levels:{}});
 assert.ok(f.send(f.gm,'redo',{}).ok);assert.equal(f.rt.state.areas[f.area].fog.epoch,3);
 assert.deepEqual(f.rt.state.areas[f.area].fog.viewers[f.a],levels(5));
 assert.ok(f.send(f.gm,'undo',{}).ok);assert.equal(f.rt.state.areas[f.area].fog.epoch,4);
 assert.deepEqual(f.rt.state.areas[f.area].fog.viewers[f.a]['0']['0'],[[2,2],[5,5]]);
});
test('reveal includes future seats; undo preserves independent player exploration',t=>{
 const f=fixture(t);assert.ok(!f.send(f.a,'fog.reveal',{epoch:0,levels:levels(10)}).ok);
 f.send(f.gm,'fog.reveal',{epoch:0,levels:levels(10)});f.send(f.a,'fog.explore',{epoch:0,levels:levels(3)});
 assert.ok(hasFogCell(exploredFor(f.rt.state.areas[f.area].fog,'seat_future0001'),12.5,0));
 f.send(f.gm,'undo',{});assert.ok(hasFogCell(exploredFor(f.rt.state.areas[f.area].fog,f.a),3.75,0));assert.ok(!hasFogCell(exploredFor(f.rt.state.areas[f.area].fog,f.a),12.5,0));
});
test('shared toggle refreshes snapshots and clears party cache when disabled',t=>{
 const f=fixture(t),c=f.con(f.a);f.rt.conns.add(c);f.rt.subscribe(c,f.area);f.send(f.b,'fog.explore',{epoch:0,levels:levels(90)});
 f.send(f.gm,'campaign.set',{defaults:{sharedPartyVision:true}});
 assert.deepEqual(c.messages.filter(m=>m.t==='snap').at(-1).state.fog.party,levels(90));
 f.send(f.gm,'campaign.set',{defaults:{sharedPartyVision:false}});
 assert.deepEqual(c.messages.filter(m=>m.t==='snap').at(-1).state.fog.party,{});
});
test('fog writes cannot be smuggled into batch or overwrite after reset during optimism',()=>{
 assert.ok(parseArgs('batch',{ops:[{type:'fog.explore',args:{epoch:0,levels:levels(1)}}]}).error);
 const t={entities:{},fog:{epoch:1,viewers:{},party:{},revealed:{}}};
 assert.deepEqual(applyArea(t,'fog.explore',{epoch:0,levels:levels(1)},{by:'a'}).fog,t.fog);
});
test('per-pawn radius can be stored, changed and cleared to unlimited',t=>{
 const f=fixture(t),id='tok_radius00001';
 assert.ok(f.send(f.gm,'token.create',{id,name:'Vision pawn',x:0,z:0,visionRadius:30}).ok);
 assert.equal(f.rt.state.areas[f.area].entities[id].visionRadius,30);
 assert.ok(!f.send(f.gm,'token.set',{id,visionRadius:-1}).ok);
 assert.ok(f.send(f.gm,'token.set',{id,visionRadius:0}).ok);assert.equal(f.rt.state.areas[f.area].entities[id].visionRadius,0);
 assert.ok(f.send(f.gm,'token.set',{id,visionRadius:null}).ok);assert.ok(!Object.hasOwn(f.rt.state.areas[f.area].entities[id],'visionRadius'));
});
test('reset undo and redo survive relay restart',t=>{
 const f=fixture(t);f.send(f.a,'fog.explore',{epoch:0,levels:levels(7)});f.send(f.gm,'fog.reset',{area:f.area});f.reload();
 assert.ok(f.send(f.gm,'undo',{}).ok);assert.deepEqual(f.rt.state.areas[f.area].fog.viewers[f.a],levels(7));f.reload();
 assert.ok(f.send(f.gm,'redo',{}).ok);assert.equal(f.rt.state.areas[f.area].fog.epoch,3);assert.deepEqual(f.rt.state.areas[f.area].fog.viewers,{});
});
