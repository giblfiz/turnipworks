// LIGHTING: the post stack and the light rig, in effect language.
// Owns: tone mapping + exposure, fill (hemisphere/sun) level, fire-light shadow budget, bloom, N8AO contact shadows,
// three-good-godrays light shafts through haze, and a colour grade. Renders through pmndrs/postprocessing.
// Libraries (vendored, js/vendor/): postprocessing 6.39.5 (Zlib), n8ao 2.0.1 (CC0), three-good-godrays 0.12.1 (Zlib).
import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, Effect, BlendFunction, SMAAEffect } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { GodraysPass } from 'three-good-godrays';

export const LIGHT_DEFAULTS = {
  fx: 'lighting', name: 'evening-hearth',
  on: true,
  tone: { mode: 'aces', exposure: 1.0 },
  fill: { ambient: 0.6, sun: 0.25, warmFill: 0.15 },
  shadows: { casters: 1, softness: 4, depth: 0.8, res: '512', dance: 0.35 },
  bloom: { strength: 0.55, threshold: 1.1, spread: 0.5 },
  ao: { strength: 2.5, radius: 3, quality: 'medium' },
  shafts: { on: false, haze: 0.004, strength: 0.22, quality: 'medium' },
  grade: { warmth: 0.15, saturation: 1.05, contrast: 1.05, vignette: 0.35 },
};

const T = (k, label, min, max, step, unit) => ({ k, label, type: 'range', min, max, step, unit });
export const LIGHT_SCHEMA = [
  ['Exposure & film', 'tone', [
    { k: 'mode', label: 'Film response', type: 'select', options: [['aces', 'ACES: warm'], ['agx', 'AgX: soft, pinks fire'], ['neutral', 'Neutral'], ['reinhard', 'Reinhard: flat'], ['linear', 'none (clips)']] },
    T('exposure', 'Exposure', 0.2, 3, 0.05),
  ]],
  ['Fill light (not from fires)', 'fill', [
    T('ambient', 'Ambient sky fill', 0, 2, 0.05),
    T('sun', 'Daylight key (sun)', 0, 2, 0.05),
    T('warmFill', 'Fill warmth', 0, 1, 0.05),
  ]],
  ['Fire shadows', 'shadows', [
    T('casters', 'Fires that cast shadows (biggest, then nearest)', 0, 4, 1),
    T('softness', 'Shadow softness', 0, 8, 0.5),
    T('depth', 'Shadow depth', 0, 1, 0.05),
    { k: 'res', label: 'Shadow detail', type: 'select', options: [['256', 'low (256)'], ['512', 'medium (512)'], ['1024', 'high (1024)']] },
    T('dance', 'Shadow dance (light wobble)', 0, 1, 0.05),
  ]],
  ['Glow (bloom)', 'bloom', [
    T('strength', 'Glow strength', 0, 3, 0.05),
    T('threshold', 'Glow starts at brightness', 0.2, 2, 0.05),
    T('spread', 'Glow spread', 0, 1, 0.05),
  ]],
  ['Contact shadows (N8AO)', 'ao', [
    T('strength', 'Strength', 0, 6, 0.1),
    T('radius', 'Reach', 0.5, 10, 0.25, 'ft'),
    { k: 'quality', label: 'Quality', type: 'select', options: [['low', 'low (half res)'], ['medium', 'medium'], ['high', 'high']] },
  ]],
  ['Light shafts through haze', 'shafts', [
    { k: 'on', label: 'Shafts from the biggest fire', type: 'check' },
    T('haze', 'Haze density', 0, 0.06, 0.001),
    T('strength', 'Shaft strength', 0, 1, 0.01),
    { k: 'quality', label: 'Quality', type: 'select', options: [['low', 'low'], ['medium', 'medium'], ['high', 'high']] },
  ]],
  ['Colour grade', 'grade', [
    T('warmth', 'Warmth (cool ↔ warm)', -1, 1, 0.05),
    T('saturation', 'Saturation', 0, 2, 0.05),
    T('contrast', 'Contrast', 0.5, 1.6, 0.05),
    T('vignette', 'Vignette', 0, 1, 0.05),
  ]],
];

