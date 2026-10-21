// src/index.ts
import { KernelSize as KernelSize2, Pass as Pass4 } from "postprocessing";
import * as THREE5 from "three";

// src/fullscreenPassCamera.ts
import * as THREE from "three";
var FullscreenPassCamera = class extends THREE.Camera {
  updateProjectionMatrix() {
  }
};

// src/bilateralFilter.ts
import { KernelSize, Pass } from "postprocessing";
import * as THREE2 from "three";

// src/bilateralFilter.frag
var bilateralFilter_default = `uniform sampler2D tInput;uniform vec2 resolution;uniform float bSigma;varying vec2 vUv;
#if (KSIZE_ENUM == 0)
#define KSIZE 2
#define MSIZE 5
const float kernel[MSIZE]=float[MSIZE](0.,0.24196934138575799,0.39894,0.24196934138575799,0.);
#elif (KSIZE_ENUM == 1)
#define KSIZE 3
#define MSIZE 7
const float kernel[MSIZE]=float[MSIZE](0.,0.39104045872899694,0.3969502784491287,0.39894,0.3969502784491287,0.39104045872899694,0.);
#elif (KSIZE_ENUM == 2)
#define KSIZE 4
#define MSIZE 9
const float kernel[MSIZE]=float[MSIZE](0.,0.3813856354024969,0.39104045872899694,0.3969502784491287,0.39894,0.3969502784491287,0.39104045872899694,0.3813856354024969,0.);
#elif (KSIZE_ENUM == 3)
#define KSIZE 5
#define MSIZE 11
const float kernel[MSIZE]=float[MSIZE](0.,0.03682680352274845,0.03813856354024969,0.039104045872899694,0.03969502784491287,0.039894,0.03969502784491287,0.039104045872899694,0.03813856354024969,0.03682680352274845,0.);
#elif (KSIZE_ENUM == 4)
#define KSIZE 6
#define MSIZE 13
const float kernel[MSIZE]=float[MSIZE](0.,0.035206331431709856,0.03682680352274845,0.03813856354024969,0.039104045872899694,0.03969502784491287,0.039894,0.03969502784491287,0.039104045872899694,0.03813856354024969,0.03682680352274845,0.035206331431709856,0.);
#elif (KSIZE_ENUM == 5)
#define KSIZE 7
#define MSIZE 15
const float kernel[MSIZE]=float[MSIZE](0.031225216,0.033322271,0.035206333,0.036826804,0.038138565,0.039104044,0.039695028,0.039894000,0.039695028,0.039104044,0.038138565,0.036826804,0.035206333,0.033322271,0.031225216);
#endif
float normpdf(in float x,in float sigma){return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;}void main(){ivec2 fragCoord=ivec2(vUv*resolution);vec4 centerSample=texelFetch(tInput,fragCoord,0);
#if defined(DEBUG_STEPS)
gl_FragColor=centerSample;
#else
float c=centerSample.r;float finalValue=0.;float bZ=1.0/normpdf(0.0,bSigma);float totalFactor=0.;for(int i=-KSIZE;i<=KSIZE;++i){for(int j=-KSIZE;j<=KSIZE;++j){float cc=texelFetch(tInput,fragCoord+ivec2(i,j),0).r;float factor=normpdf(cc-c,bSigma)*bZ*kernel[KSIZE+j]*kernel[KSIZE+i];totalFactor+=factor;finalValue+=factor*cc;}}gl_FragColor=vec4(vec3(finalValue/totalFactor),centerSample.a);
#endif
}`;

// src/compositor.vert
var compositor_default = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

// src/bilateralFilter.ts
var GODRAYS_BLUR_RESOLUTION_SCALE = 1;
var BilateralFilterMaterial = class extends THREE2.ShaderMaterial {
  constructor(input) {
    super({
      uniforms: {
        tInput: { value: input },
        resolution: {
          value: new THREE2.Vector2(
            input.image.width * GODRAYS_BLUR_RESOLUTION_SCALE,
            input.image.height * GODRAYS_BLUR_RESOLUTION_SCALE
          )
        },
        bSigma: { value: 0 }
      },
      defines: {
        KSIZE_ENUM: KernelSize.SMALL
      },
      depthWrite: false,
      depthTest: false,
      vertexShader: compositor_default,
      fragmentShader: bilateralFilter_default
    });
  }
};
var BilateralFilterPass = class extends Pass {
  constructor(input) {
    super("BilateralFilterPass", void 0, new FullscreenPassCamera());
    this.needsSwap = false;
    this.material = new BilateralFilterMaterial(input);
    this.fullscreenMaterial = this.material;
  }
  setSize(width, height) {
    this.material.uniforms.resolution.value.set(width, height);
  }
  render(renderer, _inputBuffer, outputBuffer, _deltaTime, _stencilTest) {
    renderer.setRenderTarget(outputBuffer);
    renderer.render(this.scene, this.camera);
  }
  updateUniforms(params) {
    this.material.uniforms.bSigma.value = params.variance;
    this.material.defines.KSIZE_ENUM = params.kernelSize;
  }
  updateDebugSteps(enabled) {
    const has = this.material.defines.DEBUG_STEPS !== void 0;
    if (enabled && !has) {
      this.material.defines.DEBUG_STEPS = "";
      this.material.needsUpdate = true;
    } else if (!enabled && has) {
      delete this.material.defines.DEBUG_STEPS;
      this.material.needsUpdate = true;
    }
  }
  dispose() {
    this.material.dispose();
    super.dispose();
  }
};

// src/compositorPass.ts
import { Pass as Pass2 } from "postprocessing";
import * as THREE3 from "three";

