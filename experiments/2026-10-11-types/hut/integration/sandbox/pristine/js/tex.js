// Pictures for the card, decoded OFF the main thread (2026-10-11, docs/ASSET_DELIVERY.md).
// THREE.TextureLoader hands the card an <img>, which the browser decodes on the main thread inside the upload call
// (measured 2026-10-11: 2.7 ms a texture, 0.86 s for an inn, growing with the picture's size). createImageBitmap
// decodes in the background; what is left for the upload is the copy and the mipmaps.
// An ImageBitmap ignores texture.flipY (WebGL's unpack flags do not apply to it): the flip is asked for when the bitmap
// is made instead, and the texture is marked flipY = false. The picture on the model is the same either way.
//   loadTexture(url, { flipY })  -> Promise<THREE.Texture>     flipY as THREE.TextureLoader would have had it:
//                                   true for a plain picture (the default), false for a map laid out for a glTF mesh
// Old Safari (< 17) and old Firefox (< 98) have no usable createImageBitmap options: they keep THREE.TextureLoader
// (the same test GLTFLoader makes for the pictures inside a GLB).
import * as THREE from 'three';

const ua = globalThis.navigator?.userAgent || '';
const safari = /^((?!chrome|android).)*safari/i.test(ua), safariV = safari ? +(ua.match(/Version\/(\d+)/)?.[1] || 0) : 0;
const firefoxV = +(ua.match(/Firefox\/(\d+)/)?.[1] || 0);
let BITMAPS = typeof createImageBitmap === 'function' && !(safari && safariV < 17) && !(firefoxV && firefoxV < 98) && !/[?&]imgtex\b/.test(globalThis.location?.search || '');
export const textureStats = { bitmap: 0, img: 0 };
export const bitmapTextures = () => BITMAPS;
const loaders = new Map();
function bitmapLoader(flipY) {
  if (!loaders.has(flipY)) { const l = new THREE.ImageBitmapLoader(); l.setOptions({ imageOrientation: flipY ? 'flipY' : 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); loaders.set(flipY, l); }
  return loaders.get(flipY);
}
const imgLoader = new THREE.TextureLoader();
function viaImg(url, flipY) { return new Promise((res, rej) => imgLoader.load(url, t => { t.flipY = flipY; textureStats.img++; res(t); }, undefined, rej)); }
export function loadTexture(url, { flipY = true } = {}) {
  if (!BITMAPS) return viaImg(url, flipY);
  return new Promise((res, rej) => bitmapLoader(flipY).load(url, bmp => {
    const t = new THREE.Texture(bmp); t.flipY = false; t.userData.bitmapFlipY = flipY; t.needsUpdate = true; textureStats.bitmap++; res(t);
  }, undefined, () => viaImg(url, flipY).then(res, rej))); // (a browser that cannot make this bitmap: the old way)
}
