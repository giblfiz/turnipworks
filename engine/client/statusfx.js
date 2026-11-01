// CONDITIONS ON THE TABLE (Harry's design of 2026-10-15, built 2026-10-29; docs/PAWNS.md "Conditions on the table").
// No icon badges: "big cartoony, easy to follow". What a pawn's `conditions` look like (core/conditions.js statusOf):
//   poses      prone: the figure on its side; unconscious: on its back, with Z's drifting up; dead: face down, greyed
//   orbiters   charmed, stunned, frightened, blinded, grappled, restrained, poisoned, paralyzed: a picture each, round ONE
//              ring over the head, evenly spaced, a little smaller as more join; past 4: three and "+N". A word TW has no
//              look for (Beyond20's deafened, "Hexed" typed in the bar, an AI seat's text) is a small text label on the
//              same ring, on a generated wooden plate, and counts in the "+N".
//   the base   incapacitated: its coloured rim goes dim grey; exhaustion 1-6: a 6-segment drain ring over the rim, the
//              drained segments yellow to red, at 6 the whole ring black and a skull; concentrating: a slowly turning
//              rune circle on the floor round the base
//   the body   invisible: rippling glass for its owner and the GM; for everyone else a faint shimmer, no figure
// Visible to every seat that is sent the pawn (conditions are not secrets), except Invisible as above.
//
// COST: every orbiter of every pawn in a world is ONE instanced draw (a picture atlas), every text label one more (a
// canvas atlas of the words), every floor ring one more (runes and drain share a picture): three draw calls for the
// whole table, whatever the number of pawns. Instances are rewritten each drawn frame (a few floats per orbiter).
// Poses and the body looks change the pawn's own visual in place (its figure node turned; its materials swapped for
// shared treated clones), so they cost nothing per frame. The Low graphics preset and "reduce motion" park the orbiters
// still (evenly round the ring) and stop the runes turning.
//
// The pictures: engine/client/data/icons/status/ (git-ignored like every picture; Codex image_gen, packed by
// experiments/2026-10-29-statusfx/pack_atlas.py). Without them an orbiter is drawn as its word on the text ring.
import * as THREE from 'three';
import * as CO from '../core/conditions.js';

export const STATUS = {
  size: 0.036,        // an orbiter's height, as a share of the view (a pawn's indicator is 0.052)
  shrink: 0.06,       // smaller by this share for each more entry on the ring
  rx: 0.05, ry: 0.021, grow: 0.007, // the ring's half-width and half-height on screen, and what each more entry adds (ry 0.013 let the near and far orbiters overlap: Gemini)
  // HOW HIGH (2026-10-29, Harry: the indicators "probably shouldn't be quite so high"): the ring's point is the top of the
  // head raised by `fig` of the figure's height (so a giant's ring sits higher over it than a kobold's), and the ring's
  // nearest pictures' bottom edge `clear` of the view over that point (negative: they come down over the crown). The name
  // label (when it floats) stands `gap` over the ring's top, the indicator over that; with no ring, the indicator stands
  // `markClear` over the head. ?statuslift=clear:-0.01,fig:0.03 to compare
  clear: -0.010, fig: 0.03, gap: 0.004, markClear: 0.006, // (Gemini's pick of three at table distance, 99%: was -0.021 / 0, the pictures over the faces; 0.002 / 0.05 "too high")
  zLift: 0.009,       // the Z's start this far over the head (screen share)
  textH: 0.72,        // a text label's height as a share of an orbiter's (0.5 was unreadable at table distance: Gemini, round 1)
  speed: 0.9,         // radians a second round the ring
  zzzPeriod: 2.6,     // seconds for a Z to rise and fade
  runeSpin: 0.25,     // radians a second
  maskFade: 10,       // px: a picture fades out over this much before it would reach a ring button
  drain: { outer: 1.42, lift: 0.06, colors: ['#f2d13a', '#f2b232', '#f08a2b', '#ea6326', '#e23b2e', '#0c0b0a'], off: '#3b3631', offAlpha: 0.55 },
  runes: { outer: 1.62, outerWithDrain: 1.95, lift: 0.05 }, // (with a drain ring too: outside it)
  dimRim: { mix: 0.82, grey: '#5d5a56', dark: 0.55 }, // incapacitated: the rim's colour mixed this far toward a darker grey than the disc
  copies: [0, 3, 2],  // one entry on the ring is drawn three times, two twice each (the cartoon stars round a dazed head)
  picks: { frightened: 'frightened-ghost', blinded: 'blinded-eye', poisoned: 'poisoned-skull' }, // the art for a word; ?statusart=frightened:frightened-bang to compare
};
const BASE = new URL('./data/icons/status/', import.meta.url).href;
const TAU = Math.PI * 2;
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 1000) / 1000; };