export const LIGHT_BUILTINS = {
  // Harry 2026-10-02: the two working profiles. night = his tuned preset (sent 13:20); day = the same with the daylight key at 1.2
  'night': () => ({ ...JSON.parse(JSON.stringify(LIGHT_DEFAULTS)), name: 'night', ...{"tone": {"mode": "linear", "exposure": 2.05}, "fill": {"ambient": 0.55, "sun": 0.6, "warmFill": 0.55}, "shadows": {"casters": 1, "softness": 2.5, "depth": 0.8, "res": "512", "dance": 0.35}, "bloom": {"strength": 0.45, "threshold": 1.1, "spread": 0.55}, "ao": {"strength": 2.5, "radius": 5.75, "quality": "medium"}, "shafts": {"on": false, "haze": 0.004, "strength": 0.22, "quality": "medium"}, "grade": {"warmth": 0.15, "saturation": 1.05, "contrast": 1.05, "vignette": 0.35}} }),
  'day': () => ({ ...JSON.parse(JSON.stringify(LIGHT_DEFAULTS)), name: 'day', ...{"tone": {"mode": "linear", "exposure": 2.05}, "fill": {"ambient": 0.55, "sun": 1.2, "warmFill": 0.55}, "shadows": {"casters": 1, "softness": 2.5, "depth": 0.8, "res": "512", "dance": 0.35}, "bloom": {"strength": 0.45, "threshold": 1.1, "spread": 0.55}, "ao": {"strength": 2.5, "radius": 5.75, "quality": "medium"}, "shafts": {"on": false, "haze": 0.004, "strength": 0.22, "quality": "medium"}, "grade": {"warmth": 0.15, "saturation": 1.05, "contrast": 1.05, "vignette": 0.35}} }),
  'evening-hearth': () => ({ ...JSON.parse(JSON.stringify(LIGHT_DEFAULTS)) }),
  'daylight': () => ({ ...JSON.parse(JSON.stringify(LIGHT_DEFAULTS)), name: 'daylight', tone: { mode: 'agx', exposure: 1.0 }, fill: { ambient: 1.0, sun: 1.0, warmFill: 0.2 }, shadows: { casters: 0, softness: 2, res: '512', dance: 0 }, bloom: { strength: 0.4, threshold: 1.1, spread: 0.5 }, grade: { warmth: 0, saturation: 1, contrast: 1, vignette: 0.15 } }),
  'deep-night': () => ({ ...JSON.parse(JSON.stringify(LIGHT_DEFAULTS)), name: 'deep-night', tone: { mode: 'agx', exposure: 1.35 }, fill: { ambient: 0.08, sun: 0, warmFill: 0.6 }, shadows: { casters: 2, softness: 2.5, res: '512', dance: 0.5 }, bloom: { strength: 0.8, threshold: 0.9, spread: 0.65 }, shafts: { on: true, haze: 0.006, strength: 0.3, quality: 'medium' }, grade: { warmth: 0.25, saturation: 1.1, contrast: 1.1, vignette: 0.5 } }),
};

