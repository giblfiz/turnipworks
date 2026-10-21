// FAR-FIRE GLOW: the stand-in for the light of a flame that is NOT a real light (2026-10-12).
//
// Why. To make big maps affordable only the nearest N fires are real point lights (fire.js setCap; the game's Settings >
// Me > Graphics > "Real lights from fires"). The first stand-in for the others was a flat additive disc on the floor
// under each flame. Harry: "much much worse than nothing at this point ... it might just need a run in a tuner and be
// horribly out of tune." Measured against the real light (experiments/2026-10-12-glow/README.md) it was not out of
// tune, it was the wrong kind of thing: it adds a colour instead of lighting a surface, it lies on the floor only, and
// it knows nothing of walls.
//
// What this is. A light that is left out of the pool is put back as arithmetic, in two cheap steps whose cost does not
// depend on how many flames there are:
//   1. THE LIGHT MAP. One instanced draw (a quad per left-out light, additive) into a small floor-plan texture, one tile
//      per storey. Each texel ends up holding the summed light arriving there at THREE HEIGHTS (the floor, table
//      height, head height: each sum exact however many lights overlap; the first version kept the floor only, and a
//      candle then lit the floor under its table and not the table), and where it comes from on average. Walls: each light carries a ring of 128 "how far until a wall" distances, worked out
//      on the CPU from the wall pieces when the light or the walls change; the quad's shader looks its own direction
//      up in that ring, so no stand-in ever crosses a wall (doorways are open).
//   2. THE PICTURE. One full-screen pass in the post stack, before the fog: for each pixel, where is it in the world
//      (from the depth buffer), which way does it face (from the depth's own slope), what does the light map say
//      arrives there. The light is then applied the way a real light is, as a MULTIPLY on the surface that is already
//      in the picture: out = picture x (1 + light / ambient). A dark floor stays dark, a red rug stays red, a wall
//      behind a sconce and a table top under a candle are lit, and the floor under the table is lit only as much as a
//      real light without a shadow would light it.
// Every stand-in takes its position, colour, brightness, reach and falloff from the REAL light it replaces (fire.js
// standins()), so the defaults are the real light's own numbers; the dials are multipliers on top.
// "floor" mode keeps the old painted disc (fire.js makeGlows), to compare.
//
// Who switches it on. The Spawn Tuner's Far-fire glow panel (glowpanel.js) drives it directly. In the game it follows the
// viewer's switch (setViewer: 'auto' | true | false); 'auto' is ON only when a far-fire glow has been sent with "Use in
// game" (inHouse), so the game shows no stand-in at all until Harry has chosen one.
import * as THREE from 'three';
import { Pass } from 'postprocessing';