// ---------------- the shared pictures (one load for every world) ----------------
let SHARED = null;
function shared() {
  if (SHARED) return SHARED;
  const S = SHARED = { meta: null, sprites: null, decals: null, plate: null, ready: false, listeners: new Set(), time: { value: 0 } };
  try { const q = new URLSearchParams(location.search).get('statusart'); if (q) for (const p of q.split(',')) { const [w, a] = p.split(':'); if (w && a) STATUS.picks[w] = a; } } catch { }
  try { const q = new URLSearchParams(location.search).get('statuslift'); if (q) for (const p of q.split(',')) { const [k, v] = p.split(':'); if (['clear', 'fig', 'gap', 'markClear'].includes(k) && Number.isFinite(+v)) STATUS[k] = +v; } } catch { }
  fetch(BASE + 'status.json').then(r => r.ok ? r.json() : null).then(meta => {
    if (!meta) return;
    S.meta = meta; const L = new THREE.TextureLoader(); let n = 0; const done = () => { if (++n === 3) { S.ready = true; for (const f of S.listeners) f(); } };
    const tex = (file, cb) => L.load(BASE + file, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; cb(t); done(); }, undefined, () => done());
    tex(meta.sprites.file, (t) => { S.sprites = t; });
    tex(meta.decals.file, (t) => { S.decals = t; });
    const im = new Image(); im.onload = () => { S.plate = im; done(); }; im.onerror = done; im.src = BASE + meta.plate.file;
  }).catch(() => { });
  return S;
}

// ---------------- the words: one canvas atlas of text plates ----------------
const TW = 256, TH = 64, COLS = 4, ROWS = 16;
function textAtlas(S) {
  const c = document.createElement('canvas'); c.width = TW * COLS; c.height = TH * ROWS;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const slots = new Map(), free = [...Array(COLS * ROWS).keys()]; let frame = 0;
  function draw(i, text) {
    const x = (i % COLS) * TW, y = Math.floor(i / COLS) * TH;
    g.clearRect(x, y, TW, TH);
    g.font = '800 38px Inter, system-ui, sans-serif';
    let t = text, w = g.measureText(t).width; const maxW = TW - 30;
    while (w > maxW && t.length > 2) { t = t.slice(0, -1); w = g.measureText(t + '…').width; } if (t !== text) t += '…';
    const pw = Math.min(TW - 2, Math.ceil(w + 30)), px = x + (TW - pw) / 2;
    if (S.plate) { const P = S.plate, cap = Math.round(P.width * (S.meta?.plate?.cap ?? 0.16)), ch = Math.round(cap * (TH - 4) / P.height); // the plate's two ends as made, its middle stretched to the word
      g.drawImage(P, 0, 0, cap, P.height, px, y + 2, ch, TH - 4); g.drawImage(P, cap, 0, P.width - 2 * cap, P.height, px + ch, y + 2, Math.max(1, pw - 2 * ch), TH - 4); g.drawImage(P, P.width - cap, 0, cap, P.height, px + pw - ch, y + 2, ch, TH - 4); }
    else { g.fillStyle = 'rgba(40,28,18,0.92)'; g.beginPath(); g.roundRect(px, y + 6, pw, TH - 12, 12); g.fill(); } // (until the plate picture has loaded)
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 6; g.strokeStyle = 'rgba(25,16,10,0.9)';
    g.strokeText(t, x + TW / 2, y + TH / 2 + 1); g.fillStyle = '#f6ecd2'; g.fillText(t, x + TW / 2, y + TH / 2 + 1);
    tex.needsUpdate = true;
    return [(px - 1) / c.width, 1 - (y + TH) / c.height, (pw + 2) / c.width, TH / c.height, (pw + 2) / TH];
  }
  return {
    tex,
    get(text) { // [u, v, w, h, aspect]
      let s = slots.get(text);
      if (!s) {
        if (!free.length) { let old = null; for (const [k, v] of slots) if (v.seen < frame && (!old || v.seen < old[1].seen)) old = [k, v]; if (!old) return null; slots.delete(old[0]); free.push(old[1].i); }
        const i = free.shift(); s = { i, rect: draw(i, text) }; slots.set(text, s);
      }
      s.seen = frame; return s.rect;
    },
    tick() { frame++; },
    redraw() { for (const [t, s] of slots) s.rect = draw(s.i, t); },
    size: () => slots.size,
  };
}

// where the vertex shader puts a picture, as an offset from its pawn's point (view units at distance 1, y up) and its half
// size: orbit [th, lift, mode, size], extra [aspect, alpha, rx, ry], sp the turning speed now
function placeOf([th0, ly, mode, size], extra, sp) {
  let ox = 0, oy = ly, k = 1;
  if (mode < 0.5) { const th = th0 + SHARED.time.value * sp, b = Math.min(1, Math.max(0, Math.sin(th))); ox = Math.cos(th) * extra[2]; oy += Math.sin(th) * extra[3]; k = 1 - 0.16 * b; }
  else if (mode < 1.5) { const p = sp > 0 ? (th0 + SHARED.time.value / STATUS.zzzPeriod) % 1 : th0; ox = 0.01 + 0.03 * p + 0.008 * Math.sin(p * 8); oy += 0.07 * p; k = 0.55 + 0.75 * p; }
  return [ox, oy, size * extra[0] * k / 2, size * k / 2];
}

