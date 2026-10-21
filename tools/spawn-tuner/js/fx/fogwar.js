// Campaign visibility is presentation, independent of the decorative atmosphere switch.
// One floor-plan RGBA atlas: R=current sight, G=explored, B=previous opacity.
// Callers provide RGBA masks (R/G used), row zero at z0; optional levels <=16.
// Exact texel membership never blends unseen into an adjacent explored cell.
// The final picture pass deliberately follows bloom: unseen light cannot bleed back in.
import * as THREE from 'three';
import { Pass } from 'postprocessing';
import { LIGHT_KINDS, REACH_DEFAULTS, BRIGHT_DEFAULTS, KIND_LABELS } from './lightreach.js';

export const FOGWAR_DEFAULTS = {
  fx: 'fogwar', name: 'default',
  bank: { height: 9, density: 1.35, color: '#8b939e', clear: 1 },
  veil: { height: 9, density: 0.16, color: '#b4c0cc' },
  spill: { push: 0.7, curl: 1.25, reach: 6.5, speed: 1, cap: 0 }, // (push 0.7: the tongues were dead code until 2026-10-18; Harry judged the look without them)
  bubble: { rate: 1, size: 7, rise: 3.2 },
  glow: { color: '#b8d8ff', strength: 0.3 },
  roll: { back: 5, pour: 3.5, linger: 0.25, lip: 0.7 }, // (2026-10-18) the bank rolls back from new sight and pours in where sight is lost
  edge: { feather: 3.5, falloff: 0.55 },
  base: { style: 'checker', checkerSize: 2.5, checkerContrast: 0.2, color: '#575b5d' },
  // (2026-10-20) a DARK area (game: Settings ▸ Area ▸ Darkness): the outer `hint` ft of every darkvision and light radius is
  // remembered (the veil), not seen: "just hint of what's beyond the candlelight". 0 = a hard edge. A saved look without
  // this key wears the default (engine/core/darkness.js DARK_HINT_DEFAULT).
  // (2026-10-21, Harry: "a tiny one-candle lamp is doing like 40 foot circle") how far each kind of light reaches in a dark
  // area: `reach` (bright + dim, D&D's total) when `dim` is on, `bright` when off, every row times `scale`. A GM's own
  // light radius on a thing still wins. A saved look without these keys wears the game's table (fx/lightreach.js).
  dark: { hint: 2, scale: 1, dim: true },
  reach: { ...REACH_DEFAULTS },
  bright: { ...BRIGHT_DEFAULTS },
};

const T = (k, label, min, max, step, unit) => ({ k, label, type: 'range', min, max, step, unit });
export const FOGWAR_SCHEMA = [
  ['Unseen bank (never seen)', 'bank', [
    T('height', 'Bank height', 2, 18, 0.5, 'ft'),
    T('density', 'Bank density', 0.3, 3, 0.05),
    { k: 'color', label: 'Bank colour', type: 'color' },
  ]],
  ['Explored veil (seen before)', 'veil', [
    T('height', 'Veil height', 0, 18, 0.5, 'ft'),
    T('density', 'Veil density (0 = tint only)', 0, 1.5, 0.02),
    { k: 'color', label: 'Veil colour', type: 'color' },
  ]],
  ['Spill & rolling tongues (into sight)', 'spill', [
    T('push', 'Outward push', 0, 3, 0.05),
    T('curl', 'Curl at the sight edge', 0, 3, 0.05),
    T('reach', 'Tongue reach', 0, 14, 0.25, 'ft'),
    T('speed', 'Tongue speed', 0.2, 3, 0.05, '×'),
    T('cap', 'Spill density cap (0 = off)', 0, 1, 0.02),
  ]],
  ['Bubbles & billows (top of bank)', 'bubble', [
    T('rate', 'Bubble rate', 0, 3, 0.05, '×'),
    T('size', 'Billow size', 2, 18, 0.5, 'ft'),
    T('rise', 'Rise height', 0, 8, 0.25, 'ft'),
  ]],
  ['Roll back & pour in (when sight changes)', 'roll', [
    T('back', 'Roll back speed', 0.5, 30, 0.5, 'ft/s'),
    T('pour', 'Pour in speed', 0.5, 30, 0.5, 'ft/s'),
    T('linger', 'Linger before rolling back', 0, 3, 0.05, 's'),
    T('lip', 'Pour front thickness', 0, 1.5, 0.05),
  ]],
  ['Ghostly inner glow (no lights)', 'glow', [
    { k: 'color', label: 'Glow colour', type: 'color' },
    T('strength', 'Glow strength', 0, 1.5, 0.02),
  ]],
  ['Feathered sight edge', 'edge', [
    T('feather', 'Feather width', 0.5, 10, 0.25, 'ft'),
    T('falloff', 'Edge darkening', 0, 0.9, 0.02),
  ]],
  ['Darkness (dark areas in the game)', 'dark', [
    T('hint', 'Remembered edge of the light', 0, 6, 0.5, 'ft'),
    T('scale', 'Overall light scale', 0.25, 1.5, 0.05, '×'),
    { k: 'dim', label: 'Count dim light (on: bright + dim reach; off: bright light only)', type: 'check' },
  ]],
  ['Light reach, bright + dim (Count dim light on)', 'reach', LIGHT_KINDS.map(k => T(k, KIND_LABELS[k], 0, 120, 5, 'ft'))],
  ['Light reach, bright only (Count dim light off)', 'bright', LIGHT_KINDS.map(k => T(k, KIND_LABELS[k], 0, 120, 5, 'ft'))],
  ['Secrecy floor (under the bank & on Low)', 'base', [
    { k: 'style', label: 'Unseen floor', type: 'select', options: [['checker', '2.5-ft checkerboard'], ['solid', 'flat dark']] },
    T('checkerSize', 'Checker square size', 1, 8, 0.25, 'ft'),
    T('checkerContrast', 'Checker contrast (0.2 = image editor)', 0, 0.5, 0.01),
    { k: 'color', label: 'Base colour', type: 'color' },
  ]],
];

