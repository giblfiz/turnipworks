// Build-time snapshot from the same registry and menu planner used by the game.
import { writeFileSync, readFileSync } from 'node:fs';
import { WALL_FAMILIES } from '../js/walls.js';
const rooms=JSON.parse(readFileSync(new URL('../data/rooms.json',import.meta.url)));
const library=JSON.parse(readFileSync(new URL('../data/library.json',import.meta.url)));
const floors=Object.keys(library.objects).filter(x=>x.startsWith('floor-'));
import { createRegistry } from '../../../engine/client/registry.js';
import { defineCommands } from '../../../engine/client/commands.js';
import { menuFor } from '../../../engine/client/menu.js';
const kinds = ['pawn','prop','openable','light','room','building'];
const out = {};
for (const gm of [true,false]) for (const kind of kinds) {
  const e = kind === 'pawn' ? {id:'t',kind:'token',name:'Mira',damage:0,owner:'me'} : kind === 'room' ? {id:'r',kind:'room',recipe:{type:'common',wallFamily:'auto',floor:'auto',tall:1},roof:{},name:'Common room'} : kind === 'building' ? {id:'b',kind:'building',gen:{code:'inn',storeys:2},name:'Inn'} : {id:'o',kind:'object',cat:kind === 'openable' ? 'door-plank' : kind === 'light' ? 'torch-wall' : 'crate',name:'Crate'};
  const app = {selected:()=>[e],gm:()=>gm,me:()=> 'me',can: c=>gm || ['pawn','chat','open'].includes(c),canTouch:()=>gm || kind==='pawn',canOpen:()=>kind==='openable',assets:{openable:()=>kind==='openable',lightable:()=>kind==='light'},area:()=> 'a',worldOf:()=>({}),settings:{pref:()=>null},roomgen:{typeList:rooms,families:WALL_FAMILIES,floors},ST:{isConnector:()=>false},sync:{campaign:{seats:[],areas:[]}},buildingProgramme:()=>({storeys:{min:1,max:3}}),entities:()=>({})};
  const R = createRegistry(app); defineCommands(R,app); const ctx=R.ctx();
  const avail=R.available(ctx), ringKind=kind==='light'?'prop':kind, primary=avail.filter(c=>c.ring?.slot!=null && c.ring.kinds?.includes(ringKind) && R.isEnabled(c,ctx));
  const item=c=>({id:c.id,label:String(c.short||R.titleOf(c,ctx)).replace(/\s*\(.*\)$/,''),icon:R.iconOf(c,ctx),drag:c.ring?.drag||(['room.fog'].includes(c.id)?'fog':null),slot:typeof c.ring?.slot==='object'?c.ring.slot[ringKind]:c.ring?.slot});
  const secondary=menuFor(R,ctx,{skip:new Set(primary.map(c=>c.id)),ring:true}).map(n=>n.cmd?{...item(n.cmd),opens:n.opens||null}: {id:n.group,label:n.title,icon:n.icon,children:n.children.map(x=>item(x.cmd))});
  out[`${kind}:${gm?'gm':'player'}`]={primary:primary.map(item),secondary};
}
writeFileSync(new URL('./registry.json',import.meta.url),JSON.stringify({source:['engine/client/commands.js','engine/client/menu.js'],kinds:out},null,2)+'\n');