// ---------------- the instanced quads ----------------
const SPRITE_VS = `
attribute vec3 aCenter; attribute vec4 aOrbit; attribute vec4 aUv; attribute vec4 aExtra;
uniform float uTime; uniform float uSpeed; uniform float uZzz;
varying vec2 vUv; varying float vA;
void main() {
  vec4 mv = viewMatrix * vec4(aCenter, 1.0);
  float persp = projectionMatrix[2][3] == -1.0 ? -mv.z : 1.0;
  float mode = aOrbit.z, size = aOrbit.w, k = 1.0, a = 1.0;
  vec2 off = vec2(0.0, aOrbit.y);
  if (mode < 0.5) {            // on the ring: x = rx cos, y = ry sin; the far half (y > 0) a little smaller and dimmer
    float th = aOrbit.x + uTime * uSpeed, b = clamp(sin(th), 0.0, 1.0);
    off += vec2(cos(th) * aExtra.z, sin(th) * aExtra.w); k = 1.0 - 0.16 * b; a = 1.0 - 0.3 * b;
  } else if (mode < 1.5) {     // a Z: rises from the head, drifting, growing and fading
    float p = uSpeed > 0.0 ? fract(aOrbit.x + uTime * uZzz) : aOrbit.x;
    off += vec2(0.01 + 0.03 * p + 0.008 * sin(p * 8.0), 0.07 * p); k = 0.55 + 0.75 * p; a = smoothstep(0.0, 0.12, p) * (1.0 - smoothstep(0.65, 1.0, p));
  }
  vec2 q = position.xy * vec2(size * aExtra.x, size) * k;
  mv.xy += (off + q) * persp;
  gl_Position = projectionMatrix * mv;
  vUv = aUv.xy + uv * aUv.zw; vA = a * aExtra.y;
}`;
const SPRITE_FS = `
uniform sampler2D uMap; varying vec2 vUv; varying float vA;
void main() {
  vec4 c = texture2D(uMap, vUv); c.a *= vA; if (c.a < 0.02) discard; gl_FragColor = c;
  #include <colorspace_fragment>
}`;
const DECAL_VS = `
attribute vec3 aCenter; attribute vec4 aD; attribute vec4 aUv;
uniform float uTime; uniform float uSpin;
varying vec2 vUv; varying vec2 vLocal; varying float vMode; varying float vLevel;
void main() {
  float ang = aD.w + (aD.y < 0.5 ? uTime * uSpin : 0.0), c = cos(ang), s = sin(ang);
  vec2 p = position.xy * 2.0 * aD.x, rp = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(aCenter + vec3(rp.x, 0.0, -rp.y), 1.0);
  vUv = aUv.xy + uv * aUv.zw; vLocal = uv - 0.5; vMode = aD.y; vLevel = aD.z;
}`;
const DECAL_FS = `
uniform sampler2D uMap; uniform vec3 uCols[6]; uniform vec3 uOff; uniform float uOffA; uniform float uGap;
varying vec2 vUv; varying vec2 vLocal; varying float vMode; varying float vLevel;
void main() {
  vec4 t = texture2D(uMap, vUv);
  if (vMode < 0.5) { if (t.a < 0.02) discard; gl_FragColor = t; }
  else {
    float ang = degrees(atan(vLocal.x, vLocal.y)); ang = mod(ang - uGap + 720.0, 360.0);
    float seg = floor(ang / 60.0), lvl = floor(vLevel + 0.5);
    vec3 col = seg < lvl ? uCols[int(clamp(lvl, 1.0, 6.0)) - 1] : uOff;
    float a = t.a * (seg < lvl ? 1.0 : uOffA);
    if (a < 0.02) discard;
    gl_FragColor = vec4(col, a);
  }
  #include <colorspace_fragment>
}`;
function quads(cap, vs, fs, uniforms, attrs) {
  const plane = new THREE.PlaneGeometry(1, 1), geo = new THREE.InstancedBufferGeometry();
  geo.index = plane.index; geo.setAttribute('position', plane.attributes.position); geo.setAttribute('uv', plane.attributes.uv);
  const A = {}; for (const [k, n] of Object.entries(attrs)) { A[k] = new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n); A[k].setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, A[k]); }
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.userData.halo = true; mesh.userData.noPick = true; mesh.userData.statusFx = true; mesh.raycast = () => { };
  return { mesh, geo, A, cap, attrs };
}
function grow(Q, need) {
  if (need <= Q.cap) return;
  const cap = Math.max(need, Q.cap * 2);
  for (const [k, n] of Object.entries(Q.attrs)) { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n); a.setUsage(THREE.DynamicDrawUsage); a.array.set(Q.A[k].array); Q.A[k] = a; Q.geo.setAttribute(k, a); }
  Q.cap = cap;
}

// ---------------- the body looks (materials) ----------------
const greyChunk = 'float _l = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114)); gl_FragColor.rgb = mix(vec3(_l), gl_FragColor.rgb, 0.08) * 0.78;';
const glassChunk = (others) => `{ vec3 _n = normalize(normal); vec3 _v = normalize(vViewPosition); float _f = pow(1.0 - abs(dot(_n, _v)), 2.0);
  float _b = 0.5 + 0.5 * sin(-vViewPosition.y * 5.0 - uStatusTime * 3.2 + vViewPosition.x * 2.0);
  ${others
    ? 'gl_FragColor = vec4(vec3(0.86, 0.93, 1.0), 0.16 * _f * _f * _f * (0.3 + 0.7 * _b));' // (others: a faint ripple at the edges, no figure; Gemini read a brighter shimmer as "a visible ghost")
    : 'gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.7, 0.9, 1.0), 0.25 * _f + 0.12 * _b); gl_FragColor.a = 0.3 + 0.35 * _f + 0.12 * _b;'} }`; // (owner, GM: the painted figure as rippling glass, not a white glow)