// src/compositor.frag
var compositor_default2 = `#include <common>
uniform sampler2D godrays;uniform sampler2D sceneDiffuse;uniform sampler2D sceneDepth;uniform vec2 resolution;uniform vec2 godraysResolution;uniform float near;uniform float far;uniform vec3 color;uniform bool gammaCorrection;varying vec2 vUv;
#define DITHERING
#include <dithering_pars_fragment>
float linearize_depth(float depth,float zNear,float zFar){
#if defined( USE_LOGDEPTHBUF ) || defined( USE_LOGARITHMIC_DEPTH_BUFFER )
float d=pow(2.0,depth*log2(far+1.0))-1.0;float a=far/(far-near);float b=far*near/(near-far);depth=a+b/d;
#elif defined( USE_REVERSED_DEPTH_BUFFER )
depth=1.0-depth;
#endif
return zNear*zFar/(zFar+depth*(zNear-zFar));}vec4 LinearTosRGB_(in vec4 value){return vec4(mix(pow(value.rgb,vec3(0.41666))*1.055-vec3(0.055),value.rgb*12.92,vec3(lessThanEqual(value.rgb,vec3(0.0031308)))),value.a);}void main(){float rawDepth=texture2D(sceneDepth,vUv).x;float correctDepth=linearize_depth(rawDepth,near,far);vec2 texelSize=1.0/godraysResolution;vec2 texelPos=vUv*godraysResolution-0.5;vec2 base=floor(texelPos);vec2 f=texelPos-base;float totalWeight=0.0;float totalIllum=0.0;for(int y=-JBU_EXTENT;y<=1+JBU_EXTENT;y++){for(int x=-JBU_EXTENT;x<=1+JBU_EXTENT;x++){vec2 sampleUv=(base+vec2(float(x),float(y))+0.5)*texelSize;vec4 data=texture2D(godrays,sampleUv);float sampleDepth=data.a;vec2 d=vec2(float(x),float(y))-f;float spatialW=exp(-dot(d,d)/(2.0*JBU_SPATIAL_SIGMA*JBU_SPATIAL_SIGMA));float depthDiff=(sampleDepth-correctDepth)/max(correctDepth,0.001);float depthW=exp(-0.5*depthDiff*depthDiff/(JBU_DEPTH_SIGMA*JBU_DEPTH_SIGMA));float w=spatialW*depthW;totalWeight+=w;totalIllum+=data.r*w;}}float bestChoice=totalWeight>0.0?totalIllum/totalWeight:0.0;vec4 diffuse=texture2D(sceneDiffuse,vUv);
#if defined(DEBUG_STEPS)
vec3 totalColor=vec3(0.0);float totalColorWeight=0.0;for(int y=-JBU_EXTENT;y<=1+JBU_EXTENT;y++){for(int x=-JBU_EXTENT;x<=1+JBU_EXTENT;x++){vec2 sampleUv=(base+vec2(float(x),float(y))+0.5)*texelSize;vec4 data=texture2D(godrays,sampleUv);float sampleDepth=data.a;vec2 d=vec2(float(x),float(y))-f;float spatialW=exp(-dot(d,d)/(2.0*JBU_SPATIAL_SIGMA*JBU_SPATIAL_SIGMA));float depthDiff=(sampleDepth-correctDepth)/max(correctDepth,0.001);float depthW=exp(-0.5*depthDiff*depthDiff/(JBU_DEPTH_SIGMA*JBU_DEPTH_SIGMA));float w=spatialW*depthW;totalColorWeight+=w;totalColor+=data.rgb*w;}}gl_FragColor=vec4(totalColorWeight>0.0?totalColor/totalColorWeight:vec3(0.0),diffuse.a);
#else
gl_FragColor=vec4(mix(diffuse.rgb,color,bestChoice),diffuse.a);
#endif
#include <dithering_fragment>
if(gammaCorrection){gl_FragColor=LinearTosRGB_(gl_FragColor);}}`;

