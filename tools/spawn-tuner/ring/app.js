// Offline bench: same v2 model, panel and renderer used by ?ringlab=1 in the game.
const local = import.meta.url.includes('/tools/spawn-tuner/');
const base = new URL(local ? '../../../engine/client/ringlab/' : '../../engine/client/ringlab/', import.meta.url);
const stamp = new URL(import.meta.url).searchParams.get('v') || 'dev';
const [{ createRingRenderer, loadManifest }, { mountRingPanel, draftSettings }, { BUILTINS }] = await Promise.all([
  import(new URL(`renderer.js?v=${stamp}`, base)), import(new URL(`panel.js?v=${stamp}`, base)), import(new URL(`presets.js?v=${stamp}`, base)),
]);
const css = document.createElement('link'); css.rel='stylesheet'; css.href=new URL(`style.css?v=${stamp}`,base); document.head.append(css);
const $ = s => document.querySelector(s), qs = new URLSearchParams(location.search);
const registry = await fetch('./ring/registry.json', {cache:'no-store'}).then(r=>r.json());
const tunerBase = new URL('../', import.meta.url); // ring/app.js -> tuner/
const manifest = await loadManifest(tunerBase);
let state='closed', nested=null, selection=null, uiSize=1;
const renderer=createRingRenderer($('#ring'),{manifestBase:new URL('assets/ui-icons/manifest.json',tunerBase),onAction:it=>{
  if(it.id==='menu'){state=state==='closed'?'expanded':'closed';nested=null;panel.selectState(state);return;}
  if(it.children?.length){nested=it;state='nested';panel.selectState(state);return;}
  if(it.id==='faction.set'){nested={id:'faction.set',children:['Inherit','Red','Blue','Green'].map(x=>({id:'faction.'+x.toLowerCase(),label:x,icon:'sun'}))};state='nested';panel.selectState(state);return;}
  selection=it;render();
},onDrag:(it,phase,t)=>phase==='preview'?it.id==='pawn.damage'?Math.round(t*100/6)+' damage':it.id==='room.fog'?Math.round(t*8)+' ft fog':Math.round(25+t*275)+'% size':undefined,onCycle:id=>panel.cycleIcon(id),onWarnings:values=>panel.setWarnings(values)});
const panel=mountRingPanel($('#ring-panel'),{ratingsApi:qs.get('api')||'/api/tw-ratings',initial:draftSettings()||BUILTINS['Quiet brass · Fauna'],onChange:()=>{state=panel.state();render();},onReplay:()=>{state='expanded';panel.selectState(state);render(true);},onUiSize:v=>{uiSize=v;render();},countForArc:key=>key==='closed'||key==='primary'?content().primary.length:key==='menu'?1:content().secondary.length});
panel.setManifest(manifest);
const damage=(manifest.actions?.['pawn.damage']?.variants||[]).filter(x=>x.set==='charcoal').map(x=>new URL(x.sizes?.['62']||x.file,new URL('assets/ui-icons/manifest.json',tunerBase)).href);panel.showDamageChoices(damage);
fetch((qs.get('api')||'/api/tw-ratings')+'/tuner/rings').then(r=>r.ok?r.json():{}).then(v=>panel.setSaved(Object.fromEntries(Object.entries(v).map(([k,x])=>[k,x.data||x])))).catch(()=>{});
function content(){return registry.kinds[$('#kind').value+':'+$('#seat').value]||{primary:[],secondary:[]};}
function render(replay=false){const stage=$('#stage'), W=stage.clientWidth,H=stage.clientHeight;const anchor={x:W*.5,y:H*.53};const c=content();if(state==='nested'&&!nested)nested=c.secondary.find(x=>x.children)||null;const bad=renderer.draw({settings:panel.settings(),content:c,state,nested,anchor,scale:uiSize,sector:panel.sector(),pickIcons:panel.pickIcons(),manifest,compare:panel.compare(),replay});panel.setWarnings(bad);$('#scene-label').textContent=`${$('#kind').value} · selected`;window.ringTuner={settings:panel.settings(),registry,layout:{bad,count:document.querySelectorAll('#ring .rl-button').length,center:[anchor.x,anchor.y]},manifest,presets:panel.presets(),panel};}
for(const id of ['kind','seat'])$('#'+id).onchange=()=>{state='closed';nested=null;panel.selectState(state);render();};addEventListener('resize',render);render();