const treated = new WeakMap(); // original material -> { grey, glass, shimmer }
function treatedMat(m, how, time) {
  let T = treated.get(m); if (!T) treated.set(m, T = {});
  if (T[how]) return T[how];
  const t = m.clone();
  if (how !== 'grey') { t.transparent = true; t.depthWrite = false; t.opacity = 1; }
  if (how !== 'grey' && !(m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshLambertMaterial)) { t.opacity = how === 'glass' ? 0.4 : 0.12; t.userData = { ...m.userData, statusLook: how }; return T[how] = t; } // (no lit shading to ripple: plain see-through)
  t.onBeforeCompile = (sh) => {
    if (how !== 'grey') { sh.uniforms.uStatusTime = time; sh.fragmentShader = 'uniform float uStatusTime;\n' + sh.fragmentShader; }
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>\n${how === 'grey' ? greyChunk : glassChunk(how === 'shimmer')}`);
  };
  t.customProgramCacheKey = () => `status-${how}`;
  t.userData = { ...m.userData, statusLook: how };
  return T[how] = t;
}

// ---------------- one world's ----------------
export function createStatusFx(world) {
  const S = shared();
  const T = S.time;
  const sprites = quads(64, SPRITE_VS, SPRITE_FS, { uMap: { value: null }, uTime: T, uSpeed: { value: STATUS.speed }, uZzz: { value: 1 / STATUS.zzzPeriod } }, { aCenter: 3, aOrbit: 4, aUv: 4, aExtra: 4 });
  const words = quads(32, SPRITE_VS, SPRITE_FS, { uMap: { value: null }, uTime: T, uSpeed: sprites.mesh.material.uniforms.uSpeed, uZzz: sprites.mesh.material.uniforms.uZzz }, { aCenter: 3, aOrbit: 4, aUv: 4, aExtra: 4 });
  const dc = STATUS.drain.colors.map(c => new THREE.Color(c));
  const decals = quads(16, DECAL_VS, DECAL_FS, { uMap: { value: null }, uTime: T, uSpin: { value: STATUS.runeSpin }, uCols: { value: dc }, uOff: { value: new THREE.Color(STATUS.drain.off) }, uOffA: { value: STATUS.drain.offAlpha }, uGap: { value: 0 } }, { aCenter: 3, aD: 4, aUv: 4 });
  for (const Q of [sprites, words]) { Q.mesh.material.depthTest = false; Q.mesh.renderOrder = 41; }
  Object.assign(decals.mesh.material, { polygonOffset: true, polygonOffsetFactor: -4 }); decals.mesh.renderOrder = 5;
  const text = textAtlas(S); words.mesh.material.uniforms.uMap.value = text.tex;
  const onReady = () => { sprites.mesh.material.uniforms.uMap.value = S.sprites; decals.mesh.material.uniforms.uMap.value = S.decals; decals.mesh.material.uniforms.uGap.value = S.meta?.decals?.drainGapDeg || 0; text.redraw(); for (const r of world.pawns) apply(r, true); };
  if (S.ready) onReady(); else S.listeners.add(onReady);
  world.layers.deco.add(sprites.mesh, words.mesh, decals.mesh);
  const live = new Set(); // recs with something to draw per frame

  // who sees an invisible pawn as glass (its owner, the GM side); everyone else sees the shimmer
  const seesInvisible = (e) => !!(world.gmSide || (e.owner && e.owner === world.statusViewer?.()));
  const still = () => !!world.statusStill?.();

  // ---- a pawn's look: called whenever it is placed (its entity may have changed) and when its figure arrives ----
  function apply(r, force = false) {
    const e = r.entity; if (e.kind !== 'token') return;
    const st = CO.statusOf(e.conditions), inv = st.invisible ? (seesInvisible(e) ? 'glass' : 'shimmer') : '';
    const bodyKey = `${st.pose}|${st.grey}|${inv}|${r.visual?.userData.body?.uuid || r.visual?.uuid || ''}`;
    r.status = st;
    if (force || r.statusBody !== bodyKey) { r.statusBody = bodyKey; pose(r, st.pose); body(r, st.grey ? 'grey' : inv); world.dropHalos?.(e.id); if (r.label) r.label.position.y = headY(r) + 0.95; world.placeMark?.(r); }
    rim(r, st.dim);
    if (st.orbit.length || st.zzz || st.drain || st.runes) live.add(r); else live.delete(r);
    lift(r);
  }
  function drop(r) { live.delete(r); }

  // POSES: the figure node (a figure's holder; the stand-in's body) turned, then moved so it lies ON its disc, centred
  const _m = new THREE.Matrix4(), _b = new THREE.Box3(), _bb = new THREE.Box3();
  function poseNode(r) { const U = r.visual?.userData; return U?.holder || r.visual?.children?.find(c => c.isMesh && c.geometry?.type === 'CapsuleGeometry') || null; }
  // the figure's box in the pawn visual's own frame, from its vertices (a sample of at most ~4000 a mesh: the box of a
  // turned bounding box is too big by half for a figure laid down)
  const _q = new THREE.Vector3(), _mm = new THREE.Matrix4();
  function boxIn(node, frame) {
    frame.updateMatrixWorld(true); _m.copy(frame.matrixWorld).invert(); _b.makeEmpty();
    node.traverse(o => { if (!o.isMesh || o.userData.pawnBase) return; const P = o.geometry.attributes.position; if (!P) return; _mm.multiplyMatrices(_m, o.matrixWorld); const st = Math.max(1, Math.floor(P.count / 4000)); for (let i = 0; i < P.count; i += st) _b.expandByPoint(_q.fromBufferAttribute(P, i).applyMatrix4(_mm)); });
    return _b;
  }
  function pose(r, how) {
    const v = r.visual, n = poseNode(r); if (!v || !n) return;
    if (!n.userData.home) n.userData.home = { p: n.position.clone(), r: n.rotation.clone() };
    const H = n.userData.home; n.position.copy(H.p); n.rotation.copy(H.r);
    r.poseTop = null;
    if (!how) return;
    const top = v.userData.top ?? 0.3;
    if (how === 'side') n.rotation.z = Math.PI / 2; else if (how === 'back') n.rotation.x = -Math.PI / 2; else if (how === 'down') n.rotation.x = Math.PI / 2;
    const b = boxIn(n, v); if (b.isEmpty()) return;
    n.position.x -= (b.min.x + b.max.x) / 2; n.position.z -= (b.min.z + b.max.z) / 2; n.position.y += top - b.min.y;
    r.poseTop = b.max.y - b.min.y + top;
  }
  // THE BODY: materials swapped for treated clones (shared per original material), put back when the condition goes
  function body(r, how) {
    const n = poseNode(r); if (!n) return;
    n.traverse(o => {
      if (!o.isMesh || o.userData.pawnBase || o.userData.figureStandIn) return;
      const base = o.userData.statusBase || o.material;
      if (!how) { if (o.userData.statusBase) { o.material = o.userData.statusBase; delete o.userData.statusBase; if (o.userData.statusShadow != null) { o.castShadow = o.userData.statusShadow; delete o.userData.statusShadow; } } return; }
      if (Array.isArray(base)) return;
      o.userData.statusBase = base; o.material = treatedMat(base, how, T);
      if (how !== 'grey') { if (o.userData.statusShadow == null) o.userData.statusShadow = o.castShadow; o.castShadow = false; } else if (o.userData.statusShadow != null) { o.castShadow = o.userData.statusShadow; delete o.userData.statusShadow; }
    });
  }
  // INCAPACITATED: the coloured rim dimmed toward a darker grey than the disc (its seat colour still faintly there)
  function rim(r, dim) {
    const B = r.visual?.userData.base?.userData, m = B?.rim?.material; if (!m) return;
    const c = B.color || ('#' + m.color.getHexString());
    if (!dim) { if (B.statusDim) { B.statusDim = false; B.setColor?.(c); } return; }
    if (B.statusDim === c) return;
    const k = new THREE.Color(c).lerp(new THREE.Color(STATUS.dimRim.grey), STATUS.dimRim.mix).multiplyScalar(STATUS.dimRim.dark);
    m.color.copy(k); m.emissive.copy(k); m.emissiveIntensity = 0.05; B.statusDim = c;
    const keep = B.setColor; if (keep && !keep.statusWrapped) { const wrapped = (col) => { keep(col); if (B.statusDim) { B.statusDim = false; rim(r, true); } }; wrapped.statusWrapped = true; B.setColor = wrapped; }
  }
  // THE STACK OVER THE HEAD (lowest first): the ring of pictures, the floating name / damage label, the indicator. The ring
  // is placed per frame (frame); the label and the indicator are screen-sized sprites standing on the ring's point, each
  // lifted on screen by `center.y` past what is under it (a sprite's bottom is -center.y of its height over its point)
  function lift(r) {
    const R0 = ringOf(r), on = R0.n > 0, wy = ringY(r), top = on ? ringTop(R0) : 0, gap = STATUS.gap;
    const lh = r.label ? r.label.scale.y || 0.03 : 0;
    if (r.label) { if (on) { r.label.position.y = wy; r.label.center.y = -(top + gap) / lh; } else { r.label.position.y = headY(r) + 0.95; r.label.center.y = 0.5; } } // (no ring: where world.js puts it)
    if (r.mark) {
      const mh = r.mark.scale.y || 0.052;
      if (r.label && !on) { r.mark.position.copy(r.label.position); r.mark.center.y = -0.5; } // (on its label, as before)
      else { r.mark.position.set(0, on ? wy : headY(r) * (1 + STATUS.fig), 0); r.mark.center.y = -((on ? top + gap : STATUS.markClear) + (r.label ? lh + gap : 0)) / mh; }
    }
  }
  const ringY = (r) => headY(r) * (1 + STATUS.fig);                       // the ring's point over the pawn (its own frame)
  const ringLift = (R0) => R0.ry + R0.size / 2 + STATUS.clear;            // the ring's middle over that point (view share)
  const ringTop = (R0) => ringLift(R0) + R0.ry + 0.42 * R0.size;          // its far pictures' top edge (they are drawn 0.84 the size)
  // THE RING'S ENTRIES for a pawn: [{ cell | text, name }], how many times each is drawn (pictures only: a word once), its size
  function ringOf(r) {
    const cells = S.ready && S.meta ? S.meta.sprites.cells : null, { shown: list, more } = CO.orbitShown(r.status?.orbit || []);
    const entries = list.map(o => { const a = o.art && (STATUS.picks[o.art] || o.art); return a && cells?.[a] ? { cell: cells[a], name: o.key } : { text: o.text || o.key, name: o.text || o.key }; });
    if (more.length) entries.push({ text: `+${more.length}`, name: more.map(o => o.text || o.key).join(', ') });
    if (r.status?.drain >= CO.EXHAUSTION_MAX && cells?.['exhaust-skull']) entries.unshift({ cell: cells['exhaust-skull'], name: `exhaustion ${CO.EXHAUSTION_MAX}` }); // (level 6: its skull on the ring, the floor ring black)
    const n = entries.length, copies = n && entries.every(e => e.cell) ? STATUS.copies[n] || 1 : 1;
    return { entries, n, copies, total: n * copies, size: STATUS.size * Math.max(0.7, 1 - STATUS.shrink * (n - 1)), rx: STATUS.rx + STATUS.grow * (n - 1), ry: STATUS.ry + STATUS.grow * 0.3 * (n - 1) };
  }
  const headY = (r) => r.poseTop != null ? r.poseTop : (r.visual?.userData.labelY != null ? r.visual.userData.labelY - 0.95 : 3.6);

  // ---- per drawn frame: the instances ----
  const _p = new THREE.Vector3();
  function shown(r) {
    if (!r.group.visible || r.asleep || !r.group.parent || !r.visual || r.visual.visible === false) return false;
    for (let o = r.group.parent; o; o = o.parent) if (!o.visible) return false;
    return !(world.fogActive && world.fogRule?.(r.entity));
  }
  // UNDER THE OPEN RING NOTHING IS DRAWN (2026-10-29): an orbiter, a text plate or a Z whose picture would sit under a
  // ring button (or its open panel) fades out over the last few px before it gets there, and back as it comes out; so
  // does a pawn's indicator. The buttons are in the page over the canvas; the instance's place is the shader's, on the CPU.
  const _c = new THREE.Vector3();
  function maskOf(camera) {
    const M = camera && world.statusMask?.(camera); if (!M || !(M.circles.length || M.rects.length)) return null;
    const P = camera.projectionMatrix.elements, R = M.rect; camera.updateMatrixWorld();
    return { ...M, f: P[5] * R.height / 2, R, cx: 0, cy: 0, ok: false,
      at(x, y, z) { _c.set(x, y, z).applyMatrix4(camera.matrixWorldInverse); this.ok = !(P[11] === -1 && _c.z >= 0); _c.applyMatrix4(camera.projectionMatrix); this.cx = R.left + (_c.x + 1) / 2 * R.width; this.cy = R.top + (1 - _c.y) / 2 * R.height; return this.ok; },
      // 0 under a button .. 1 clear of every one by FADE px; (ox, oy) the picture's offset (view units, y up), (hx, hy) its half size
      alpha(ox, oy, hx, hy) {
        if (!this.ok) return 1;
        const x = this.cx + ox * this.f, y = this.cy - oy * this.f, h = Math.max(hx, hy) * this.f; let d = Infinity;
        for (const [X, Y, r] of this.circles) d = Math.min(d, Math.hypot(x - X, y - Y) - r - h);
        for (const [l, t, r, b] of this.rects) d = Math.min(d, Math.hypot(Math.max(l - x, 0, x - r), Math.max(t - y, 0, y - b)) - (x > l && x < r && y > t && y < b ? h + 1e3 : h));
        return d <= 0 ? 0 : d >= STATUS.maskFade ? 1 : d / STATUS.maskFade;
      } };
  }
  let masked = 0; // (tests) instances faded out under the ring this frame
  const last = { on: false, list: [] }; // (tests) every picture's screen box and alpha, the last frame the ring was open
  function frame(now, camera) {
    T.value = now / 1000;
    const isStill = still(), sp = isStill ? 0 : STATUS.speed; sprites.mesh.material.uniforms.uSpeed.value = sp; decals.mesh.material.uniforms.uSpin.value = isStill ? 0 : STATUS.runeSpin;
    text.tick();
    let ns = 0, nw = 0, nd = 0;
    const mk = maskOf(camera); masked = 0; if (mk && last.on) last.list = [];
    let pc = null; // the pawn whose centre mk was last projected for
    const fade = (c, orbit, extra) => {
      if (!mk) return extra;
      if (pc !== c) { pc = c; mk.at(c[0], c[1], c[2]); }
      const [ox, oy, hx, hy] = placeOf(orbit, extra, sp), a = mk.alpha(ox, oy, hx, hy); if (a < 1) masked++;
      if (last.on && mk.ok) last.list.push({ x: mk.cx + ox * mk.f, y: mk.cy - oy * mk.f, hw: hx * mk.f, hh: hy * mk.f, a: +(a * extra[1]).toFixed(3) });
      return a === 1 ? extra : [extra[0], extra[1] * a, extra[2], extra[3]];
    };
    const put = (Q, i, c, orbit, uvr, extra) => { extra = fade(c, orbit, extra); Q.A.aCenter.array.set(c, i * 3); Q.A.aOrbit.array.set(orbit, i * 4); Q.A.aUv.array.set(uvr, i * 4); Q.A.aExtra.array.set(extra, i * 4); };
    // a pawn's indicator (world.js refreshTokenMark: a screen-sized sprite standing on its point) the same way
    for (const r of world.pawns) {
      const m = r.mark; if (!m) continue;
      let a = 1;
      if (mk && m.visible) { // (a sprite with sizeAttenuation off: scale.y is its height in view units at distance 1, as an orbiter's size)
        const E = m.matrixWorld.elements, sx = Math.hypot(E[0], E[1], E[2]), sy = Math.hypot(E[4], E[5], E[6]);
        if (mk.at(E[12], E[13], E[14])) { const ox = (0.5 - m.center.x) * sx, oy = (0.5 - m.center.y) * sy; a = mk.alpha(ox, oy, sx / 2, sy / 2); if (last.on) last.list.push({ mark: r.entity.id, x: mk.cx + ox * mk.f, y: mk.cy - oy * mk.f, hw: sx / 2 * mk.f, hh: sy / 2 * mk.f, a }); }
      }
      if (m.material.opacity !== a) m.material.opacity = a; if (a < 1) masked++;
    }
    const cells = S.ready && S.meta ? S.meta.sprites.cells : null;
    for (const r of live) {
      if (!world.recs.has(r.entity.id) || world.recs.get(r.entity.id) !== r) { live.delete(r); continue; }
      if (!shown(r)) continue;
      const st = r.status, g = r.group, ph = hash(r.entity.id) * TAU;
      const hx = g.position.x, hz = g.position.z, sy = g.scale.y || 1, c = [hx, g.position.y + ringY(r) * sy, hz];
      // the ring: a picture where there is one (and the atlas has loaded), else the word
      const R0 = ringOf(r), ly = ringLift(R0);
      if (R0.n) {
        grow(sprites, ns + R0.total); grow(words, nw + R0.total);
        for (let j = 0; j < R0.total; j++) {
          const en = R0.entries[j % R0.n], th = ph + TAU * j / R0.total;
          if (en.cell) put(sprites, ns++, c, [th, ly, 0, R0.size], en.cell, [1, 1, R0.rx, R0.ry]);
          else { const R = text.get(en.text); if (!R) continue; put(words, nw++, c, [th, ly, 0, R0.size * STATUS.textH], R.slice(0, 4), [R[4], 1, R0.rx, R0.ry]); }
        }
      }
      if (st.zzz && cells?.zzz) { const zc = [hx, g.position.y + headY(r) * sy, hz]; grow(sprites, ns + 3); for (let k = 0; k < 3; k++) put(sprites, ns++, zc, [(k / 3 + ph) % 1, STATUS.zLift, 1, STATUS.size * 1.15], cells.zzz, [1, 1, 0, 0]); }
      const B = r.visual?.userData.base?.userData, rad = (B?.radius || 1.8) * Math.max(1, g.scale.x || 1), by = g.position.y - (r.footDrop || 0) + (r.visual?.userData.top ?? 0.3);
      if (st.drain && S.meta) { grow(decals, nd + 1); decals.A.aCenter.array.set([hx, g.position.y - (r.footDrop || 0) + STATUS.drain.lift, hz], nd * 3); decals.A.aD.array.set([rad * STATUS.drain.outer, 1, st.drain, 0], nd * 4); decals.A.aUv.array.set(S.meta.decals.drain, nd * 4); nd++;
      }
      if (st.runes && S.meta) { grow(decals, nd + 1); decals.A.aCenter.array.set([hx, g.position.y - (r.footDrop || 0) + STATUS.runes.lift, hz], nd * 3); decals.A.aD.array.set([rad * (st.drain ? STATUS.runes.outerWithDrain : STATUS.runes.outer), 0, 0, ph], nd * 4); decals.A.aUv.array.set(S.meta.decals.runes, nd * 4); nd++; }
    }
    for (const [Q, n] of [[sprites, ns], [words, nw], [decals, nd]]) { Q.geo.instanceCount = n; Q.mesh.visible = n > 0; if (n) for (const a of Object.values(Q.A)) { a.needsUpdate = true; a.clearUpdateRanges?.(); a.addUpdateRange?.(0, n * a.itemSize); } }
    return ns + nw + nd;
  }

  // ---- hover names (a selected pawn): which orbiter is under the pointer, or the whole list over the pawn ----
  const _v = new THREE.Vector3();
  function at(px, py, camera, rect, ids) {
    const t = T.value, sp = still() ? 0 : STATUS.speed, H = rect.height, W = rect.width;
    const proj = camera.projectionMatrix.elements, f = proj[5] * H / 2; // screen px per view unit at distance 1
    for (const r of live) {
      if (!ids.has(r.entity.id) || !shown(r)) continue;
      const g = r.group; _v.set(g.position.x, g.position.y + ringY(r) * (g.scale.y || 1), g.position.z);
      const mv = _v.clone().applyMatrix4(camera.matrixWorldInverse), d = proj[11] === -1 ? -mv.z : 1; if (d <= 0) continue;
      _v.project(camera); const cx = rect.left + (_v.x + 1) / 2 * W, cy = rect.top + (1 - _v.y) / 2 * H, k = f; // (the sprite units scale with distance: off * d in view space = off * f px)
      const R0 = ringOf(r), n = R0.n; if (!n) { if (Math.hypot(px - cx, py - cy) < STATUS.rx * k) return { id: r.entity.id, name: null, all: r.status.words }; continue; }
      const total = R0.total, ph = hash(r.entity.id) * TAU, rx = R0.rx * k, ry = R0.ry * k, sz = R0.size * k, ly = ringLift(R0) * k, entries = R0.entries.map(e => e.name);
      let best = null;
      for (let j = 0; j < total; j++) { const th = ph + TAU * j / total + t * sp, x = cx + Math.cos(th) * rx, y = cy - (ly + Math.sin(th) * ry), dd = Math.hypot(px - x, py - y); if (dd < sz * 0.6 && (!best || dd < best.d)) best = { d: dd, name: entries[j % n] }; }
      if (best) return { id: r.entity.id, name: best.name, all: r.status.words };
      if (Math.abs(px - cx) < rx + sz && Math.abs(py - (cy - ly)) < ry + sz) return { id: r.entity.id, name: null, all: r.status.words };
    }
    return null;
  }

  // (tests) where a pawn's ring is on screen (client px): its middle, and its first orbiter now
  function screenOf(id, camera, rect) {
    const r = world.recs.get(id); if (!r || !shown(r)) return null;
    const g = r.group; _v.set(g.position.x, g.position.y + ringY(r) * (g.scale.y || 1), g.position.z).project(camera);
    const f = camera.projectionMatrix.elements[5] * rect.height / 2, R0 = ringOf(r);
    const cx = rect.left + (_v.x + 1) / 2 * rect.width, cy = rect.top + (1 - _v.y) / 2 * rect.height - ringLift(R0) * f;
    const th = hash(id) * TAU + T.value * (still() ? 0 : STATUS.speed);
    _v.set(g.position.x, g.position.y + Math.min(1.2, headY(r) * 0.5), g.position.z).project(camera);
    const body = [rect.left + (_v.x + 1) / 2 * rect.width, rect.top + (1 - _v.y) / 2 * rect.height];
    _v.set(g.position.x, g.position.y + headY(r) * (g.scale.y || 1), g.position.z).project(camera); const crown = rect.top + (1 - _v.y) / 2 * rect.height;
    _v.set(g.position.x, g.position.y, g.position.z).project(camera); const foot = rect.top + (1 - _v.y) / 2 * rect.height;
    // (the stack: the crown and the feet on screen; the ring's nearest pictures' bottom edge and its far ones' top edge)
    return { x: cx, y: cy, body, first: [cx + Math.cos(th) * R0.rx * f, cy - Math.sin(th) * R0.ry * f], firstName: R0.entries[0]?.name || null,
      crown, foot, nearBottom: R0.n ? cy + (R0.ry + R0.size / 2) * f : null, farTop: R0.n ? cy - (R0.ry + 0.42 * R0.size) * f : null, mark: boxOfSprite(r.mark, camera, rect, f), label: boxOfSprite(r.label, camera, rect, f) };
  }
  // (tests) a screen-sized sprite's box on screen (client px): [top, bottom, left, right]
  function boxOfSprite(m, camera, rect, f) {
    if (!m || !m.visible) return null; m.updateMatrixWorld(true);
    const E = m.matrixWorld.elements, sx = Math.hypot(E[0], E[1], E[2]), sy = Math.hypot(E[4], E[5], E[6]); _v.set(E[12], E[13], E[14]).project(camera);
    const px = rect.left + (_v.x + 1) / 2 * rect.width, py = rect.top + (1 - _v.y) / 2 * rect.height, bottom = py + m.center.y * sy * f, left = px - m.center.x * sx * f;
    return [bottom - sy * f, bottom, left, left + sx * f];
  }
  // (tests) what is drawn for a pawn, and the counts
  function info(id) {
    const r = world.recs.get(id); if (!r || r.entity.kind !== 'token') return null;
    const st = r.status || CO.statusOf(r.entity.conditions), n = poseNode(r), { shown: list, more } = CO.orbitShown(st.orbit);
    const mats = []; n?.traverse(o => { if (o.isMesh && !o.userData.pawnBase) mats.push(o.material?.userData?.statusLook || 'plain'); });
    return { pose: st.pose, poseTop: r.poseTop ?? null, standTop: r.visual?.userData.labelY != null ? +(r.visual.userData.labelY - 0.95).toFixed(3) : null, rot: n ? [n.rotation.x, n.rotation.z].map(v => +v.toFixed(3)) : null, body: [...new Set(mats)], invisible: st.invisible ? (seesInvisible(r.entity) ? 'glass' : 'shimmer') : null,
      orbit: list.map(o => o.art ? { art: STATUS.picks[o.art] || o.art } : { text: o.text }), more: more.map(o => o.text || o.key), zzz: st.zzz, drain: st.drain, runes: st.runes, dim: !!r.visual?.userData.base?.userData.statusDim,
      rim: r.visual?.userData.base?.userData.rim ? '#' + r.visual.userData.base.userData.rim.material.color.getHexString() : null, live: live.has(r), shown: shown(r) };
  }
  const boxes = () => { last.on = true; return last.list; }; // (tests) from the next frame the ring is open: [{ x, y, hw, hh, a, mark? }] client px
  const counts = () => ({ masked, orbiters: sprites.geo.instanceCount, words: words.geo.instanceCount, decals: decals.geo.instanceCount, drawCalls: [sprites, words, decals].filter(Q => Q.mesh.visible).length, textSlots: text.size(), ready: S.ready, live: live.size });
  return { apply, drop, frame, at, info, counts, boxes, headY, screenOf, meshes: [sprites.mesh, words.mesh] };
}