export const FARGLOW_DEFAULTS = {
  fx: 'farglow', name: 'far-glow',
  how: { mode: 'projected' },
  light: { intensity: 1, radius: 1, falloff: 1, softness: 1, height: 0 },
  colour: { warmth: 0, saturation: 1 },
  surface: { shaping: 1, wrap: 0.1, clamp: 40, walls: 1 },
  swap: { fade: 0.4 },
  types: { hearth: 1, oven: 1, brazier: 1, torch: 1, lantern: 1, candle: 1 },
  floor: { radius: 1, intensity: 1 },
};
const T = (k, label, min, max, step, unit) => ({ k, label, type: 'range', min, max, step, unit });
export const FARGLOW_SCHEMA = [
  ['How it is drawn', 'how', [
    { k: 'mode', label: 'Applied as', type: 'select', options: [['projected', 'projected light (lands on floors, walls, tables, sides of things)'], ['floor', 'floor disc (the old painted glow)']] },
  ]],
  ['The light (× the real light it stands in for)', 'light', [
    T('intensity', 'Intensity', 0, 3, 0.05, '×'),
    T('radius', 'Radius (reach)', 0.3, 2.5, 0.05, '×'),
    T('falloff', 'Falloff exponent', 0.4, 2, 0.05, '×'),
    T('softness', 'Edge softness (1 = as the real light)', 0.3, 4, 0.05),
    T('height', 'Height of the source', -4, 6, 0.25, 'ft'),
  ]],
  ['Colour', 'colour', [
    T('warmth', 'Warmth (− cooler, + redder)', -1, 1, 0.05),
    T('saturation', 'Saturation', 0, 2, 0.05, '×'),
  ]],
  ['Surfaces and walls', 'surface', [
    T('shaping', 'Facing the light matters (0 = flat wash)', 0, 1, 0.05),
    T('wrap', 'Wrap round edges', 0, 1, 0.05),
    T('clamp', 'Clamp where glows pile up (brightening at most)', 1, 100, 1, '×'),
    T('walls', 'Walls block it (0 = shines through)', 0, 1, 0.05),
  ]],
  ['Swapping between real and stand-in', 'swap', [
    T('fade', 'Cross-fade time', 0, 2, 0.05, 's'),
  ]],
  ['Per fire type (scale)', 'types', [
    T('hearth', 'Hearths & fireplaces', 0, 2, 0.05, '×'),
    T('oven', 'Ovens', 0, 2, 0.05, '×'),
    T('brazier', 'Braziers', 0, 2, 0.05, '×'),
    T('torch', 'Torches', 0, 2, 0.05, '×'),
    T('lantern', 'Lanterns', 0, 2, 0.05, '×'),
    T('candle', 'Candles, candelabra, chandeliers, sconces', 0, 2, 0.05, '×'),
  ]],
  ['Floor disc mode only', 'floor', [
    T('radius', 'Disc radius', 0.2, 3, 0.05, '×'),
    T('intensity', 'Disc brightness', 0, 4, 0.05, '×'),
  ]],
];
const D = () => JSON.parse(JSON.stringify(FARGLOW_DEFAULTS));
export const FARGLOW_BUILTINS = {
  'far-glow': () => D(),                                                                              // the measured match: the real light's own numbers
  'gentle': () => ({ ...D(), name: 'gentle', light: { intensity: 0.7, radius: 0.9, falloff: 1, softness: 1.5, height: 0 }, surface: { shaping: 0.8, wrap: 0.25, clamp: 4, walls: 1 } }),
  'old-floor-disc': () => ({ ...D(), name: 'old-floor-disc', how: { mode: 'floor' } }),               // what Harry saw on 2026-10-12
};

export const STOREY = 10;   // ft, floor to floor (the game's storeys)
const LAYERS = 3;           // storeys in the light map: the focus's own, one below, one above
const RES = 256;            // texels a side, per storey
const BINS = 128, ROWS = 256; // the wall ring: directions per light, lights at most
const FAR = 1e4;
const PLANES = [0, 3, 6.5];  // ft above a storey's floor: where the light map keeps its three sums

const VS_MAP = /* glsl */`
  in vec3 position; in vec3 iPos; in vec3 iCol; in vec4 iMisc;   // iMisc: reach (ft), falloff exponent, storey tile, ring row
  in float iDrop;                                                // how far the light hangs above its storey's floor (ft)
  uniform vec3 uWin;                                             // the window on the ground: x0, z0, side (ft)
  out vec2 vQ; out vec2 vD; out vec3 vCol; out vec4 vMisc; out float vY; out float vDrop;
  void main() {
    vD = position.xy * iMisc.x; vCol = iCol; vMisc = iMisc; vY = iPos.y; vDrop = iDrop;
    vQ = (iPos.xz + vD - uWin.xy) / uWin.z;
    float ok = step(0.0, iMisc.z) * step(iMisc.z, ${(LAYERS - 0.5).toFixed(1)});
    gl_Position = ok > 0.5 ? vec4(((vQ.x + iMisc.z) / ${LAYERS}.0) * 2.0 - 1.0, vQ.y * 2.0 - 1.0, 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0); // (a storey outside the map: off the target)
  }`;
