// Contract test uses deliberately box-shaped corbels; real silhouettes are gated separately.
import assert from 'node:assert/strict';
import {loadTree, makeHarness} from './ccm_lib.mjs';
const S = await loadTree('tem'), H = makeHarness(S);
const lib = structuredClone(S.lib);
const base = lib.objects['corbel-stone'].skus[0];
lib.objects['flavor-corbel'] = {...lib.objects['corbel-stone'], id:'flavor-corbel',size:[24,24,30],skus:['sun','moon','devils','spiders'].map(shape=>({...base,sku:`flavor-corbel--${shape}-fct`,shape,size:[24,24,30],bounds:[0.8,1,0.8],tier:''}))};
for (const type of ['temple-nave','cathedral','cathedral-dark','cult-sanctum','cult-vault']) {
  const r=H.mk('r',type,0,0,...(type.startsWith('cathedral')?[8,14]:[6,9]),314,1); r.flavor='spiders';
  const L=H.build([r],{lib}).solve('r');
  const ps=L.placements.filter(p=>p.id==='flavor-corbel');
  assert(ps.length >= 2,`${type}: at least two brackets, got ${ps.length}`);
  for (const p of ps) {
    assert.equal(p.sku,'flavor-corbel--spiders-fct');
    assert(Math.abs(p.y+p.dims[1]-9)<1e-6);
    assert(['W','E'].includes(p.side));
  }
}
// Merely adding every new idol must not perturb automatic seeded building choices.
const original=structuredClone(S.lib), expanded=structuredClone(S.lib);
for(const shape of ['nature','sword-shield','dragons','skulls','tentacles','death','scales-coin','forge-hammer','sea-storm']) expanded.objects['flavor-idol'].skus.push({...expanded.objects['flavor-idol'].skus[0],sku:`flavor-idol--${shape}-fixture`,shape});
for(const type of ['temple-nave','cult-sanctum']) for(let seed=1;seed<=12;seed++) {
  const r=H.mk('r',type,0,0,5,8,seed,1);r.building=`building-${seed}`;
  assert.deepEqual(H.build([structuredClone(r)],{lib:original}).solve('r').placements,H.build([structuredClone(r)],{lib:expanded}).solve('r').placements);
}
console.log('factions: brackets, beam height, faction isolation and unchanged default buildings OK');
for (const type of ['temple-nave','temple-shrine','cult-sanctum','cult-vault']) {
  const r=H.mk('r',type,0,0,6,9,47,1);r.flavor='nature';
  const L=H.build([r],{lib:expanded}).solve('r');
  const p=L.placements.find(p=>p.id==='censer-hanging');
  assert(p,`${type}: missing neutral hanging censer`);
  assert.equal(p.rule,'ceiling');
  assert(p.y>5 && p.y+p.dims[1]<=9.01,`${type}: hanging censer must be ceiling mounted`);
  assert(!L.placements.some(p=>p.id==='flavor-censer'),`${type}: borrowed another faction's censer`);
}
console.log('factions: neutral bronze censer ceiling fallback OK in nave, shrine, sanctum and inner sanctum');

// A 20x35-ft nave must keep its faction banners when overhead brackets are available.
const withoutCorbels = structuredClone(lib); delete withoutCorbels.objects['flavor-corbel'];
for (const flavor of ['sun','moon','devils','spiders']) {
  const r=H.mk('r','temple-nave',0,0,4,7,11,1);r.flavor=flavor;
  const before=H.build([structuredClone(r)],{lib:withoutCorbels}).solve('r');
  const after=H.build([structuredClone(r)],{lib}).solve('r');
  const banners=L=>L.placements.filter(p=>p.id==='flavor-banner');
  assert(banners(before).length>0,`${flavor}: fixture needs original banners`);
  assert.deepEqual(banners(after).map(p=>[p.sku,p.x,p.z,p.side]),banners(before).map(p=>[p.sku,p.x,p.z,p.side]),`${flavor}: corbels must preserve banner count and wall positions`);
  const corbels=after.placements.filter(p=>p.id==='flavor-corbel');
  assert(corbels.length>0,`${flavor}: banners must leave some corbels`);
  for(const c of corbels) for(const p of after.placements.filter(p=>p.uid!==c.uid)) {
    if(p.y>=c.y+c.dims[1] || p.y+p.dims[1]<=c.y) continue;
    const box=q=>{const x=Math.abs(Math.cos(q.rot)),z=Math.abs(Math.sin(q.rot));return [x*q.dims[0]+z*q.dims[2],z*q.dims[0]+x*q.dims[2]];};
    const [cw,cd]=box(c),[pw,pd]=box(p);
    assert(!(Math.abs(p.x-c.x)<(cw+pw)/2-0.02 && Math.abs(p.z-c.z)<(cd+pd)/2-0.02),`${flavor}: bracket intersects ${p.id}`);
  }
}
console.log('factions: 20x35 nave retains banners and nonintersecting corbels OK');
// Real mesh widths and the taller spider variant must also fit around the existing dress.
const actualWithout = structuredClone(S.lib); delete actualWithout.objects['flavor-corbel'];
for(const flavor of ['sun','moon','devils','spiders']) for(const [type,w,d] of [['temple-nave',4,7],['cathedral',8,14]]) {
  const r=H.mk('r',type,0,0,w,d,11,1);r.flavor=flavor;
  const before=H.build([structuredClone(r)],{lib:actualWithout}).solve('r');
  const after=H.build([structuredClone(r)]).solve('r');
  const banners=L=>L.placements.filter(p=>p.id==='flavor-banner').map(p=>[p.sku,p.x,p.z,p.side]);
  assert(banners(after).length>=banners(before).length,`${type}/${flavor}: actual mesh must retain banner count`);
  assert(after.placements.filter(p=>p.id==='flavor-corbel').length>=2,`${type}/${flavor}: actual mesh needs a row of corbels`);
}
console.log('factions: actual corbels and banners coexist in small nave and full cathedral OK');

// Each delivered faction's actual idol remains present across nave/cathedral/shrine and cult layouts.
const newFactions = (S.lib.factions || []).filter(f => f.available && !['sun','moon','devils','spiders'].includes(f.id));
for (const f of newFactions) for (const [type,w,d] of [['temple-nave',6,9],['cathedral',8,14],['cathedral-dark',8,14],['temple-shrine',4,5],['cult-sanctum',6,9],['cult-vault',4,5]]) for (const seed of [31,62,93,124,155,186]) {
  const r=H.mk('r',type,10,10,w,d,seed,1);r.flavor=f.id;
  const L=H.build([r]).solve('r');
  assert(L.placements.some(p=>p.id==='flavor-idol' && S.lib.objects[p.id].skus.find(s=>s.sku===p.sku)?.shape===f.id),`${type}/${f.id}/seed${seed}: actual faction idol missing`);
}
console.log(`factions: ${newFactions.length} new families retain actual idols across six room recipes and six seeds`);