const B = (name, o) => () => {
  const p = JSON.parse(JSON.stringify(FOGWAR_DEFAULTS));
  p.name = name;
  for (const [k, v] of Object.entries(o)) Object.assign(p[k], v);
  return p;
};
export const FOGWAR_BUILTINS = {
  'default': B('default', {}),
  'calm-veil': B('calm-veil', { spill: { push: 0.35, curl: 0.65, reach: 3.5, speed: 0.7, cap: 0 }, bubble: { rate: 0.6, size: 9, rise: 1.8 }, glow: { color: '#b8d8ff', strength: 0.28 } }),
  'wild-billows': B('wild-billows', { bank: { height: 11, density: 1.65 }, spill: { push: 2.1, curl: 2.0, reach: 9.5, speed: 1.35, cap: 0 }, bubble: { rate: 1.6, size: 6, rise: 4.8 }, glow: { color: '#c4e2ff', strength: 0.58 } }),
  'low-checker': B('low-checker', { bank: { height: 9, density: 0.3 }, veil: { height: 0, density: 0 }, spill: { push: 0, curl: 0, reach: 0, speed: 1, cap: 0 }, bubble: { rate: 0, size: 7, rise: 0 }, glow: { strength: 0 } }),
};

export function normFogWar(p) {
  const out = JSON.parse(JSON.stringify(FOGWAR_DEFAULTS));
  if (!p || typeof p !== 'object') return out;
  if (typeof p.name === 'string') out.name = p.name;
  for (const k of ['bank', 'veil', 'spill', 'roll', 'bubble', 'glow', 'edge', 'base', 'dark', 'reach', 'bright']) {
    if (p[k] && typeof p[k] === 'object') Object.assign(out[k], p[k]);
  }
  return out;
}