const FS_MAP = /* glsl */`
  precision highp float; precision highp sampler2D;
  in vec2 vQ; in vec2 vD; in vec3 vCol; in vec4 vMisc; in float vY; in float vDrop;
  uniform sampler2D uRing; uniform float uWalls, uSoft;
  layout(location = 0) out vec4 oA; layout(location = 1) out vec4 oB; layout(location = 2) out vec4 oC; layout(location = 3) out vec4 oD;
  void main() {
    if (vQ.x < 0.0 || vQ.x > 1.0 || vQ.y < 0.0 || vQ.y > 1.0) discard;   // (its own storey's tile only)
    float R = vMisc.x, r = length(vD); if (r >= R) discard;
    float x = r / R, w = 1.0 - x * x * x * x; w = pow(w * w, uSoft);       // three.js's own reach window: (1 - (r/R)^4)^2
    if (uWalls > 0.0) {
      float dw = texture(uRing, vec2(atan(vD.y, vD.x) / 6.2831853 + 0.5, (vMisc.w + 0.5) / ${ROWS}.0)).r;
      w *= mix(1.0, 1.0 - smoothstep(dw + 0.45, dw + 1.0, r), uWalls);     // lit up to the wall's own face, dark behind it
    }
    // the light arriving at this spot on three planes above the storey's floor (the true distance to each)
    vec3 cw = vCol * w; float r2 = r * r;
    vec3 e0 = cw / max(pow(r2 + vDrop * vDrop, 0.5 * vMisc.y), 0.05);
    float d1 = vDrop - ${PLANES[1].toFixed(1)}, d2 = vDrop - ${PLANES[2].toFixed(1)};                       // (a plane is never taken nearer the flame than 0.5 ft: no white spot where one happens to pass through it)
    vec3 e1 = cw / max(pow(r2 + max(d1 * d1, 0.25), 0.5 * vMisc.y), 0.05);
    vec3 e2 = cw / max(pow(r2 + max(d2 * d2, 0.25), 0.5 * vMisc.y), 0.05);
    float u = dot(e0 + e1 + e2, vec3(0.3, 0.6, 0.1));
    oA = vec4(e0, u); oB = vec4(e1, r * u); oC = vec4(e2, vY * u); oD = vec4(vD * u, 0.0, 0.0); // the sums, and (weighted by them) distance, height, direction
  }`;
const VS_FS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FS_PIC = /* glsl */`
  precision highp float; precision highp sampler2D;
  varying vec2 vUv;
  uniform sampler2D uDepth, uA, uB, uC, uD; uniform mat4 uProjInv, uCamWorld; uniform vec3 uCam;
  uniform vec3 uWin; uniform float uBase;                         // window (x0, z0, side); the storey of tile 0
  uniform vec3 uSky, uGround, uSunCol, uSunDir;
  uniform float uShaping, uWrap, uClamp, uHeight, uView;
  vec3 worldAt(vec2 uv, float d) { vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); v /= v.w; return (uCamWorld * v).xyz; }
  void main() {
    float d = texture2D(uDepth, vUv).x; if (d >= 1.0) discard;
    vec3 pos = worldAt(vUv, d);
    float s = floor((pos.y + 0.75) / ${STOREY}.0) - uBase; if (s < 0.0 || s > ${(LAYERS - 0.5).toFixed(1)}) discard;
    // which way the surface faces: the slope of the depth itself (no normal buffer in a forward renderer)
    vec3 n = normalize(cross(dFdx(pos), dFdy(pos))); if (dot(n, uCam - pos) < 0.0) n = -n;
    vec2 q = (pos.xz + n.xz * 0.6 - uWin.xy) / uWin.z;              // (read the map a little way out from the surface: a wall's face must not read the wall's inside, which is dark) if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) discard;
    float edge = smoothstep(0.0, 0.04, min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y)));
    vec2 t = vec2((clamp(q.x, ${(0.5 / RES).toFixed(6)}, ${(1 - 0.5 / RES).toFixed(6)}) + s) / ${LAYERS}.0, q.y);
    vec4 A = texture2D(uA, t); if (A.a < 1e-6) discard;
    vec4 B = texture2D(uB, t), C = texture2D(uC, t); vec2 D = texture2D(uD, t).xy / A.a;
    float rbar = B.a / A.a, ly = C.a / A.a + uHeight, dy = ly - pos.y;
    // the light at this pixel's own height: between the planes the map holds (floor, table height, head height)
    float h = (pos.y - (s + uBase) * ${STOREY}.0 - uHeight) / ${PLANES[1].toFixed(1)};
    vec3 Eh = h < 1.0 ? mix(A.rgb, B.rgb, clamp(h, 0.0, 1.0)) : mix(B.rgb, C.rgb, clamp((h - 1.0) * ${(PLANES[1] / (PLANES[2] - PLANES[1])).toFixed(3)}, 0.0, 1.0));
    // the direction it arrives from: the weighted mean of the lights' directions (lights on every side: from above)
    vec3 toL = vec3(-D.x, dy, -D.y); float r3 = max(sqrt(rbar * rbar + dy * dy), 1e-3);
    float ndl = clamp((dot(n, toL / r3) + uWrap) / (1.0 + uWrap), 0.0, 1.0);
    ndl = mix(0.6, ndl, uShaping);
    vec3 E = Eh * ndl;
    vec3 amb = mix(uGround, uSky, 0.5 + 0.5 * n.y) + uSunCol * max(dot(n, uSunDir), 0.0);
    vec3 gain = E / max(amb, vec3(1e-3));
    gain = uClamp * (1.0 - exp(-gain / uClamp)) * edge;            // soft clamp: where glows pile up it levels off, never a white blob
    if (uView > 0.5) { gl_FragColor = vec4(uView > 1.5 ? n * 0.5 + 0.5 : gain * 0.25, 1.0); return; }
    gl_FragColor = vec4(gain, 0.0);                                // blended: picture x (1 + gain)
  }`;