// src/compositorPass.ts
var GodraysCompositorMaterial = class extends THREE3.ShaderMaterial {
  constructor({
    godrays,
    color,
    camera,
    gammaCorrection,
    upsampleQuality
  }) {
    const uniforms = {
      godrays: { value: godrays },
      sceneDiffuse: { value: null },
      sceneDepth: { value: null },
      near: { value: 0.1 },
      far: { value: 1e3 },
      color: { value: color },
      resolution: { value: new THREE3.Vector2(1, 1) },
      godraysResolution: { value: new THREE3.Vector2(1, 1) },
      gammaCorrection: { value: 1 }
    };
    const jbuExtent = upsampleQuality >= 1 ? 1 : 0;
    const jbuSpatialSigma = jbuExtent === 1 ? 1 : 0.5;
    super({
      name: "GodraysCompositorMaterial",
      uniforms,
      depthWrite: false,
      depthTest: false,
      fragmentShader: compositor_default2,
      vertexShader: compositor_default,
      defines: {
        JBU_EXTENT: String(jbuExtent),
        JBU_SPATIAL_SIGMA: jbuSpatialSigma.toFixed(1),
        JBU_DEPTH_SIGMA: "0.02"
      }
    });
    this.updateUniforms(color, gammaCorrection, camera.near, camera.far);
  }
  updateUniforms(color, gammaCorrection, near, far) {
    this.uniforms.color.value = color;
    this.uniforms.near.value = near;
    this.uniforms.far.value = far;
    this.uniforms.gammaCorrection.value = gammaCorrection ? 1 : 0;
  }
  setSize(width, height) {
    this.uniforms.resolution.value.set(width, height);
  }
  setGodraysResolution(width, height) {
    this.uniforms.godraysResolution.value.set(width, height);
  }
};
var GodraysCompositorPass = class extends Pass2 {
  constructor(props) {
    super("GodraysCompositorPass", void 0, new FullscreenPassCamera());
    this.depthCopyTarget = null;
    this.fullscreenMaterial = new GodraysCompositorMaterial(props);
    this.sceneCamera = props.camera;
  }
  updateUniforms(params) {
    this.fullscreenMaterial.updateUniforms(
      params.color,
      params.gammaCorrection,
      this.sceneCamera.near,
      this.sceneCamera.far
    );
  }
  updateDebugSteps(enabled) {
    const mat = this.fullscreenMaterial;
    const has = mat.defines.DEBUG_STEPS !== void 0;
    if (enabled && !has) {
      mat.defines.DEBUG_STEPS = "";
      mat.needsUpdate = true;
    } else if (!enabled && has) {
      delete mat.defines.DEBUG_STEPS;
      mat.needsUpdate = true;
    }
  }
  updateUpsampleQuality(quality) {
    const mat = this.fullscreenMaterial;
    const jbuExtent = quality >= 1 ? 1 : 0;
    const jbuSpatialSigma = jbuExtent === 1 ? 1 : 0.5;
    const needsUpdate = mat.defines.JBU_EXTENT !== String(jbuExtent);
    if (needsUpdate) {
      mat.defines.JBU_EXTENT = String(jbuExtent);
      mat.defines.JBU_SPATIAL_SIGMA = jbuSpatialSigma.toFixed(1);
      mat.needsUpdate = true;
    }
  }
  maybeInitDepthCopyTarget(width, height) {
    var _a;
    const needsRecreate = !this.depthCopyTarget || this.depthCopyTarget.width !== width || this.depthCopyTarget.height !== height;
    if (!needsRecreate) {
      return;
    }
    (_a = this.depthCopyTarget) == null ? void 0 : _a.dispose();
    this.depthCopyTarget = new THREE3.WebGLRenderTarget(width, height);
    this.depthCopyTarget.depthTexture = new THREE3.DepthTexture(
      width,
      height,
      THREE3.UnsignedIntType
    );
    this.depthCopyTarget.depthTexture.format = THREE3.DepthFormat;
    this.depthCopyTarget.depthTexture.compareFunction = null;
    this.depthCopyTarget.depthTexture.minFilter = THREE3.NearestFilter;
    this.depthCopyTarget.depthTexture.magFilter = THREE3.NearestFilter;
  }
  blitDepthTexture(renderer, sourceBuffer) {
    const gl = renderer.getContext();
    const sourceProps = renderer.properties.get(sourceBuffer);
    const srcFramebuffer = sourceProps.__webglFramebuffer;
    const copyTargetProps = renderer.properties.get(this.depthCopyTarget);
    let dstFramebuffer = copyTargetProps == null ? void 0 : copyTargetProps.__webglFramebuffer;
    if (!dstFramebuffer) {
      renderer.setRenderTarget(this.depthCopyTarget);
      renderer.clear();
      renderer.setRenderTarget(null);
      const updatedProps = renderer.properties.get(this.depthCopyTarget);
      dstFramebuffer = updatedProps.__webglFramebuffer;
    }
    if (!srcFramebuffer || !dstFramebuffer) {
      return;
    }
    const width = sourceBuffer.width;
    const height = sourceBuffer.height;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, srcFramebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dstFramebuffer);
    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }
  render(renderer, inputBuffer, outputBuffer, _deltaTime, _stencilTest) {
    this.fullscreenMaterial.uniforms.sceneDiffuse.value = inputBuffer.texture;
    const sceneDepth = this.fullscreenMaterial.uniforms.sceneDepth.value;
    if (sceneDepth && outputBuffer && outputBuffer.depthTexture && sceneDepth === outputBuffer.depthTexture) {
      this.maybeInitDepthCopyTarget(outputBuffer.width, outputBuffer.height);
      this.blitDepthTexture(renderer, outputBuffer);
      this.fullscreenMaterial.uniforms.sceneDepth.value = this.depthCopyTarget.depthTexture;
    }
    renderer.setRenderTarget(outputBuffer);
    renderer.render(this.scene, this.camera);
    this.fullscreenMaterial.uniforms.sceneDepth.value = sceneDepth;
  }
  setDepthTexture(depthTexture, depthPacking) {
    if (depthPacking && depthPacking !== THREE3.BasicDepthPacking) {
      throw new Error("Only BasicDepthPacking is supported");
    }
    this.fullscreenMaterial.uniforms.sceneDepth.value = depthTexture;
  }
  setSize(width, height) {
    this.fullscreenMaterial.setSize(width, height);
  }
  setGodraysResolution(width, height) {
    this.fullscreenMaterial.setGodraysResolution(width, height);
  }
};

// src/illumPass.ts
import { Pass as Pass3 } from "postprocessing";
import * as THREE4 from "three";

