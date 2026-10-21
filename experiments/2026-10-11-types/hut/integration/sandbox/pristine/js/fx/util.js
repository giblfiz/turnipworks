// Small shared helpers for the FX modules: colour temperature and a smooth 1-D noise for flicker.
import * as THREE from 'three';

// Kelvin -> linear-ish RGB (Tanner Helland's fit, 1000 K .. 40000 K), returned as a THREE.Color in sRGB.
export function kelvin(k, out = new THREE.Color()) {
  const t = Math.max(1000, Math.min(40000, k)) / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
  if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v) => Math.max(0, Math.min(255, v)) / 255;
  return out.setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
}

// smooth value noise, roughly in [-1, 1]
const P = new Float32Array(512);
{ let s = 1234567; for (let i = 0; i < 512; i++) { s = (s * 16807) % 2147483647; P[i] = (s / 2147483647) * 2 - 1; } }
export function noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return P[i & 511] * (1 - u) + P[(i + 1) & 511] * u;
}
// layered flicker: slow breathing plus fast licks, ~[-1, 1]
export function flicker(t, phase, speed = 1) {
  const x = t * speed;
  return 0.5 * noise1(x * 1.3 + phase) + 0.3 * noise1(x * 4.7 + phase * 1.7) + 0.2 * noise1(x * 11.0 + phase * 3.1);
}

export const clone = (o) => JSON.parse(JSON.stringify(o));
// fill missing keys of p from defaults (deep, one level of nesting is all the presets use)
export function mergeDefaults(defaults, p) {
  const out = clone(defaults);
  for (const [k, v] of Object.entries(p || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object') Object.assign(out[k], v);
    else if (k in out) out[k] = v;
  }
  return out;
}