export function createFarGlow({ renderer, camera, hemi = null, sun = null, fire, structure = () => [], focus = () => null, game = false }) {
  let P = D();
  // ---- who wants it
  let viewer = game ? 'auto' : true, inHouse = false, on = false;
  const resolve = () => { on = viewer === true || (viewer !== false && inHouse); fire.setGlow(on); fire.setGlowLook({ mode: P.how.mode, radius: P.floor.radius, intensity: P.floor.intensity, fade: P.swap.fade }); };

  // ---- the light map: two half-float targets (MRT), one instanced additive draw
  const map = new THREE.WebGLRenderTarget(RES * LAYERS, RES, { count: 4, type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3)); geo.setIndex([0, 1, 2, 0, 2, 3]);
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(ROWS * 3), 3), iCol = new THREE.InstancedBufferAttribute(new Float32Array(ROWS * 3), 3), iMisc = new THREE.InstancedBufferAttribute(new Float32Array(ROWS * 4), 4);
  const iDrop = new THREE.InstancedBufferAttribute(new Float32Array(ROWS), 1);
  for (const a of [iPos, iCol, iMisc, iDrop]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iPos', iPos); geo.setAttribute('iCol', iCol); geo.setAttribute('iMisc', iMisc); geo.setAttribute('iDrop', iDrop); geo.instanceCount = 0;
  const ringData = new Uint16Array(BINS * ROWS).fill(THREE.DataUtils.toHalfFloat(FAR));
  const ring = new THREE.DataTexture(ringData, BINS, ROWS, THREE.RedFormat, THREE.HalfFloatType);
  ring.minFilter = ring.magFilter = THREE.LinearFilter; ring.wrapS = THREE.RepeatWrapping; ring.wrapT = THREE.ClampToEdgeWrapping; ring.needsUpdate = true;
  const win = new THREE.Vector3(0, 0, 128);
  const mapMat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VS_MAP, fragmentShader: FS_MAP, uniforms: { uWin: { value: win }, uRing: { value: ring }, uWalls: { value: 1 }, uSoft: { value: 1 } },
    depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor, side: THREE.DoubleSide });
  const mapMesh = new THREE.Mesh(geo, mapMat); mapMesh.frustumCulled = false;
  const mapScene = new THREE.Scene(); mapScene.add(mapMesh);
  const flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---- the picture pass
  const picMat = new THREE.ShaderMaterial({ vertexShader: VS_FS, fragmentShader: FS_PIC, depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: { uDepth: { value: null }, uA: { value: map.textures[0] }, uB: { value: map.textures[1] }, uC: { value: map.textures[2] }, uD: { value: map.textures[3] }, uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() },
      uWin: { value: win }, uBase: { value: 0 }, uSky: { value: new THREE.Vector3(1, 1, 1) }, uGround: { value: new THREE.Vector3(1, 1, 1) }, uSunCol: { value: new THREE.Vector3() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uShaping: { value: 1 }, uWrap: { value: 0.1 }, uClamp: { value: 40 }, uHeight: { value: 0 }, uView: { value: 0 } } });
  const picMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), picMat); picMesh.frustumCulled = false;
  const picScene = new THREE.Scene(); picScene.add(picMesh);

  // ---- walls -> each light's ring of distances (CPU; only when a light or the walls have moved)
  let walls = [], wallSig = '', wallT = -1e9, wallVer = 0;
  function readWalls(now) {
    if (now - wallT < 500) return; wallT = now;
    const out = []; let sig = '';
    for (const it of structure()) {
      const sp = it?.spec; if (!sp || !it.group || (sp.layer || it.layer) !== 'walls') continue;
      const r = it.rest, x = r?.x ?? sp.x ?? it.group.position.x, y = r?.y ?? sp.y ?? 0, z = r?.z ?? sp.z ?? it.group.position.z, rot = r?.rot ?? sp.rot ?? it.group.rotation.y, [w, , d] = sp.dims || [1, 1, 1];
      const c = Math.cos(rot), s = Math.sin(rot), st = Math.floor((y + 0.75) / STOREY);
      const piece = (ox, pw) => { const cx = x + c * ox, cz = z - s * ox; out.push({ cx, cz, c, s, hw: pw / 2, hd: Math.max(d, 0.4) / 2, st, far: Math.hypot(pw, d) / 2 }); };
      if (/doorway/.test(sp.id || '')) { const j = Math.max(w * 0.14, 0.3), off = w / 2 - j / 2; piece(off, j); piece(-off, j); } else piece(0, w); // (a doorway is open: its two jambs only)
      sig += `${Math.round(x * 10)},${Math.round(y)},${Math.round(z * 10)},${Math.round(rot * 100)},${Math.round(w * 10)};`;
    }
    if (sig !== wallSig) { wallSig = sig; walls = out; wallVer++; }
  }
  const rows = new Map(); let rowFree = [], ringDirty = false; // light -> { row, key }
  const half = (v) => THREE.DataUtils.toHalfFloat(Math.min(v, FAR));
  function ringFor(l, x, z, st, R) {
    let rec = rows.get(l); if (!rec) { rec = { row: rowFree.length ? rowFree.pop() : rows.size, key: '' }; if (rec.row >= ROWS) return -1; rows.set(l, rec); }
    const key = `${Math.round(x * 2)},${Math.round(z * 2)},${st},${Math.round(R)},${wallVer}`; if (key === rec.key) return rec.row; rec.key = key;
    const dist = new Float32Array(BINS).fill(FAR);
    for (const w of walls) {
      if (w.st !== st) continue; const dx = w.cx - x, dz = w.cz - z; if (Math.hypot(dx, dz) > R + w.far) continue;
      const lx = -(dx * w.c - dz * w.s), lz = -(dx * w.s + dz * w.c); // the light in the wall's own frame
      if (Math.abs(lx) < w.hw && Math.abs(lz) < w.hd) continue;          // a flame set into a wall is not walled in by it
      const P4 = [[-w.hw, -w.hd], [w.hw, -w.hd], [w.hw, w.hd], [-w.hw, w.hd]].map(([a, b]) => [w.cx + a * w.c + b * w.s - x, w.cz - a * w.s + b * w.c - z]);
      for (let e = 0; e < 4; e++) {
        const [ax, az] = P4[e], [bx, bz] = P4[(e + 1) % 4];
        let t0 = Math.atan2(az, ax), t1 = Math.atan2(bz, bx), dt = t1 - t0; if (dt > Math.PI) dt -= 2 * Math.PI; else if (dt < -Math.PI) dt += 2 * Math.PI;
        if (dt < 0) { t0 = t0 + dt; dt = -dt; }
        const k0 = Math.floor((t0 / (2 * Math.PI) + 0.5) * BINS - 0.5), k1 = Math.ceil(((t0 + dt) / (2 * Math.PI) + 0.5) * BINS - 0.5);
        const ex = bx - ax, ez = bz - az;
        for (let k = k0; k <= k1; k++) {
          const th = ((k + 0.5) / BINS - 0.5) * 2 * Math.PI, rx = Math.cos(th), rz = Math.sin(th), den = rx * ez - rz * ex; if (Math.abs(den) < 1e-9) continue;
          const tt = (ax * ez - az * ex) / den, uu = (ax * rz - az * rx) / den; if (tt <= 0 || uu < -0.08 || uu > 1.08) continue;
          const kk = ((k % BINS) + BINS) % BINS; if (tt < dist[kk]) dist[kk] = tt;
        }
      }
    }
    for (let k = 0; k < BINS; k++) ringData[rec.row * BINS + k] = half(dist[k]);
    ringDirty = true; return rec.row;
  }

  // ---- once a frame: the window, the instances, the light map
  const _c = new THREE.Color(), _f = new THREE.Vector3(), _hsl = {};
  let count = 0, baseStorey = 0, lastList = [];
  function tint(c) { // the dials on the real light's own colour
    const w = P.colour.warmth, s = P.colour.saturation;
    if (w) { c.r *= 1 + 0.35 * w; c.g *= 1 + 0.04 * w; c.b *= 1 - 0.45 * w; }
    if (s !== 1) { const l = 0.3 * c.r + 0.6 * c.g + 0.1 * c.b; c.r = Math.max(0, l + (c.r - l) * s); c.g = Math.max(0, l + (c.g - l) * s); c.b = Math.max(0, l + (c.b - l) * s); }
    return c;
  }
  function frame(dt, now) {
    count = 0; if (!on || P.how.mode !== 'projected') { pass.enabled = false; return; }
    const list = lastList = fire.standins(); if (!list.length) { pass.enabled = false; return; }
    readWalls(now);
    // the window: a square on the ground round the view's focus, as wide as the view is deep, in whole texels
    const f = focus(); if (f) _f.set(f.x, f.y ?? 0, f.z); else camera.getWorldPosition(_f);
    const dist = Math.max(8, camera.position.distanceTo(_f));
    const side = Math.min(640, Math.max(80, 64 * Math.pow(1.25, Math.ceil(Math.log(2.2 * dist / 64) / Math.log(1.25))))), cell = side / RES;
    win.set(Math.floor((_f.x - side / 2) / cell) * cell, Math.floor((_f.z - side / 2) / cell) * cell, side);
    baseStorey = Math.floor(((f?.y ?? 0) + 0.75) / STOREY) - 1;
    const seen = new Set();
    for (const s of list) {
      if (count >= ROWS) break;
      const R = s.distance * P.light.radius, k = (P.types[s.type] ?? 1) * P.light.intensity * s.weight; if (!(k > 0.001) || !(R > 0.5)) continue;
      if (s.x + R < win.x || s.x - R > win.x + side || s.z + R < win.y || s.z - R > win.y + side) continue;
      const st = Math.floor((s.y + 0.5) / STOREY), tile = st - baseStorey; if (tile < 0 || tile >= LAYERS) continue;
      const row = P.surface.walls > 0 ? ringFor(s.light, s.x, s.z, st, R) : 0; if (row < 0) continue; seen.add(s.light);
      tint(_c.copy(s.color)).multiplyScalar(s.intensity * k);
      const dec = Math.max(0.2, s.decay * P.light.falloff);
      iPos.setXYZ(count, s.x, s.y, s.z); iCol.setXYZ(count, _c.r, _c.g, _c.b); iMisc.setXYZW(count, R, dec, tile, row); iDrop.setX(count, Math.max(0.5, s.y - st * STOREY)); count++;
    }
    if (rows.size > seen.size + 32) for (const [l, rec] of rows) if (!seen.has(l)) { rows.delete(l); rowFree.push(rec.row); }
    geo.instanceCount = count; pass.enabled = count > 0; if (!count) return;
    iPos.needsUpdate = iCol.needsUpdate = iMisc.needsUpdate = iDrop.needsUpdate = true;
    if (ringDirty) { ring.needsUpdate = true; ringDirty = false; }
    mapMat.uniforms.uWalls.value = P.surface.walls; mapMat.uniforms.uSoft.value = P.light.softness;
    const rt = renderer.getRenderTarget(), ac = renderer.autoClear, cc = renderer.getClearColor(_c), ca = renderer.getClearAlpha();
    renderer.setRenderTarget(map); renderer.setClearColor(0x000000, 0); renderer.autoClear = true; renderer.render(mapScene, flatCam);
    renderer.setRenderTarget(rt); renderer.autoClear = ac; renderer.setClearColor(cc, ca);
  }

  class FarGlowPass extends Pass {
    constructor() { super('FarGlowPass'); this.needsSwap = false; this.needsDepthTexture = true; this.depth = null; this.enabled = false; }
    setDepthTexture(t) { this.depth = t; }
    render(r, inputBuffer) {
      if (!this.depth || !count) return;
      const u = picMat.uniforms;
      u.uDepth.value = this.depth; u.uProjInv.value.copy(camera.projectionMatrixInverse); u.uCamWorld.value.copy(camera.matrixWorld); camera.getWorldPosition(u.uCam.value);
      u.uBase.value = baseStorey; u.uShaping.value = P.surface.shaping; u.uWrap.value = P.surface.wrap; u.uClamp.value = P.surface.clamp; u.uHeight.value = P.light.height;
      // what the surfaces are lit by already (three.js's hemisphere light and the key light): the stand-in is a light added to those
      if (hemi) { _c.copy(hemi.color).multiplyScalar(hemi.intensity); u.uSky.value.set(_c.r, _c.g, _c.b); _c.copy(hemi.groundColor).multiplyScalar(hemi.intensity); u.uGround.value.set(_c.r, _c.g, _c.b); }
      if (sun) { _c.copy(sun.color).multiplyScalar(sun.visible ? sun.intensity : 0); u.uSunCol.value.set(_c.r, _c.g, _c.b); u.uSunDir.value.copy(sun.position).sub(sun.target?.position || _f.set(0, 0, 0)).normalize(); }
      const ac = r.autoClear; r.autoClear = false; r.setRenderTarget(inputBuffer); r.render(picScene, flatCam); r.autoClear = ac;
    }
  }
  const pass = new FarGlowPass();

  const self = {
    get params() { return P; },
    set(p) { P = p; resolve(); },
    apply: resolve,
    frame, pass,
    setViewer(v) { v = v === true || v === false ? v : 'auto'; if (v === viewer) return; viewer = v; resolve(); },
    get viewer() { return viewer; }, get on() { return on; },
    get inHouse() { return inHouse; }, setInHouse(v) { inHouse = !!v; resolve(); },
    setView(v) { picMat.uniforms.uView.value = v === 'gain' ? 1 : v === 'normal' ? 2 : 0; if (v === 'gain' || v === 'normal') picMat.blending = THREE.NoBlending; else picMat.blending = THREE.CustomBlending; },
    stats: () => ({ farglow_on: on, farglow_mode: P.how.mode, farglow_lights: count, farglow_pass: pass.enabled, farglow_window_ft: +win.z.toFixed(1), farglow_walls: walls.length, farglow_rings: rows.size }),
    ringOf: (l) => { const rec = rows.get(l); return rec ? Array.from({ length: BINS }, (_, k) => THREE.DataUtils.fromHalfFloat(ringData[rec.row * BINS + k])) : null; },
    standins: () => lastList,
  };
  resolve();
  return self;
}