// src/godrays.frag
var godrays_default = `varying vec2 vUv;varying vec3 vWorldRay;uniform sampler2D sceneDepth;uniform vec3 lightPos;uniform vec3 cameraPos;uniform vec2 resolution;uniform mat4 cameraProjectionMatrixInv;uniform mat4 cameraMatrixWorld;
#if defined(USE_CUBE_SHADOWMAP)
uniform samplerCube shadowMap;
#else
uniform sampler2D shadowMap;
#endif
uniform float texelSizeY;uniform float lightCameraNear;uniform float lightCameraFar;uniform float near;uniform float far;uniform float density;uniform float maxDensity;uniform float distanceAttenuation;uniform vec3[6]fNormals;uniform float[6]fConstants;uniform float raymarchSteps;uniform float raymarchStepSize;uniform float minSteps;uniform float maxSteps;uniform float shadowTexelWorldSize;uniform mat4 premultipliedLightCameraMatrix;
#include <packing>
float linearize_depth(float depth,float zNear,float zFar){
#if defined( USE_LOGDEPTHBUF ) || defined( USE_LOGARITHMIC_DEPTH_BUFFER )
float d=pow(2.0,depth*log2(zFar+1.0))-1.0;float a=zFar/(zFar-zNear);float b=zFar*zNear/(zNear-zFar);depth=a+b/d;
#elif defined( USE_REVERSED_DEPTH_BUFFER )
depth=1.0-depth;
#endif
return zNear*zFar/(zFar+depth*(zNear-zFar));}vec3 WorldPosFromDepth(float depth){
#if defined( USE_LOGDEPTHBUF ) || defined( USE_LOGARITHMIC_DEPTH_BUFFER )
float d=pow(2.0,depth*log2(far+1.0))-1.0;float a=far/(far-near);float b=far*near/(near-far);depth=a+b/d;
#endif
#if defined( USE_REVERSED_DEPTH_BUFFER )
float ndcZ=depth;
#else
float ndcZ=depth*2.0-1.0;
#endif
float invW=1.0/(cameraProjectionMatrixInv[2][3]*ndcZ+cameraProjectionMatrixInv[3][3]);return vWorldRay*invW+cameraMatrixWorld[3].xyz;}vec2 cubeToUV(vec3 v){vec3 absV=abs(v);float scaleToCube=1.0/max(absV.x,max(absV.y,absV.z));absV*=scaleToCube;v*=scaleToCube*(1.0-2.0*texelSizeY);vec2 planar=v.xy;float almostATexel=1.5*texelSizeY;float almostOne=1.0-almostATexel;if(absV.z>=almostOne){if(v.z>0.0)planar.x=4.0-v.x;}else if(absV.x>=almostOne){float signX=sign(v.x);planar.x=v.z*signX+2.0*signX;}else if(absV.y>=almostOne){float signY=sign(v.y);planar.x=v.x+2.0*signY+2.0;planar.y=v.z*signY-2.0;}return vec2(0.125,0.25)*planar+vec2(0.375,0.75);}vec3 projectToShadowMap(vec3 worldPos){vec4 lightSpacePos=premultipliedLightCameraMatrix*vec4(worldPos,1.0);lightSpacePos/=lightSpacePos.w;
#if defined( USE_REVERSED_DEPTH_BUFFER )
return vec3(lightSpacePos.xy*0.5+0.5,1.0-lightSpacePos.z);
#else
return lightSpacePos.xyz*0.5+0.5;
#endif
}vec2 inShadow(vec3 worldPos){
#if defined(USE_CUBE_SHADOWMAP)
vec3 lightToPos=worldPos-lightPos;float lightDist=length(lightToPos);float shadowMapDepth=textureCube(shadowMap,lightToPos).r;float depth=lightCameraNear+(lightCameraFar-lightCameraNear)*shadowMapDepth;return vec2(float(lightDist>depth+0.005),lightDist);
#else
#if defined(IS_POINT_LIGHT)
vec2 shadowMapUV=cubeToUV(normalize(worldPos-lightPos));
#elif defined(IS_DIRECTIONAL_LIGHT)
vec3 shadowMapUV=projectToShadowMap(worldPos);bool isOutsideShadowMap=shadowMapUV.x<0.0||shadowMapUV.x>1.0||shadowMapUV.y<0.0||shadowMapUV.y>1.0||shadowMapUV.z<0.0||shadowMapUV.z>1.0;if(isOutsideShadowMap){return vec2(1.0,0.0);}
#endif
vec4 packedDepth=texture2D(shadowMap,shadowMapUV.xy);
#if defined( USE_UNPACKED_DEPTH )
#if defined(IS_DIRECTIONAL_LIGHT)
float depth=packedDepth.x;
#else
float depth=1.-packedDepth.x;
#endif
#else
float depth=unpackRGBAToDepth(packedDepth);
#endif
#if defined( USE_REVERSED_DEPTH_BUFFER ) && defined( IS_DIRECTIONAL_LIGHT )
depth=1.0-depth;
#endif
depth=lightCameraNear+(lightCameraFar-lightCameraNear)*depth;
#if defined(IS_POINT_LIGHT)
float lightDist=distance(worldPos,lightPos);
#elif defined(IS_DIRECTIONAL_LIGHT)
float lightDist=(lightCameraNear+(lightCameraFar-lightCameraNear)*shadowMapUV.z);
#endif
float difference=lightDist-depth;return vec2(float(difference>0.0),lightDist);
#endif
}float sdPlane(vec3 p,vec3 n,float h){return dot(p,n)+h;}void main(){float depth=texture2D(sceneDepth,vUv).x;float linearDepth=linearize_depth(depth,near,far);vec3 worldPos=WorldPosFromDepth(depth);vec3 direction=normalize(worldPos-cameraPos);float distToTarget=distance(worldPos,cameraPos);float tEntry=0.0;float tExit=distToTarget;bool missed=false;for(int i=0;i<6;i++){float denom=dot(fNormals[i],direction);float dist=sdPlane(cameraPos,fNormals[i],fConstants[i]);if(abs(denom)<1e-6){if(dist>0.0){missed=true;break;}}else{float t=-dist/denom;if(denom<0.0){tEntry=max(tEntry,t);}else{tExit=min(tExit,t);}}}if(missed||tEntry>=tExit){gl_FragColor=vec4(0.0,0.0,0.0,linearDepth);return;}float startOffset=tEntry>0.0?0.001:0.0;vec3 startPos=cameraPos+(tEntry+startOffset)*direction;worldPos=cameraPos+tExit*direction;float illum=0.0;float rayLength=distance(startPos,worldPos);float densityFactor=rayLength*density;float baseSteps;if(raymarchStepSize>0.0){float effectiveStepSize=max(raymarchStepSize,shadowTexelWorldSize*0.5);baseSteps=clamp(rayLength/effectiveStepSize,minSteps,maxSteps);}else{baseSteps=raymarchSteps;}float noise=fract(52.9829189*fract(0.06711056*gl_FragCoord.x+0.00583715*gl_FragCoord.y));float samplesFloat=round(baseSteps+((baseSteps/8.0)+2.0)*noise);int samples=int(samplesFloat);float earlyOutThreshold=-log(1.0-maxDensity)*samplesFloat;int stepsTaken=samples;for(int i=0;i<samples;i++){vec3 samplePos=mix(startPos,worldPos,float(i)/samplesFloat);vec2 shadowInfo=inShadow(samplePos);float shadowAmount=1.0-shadowInfo.x;illum+=shadowAmount*densityFactor*pow(1.0-shadowInfo.y/lightCameraFar,distanceAttenuation);if(illum>earlyOutThreshold){stepsTaken=i+1;break;}}illum/=samplesFloat;
#if defined(DEBUG_STEPS)
float t=clamp(float(stepsTaken)/150.0,0.0,1.0);gl_FragColor=vec4(0.0,t,0.0,linearDepth);
#else
gl_FragColor=vec4(vec3(clamp(1.0-exp(-illum),0.0,maxDensity)),linearDepth);
#endif
}`;