// exposure before the film curve; grade after it
class ExposureEffect extends Effect {
  constructor() {
    super('ExposureEffect', 'uniform float exposure; void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) { outputColor = vec4(inputColor.rgb * exposure, inputColor.a); }',
      { blendFunction: BlendFunction.SET, uniforms: new Map([['exposure', new THREE.Uniform(1)]]) });
  }
}
class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', `uniform float warmth; uniform float saturation; uniform float contrast;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        c *= vec3(1.0 + 0.12 * warmth, 1.0 + 0.02 * warmth, 1.0 - 0.14 * warmth);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, saturation);
        c = (c - 0.5) * contrast + 0.5;
        outputColor = vec4(max(c, 0.0), inputColor.a);
      }`, { blendFunction: BlendFunction.SET, uniforms: new Map([['warmth', new THREE.Uniform(0)], ['saturation', new THREE.Uniform(1)], ['contrast', new THREE.Uniform(1)]]) });
  }
}
const TONE = { agx: ToneMappingMode.AGX, aces: ToneMappingMode.ACES_FILMIC, neutral: ToneMappingMode.NEUTRAL, reinhard: ToneMappingMode.REINHARD, linear: ToneMappingMode.LINEAR };

// THE SCENE GRAPH'S GENERATION: a counter that moves whenever anything is added to or taken out of any Object3D. three.js
// tells only the child ('added' / 'removed'), never the scene, so the three methods are wrapped once per page. Used to
// know when a cached list of "the scene's see-through things" may be out of date without walking the scene to find out.
const graph = (() => {
  const P = THREE.Object3D.prototype; if (P.__twGraph) return P.__twGraph;
  const G = { gen: 0 };
  for (const k of ['add', 'remove', 'clear']) { const f = P[k]; P[k] = function (...a) { G.gen++; return f.apply(this, a); }; }
  Object.defineProperty(P, '__twGraph', { value: G, enumerable: false });
  return G;
})();

// casters(light, reach): the host's list of the scene's things that stand within `reach` ft of a shadow-casting light
// (roots; what hangs under them comes along), or null for "walk the whole scene" (the tuner; see THE FIRE'S SHADOW below).
export function createLighting({ renderer, scene, camera, hemi, sun, focus = () => null, motion = () => 0, casters = null }) {
  let P = JSON.parse(JSON.stringify(LIGHT_DEFAULTS));
  const base = { hemi: hemi?.intensity ?? 1.7, sun: sun?.intensity ?? 1.9, hemiSky: hemi?.color.clone(), hemiGround: hemi?.groundColor.clone() };
  const size = new THREE.Vector2(1, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap; // point-light shadow.radius softening needs PCF (not PCFSoft)

  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
  const renderPass = new RenderPass(scene, camera);
  // TWO CONTACT-SHADOW PASSES, ONE IN USE. N8AO rebuilds and recompiles its shaders whenever its half-resolution mode is
  // flipped (a quarter of a second, every time). The viewer's "half resolution" switch therefore swaps between two
  // passes, each built once in its own mode: the half-res one is made the first time it is asked for (that first time
  // compiles; after that the swap is free).
  const makeAO = () => { const p = new N8AOPostPass(scene, camera, 512, 512); p.configuration.gammaCorrection = false; return p; }; // (gammaCorrection: more passes follow; the last pass converts to sRGB)
  const aoFull = makeAO(); let aoHalf = null, ao = aoFull;
  // CONTACT SHADOWS AND SEE-THROUGH THINGS (frame time, 2026-10-06). So that a contact shadow is not drawn over a flame,
  // a label or a pane of glass, N8AO draws the scene's see-through things again into two buffers of its own, every frame
  // (its "transparency aware" mode, which it switches on by itself when any material is see-through). Its way of doing
  // that: walk the WHOLE scene four times a frame to hide and restore everything else (with a Map of every node), and
  // have three.js walk the whole scene twice more to draw the few things left. On a 200-room map that was 30 to 40% of
  // the frame, to draw a few dozen flames and labels.
  // Here the same two buffers are filled from a LIST of the see-through things, kept up to date when the scene graph
  // changes: for the length of the two draws the scene's children ARE that list (plus the lights, so no shader sees a
  // different light count), so three.js walks only them. Same buffers, same shader, same picture; nothing else is walked.
  // perf.aoList = false puts N8AO's own code back (measurements, and a way out).
  const perf = { aoList: true, shadowList: true };
  let tList = [], tLights = [], tGen = -1, tScanT = -1e9, tScanMs = 0, tScans = 0, tDrawn = 0;
  function scanSeeThrough(now) { // one walk: everything that may be see-through, and every light
    const t0 = performance.now(); tList = []; tLights = [];
    scene.traverse(o => { if (o.isLight) tLights.push(o); else { const m = o.material; if (m && (m.transparent || o.userData.cannotReceiveAO)) tList.push(o); } });
    tGen = graph.gen; tScanT = now; tScanMs = performance.now() - t0; tScans++;
  }
  // N8AO's own rule, kept exactly: a thing is drawn into buffer A when it is see-through and writes no depth (or is
  // marked cannotReceiveAO), into buffer B when it is see-through and writes depth; everything else that has a material
  // is hidden for that draw, and so is whatever hangs under it. A thing taken out of the scene since the last walk is
  // not in the scene, so it is not drawn.
  const qualA = (o) => { const m = o.material; return !!((m.transparent && !m.depthWrite && !o.userData.treatAsOpaque) || o.userData.cannotReceiveAO); };
  const qualB = (o) => { const m = o.material; return !!(m.transparent && m.depthWrite && !o.userData.treatAsOpaque); };
  const drawn = (o) => { let p = o; for (; p.parent; p = p.parent) if (!p.visible) return false; return p === scene && p.visible; };
  function pick(qual) {
    const got = [];
    for (const o of tList) {
      if (!o.material || !qual(o)) continue;
      let ok = o.visible, p = o.parent, inside = false;
      for (; ok && p; p = p.parent) { if (!p.visible || (p.material && !qual(p))) ok = false; else if (p.material) inside = true; if (!p.parent) break; }
      if (ok && p === scene && !inside) got.push(o); // (inside: something above it is drawn itself and brings it along)
    }
    return got;
  }
  const _clear = new THREE.Color(), _none = new THREE.Color(0, 0, 0);
  function renderSeeThrough(r) { // (called by N8AO as its renderTransparency, `this` = the pass)
    const now = performance.now(), age = now - tScanT;
    // walk again when the graph changed (no more often than keeps the walk under about 5% of the time), and once a
    // second regardless: a material can turn see-through with no change to the graph (a thing fading in)
    if ((graph.gen !== tGen && age > tScanMs * 20) || age > 1000) scanSeeThrough(now);
    const lists = [pick(qualA), pick(qualB)], quals = [qualA, qualB];
    const lights = tLights.filter(drawn); tDrawn = lists[0].length + lists[1].length;
    const kids = scene.children, bg = scene.background, cc = r.getClearColor(_clear), ca = r.getClearAlpha(), acd = r.autoClearDepth, smu = r.shadowMap.autoUpdate, smn = r.shadowMap.needsUpdate, mwa = scene.matrixWorldAutoUpdate;
    scene.background = null; r.autoClearDepth = false; r.setClearColor(_none, 0);
    r.shadowMap.autoUpdate = false; r.shadowMap.needsUpdate = false; // the shadow maps were drawn with the main picture
    scene.matrixWorldAutoUpdate = false;                             // and every world position was worked out then
    this.depthCopyPass.material.uniforms.depthTexture.value = this.depthTexture;
    this.depthCopyPass.material.uniforms.reverseDepthBuffer.value = this.configuration.depthBufferType === 3; // (N8AO DepthType.Reverse)
    const targets = [this.transparencyRenderTargetDWFalse, this.transparencyRenderTargetDWTrue], hid = [];
    try {
      for (let i = 0; i < 2; i++) {
        r.setRenderTarget(targets[i]); r.clear(true, true, true); this.depthCopyPass.render(r);
        const list = lists[i], qual = quals[i]; if (!list.length) continue;
        for (const o of list) if (o.children.length) o.traverse(c => { if (c !== o && c.material && c.visible && !qual(c)) { c.visible = false; hid.push(c); } });
        scene.children = lights.concat(list);
        try { r.render(scene, this.camera); } finally { scene.children = kids; for (const c of hid.splice(0)) c.visible = true; }
      }
    } finally {
      scene.children = kids; for (const c of hid) c.visible = true;
      scene.background = bg; scene.matrixWorldAutoUpdate = mwa; r.setClearColor(cc, ca); r.autoClearDepth = acd; r.shadowMap.autoUpdate = smu; r.shadowMap.needsUpdate = smn;
    }
  }
  function applyPerf() {
    if (perf.aoList) {
      scanSeeThrough(performance.now());
      ao.configuration.transparencyAware = tList.length > 0; // (setting it by hand also stops N8AO's own every-frame walk to detect it)
      ao.autoDetectTransparency = false; ao.renderTransparency = renderSeeThrough;
    } else { delete ao.renderTransparency; ao.autoDetectTransparency = true; }
  }
  // see-through things can arrive later (the first flame, the first label): the mode goes on with the first one and stays on
  function seeThroughTick(now) {
    if (!perf.aoList || ao.configuration.transparencyAware) return;
    if (graph.gen !== tGen || now - tScanT > 1000) { scanSeeThrough(now); if (tList.length) { ao.configuration.transparencyAware = true; ao.autoDetectTransparency = false; } }
  }
  let godrays = null, godraysLight = null;
  const exposure = new ExposureEffect(), grade = new GradeEffect();
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
  const bloom = new BloomEffect({ intensity: 1, luminanceThreshold: 0.85, luminanceSmoothing: 0.25, mipmapBlur: true, radius: 0.6 });
  const vignette = new VignetteEffect({ darkness: 0.35, offset: 0.3 });
  const smaa = new SMAAEffect();
  let effectPass = null, effectSig = ''; const finals = new Map();
  let fogWarPass = null; // vision fog of war (fogwar.js): runs before the atmosphere and tone mapping; its overlays after
  let glowPass = null; // farglow.js (2026-10-12): the stand-in for lights left out of the pool, a multiply on the lit picture, before the fog
  let atmosPass = null, hazeBoost = 0; // atmos.js (2026-10-04): fog / smoke pass after contact shadows; its haze feeds the shafts
  let waterPass = null; // water.js (2026-10-04): water surfaces, drawn into the frame right after the scene (before contact shadows)

  function rebuildPasses() {
    composer.removeAllPasses();
    composer.addPass(renderPass);
    if (waterPass) composer.addPass(waterPass);
    // (contact shadows off for this viewer: the pass is not in the stack at all, and its buffers are given back; so are
    // the buffers of whichever of the two passes is not the one in use)
    if (P.ao.strength > 0 && viewer.contact) composer.addPass(ao); else try { ao.setSize(1, 1); } catch { }
    for (const p of [aoFull, aoHalf]) if (p && p !== ao) try { p.setSize(1, 1); } catch { }
    if (glowPass) composer.addPass(glowPass);
    // vision fog of war (2026-10-17): BEFORE the atmosphere and tone mapping. It puts the secrecy floor (a checker on the
    // floor plane) where the viewer has never seen, so the war-fog bank the atmosphere draws over it, the bloom and the
    // tone mapping treat bank, spill and room alike; nothing hidden is left in the picture for bloom to carry.
    // Rulers, cursors and labels are drawn after the composer (fogwar.js drawLateOverlays).
    if (fogWarPass) { fogWarPass.early = true; fogWarPass.exposure = P.tone.exposure; composer.addPass(fogWarPass); }
    if (atmosPass) composer.addPass(atmosPass);
    if (P.shafts.on && godraysLight) {
      if (!godrays || godrays.props.light !== godraysLight) { godrays?.dispose(); godrays = new GodraysPass(godraysLight, camera, shaftParams()); }
      composer.addPass(godrays);
    }
    const list = viewer.aa ? [smaa, exposure] : [exposure];
    if (P.bloom.strength > 0 && viewer.bloom) list.push(bloom);
    list.push(tone, grade);
    if (P.grade.vignette > 0) list.push(vignette);
    // one final pass per mix of effects, kept: a mix seen before costs nothing to come back to (no program is compiled twice)
    const fkey = [viewer.aa, P.bloom.strength > 0 && viewer.bloom, P.grade.vignette > 0].join();
    effectPass = finals.get(fkey);
    if (!effectPass) { effectPass = new EffectPass(camera, ...list); finals.set(fkey, effectPass); }
    effectPass.dithering = true; // big soft glows (fire in haze, fog) band into contour rings at 8 bits without it (atmos, 2026-10-04)
    composer.addPass(effectPass);
    composer.setSize(size.x, size.y, false);
  }
  const shaftParams = () => ({
    density: P.shafts.haze + hazeBoost, maxDensity: P.shafts.strength, distanceAttenuation: 2, color: new THREE.Color('#ffb070'),
    raymarchSteps: { low: 30, medium: 50, high: 80 }[P.shafts.quality] || 50, blur: true, resolutionScale: P.shafts.quality === 'high' ? 1 : 0.5,
  });

  // ---- fire lights: the shadow budget (biggest first, then nearest the camera focus)
  let fireLights = [];
  let shadowSig = '';
  function applyShadowBudget(force = false) {
    const f = focus();
    const ranked = [...fireLights].filter(l => l.visible && !l.userData.noShadow).sort((a, b) => (b.userData.priority - a.userData.priority) || (f ? a.position.distanceToSquared(f) - b.position.distanceToSquared(f) : 0));
    const n = P.on && (viewer.shadows || (casters && perf.shadowList)) ? Math.min(P.shadows.casters, ranked.length) : 0;
    const want = new Set(ranked.slice(0, n));
    const res = +P.shadows.res;
    const sig = [...want].map(l => l.uuid).join() + `|${res}`;
    if (sig === shadowSig && !force) return;
    shadowSig = sig;
    for (const l of fireLights) {
      const on = want.has(l);
      l.castShadow = on;
      if (on) {
        if (l.shadow.mapSize.x !== res) { l.shadow.mapSize.set(res, res); l.shadow.map?.dispose(); l.shadow.map = null; }
        l.shadow.radius = P.shadows.softness; l.shadow.intensity = P.shadows.depth ?? 0.8; l.shadow.bias = -0.002; l.shadow.normalBias = 0.03;
        l.shadow.camera.near = 0.3; l.shadow.camera.far = Math.max(10, l.distance || 40); l.shadow.camera.updateProjectionMatrix();
        l.shadow.autoUpdate = false; l.shadow.needsUpdate = true; // refreshed by refreshShadows(): the budget is in time too
      }
    }
    renderer.shadowMap.enabled = renderer.shadowMap.enabled || n > 0;
    const top = ranked[0] || null;
    if (top !== godraysLight) { godraysLight = top; if (P.shafts.on) rebuildPasses(); }
  }
  // A point-light shadow re-renders the scene 6 times, so maps refresh on a budget - but a map must never outlive the
  // geometry it was drawn from (2026-10-02 "shadows floating in the sky": maps drawn mid-spawn, wrong/no caster picked
  // while fires were hidden). Rules: refresh EVERY frame while anything in the scene moves (spawn, settle, drags), once
  // more when it stops; every 2nd frame with shadow dance; on any caster change; and at least once a second.
  let frameNo = 0, lastRefresh = 0, lastRefreshT = 0, lastMotionFrame = 0, motionSig = NaN, settleFrames = 0, dirty = true;
  const why = { motion: 0, dirty: 0, dance: 0, timer: 0, budget: 0, vis: 0 };
  // WHAT THE HOST HAS ASKED TO GO WITHOUT FOR A MOMENT (the game, while the hand is moving and frames run over time:
  // engine/client/interact.js). dance: the fire's shadow is not redrawn for its dance. ao: no contact-shadow pass at
  // all; when it comes back it fades in over `fade` ms so the picture does not pop.
  const shedState = { dance: false, ao: false }; let aoFade = null;
  // WHAT THIS VIEWER HAS SWITCHED OFF FOR GOOD (the game's Settings > Me > Graphics, 2026-10-11; setViewer). Each one
  // skips the WORK, and none of them changes a compiled shader, so switching is instant:
  //   shadows: false  the fire's shadow map is drawn once more with nothing in it (so nothing is in shadow) and then
  //                   never again; the lights still "cast" as far as three.js knows, so the light state every program
  //                   was compiled for is the same. (A host with no `casters` list, the tuner, gets the plain way:
  //                   no caster at all, which compiles every lit program again the first time.)
  //   contact: false  no contact-shadow pass at all (as the host's momentary shed does)
  //   half: true      contact shadows worked out at half resolution (N8AO's own half-res mode, depth-aware upscale)
  //   dance: false    the shadow is not redrawn for the flame's dance (the fire holds steady: fire.js setLite)
  //   bloom: false    no glow round bright things (the bloom's blur chain is not run)
  //   aa: false       no edge smoothing (SMAA's three passes are not run)
  //                   (these two are parts of the one final pass: each mix of them is its own program, built the first
  //                   time it is used and KEPT, so going back and forth compiles nothing)
  const viewer = { shadows: true, contact: true, half: false, dance: true, bloom: true, aa: true };
  const aoWanted = () => viewer.contact && !shedState.ao;
  function setViewer(o = {}) {
    const was = { ...viewer }; for (const k of Object.keys(viewer)) if (o[k] !== undefined) viewer[k] = !!o[k];
    if (viewer.contact !== was.contact) { ao.enabled = aoWanted(); if (ao.enabled) { aoFade = null; ao.configuration.intensity = P.ao.strength; } rebuildPasses(); }
    if (viewer.half !== was.half) { const on = ao.enabled; ao = viewer.half ? (aoHalf ||= makeAO()) : aoFull; ao.enabled = on; applyPerf(); apply(); rebuildPasses(); }
    if (viewer.shadows !== was.shadows) { if (!casters || !perf.shadowList) applyShadowBudget(true); else if (!viewer.shadows) for (const l of fireLights) if (l.castShadow) l.shadow.needsUpdate = true; dirty = true; }
    if (viewer.dance !== was.dance && viewer.dance) dirty = true;
    if (viewer.bloom !== was.bloom || viewer.aa !== was.aa) apply();
  }
  function shed(o = {}) {
    if (o.dance !== undefined && o.dance !== shedState.dance) { shedState.dance = !!o.dance; if (!o.dance) dirty = true; }
    if (o.ao !== undefined && !!o.ao !== shedState.ao) {
      shedState.ao = !!o.ao;
      if (o.ao) { ao.enabled = false; aoFade = null; }
      else if (!viewer.contact) ao.enabled = false; // (this viewer has contact shadows off: nothing comes back)
      else { ao.enabled = true; if (o.fade > 0) { aoFade = { t0: performance.now(), ms: o.fade }; ao.configuration.intensity = 0; } else ao.configuration.intensity = P.ao.strength; }
    }
  }
  function fadeTick() { if (!aoFade) return; const k = Math.min(1, (performance.now() - aoFade.t0) / aoFade.ms); ao.configuration.intensity = P.ao.strength * k * k * (3 - 2 * k); if (k >= 1) aoFade = null; }
  // THE FIRE'S SHADOW FROM A LIST (frame time, 2026-10-06). three.js draws a point light's shadow by walking the WHOLE
  // scene once for each of its six faces, whatever the light can reach: on a 200-room map that walk alone was 25 to
  // 40 ms a frame for a fire that lights one room. When the host can say which things stand within the light's reach
  // (`casters`), the shadow is drawn here, just before the picture, in a draw of its own for whose length the scene's
  // children ARE that list (plus every light, so the light count no shader was compiled for never changes); in the main
  // picture three.js then finds the map up to date and leaves it. The map is the same: nothing farther from the light
  // than its reach could be drawn into it anyway (that is where its six cameras end).
  // "Something moved" is then asked of those things only. It was asked of every thing in the area, so a cup being
  // seated on a table 300 ft away redrew the shadow, every frame, for as long as the seating queue ran: the "slow
  // state" of the big-map measurements (experiments/2026-10-06-megamap/FIXES.md).
  let castList = null, castSum = 0, castDraws = 0;
  function gatherCasters() {
    castList = null;
    if (!casters || !perf.shadowList || !P.on) return;
    if (!viewer.shadows) { castList = []; castSum = 0; return; } // (shadows off for this viewer: nothing casts)
    const ls = fireLights.filter(l => l.castShadow && l.visible); if (!ls.length) { castList = []; castSum = 0; return; }
    const set = new Set();
    for (const l of ls) { const list = casters(l, Math.max(10, l.distance || 40)); if (!list) return; for (const o of list) set.add(o); }
    castList = [...set]; let h = castList.length;
    for (const g of castList) { const p = g.position, q = g.quaternion, k = g.scale; h += p.x * 1.31 + p.y * 7.13 + p.z * 2.97 + k.x * 3.7 + k.y * 5.3 + k.z * 1.9 + q.x * 11 + q.y * 13 + q.z * 17 + q.w * 19 + (g.children[0]?.id || 0) * 0.37 + (g.visible ? 0.11 : 0); }
    castSum = Math.round(h * 1000);
  }
  const awayCam = new THREE.PerspectiveCamera(10, 1, 0.1, 1); awayCam.position.set(0, 1e7, 0); awayCam.lookAt(0, 2e7, 0); awayCam.updateMatrixWorld(); // sees nothing: only the shadow maps are wanted of that draw
  const tinyRT = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  function drawShadows() {
    if (!castList || !fireLights.some(l => l.castShadow && l.visible && l.shadow.needsUpdate)) return; // (shadows off for this viewer: castList is empty, so a map that is due is drawn once with nothing in it)
    if (graph.gen !== tGen) scanSeeThrough(performance.now()); // (the list of lights comes from the same walk)
    const kids = scene.children, bg = scene.background, mwa = scene.matrixWorldAutoUpdate, rt = renderer.getRenderTarget();
    if (mwa) scene.updateMatrixWorld(); // (a host that leaves world positions to three.js: they are worked out once here, and once more in the picture)
    scene.children = tLights.filter(drawn).concat(castList); scene.background = null; scene.matrixWorldAutoUpdate = false;
    try { renderer.setRenderTarget(tinyRT); renderer.render(scene, awayCam); castDraws++; }
    finally { scene.children = kids; scene.background = bg; scene.matrixWorldAutoUpdate = mwa; renderer.setRenderTarget(rt); }
  }
  function refreshShadows(now) {
    frameNo++;
    gatherCasters();
    if (!viewer.shadows && castList) { dirty = false; return; } // nothing is redrawn: whatever map is due (a new caster, the switch itself) is emptied by drawShadows
    const m = castList ? castSum : motion();
    if (m !== motionSig) { motionSig = m; lastMotionFrame = frameNo; settleFrames = 2; }
    const moving = lastMotionFrame === frameNo || settleFrames > 0;
    if (settleFrames > 0 && lastMotionFrame !== frameNo) settleFrames--;
    const due = moving || dirty || (P.shadows.dance > 0 && !shedState.dance && viewer.dance && frameNo % 2 === 0) || now - lastRefreshT > 1000; // (shed: the host's hand is moving and the frame is over time; the shadow holds still)
    if (!due) return;
    why[moving ? 'motion' : dirty ? 'dirty' : now - lastRefreshT > 1000 ? 'timer' : 'dance']++; // (stats: why the shadow was drawn again)
    dirty = false; lastRefresh = frameNo; lastRefreshT = now;
    for (const l of fireLights) if (l.castShadow) l.shadow.needsUpdate = true;
  }
  // re-pick the casters on a timer and the moment the set of visible lights changes (not on a frame-time modulo,
  // which at low fps left a hidden light as the caster, or none, for 10+ s)
  let budgetT = 0, visSig = '';
  function budgetTick(now) {
    const vs = fireLights.map(l => (l.visible ? 1 : 0)).join('');
    if (vs !== visSig || now - budgetT > 250) { const changed = vs !== visSig; visSig = vs; budgetT = now; const before = shadowSig; applyShadowBudget(); if (changed) why.vis++; if (shadowSig !== before) why.budget++; if (changed || shadowSig !== before) dirty = true; }
  }
  // a caster's shadow camera must reach as far as its light does (the light's reach is a fire dial)
  function syncShadowCams() {
    for (const l of fireLights) {
      if (!l.castShadow) continue;
      const far = Math.max(10, l.distance || 40);
      if (Math.abs(l.shadow.camera.far - far) > 0.01) { l.shadow.camera.far = far; l.shadow.camera.updateProjectionMatrix(); l.shadow.needsUpdate = true; dirty = true; }
    }
  }
  // ROOT CAUSE of "shadows floating way up in the sky" (Harry 2026-10-02): three-good-godrays reads the light's shadow
  // map texture and its camera near/far ONCE, when the pass first renders. When the fire's shadow map was re-made
  // (detail dial, caster swap) or its camera far changed (the light's reach is set a frame after the pass is built:
  // 20 ft at construction, 30 ft once the fire runs), the shafts kept raymarching the old map with the wrong depth
  // scale: shadow volumes hanging in the air until any setting change rebuilt the pass. Re-arm it whenever they drift.
  let grMap = null;
  function syncGodrays() {
    if (!godrays) return;
    const L = godrays.props.light, ip = godrays.illumPass, u = ip.material.uniforms;
    godrays.enabled = !!(L.castShadow && L.visible);
    const map = L.shadow.map;
    if (map !== grMap || Math.abs(u.lightCameraFar.value - L.shadow.camera.far) > 1e-3 || Math.abs(u.lightCameraNear.value - L.shadow.camera.near) > 1e-3) {
      grMap = map; ip.shadowMapSet = false; if (!map) ip.updateUniforms(godrays.props, godrays.lastParams);
    }
  }
  let castT = 0;
  function markCasters(now) { // fire shadows need the room's meshes to cast + receive; new items arrive all the time
    if (now - castT < (castList ? 300 : 1000)) return; castT = now;
    if (!P.on || P.shadows.casters <= 0 || !viewer.shadows) return;
    const mark = (o) => { if (o.isMesh && !o.userData.fx && !o.material?.transparent) { o.castShadow = !o.userData.noCast; o.receiveShadow = true; } };
    if (castList) { for (const g of castList) g.traverse(mark); return; } // (drawn from a list: only what is within the light's reach can cast or be shadowed)
    scene.traverse(mark);
  }

  function apply() {
    // fill
    if (hemi) {
      hemi.intensity = base.hemi * (P.on ? P.fill.ambient : 1);
      if (base.hemiSky) hemi.color.copy(base.hemiSky).lerp(new THREE.Color('#ffb877'), P.on ? P.fill.warmFill * 0.6 : 0);
    }
    if (sun) sun.intensity = base.sun * (P.on ? P.fill.sun : 1);
    // post
    exposure.uniforms.get('exposure').value = P.tone.exposure;
    tone.mode = TONE[P.tone.mode] ?? ToneMappingMode.AGX;
    bloom.intensity = P.bloom.strength; bloom.luminanceMaterial.threshold = P.bloom.threshold; bloom.mipmapBlurPass.radius = P.bloom.spread;
    const q = P.ao.quality;
    Object.assign(ao.configuration, { intensity: P.ao.strength, aoRadius: P.ao.radius, distanceFalloff: Math.max(0.5, P.ao.radius * 0.4), halfRes: q === 'low' || ao === aoHalf, aoSamples: q === 'high' ? 16 : 8, denoiseSamples: q === 'high' ? 8 : 4, denoiseRadius: q === 'high' ? 12 : 8 });
    grade.uniforms.get('warmth').value = P.grade.warmth; grade.uniforms.get('saturation').value = P.grade.saturation; grade.uniforms.get('contrast').value = P.grade.contrast;
    vignette.darkness = P.grade.vignette; vignette.offset = 0.3;
    if (godrays) godrays.setParams(shaftParams());
    const sig = [P.ao.strength > 0, P.shafts.on, P.bloom.strength > 0 && viewer.bloom, viewer.aa, P.grade.vignette > 0, !!godraysLight].join();
    if (sig !== effectSig) { effectSig = sig; rebuildPasses(); }
    applyShadowBudget(true);
  }

  rebuildPasses(); apply(); applyPerf();
  const counters = { post_passes: 0 };
  return {
    get params() { return P; },
    set(p) { P = p; apply(); },
    apply,
    setAtmosPass(pass) { atmosPass = pass; rebuildPasses(); },
    setFogWarPass(pass) { fogWarPass = pass; rebuildPasses(); },
    setGlowPass(pass) { glowPass = pass; rebuildPasses(); },
    setWaterPass(pass) { waterPass = pass; rebuildPasses(); },
    setHazeBoost(v) { if (Math.abs(v - hazeBoost) < 1e-6) return; hazeBoost = v; if (godrays) godrays.setParams(shaftParams()); },
    setFireLights(list) { fireLights = list; dirty = true; applyShadowBudget(true); },
    frame(now) { markCasters(now); budgetTick(now); syncShadowCams(); refreshShadows(now); syncGodrays(); seeThroughTick(now); fadeTick(); },
    shed, get shedding() { return { ...shedState, fading: !!aoFade }; },
    setViewer, get viewer() { return { ...viewer }; },
    // frame-time switches (each one off = the code as it was before 2026-10-06): { aoList, shadowList }
    get perf() { return { ...perf }; },
    setPerf(p) { Object.assign(perf, p); applyPerf(); dirty = true; },
    markDirty() { dirty = true; },
    // composer.setSize sizes every pass at the DRAWING-BUFFER size (CSS px x pixel ratio). Never size N8AO separately in
    // CSS px: on a pixel-ratio-2 screen its depth/AO buffers came out half size, so the whole map's AO was sampled
    // from the wrong texels: a ghost copy of the map's darkening floating above it, sliding as you zoom (Harry 2026-10-02).
    setSize(w, h) { size.set(w, h); composer.setSize(w, h, false); },
    render(dt) {
      if (!P.on) { renderer.render(scene, camera); counters.post_passes = 0; return; }
      // EffectComposer only chooses its screen pass when passes are added or
      // removed. A disabled last pass otherwise strands the picture offscreen.
      effectPass.renderToScreen = true;
      if (fogWarPass) { fogWarPass.renderToScreen = false; fogWarPass.exposure = P.tone.exposure; }
      drawShadows();
      composer.render(dt / 1000);
      fogWarPass?.drawLateOverlays?.();
      counters.post_passes = composer.passes.filter(p => p.enabled).length;
    },
    stats() {
      const gu = godrays?.illumPass.material.uniforms, gl = godrays?.props.light;
      return { shafts_far_ok: !godrays || Math.abs(gu.lightCameraFar.value - gl.shadow.camera.far) < 1e-3, shafts_map_ok: !godrays || !gl.shadow.map || godrays.illumPass.originalShadowMap === gl.shadow.map.texture || gu.shadowMap.value === gl.shadow.map.texture, shadow_frame: frameNo, shadow_last_refresh: lastRefresh, shadow_last_motion: lastMotionFrame, post_passes: counters.post_passes, shadow_casters: fireLights.filter(l => l.castShadow).length, fire_lights: fireLights.length, shafts: !!(P.on && P.shafts.on && godraysLight), shadow_why: { ...why }, shed_dance: shedState.dance, shed_ao: shedState.ao, viewer_shadows: viewer.shadows, viewer_contact: viewer.contact, viewer_half: viewer.half, ao_half: !!ao.configuration.halfRes, ao_intensity: +(+ao.configuration.intensity).toFixed(3), ao_enabled: ao.enabled !== false, shadow_list: castList ? castList.length : null, shadow_list_draws: castDraws, shadow_sig: shadowSig.slice(0, 80), ao_see_through: tDrawn, ao_listed: tList.length, ao_scans: tScans, ao_scan_ms: +tScanMs.toFixed(2), ao_aware: !!ao.configuration.transparencyAware, graph_gen: graph.gen };
    },
    composer,
  };
}