const vertexShader = `varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const fragmentShader = `
uniform sampler2D uPicture,uDepth,uMask,uFlow,uFlyers,uKnown,uRoll;
uniform vec4 uRollB;uniform vec2 uRollN;uniform float uHasRoll;
uniform mat4 uProjInv,uCamera;
uniform vec4 uFlowBounds,uLevelBounds[16],uLevelTiles[16];
uniform float uLevelY[16];
uniform int uLevelCount;
uniform float uChanged;
uniform vec2 uAtlasSize;
uniform float uHasFlow,uHasFlyers,uHasKnown;
uniform float uFloor,uTime,uDecorative,uVeilDen,uExposure;
uniform vec3 uChecker,uBaseCol,uVeilCol;
uniform vec2 uFeather;
varying vec2 vUv;
vec3 world(float d){vec4 p=uProjInv*vec4(vUv*2.-1.,d*2.-1.,1.);return (uCamera*vec4(p.xyz/p.w,1.)).xyz;}
float remembered(vec2 uv,vec4 tile,vec2 texel){
 return texture2D(uMask,clamp(tile.xy+uv*tile.zw,tile.xy+texel*.5,tile.xy+tile.zw-texel*.5)).g;
}
vec2 sampleMask(vec2 uv,vec4 tile,vec2 texel){
 if(any(lessThan(uv,vec2(0.)))||any(greaterThanEqual(uv,vec2(1.))))return vec2(0.);
 return texture2D(uMask,clamp(tile.xy+uv*tile.zw,tile.xy+texel*.5,tile.xy+tile.zw-texel*.5)).rg;
}
float hash21(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
// Box-filtered checker (the integral of a square wave over the pixel footprint): no shimmer when the camera moves,
// fading to its mean colour where a square is smaller than a pixel. 1 = light square, 0 = dark.
vec2 tri(vec2 x){vec2 h=fract(x*.5)-.5;return 1.-2.*abs(h);}
float checkerAt(vec2 p,float sz){
 vec2 q=p/max(.25,sz);
 vec2 w=clamp(fwidth(q)*1.5,vec2(.001),vec2(1.));
 vec2 i=(tri(q+.5*w)-tri(q-.5*w))/w;
 return .5+.5*i.x*i.y*clamp(1.-max(w.x,w.y),0.,1.);
}

void main(){
// Two finite clip depths avoid catastrophic cancellation at a distant far plane.
 vec3 nearP=world(0.),farP=world(.5);vec3 ray=farP-nearP;
 float depth=texture2D(uDepth,vUv).r;
 vec3 surface=depth<.999999?world(depth):vec3(0.,uFloor,0.);
 float levelY=uLevelY[0];vec4 bounds=uLevelBounds[0],tile=uLevelTiles[0];
 for(int i=1;i<16;i++){
   if(i>=uLevelCount)break;
   if(surface.y+.08>=uLevelY[i]){levelY=uLevelY[i];bounds=uLevelBounds[i];tile=uLevelTiles[i];}
 }
 float t=(levelY-nearP.y)/(abs(ray.y)<.00001?-.00001:ray.y);
 vec2 floorP=(nearP+ray*t).xz;
 vec2 uv=((depth<.999999?surface.xz:floorP)-bounds.xy)/bounds.zw;
 // Half-texel clamp prevents one level reading its neighbour in the atlas.
 vec2 atlasUV=tile.xy+clamp(uv,vec2(0.),vec2(.999999))*tile.zw;
 vec2 texel=1./uAtlasSize;
 vec3 mask=texture2D(uMask,(floor(atlasUV*uAtlasSize)+.5)*texel).rgb;
 vec2 softMask=texture2D(uMask,clamp(atlasUV,tile.xy+texel*.5,tile.xy+tile.zw-texel*.5)).rg;
 if(any(lessThan(uv,vec2(0.)))||any(greaterThanEqual(uv,vec2(1.))))mask=vec3(0.,0.,1.);
 float seen=step(.5,max(mask.r,mask.g));
 float current=step(.5,mask.r);
 float transition=clamp((uTime-uChanged)/.42,0.,1.);
 float edge=0.;
 // explored (remembered) cells: a flat translucent tint; with the atmosphere on, its 3-D veil does most of the work
 float mist=uDecorative>.5?clamp(.12+.4*uVeilDen,0.,.62):clamp(.73*(uVeilDen/.36),0.,.92);
 // SECRECY FLOOR: a checkerboard drawn on the FLOOR PLANE of the level (floorP, never the hidden surface's depth),
 // anchored to the world, so nothing under it can sketch hidden walls or furniture. uChecker: size ft, display
 // contrast (0.2 = an image editor's transparency checker: dark squares 20% darker), on/off.
 float chk=uChecker.z>.5?checkerAt(floorP,uChecker.x):1.;
 vec3 unseenOut=uBaseCol*mix(pow(max(0.,1.-uChecker.y),2.2),1.,chk);
 vec3 exploredCol=uVeilCol;
 if(uDecorative>.5){
   vec2 flowUV=(floorP-uFlowBounds.xy)/uFlowBounds.zw;
   vec2 flow=vec2(0.);
   if(uHasFlow>.5 && all(greaterThanEqual(flowUV,vec2(0.))) && all(lessThanEqual(flowUV,vec2(1.))))flow=texture2D(uFlow,flowUV).xy;
   float fine=noise((floorP-flow*.35)*.21+vec2(-uTime*.025,uTime*.02));
   // Explored mist is stationary in this pass; the 3-D veil in the atmosphere moves.
   float still=noise(floorP*.12);
   exploredCol=uVeilCol+vec3((still-.5)*.025);
   transition=smoothstep(0.,1.,clamp(transition+(fine-.5)*.36*sin(transition*3.14159265),0.,1.));
   edge=4.*transition*(1.-transition)*abs(mask.b-mist*(1.-current));
   exploredCol+=vec3(edge*(fine-.5)*.04);
 }
 // Soften only INTO known space: never expose an unseen texel or brighten an
 // explored texel using current sight from a neighbouring cell.
 if(current<.5 && seen>.5){
   vec2 cell=max(vec2(1.25),bounds.zw/(tile.zw*uAtlasSize));
   vec2 grid=uv*bounds.zw/cell-.5,base=floor(grid),f=fract(grid);
   vec2 a=(base+.5)*cell/bounds.zw,b=cell/bounds.zw;
   softMask.g=mix(mix(remembered(a,tile,texel),remembered(a+vec2(b.x,0.),tile,texel),f.x),
                  mix(remembered(a+vec2(0.,b.y),tile,texel),remembered(a+b,tile,texel),f.x),f.y);
 }
 // WIDE FEATHERED SIGHT EDGE: darkens only the VISIBLE side over uFeather.x feet, like torchlight falling off
 // (an average of the sight mask over a disc of that radius); never thins the unseen side.
 float sightAvg=softMask.r,seenAvg=max(softMask.r,softMask.g);
 if(current>.5 && uFeather.x>.25){
   vec2 acc=softMask*.1;float wsum=.1;
   for(int k=0;k<12;k++){
     float a=float(k)*2.3999632+.5,rr=sqrt((float(k)+.5)/12.);
     vec2 o=vec2(cos(a),sin(a))*rr*uFeather.x/bounds.zw;
     acc+=sampleMask(uv+o,tile,texel);wsum+=1.;
   }
   acc/=wsum;sightAvg=acc.r;seenAvg=max(acc.r,acc.g);
 }
 float edgeRim=1.-smoothstep(.25,.98,sightAvg);
 float kFall=mix(uFeather.y,min(1.,uFeather.y*1.35),1.-seenAvg);
 float edgeMist=max(mist,.62);
 float target=current>.5?edgeMist*kFall*edgeRim:mist;
 target=mix(1.,target,smoothstep(.5,1.,max(softMask.r,softMask.g)));
 // Reset/never-seen is opaque immediately. Historical visibility cannot leak
 // through a transition after reset fog, identity change or GM hide.
 float alpha=seen>0.?mix(mask.b,target,transition):1.;
 // Exact visible pawn fragments use their base sight, including tall figures.
 // FIRST REVEAL (2026-10-18, Harry: "an instant snap to 'remembered'"): ground seen for the first time keeps its checker
 // floor under the bank until the atmosphere's roll-back front reaches it, then fades it as the bank clears (atmos.js
 // sight clock: >= 12 waiting, (2,3] fading). Only ever MORE cover than the mask asks for.
 if(uHasRoll>.5 && seen>.5){
   vec2 ru=((depth<.999999?surface.xz:floorP)-uRollB.xy)/uRollB.zw;
   if(all(greaterThanEqual(ru,vec2(0.)))&&all(lessThan(ru,vec2(1.)))){
     float A=texture2D(uRoll,(floor(ru*uRollN)+.5)/uRollN).a;
     alpha=max(alpha,A>=11.5?1.:(A>2.001&&A<3.01?A-2.:0.));
   }
 }
 if(uHasFlyers>.5 && texture2D(uFlyers,vUv).r>.5)alpha=0.;
 // A WALL KNOWN THROUGH ITS THICKNESS (2026-10-18, Harry: "known through its thickness, not along its length"): a wall
 // piece whose face the viewer has seen keeps its cap and outer face as geometry instead of floor checker. Its never-seen
 // side is drawn as the floor's secrecy checker on its own surfaces, never its own material (an outside face would
 // otherwise say "this is the building's outside"). Only pieces the host marks (setKnown) qualify;
 // what joins it or hangs on it from the far side stays checker.
 float known=uHasKnown>.5?texture2D(uKnown,vUv).r:0.;
 // (uExposure: 1 / the tone exposure when this pass runs before tone mapping, so the floor keeps its display colour)
 if(seen<.5 && known>.5 && depth<.999999){
   // (2026-10-18, Harry: the same checker as the never-seen floor, on the wall's own surfaces) face-aligned: the cap takes
   // the floor's xz squares, a vertical face its own (along-wall, height) squares, all in world feet, so squares stay
   // square and line up across neighbouring pieces; box-filtered like the floor; same colours, size and contrast knobs
   vec3 n=abs(normalize(cross(dFdx(surface),dFdy(surface))));
   vec2 fp=n.y>=max(n.x,n.z)?surface.xz:n.x>=n.z?surface.zy:surface.xy;
   float wc=uChecker.z>.5?checkerAt(fp,uChecker.x):1.;
   gl_FragColor=vec4(uBaseCol*mix(pow(max(0.,1.-uChecker.y),2.2),1.,wc)*uExposure,1.);
 }else if(seen<.5 && alpha>.999){
   gl_FragColor=vec4(unseenOut*uExposure,1.);
 }else{
   vec4 picture=texture2D(uPicture,vUv);
   vec3 fogCol=mix(exploredCol,unseenOut,smoothstep(mist+.01,.99,alpha))*uExposure;
   gl_FragColor=vec4(mix(picture.rgb,fogCol,alpha),picture.a);
 }
 #include <colorspace_fragment>
}`;

export function createFogWar({ renderer, camera, scene: sourceScene = null, decorative = () => true, flow = () => null, roll = () => null }) {
  let P = normFogWar(FOGWAR_DEFAULTS);
  let texture = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  texture.needsUpdate = true;
  const _c = new THREE.Color();
  const linVec = (hex) => { _c.set(hex || '#575b5d'); return new THREE.Vector3(_c.r, _c.g, _c.b); };
  const uniforms = {
    uFlyers:{value:texture},uHasFlyers:{value:0},uRoll:{value:texture},uRollB:{value:new THREE.Vector4(0,0,1,1)},uRollN:{value:new THREE.Vector2(1,1)},uHasRoll:{value:0},uKnown:{value:texture},uHasKnown:{value:0},uPicture:{value:null},uDepth:{value:null},uMask:{value:texture},
    uProjInv:{value:new THREE.Matrix4()},uCamera:{value:new THREE.Matrix4()},
    uFlow:{value:texture},uHasFlow:{value:0},uFlowBounds:{value:new THREE.Vector4(0,0,1,1)},
    uAtlasSize:{value:new THREE.Vector2(1,1)},uLevelBounds:{value:Array.from({length:16},()=>new THREE.Vector4(0,0,1,1))},
    uLevelTiles:{value:Array.from({length:16},()=>new THREE.Vector4(0,0,1,1))},uLevelY:{value:new Array(16).fill(0)},uLevelCount:{value:1},uChanged:{value:-1},
    uFloor:{value:0},uTime:{value:0},uDecorative:{value:1},uVeilDen:{value:P.veil.density},uExposure:{value:1},
    uChecker:{value:new THREE.Vector3(P.base.checkerSize,P.base.checkerContrast,P.base.style==='checker'?1:0)},
    uBaseCol:{value:linVec(P.base.color)},
    uVeilCol:{value:new THREE.Vector3(.095,.104,.11)},
    uFeather:{value:new THREE.Vector2(P.edge.feather,P.edge.falloff)},
  };
  function syncUniforms() {
    uniforms.uChecker.value.set(P.base.checkerSize ?? 2.5, P.base.checkerContrast ?? 0.14, P.base.style === 'solid' ? 0 : 1);
    uniforms.uBaseCol.value.copy(linVec(P.base.color || '#575b5d'));
    // Veil tint in the final pass stays anchored near neutral slate while following veil.color
    const vc = linVec(P.veil.color || '#b4c0cc');
    uniforms.uVeilCol.value.set(0.065 + vc.x * 0.06, 0.07 + vc.y * 0.06, 0.072 + vc.z * 0.06);
    uniforms.uFeather.value.set(P.edge.feather ?? 3.5, P.edge.falloff ?? 0.55);
    uniforms.uVeilDen.value = P.veil.density ?? 0.36;
  }
  syncUniforms();
  const material = new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms,depthTest:false,depthWrite:false,toneMapped:false,extensions:{derivatives:true}});
  const scene = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
  quad.frustumCulled=false;scene.add(quad);
  const flatCamera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  let revision=null, uploads=0, override=null, plain=null, aux=null, plainPrevious=null, priorLevels=[], flyers=[], overlays=[], flyerTarget=null, packMs=0, spareData=null;
  const size=new THREE.Vector2();
  const flyerU={twDepth:{value:null},twSize:{value:new THREE.Vector2()},twNear:{value:.1},twFar:{value:1000},twOrtho:{value:0}};
  // The original depth identifies actual opaque figure fragments, including
  // holes in alpha-tested figures. Requiring equality (not just nearer-than)
  // rejects both wall-occluded fragments AND hypothetical faces in cutout holes.
  const flyerMaterial=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false,depthTest:false,depthWrite:false,side:THREE.DoubleSide});
  flyerMaterial.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,flyerU);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform sampler2D twDepth;uniform vec2 twSize;uniform float twNear,twFar,twOrtho;
      float twViewZ(float d){return twOrtho>.5?mix(-twNear,-twFar,d):(twNear*twFar)/((twFar-twNear)*d-twFar);}`)
      .replace('#include <opaque_fragment>',`float sceneZ=twViewZ(texture2D(twDepth,gl_FragCoord.xy/twSize).r);
      if(abs(twViewZ(gl_FragCoord.z)-sceneZ)>.025)discard;
      #include <opaque_fragment>`);
  };
  function flyerMask(r,input,depth,viewCamera,world){
    uniforms.uHasFlyers.value=0;
    if(!world||!flyers.length)return;
    const active=[];
    for(const root of flyers)if(root?.visible)root.traverseVisible(o=>{if(o.isMesh)active.push([o,o.layers.mask]);});
    if(!active.length)return;
    const w=input.width,h=input.height;
    if(!flyerTarget)flyerTarget=new THREE.WebGLRenderTarget(w,h,{format:THREE.RedFormat,type:THREE.UnsignedByteType,depthBuffer:false,stencilBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
    if(flyerTarget.width!==w||flyerTarget.height!==h)flyerTarget.setSize(w,h);
    flyerU.twDepth.value=depth;flyerU.twSize.value.set(w,h);flyerU.twNear.value=viewCamera.near;flyerU.twFar.value=viewCamera.far;flyerU.twOrtho.value=viewCamera.isOrthographicCamera?1:0;
    const previous={target:r.getRenderTarget(),clear:r.getClearColor(new THREE.Color()),alpha:r.getClearAlpha(),auto:r.autoClear,scissor:r.getScissorTest(),background:world.background,override:world.overrideMaterial,layers:viewCamera.layers.mask,shadows:r.shadowMap.autoUpdate};
    try{
      for(const [o] of active)o.layers.enable(31);
      viewCamera.layers.set(31);world.background=null;world.overrideMaterial=flyerMaterial;r.shadowMap.autoUpdate=false;
      r.setRenderTarget(flyerTarget);r.setScissorTest(false);r.setClearColor(0,0);r.clear(true,false,false);r.autoClear=false;r.render(world,viewCamera);
    }finally{
      for(const [o,mask] of active)o.layers.mask=mask;
      viewCamera.layers.mask=previous.layers;world.background=previous.background;world.overrideMaterial=previous.override;r.shadowMap.autoUpdate=previous.shadows;
      r.setClearColor(previous.clear,previous.alpha);r.autoClear=previous.auto;r.setRenderTarget(previous.target);r.setScissorTest(previous.scissor);
    }
    uniforms.uFlyers.value=flyerTarget.texture;uniforms.uHasFlyers.value=1;
  }
  let known=[],knownTarget=null;
  function knownMask(r,input,depth,viewCamera,world){
    uniforms.uHasKnown.value=0;
    if(!world||!known.length)return;
    const active=[];
    for(const root of known)if(root?.visible)root.traverseVisible(o=>{if(o.isMesh)active.push([o,o.layers.mask]);});
    if(!active.length)return;
    const w=input.width,h=input.height;
    if(!knownTarget)knownTarget=new THREE.WebGLRenderTarget(w,h,{format:THREE.RedFormat,type:THREE.UnsignedByteType,depthBuffer:false,stencilBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
    if(knownTarget.width!==w||knownTarget.height!==h)knownTarget.setSize(w,h);
    flyerU.twDepth.value=depth;flyerU.twSize.value.set(w,h);flyerU.twNear.value=viewCamera.near;flyerU.twFar.value=viewCamera.far;flyerU.twOrtho.value=viewCamera.isOrthographicCamera?1:0;
    const previous={target:r.getRenderTarget(),clear:r.getClearColor(new THREE.Color()),alpha:r.getClearAlpha(),auto:r.autoClear,scissor:r.getScissorTest(),background:world.background,override:world.overrideMaterial,layers:viewCamera.layers.mask,shadows:r.shadowMap.autoUpdate};
    try{
      for(const [o] of active)o.layers.enable(29);
      viewCamera.layers.set(29);world.background=null;world.overrideMaterial=flyerMaterial;r.shadowMap.autoUpdate=false;
      r.setRenderTarget(knownTarget);r.setScissorTest(false);r.setClearColor(0,0);r.clear(true,false,false);r.autoClear=false;r.render(world,viewCamera);
    }finally{
      for(const [o,mask] of active)o.layers.mask=mask;
      viewCamera.layers.mask=previous.layers;world.background=previous.background;world.overrideMaterial=previous.override;r.shadowMap.autoUpdate=previous.shadows;
      r.setClearColor(previous.clear,previous.alpha);r.autoClear=previous.auto;r.setRenderTarget(previous.target);r.setScissorTest(previous.scissor);
    }
    uniforms.uKnown.value=knownTarget.texture;uniforms.uHasKnown.value=1;
  }
  function drawOverlays(r,viewCamera,world){
    if(!world||!overlays.length)return;
    const active=[],materials=new Map();
    for(const root of overlays)if(root?.visible)root.traverseVisible(o=>{if(o.isMesh||o.isLine||o.isSprite){active.push([o,o.layers.mask]);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m&&!materials.has(m))materials.set(m,[m.depthTest,m.depthWrite]);}});
    if(!active.length)return;
    const previous={auto:r.autoClear,background:world.background,override:world.overrideMaterial,layers:viewCamera.layers.mask,shadows:r.shadowMap.autoUpdate};
    try{
      for(const [o] of active)o.layers.enable(30);
      for(const [m] of materials){m.depthTest=false;m.depthWrite=false;}
      viewCamera.layers.set(30);world.background=null;world.overrideMaterial=null;r.shadowMap.autoUpdate=false;r.autoClear=false;
      // Draw the actual translucent line/fill over grey. Never exempt its shape
      // from the fog mask: that would reveal the world underneath a template.
      r.render(world,viewCamera);
    }finally{
      for(const [o,mask] of active)o.layers.mask=mask;
      for(const [m,[test,write]] of materials){m.depthTest=test;m.depthWrite=write;}
      viewCamera.layers.mask=previous.layers;world.background=previous.background;world.overrideMaterial=previous.override;r.shadowMap.autoUpdate=previous.shadows;r.autoClear=previous.auto;
    }
  }
  // overlaysNow false: the host draws them later (drawLateOverlays), after tone mapping, when this pass runs early
  function draw(r,input,depth,target,viewCamera=camera,world=sourceScene,exposure=1,overlaysNow=true){
    flyerMask(r,input,depth,viewCamera,world);knownMask(r,input,depth,viewCamera,world);
    uniforms.uPicture.value=input.texture;uniforms.uDepth.value=depth;
    uniforms.uProjInv.value.copy(viewCamera.projectionMatrixInverse);uniforms.uCamera.value.copy(viewCamera.matrixWorld);
    const f=flow();uniforms.uHasFlow.value=f?1:0;if(f){uniforms.uFlow.value=f.texture;uniforms.uFlowBounds.value.fromArray(f.bounds);}
    const dec=(override??decorative())?1:0;
    const rf=dec?roll():null;uniforms.uHasRoll.value=rf?1:0;if(rf){uniforms.uRoll.value=rf.texture;uniforms.uRollB.value.fromArray(rf.bounds);uniforms.uRollN.value.fromArray(rf.size);}
    uniforms.uDecorative.value=dec;
    uniforms.uExposure.value=1/Math.max(.05,exposure||1);
    r.setRenderTarget(target);r.render(scene,flatCamera);if(overlaysNow)drawOverlays(r,viewCamera,world);
  }
  class FogWarPass extends Pass {
    // early: the host (lighting.js) runs this pass BEFORE the atmosphere and tone mapping, so the war fog is drawn over
    // the secrecy floor in the same light as everything else; exposure = that tone exposure; overlays come later.
    constructor(){super('FogWarPass');this.needsSwap=true;this.needsDepthTexture=true;this.enabled=false;this.depth=null;this.early=false;this.exposure=1;}
    setDepthTexture(t){this.depth=t;}
    // after the composer (the pass ran early): rulers, cursors and labels over the finished picture
    drawLateOverlays(target=null){if(!this.enabled||!this.early)return;const t=renderer.getRenderTarget();renderer.setRenderTarget(target);drawOverlays(renderer,camera,sourceScene);renderer.setRenderTarget(t);}
    render(r,input,output){if(this.depth)draw(r,input,this.depth,this.renderToScreen?null:output,camera,sourceScene,this.early?this.exposure:1,!this.early);}
  }
  const pass=new FogWarPass();
  function levelForY(y=uniforms.uFloor.value){
    if(!priorLevels.length)return null;
    let pick=priorLevels[0];
    for(let i=1;i<priorLevels.length;i++)if(y+.08>=priorLevels[i].y)pick=priorLevels[i];
    return pick;
  }
  return {
    pass,
    get params(){return P;},
    set(p){P=normFogWar(p);syncUniforms();},
    apply:syncUniforms,
    get enabled(){return pass.enabled;},
    visionState(y=uniforms.uFloor.value){
      const L=levelForY(y);
      if(!pass.enabled||!L)return null;
      const idx=priorLevels.indexOf(L);
      return {
        on:pass.enabled,
        texture,
        atlasSize:uniforms.uAtlasSize.value,
        bounds:uniforms.uLevelBounds.value[idx],
        tile:uniforms.uLevelTiles.value[idx],
        floorY:L.y,
        revision,
        params:P,
      };
    },
    isPointVisible(x,z,y=uniforms.uFloor.value){
      if(!pass.enabled||!priorLevels.length)return true;
      const L=levelForY(y);if(!L)return false;
      const [x0,z0,x1,z1]=L.bounds;
      const ix=Math.floor((x-x0)/Math.max(.001,x1-x0)*L.width),iz=Math.floor((z-z0)/Math.max(.001,z1-z0)*L.height);
      if(ix<0||iz<0||ix>=L.width||iz>=L.height)return false;
      return texture.image.data[((L.row+iz)*texture.image.width+ix)*4]>=128;
    },
    isPointSeen(x,z,y=uniforms.uFloor.value){
      if(!pass.enabled||!priorLevels.length)return true;
      const L=levelForY(y);if(!L)return false;
      const [x0,z0,x1,z1]=L.bounds;
      const ix=Math.floor((x-x0)/Math.max(.001,x1-x0)*L.width),iz=Math.floor((z-z0)/Math.max(.001,z1-z0)*L.height);
      if(ix<0||iz<0||ix>=L.width||iz>=L.height)return false;
      const o=((L.row+iz)*texture.image.width+ix)*4;
      return texture.image.data[o]>=128||texture.image.data[o+1]>=128;
    },
    setState(state){
      const wasEnabled=pass.enabled;pass.enabled=!!state?.enabled;if(!pass.enabled){revision=null;return;}
      if(wasEnabled&&state.revision!=null&&state.revision===revision)return;
      const packStart=performance.now();
      const levels=(state.levels?.length?state.levels:[state]).slice().sort((a,b)=>(a.floorY||0)-(b.floorY||0));
      if(levels.length>16)throw new Error('Fog visibility supports at most 16 viewed levels');
      let width=1,height=0;
      for(const L of levels){
        if(!L.width||!L.height||!L.data||!L.bounds)throw new Error('Fog visibility needs width, height, RGBA data and bounds');
        if(L.data.length!==L.width*L.height*4)throw new Error('Fog visibility RGBA size mismatch');
        width=Math.max(width,L.width);height+=L.height;
      }
      if(width>renderer.capabilities.maxTextureSize||height>renderer.capabilities.maxTextureSize)throw new Error('Fog visibility atlas exceeds GPU texture size');
      const oldData=texture.image.data,oldWidth=texture.image.width;
      const packed=spareData?.length===width*height*4?spareData:new Uint8Array(width*height*4);
      const words=new Uint32Array(packed.buffer),oldWords=new Uint32Array(oldData.buffer,oldData.byteOffset,oldData.byteLength/4);
      const fraction=Math.max(0,Math.min(1,(uniforms.uTime.value-uniforms.uChanged.value)/.42));
      const snap=!wasEnabled||state.snap===true;
      const next=[];let row=0;
      for(let i=0;i<levels.length;i++){
        const L=levels[i],bounds=L.bounds,y=L.floorY||0;
        uniforms.uLevelBounds.value[i].set(bounds[0],bounds[1],Math.max(.001,bounds[2]-bounds[0]),Math.max(.001,bounds[3]-bounds[1]));
        uniforms.uLevelTiles.value[i].set(0,row/height,L.width/width,L.height/height);uniforms.uLevelY.value[i]=y;
        const previous=priorLevels.find(p=>p.y===y&&p.width===L.width&&p.height===L.height&&p.bounds.every((v,k)=>v===bounds[k]));
        // Native row copies keep a large fine mask's upload preparation cheap.
        // The input owns R/G; only the transition's B byte needs arithmetic.
        if(L.width===width)packed.set(L.data,row*width*4);
        else for(let z=0;z<L.height;z++)packed.set(L.data.subarray(z*L.width*4,(z+1)*L.width*4),(z+row)*width*4);
        if(!snap){
          const complete=fraction>=1,keep=1-fraction;
          for(let z=0;z<L.height;z++){
            const dst=(z+row)*width,src=previous?(z+previous.row)*oldWidth:0;
            if(previous){
              for(let x=0;x<L.width;x++){
                const v=oldWords[src+x],target=(v&255)>=128?0:((v>>>8)&255)>=128?186:255;
                const alpha=complete?target:((((v>>>16)&255)*keep+target*fraction+.5)|0);
                words[dst+x]=(words[dst+x]&65535)|(alpha<<16)|0xff000000;
              }
            }else for(let x=0;x<L.width;x++)words[dst+x]|=0xffff0000;
          }
        }
        next.push({y,width:L.width,height:L.height,bounds:[...bounds],row});row+=L.height;
      }
      priorLevels=next;revision=state.revision;spareData=oldData;
      uniforms.uAtlasSize.value.set(width,height);uniforms.uLevelCount.value=levels.length;uniforms.uFloor.value=state.floorY??levels.at(-1).floorY??0;
      uniforms.uChanged.value=snap?uniforms.uTime.value-1:uniforms.uTime.value;
      if(texture.image.width!==width||texture.image.height!==height){texture.dispose();texture=new THREE.DataTexture(packed,width,height,THREE.RGBAFormat);texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;uniforms.uMask.value=texture;}else texture.image.data=packed;
      texture.needsUpdate=true;uploads++;packMs=performance.now()-packStart;
    },
    setFlyers(roots){flyers=roots||[];},
    // wall pieces whose face the viewer has seen: known through their thickness (cap and far face drawn, see the shader)
    setKnown(roots){known=roots||[];},
    knownTexture:()=>uniforms.uHasKnown.value?uniforms.uKnown.value:null,
    setOverlays(roots){overlays=roots||[];},
    setDecorative(value){override=value==null?null:!!value;},
    frame(dt,now){uniforms.uTime.value=now*.001;},
    // A plain render still needs depth. The host encloses ALL plain decorations
    // between these calls, so smoke cannot draw over an opaque unseen region.
    beginPlain(){
      if(!pass.enabled)return false;
      renderer.getDrawingBufferSize(size);
      if(!plain){plain=new THREE.WebGLRenderTarget(size.x,size.y);plain.depthTexture=new THREE.DepthTexture(size.x,size.y);}
      if(plain.width!==size.x||plain.height!==size.y)plain.setSize(size.x,size.y);
      plainPrevious=renderer.getRenderTarget();renderer.setRenderTarget(plain);return true;
    },
    endPlain(){draw(renderer,plain,plain.depthTexture,plainPrevious,camera,sourceScene);},
    drawLateOverlays:(target=null)=>pass.drawLateOverlays(target),
    // Auxiliary cameras (follow PiP): preserve the caller's viewport/scissor.
    renderPlain(sourceScene,viewCamera){
      if(!pass.enabled){renderer.render(sourceScene,viewCamera);return;}
      const vp=renderer.getViewport(new THREE.Vector4()), sc=renderer.getScissor(new THREE.Vector4()), st=renderer.getScissorTest();
      const target=renderer.getRenderTarget(), ratio=renderer.getPixelRatio();
      const w=Math.max(1,Math.round(vp.z*ratio)),h=Math.max(1,Math.round(vp.w*ratio));
      if(!aux){aux=new THREE.WebGLRenderTarget(w,h);aux.depthTexture=new THREE.DepthTexture(w,h);}else if(aux.width!==w||aux.height!==h)aux.setSize(w,h);
      renderer.setRenderTarget(aux);renderer.setScissorTest(false);renderer.render(sourceScene,viewCamera);
      renderer.setRenderTarget(target);renderer.setViewport(vp);renderer.setScissor(sc);renderer.setScissorTest(st);
      draw(renderer,aux,aux.depthTexture,target,viewCamera,sourceScene);
    },
    stats:()=>({fogwar_on:pass.enabled,fogwar_decorative:override??decorative(),fogwar_uploads:uploads,fogwar_pack_ms:packMs,fogwar_levels:priorLevels.length,fogwar_flyers:flyers.length,fogwar_known:known.length,fogwar_overlays:overlays.length,fogwar_transition:uniforms.uTime.value-uniforms.uChanged.value<.42,fogwar_size:[texture.image.width,texture.image.height]}),
    dispose(){texture.dispose();plain?.dispose();aux?.dispose();flyerTarget?.dispose();knownTarget?.dispose();flyerMaterial.dispose();quad.geometry.dispose();material.dispose();},
  };
}