// src/godrays.vert
var godrays_default2 = `varying vec2 vUv;varying vec3 vWorldRay;uniform mat4 cameraProjectionMatrixInv;uniform mat4 cameraMatrixWorld;void main(){vec2 ndcXY=position.xy;vUv=ndcXY*0.5+0.5;vec3 viewRay=vec3(cameraProjectionMatrixInv[0][0]*ndcXY.x+cameraProjectionMatrixInv[3][0],cameraProjectionMatrixInv[1][1]*ndcXY.y+cameraProjectionMatrixInv[3][1],cameraProjectionMatrixInv[3][2]);vWorldRay=mat3(cameraMatrixWorld)*viewRay;gl_Position=vec4(ndcXY,1.0,1.0);}`;

// src/illumPass.ts
var GodraysMaterial = class extends THREE4.ShaderMaterial {
  constructor(light) {
    const uniforms = {
      density: { value: 1 / 128 },
      maxDensity: { value: 0.5 },
      distanceAttenuation: { value: 2 },
      sceneDepth: { value: null },
      lightPos: { value: new THREE4.Vector3(0, 0, 0) },
      cameraPos: { value: new THREE4.Vector3(0, 0, 0) },
      resolution: { value: new THREE4.Vector2(1, 1) },
      premultipliedLightCameraMatrix: { value: new THREE4.Matrix4() },
      cameraProjectionMatrixInv: { value: new THREE4.Matrix4() },
      cameraMatrixWorld: { value: new THREE4.Matrix4() },
      shadowMap: { value: null },
      texelSizeY: { value: 1 },
      lightCameraNear: { value: 0.1 },
      lightCameraFar: { value: 1e3 },
      near: { value: 0.1 },
      far: { value: 1e3 },
      fNormals: { value: DIRECTIONS.map(() => new THREE4.Vector3()) },
      fConstants: { value: DIRECTIONS.map(() => 0) },
      raymarchSteps: { value: 60 },
      raymarchStepSize: { value: 0 },
      minSteps: { value: 8 },
      maxSteps: { value: 125 },
      shadowTexelWorldSize: { value: 0 }
    };
    const defines = {};
    if (light instanceof THREE4.PointLight || light.isPointLight) {
      defines.IS_POINT_LIGHT = "";
    } else if (light instanceof THREE4.DirectionalLight || light.isDirectionalLight) {
      defines.IS_DIRECTIONAL_LIGHT = "";
    }
    const threeVersion = +THREE4.REVISION;
    if (threeVersion >= 182) {
      defines.USE_UNPACKED_DEPTH = "";
    }
    super({
      name: "GodraysMaterial",
      uniforms,
      depthWrite: false,
      depthTest: false,
      fragmentShader: godrays_default,
      vertexShader: godrays_default2,
      defines
    });
  }
};
var DIRECTIONS = [
  new THREE4.Vector3(1, 0, 0),
  new THREE4.Vector3(-1, 0, 0),
  new THREE4.Vector3(0, 1, 0),
  new THREE4.Vector3(0, -1, 0),
  new THREE4.Vector3(0, 0, 1),
  new THREE4.Vector3(0, 0, -1)
];
var PLANES = DIRECTIONS.map(() => new THREE4.Plane());
var SCRATCH_VECTOR = new THREE4.Vector3();
var SCRATCH_VECTOR2 = new THREE4.Vector3();
var SCRATCH_VECTOR3 = new THREE4.Vector3();
var SCRATCH_FRUSTUM = new THREE4.Frustum();
var SCRATCH_MAT4 = new THREE4.Matrix4();
var GodraysIllumPass = class extends Pass3 {
  constructor(props, params) {
    super("GodraysPass", void 0, new FullscreenPassCamera());
    this.shadowMapSet = false;
    this.lightWorldPos = new THREE4.Vector3();
    /**
     * Tracks whether we need to copy the shadow map depth texture to avoid comparison mode issues.
     *
     * Three.js configures depth textures differently based on shadow map type:
     * - PCFShadowMap (default): Sets compareFunction to LessEqualCompare, requiring sampler2DShadow
     * - PCFSoftShadowMap/BasicShadowMap: Sets compareFunction to null, allowing regular sampler2D
     *
     * The godrays shader needs raw depth values for raymarching, so it uses sampler2D.
     * When PCFShadowMap is used, we copy the depth data to our own texture without comparison mode
     * using WebGL's blitFramebuffer, which copies at the GPU level without shader sampling.
     */
    this.needsDepthCopy = false;
    this.depthCopyTarget = null;
    this.originalShadowMap = null;
    this.props = props;
    this.lastParams = params;
    this.material = new GodraysMaterial(props.light);
    this.updateUniforms(props, params);
    this.fullscreenMaterial = this.material;
  }
  setSize(width, height) {
    this.material.uniforms.resolution.value.set(width, height);
    this.material.uniforms.near.value = this.props.camera.near;
    this.material.uniforms.far.value = this.props.camera.far;
  }
  render(renderer, _inputBuffer, outputBuffer, _deltaTime, _stencilTest) {
    var _a;
    if (!this.shadowMapSet && ((_a = this.props.light.shadow.map) == null ? void 0 : _a.texture)) {
      this.updateUniforms(this.props, this.lastParams);
      this.shadowMapSet = true;
      this.checkForDepthCopy(renderer);
    }
    this.updateLightParams(this.props);
    if (this.needsDepthCopy && this.originalShadowMap && this.depthCopyTarget) {
      this.copyDepthTexture(renderer);
      this.material.uniforms.shadowMap.value = this.depthCopyTarget.depthTexture;
    }
    renderer.setRenderTarget(outputBuffer);
    renderer.render(this.scene, this.camera);
    if (this.needsDepthCopy && this.originalShadowMap) {
      this.material.uniforms.shadowMap.value = this.originalShadowMap;
    }
  }
  /**
   * Copy the shadow map depth texture to our own texture without comparison mode.
   * Uses blitFramebuffer for GPU-level copy without shader sampling.
   */
  copyDepthTexture(renderer) {
    const gl = renderer.getContext();
    const shadow = this.props.light.shadow;
    const shadowMapProps = renderer.properties.get(shadow.map);
    const srcFramebuffer = shadowMapProps.__webglFramebuffer;
    const copyTargetProps = renderer.properties.get(this.depthCopyTarget);
    let dstFramebuffer = copyTargetProps == null ? void 0 : copyTargetProps.__webglFramebuffer;
    if (!dstFramebuffer) {
      renderer.setRenderTarget(this.depthCopyTarget);
      renderer.clear();
      renderer.setRenderTarget(null);
      const updatedProps = renderer.properties.get(this.depthCopyTarget);
      dstFramebuffer = updatedProps.__webglFramebuffer;
    }
    if (!srcFramebuffer || !dstFramebuffer) {
      return;
    }
    const width = shadow.map.width;
    const height = shadow.map.height;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, srcFramebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dstFramebuffer);
    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }
  /**
   * Check if the shadow map's depth texture has comparison mode enabled,
   * which requires copying the depth texture to avoid sampler type mismatch.
   *
   * This check is based on the actual compareFunction value rather than shadow map type,
   * making it robust against Three.js version differences:
   * - r182: PCFShadowMap has compareFunction set, PCFSoftShadowMap does not
   * - r183+: PCFSoftShadowMap is auto-converted to PCFShadowMap, so both have compareFunction set
   */
  checkForDepthCopy(renderer) {
    var _a;
    const light = this.props.light;
    const isDirectionalOrSpot = light instanceof THREE4.DirectionalLight || light.isDirectionalLight || light instanceof THREE4.SpotLight || light.isSpotLight;
    if (!isDirectionalOrSpot) {
      this.needsDepthCopy = false;
      return;
    }
    const depthTexture = (_a = light.shadow.map) == null ? void 0 : _a.depthTexture;
    const hasCompareFunction = depthTexture && depthTexture.compareFunction !== null;
    if (hasCompareFunction) {
      this.needsDepthCopy = true;
      this.originalShadowMap = depthTexture;
      const shadowMapSize = light.shadow.mapSize;
      this.depthCopyTarget = new THREE4.WebGLRenderTarget(shadowMapSize.x, shadowMapSize.y);
      this.depthCopyTarget.depthTexture = new THREE4.DepthTexture(
        shadowMapSize.x,
        shadowMapSize.y,
        THREE4.UnsignedIntType
      );
      this.depthCopyTarget.depthTexture.format = THREE4.DepthFormat;
      this.depthCopyTarget.depthTexture.compareFunction = null;
      this.depthCopyTarget.depthTexture.minFilter = THREE4.NearestFilter;
      this.depthCopyTarget.depthTexture.magFilter = THREE4.NearestFilter;
    } else {
      this.needsDepthCopy = false;
      this.originalShadowMap = null;
    }
  }
  setDepthTexture(depthTexture, depthPacking) {
    this.material.uniforms.sceneDepth.value = depthTexture;
    if (depthPacking && depthPacking !== THREE4.BasicDepthPacking) {
      throw new Error("Only BasicDepthPacking is supported");
    }
  }
  computeEffectiveMaxDist(lightCameraFar, distanceAttenuation) {
    if (distanceAttenuation <= 0) {
      return lightCameraFar;
    }
    const epsilon = 5e-3;
    return Math.min(
      lightCameraFar,
      lightCameraFar * (1 - Math.pow(epsilon, 1 / distanceAttenuation))
    );
  }
  updateLightParams({ light }) {
    light.getWorldPosition(this.lightWorldPos);
    const uniforms = this.material.uniforms;
    uniforms.premultipliedLightCameraMatrix.value.multiplyMatrices(
      light.shadow.camera.projectionMatrix,
      light.shadow.camera.matrixWorldInverse
    );
    if (light instanceof THREE4.PointLight || light.isPointLight) {
      const effectiveFar = this.computeEffectiveMaxDist(
        uniforms.lightCameraFar.value,
        uniforms.distanceAttenuation.value
      );
      for (let i = 0; i < DIRECTIONS.length; i += 1) {
        const direction = DIRECTIONS[i];
        const plane = PLANES[i];
        SCRATCH_VECTOR.copy(light.position);
        SCRATCH_VECTOR.addScaledVector(direction, effectiveFar);
        plane.setFromNormalAndCoplanarPoint(direction, SCRATCH_VECTOR);
        uniforms.fNormals.value[i].copy(plane.normal);
        uniforms.fConstants.value[i] = plane.constant;
      }
      uniforms.shadowTexelWorldSize.value = 2 * uniforms.lightCameraFar.value / light.shadow.mapSize.x;
    } else if (light instanceof THREE4.DirectionalLight || light.isDirectionalLight) {
      const shadowCam = light.shadow.camera;
      SCRATCH_MAT4.multiplyMatrices(shadowCam.projectionMatrix, shadowCam.matrixWorldInverse);
      SCRATCH_FRUSTUM.setFromProjectionMatrix(
        SCRATCH_MAT4,
        shadowCam.coordinateSystem,
        shadowCam.reversedDepth
      );
      const effectiveFar = this.computeEffectiveMaxDist(
        uniforms.lightCameraFar.value,
        uniforms.distanceAttenuation.value
      );
      if (effectiveFar < uniforms.lightCameraFar.value) {
        light.shadow.camera.getWorldDirection(SCRATCH_VECTOR2);
        light.shadow.camera.getWorldPosition(SCRATCH_VECTOR3);
        SCRATCH_VECTOR.copy(SCRATCH_VECTOR3).addScaledVector(SCRATCH_VECTOR2, effectiveFar);
        SCRATCH_VECTOR2.negate();
        SCRATCH_FRUSTUM.planes[4].setFromNormalAndCoplanarPoint(SCRATCH_VECTOR2, SCRATCH_VECTOR);
      }
      for (let planeIx = 0; planeIx < 6; planeIx += 1) {
        const plane = SCRATCH_FRUSTUM.planes[planeIx];
        uniforms.fNormals.value[planeIx].copy(plane.normal).multiplyScalar(-1);
        uniforms.fConstants.value[planeIx] = plane.constant * -1;
      }
      uniforms.shadowTexelWorldSize.value = (shadowCam.right - shadowCam.left) / light.shadow.mapSize.x;
    }
  }
  updateUniforms({ light, camera }, params) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    const shadow = light.shadow;
    if (!shadow) {
      throw new Error("Light used for godrays must have shadow");
    }
    let shadowMap = (_b = (_a = shadow.map) == null ? void 0 : _a.texture) != null ? _b : null;
    if ((light instanceof THREE4.DirectionalLight || light.isDirectionalLight) && ((_c = shadow.map) == null ? void 0 : _c.depthTexture)) {
      shadowMap = shadow.map.depthTexture;
    }
    const mapSize = (_e = (_d = shadow.map) == null ? void 0 : _d.height) != null ? _e : 1;
    if (shadowMap && shadowMap.isCubeTexture) {
      if (this.material.defines.USE_CUBE_SHADOWMAP === void 0) {
        this.material.defines.USE_CUBE_SHADOWMAP = "";
        this.material.needsUpdate = true;
      }
    } else {
      if (this.material.defines.USE_CUBE_SHADOWMAP !== void 0) {
        delete this.material.defines.USE_CUBE_SHADOWMAP;
        this.material.needsUpdate = true;
      }
    }
    const uniforms = this.material.uniforms;
    uniforms.density.value = params.density;
    uniforms.maxDensity.value = params.maxDensity;
    uniforms.lightPos.value = this.lightWorldPos;
    uniforms.cameraPos.value = camera.position;
    uniforms.cameraProjectionMatrixInv.value = camera.projectionMatrixInverse;
    uniforms.cameraMatrixWorld.value = camera.matrixWorld;
    uniforms.shadowMap.value = shadowMap;
    uniforms.texelSizeY.value = 1 / (mapSize * 2);
    uniforms.lightCameraNear.value = (_f = shadow == null ? void 0 : shadow.camera.near) != null ? _f : 0.1;
    uniforms.lightCameraFar.value = (_g = shadow == null ? void 0 : shadow.camera.far) != null ? _g : 1e3;
    uniforms.near.value = camera.near;
    uniforms.far.value = camera.far;
    uniforms.distanceAttenuation.value = params.distanceAttenuation;
    uniforms.raymarchSteps.value = params.raymarchSteps;
    if (params.adaptiveSteps) {
      uniforms.raymarchStepSize.value = params.adaptiveSteps.stepSize;
      uniforms.minSteps.value = (_h = params.adaptiveSteps.minSteps) != null ? _h : 8;
      uniforms.maxSteps.value = (_i = params.adaptiveSteps.maxSteps) != null ? _i : 125;
    } else {
      uniforms.raymarchStepSize.value = 0;
    }
    const wantsDebug = !!params.debugSteps;
    const hasDebug = this.material.defines.DEBUG_STEPS !== void 0;
    if (wantsDebug && !hasDebug) {
      this.material.defines.DEBUG_STEPS = "";
      this.material.needsUpdate = true;
    } else if (!wantsDebug && hasDebug) {
      delete this.material.defines.DEBUG_STEPS;
      this.material.needsUpdate = true;
    }
  }
};

// src/index.ts
var GodraysUpsampleQuality = /* @__PURE__ */ ((GodraysUpsampleQuality2) => {
  GodraysUpsampleQuality2[GodraysUpsampleQuality2["LOW"] = 0] = "LOW";
  GodraysUpsampleQuality2[GodraysUpsampleQuality2["HIGH"] = 1] = "HIGH";
  return GodraysUpsampleQuality2;
})(GodraysUpsampleQuality || {});
var defaultParams = {
  density: 1 / 128,
  maxDensity: 0.5,
  distanceAttenuation: 2,
  color: new THREE5.Color(16777215),
  raymarchSteps: 60,
  blur: true,
  gammaCorrection: true,
  resolutionScale: 0.5,
  upsampleQuality: 1 /* HIGH */
};
var populateParams = (partialParams) => {
  var _a;
  if ("raymarchSteps" in partialParams && "adaptiveSteps" in partialParams) {
    throw new Error("Cannot specify both raymarchSteps and adaptiveSteps");
  }
  return {
    ...defaultParams,
    ...partialParams,
    color: new THREE5.Color((_a = partialParams.color) != null ? _a : defaultParams.color)
  };
};
var defaultGodraysBlurParams = {
  variance: 0.1,
  kernelSize: KernelSize2.SMALL
};
var populateGodraysBlurParams = (blur) => {
  if (typeof blur === "boolean") {
    return { ...defaultGodraysBlurParams };
  }
  return { ...defaultGodraysBlurParams, ...blur };
};
var GodraysPass = class extends Pass4 {
  /**
   * Constructs a new GodraysPass.  Casts godrays from a point light source.  Add to your scene's composer like this:
   *
   * ```ts
   * import { EffectComposer, RenderPass } from 'postprocessing';
   * import { GodraysPass } from 'three-good-godrays';
   *
   * const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
   * const renderPass = new RenderPass(scene, camera);
   * renderPass.renderToScreen = false;
   * composer.addPass(renderPass);
   *
   * const godraysPass = new GodraysPass(pointLight, camera);
   * godraysPass.renderToScreen = true;
   * composer.addPass(godraysPass);
   *
   * function animate() {
   *   composer.render(scene, camera);
   * }
   * ```
   *
   * @param light The light source to use for the godrays.
   * @param camera The camera used to render the scene.
   * @param partialParams The parameters to use for the godrays effect.  Will use default values for any parameters not specified.
   */
  constructor(light, camera, partialParams = {}) {
    super("GodraysPass", void 0, new FullscreenPassCamera());
    this.depthTexture = null;
    this.depthPacking = null;
    this.lastWidth = 1;
    this.lastHeight = 1;
    this.godraysRenderTarget = new THREE5.WebGLRenderTarget(1, 1, {
      minFilter: THREE5.NearestFilter,
      magFilter: THREE5.NearestFilter,
      format: THREE5.RGBAFormat,
      type: THREE5.HalfFloatType,
      generateMipmaps: false
    });
    this.enableBlurPass = true;
    this.blurPass = null;
    this.blurRenderTarget = null;
    this.props = {
      light,
      camera
    };
    const params = populateParams(partialParams);
    this.lastParams = params;
    this.illumPass = new GodraysIllumPass(this.props, params);
    this.illumPass.needsDepthTexture = true;
    this.compositorPass = new GodraysCompositorPass({
      godrays: this.godraysRenderTarget.texture,
      color: params.color,
      camera,
      gammaCorrection: params.gammaCorrection,
      upsampleQuality: params.upsampleQuality
    });
    this.compositorPass.needsDepthTexture = true;
    this.needsDepthTexture = true;
    this.setParams(partialParams);
  }
  /**
   * Updates the parameters used for the godrays effect.  Will use default values for any parameters not specified.
   */
  setParams(partialParams) {
    const oldScale = this.lastParams.resolutionScale;
    const params = populateParams(partialParams);
    this.lastParams = params;
    this.illumPass.updateUniforms(this.props, params);
    this.compositorPass.updateUniforms(params);
    this.compositorPass.updateUpsampleQuality(params.upsampleQuality);
    this.compositorPass.updateDebugSteps(!!params.debugSteps);
    if (params.resolutionScale !== oldScale) {
      this.setSize(this.lastWidth, this.lastHeight);
    }
    this.enableBlurPass = !!params.blur;
    if (params.blur && this.blurPass) {
      const blurParams = populateGodraysBlurParams(params.blur);
      if (this.blurPass.material.defines.KSIZE_ENUM !== blurParams.kernelSize) {
        this.blurPass.dispose();
        this.maybeInitBlur(
          this.godraysRenderTarget.texture
        );
      }
      this.blurPass.updateUniforms(blurParams);
      this.blurPass.updateDebugSteps(!!params.debugSteps);
    }
  }
  maybeInitBlur(input) {
    var _a;
    if (!this.blurPass) {
      this.blurPass = new BilateralFilterPass(input);
      const blurParams = populateGodraysBlurParams(this.lastParams.blur);
      this.blurPass.updateUniforms(blurParams);
      this.blurPass.updateDebugSteps(!!this.lastParams.debugSteps);
      if (this.depthTexture) {
        this.blurPass.setDepthTexture(this.depthTexture, (_a = this.depthPacking) != null ? _a : void 0);
      }
    }
    if (!this.blurRenderTarget) {
      this.blurRenderTarget = new THREE5.WebGLRenderTarget(
        Math.ceil(this.godraysRenderTarget.width * GODRAYS_BLUR_RESOLUTION_SCALE),
        Math.ceil(this.godraysRenderTarget.height * GODRAYS_BLUR_RESOLUTION_SCALE),
        {
          minFilter: THREE5.NearestFilter,
          magFilter: THREE5.NearestFilter,
          format: THREE5.RGBAFormat,
          type: THREE5.HalfFloatType,
          generateMipmaps: false
        }
      );
    }
  }
  render(renderer, inputBuffer, outputBuffer, _deltaTime, _stencilTest) {
    this.illumPass.render(renderer, inputBuffer, this.godraysRenderTarget);
    if (this.enableBlurPass) {
      this.maybeInitBlur(
        this.godraysRenderTarget.texture
      );
      this.blurPass.render(renderer, this.godraysRenderTarget, this.blurRenderTarget);
      this.compositorPass.fullscreenMaterial.uniforms.godrays.value = this.blurRenderTarget.texture;
    } else {
      this.compositorPass.fullscreenMaterial.uniforms.godrays.value = this.godraysRenderTarget.texture;
    }
    this.compositorPass.render(renderer, inputBuffer, this.renderToScreen ? null : outputBuffer);
  }
  setDepthTexture(depthTexture, depthPacking) {
    this.illumPass.setDepthTexture(depthTexture, depthPacking);
    this.compositorPass.setDepthTexture(depthTexture, depthPacking);
    this.depthTexture = depthTexture;
    this.depthPacking = depthPacking;
  }
  setSize(width, height) {
    var _a, _b;
    this.lastWidth = width;
    this.lastHeight = height;
    const scale = this.lastParams.resolutionScale;
    const godraysWidth = Math.ceil(width * scale);
    const godraysHeight = Math.ceil(height * scale);
    this.godraysRenderTarget.setSize(godraysWidth, godraysHeight);
    this.illumPass.setSize(godraysWidth, godraysHeight);
    this.compositorPass.setSize(width, height);
    this.compositorPass.setGodraysResolution(godraysWidth, godraysHeight);
    (_a = this.blurPass) == null ? void 0 : _a.setSize(godraysWidth, godraysHeight);
    (_b = this.blurRenderTarget) == null ? void 0 : _b.setSize(
      Math.ceil(godraysWidth * GODRAYS_BLUR_RESOLUTION_SCALE),
      Math.ceil(godraysHeight * GODRAYS_BLUR_RESOLUTION_SCALE)
    );
  }
  dispose() {
    var _a;
    this.godraysRenderTarget.dispose();
    this.illumPass.dispose();
    this.compositorPass.dispose();
    (_a = this.blurPass) == null ? void 0 : _a.dispose();
    super.dispose();
  }
};
export {
  GodraysPass,
  GodraysUpsampleQuality
};
