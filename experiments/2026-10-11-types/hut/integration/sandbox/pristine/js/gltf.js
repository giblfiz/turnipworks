// One way to make a GLTFLoader, for every page that loads a mesh (2026-10-11, docs/ASSET_DELIVERY.md).
// The delivered meshes are meshopt-compressed (EXT_meshopt_compression + KHR_mesh_quantization, written by
// prep/meshopt.mjs); three.js reads the quantized attributes natively and needs a decoder for the compression. The
// decoder is vendored (js/vendor/meshopt_decoder-1.2.0.js, MIT) and runs in WORKERS, so decoding never holds the main
// thread; a worker that does not answer in time (a browser that refuses blob workers) hands the same bytes to the
// main-thread decoder, so a mesh can be late but not missing. An uncompressed GLB loads exactly as before.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/meshopt_decoder-1.2.0.js';

const WORKER_WAIT_MS = 15000;
let workers = -1; // -1 not started, 0 main thread only, n workers
export const meshoptStats = { worker: 0, main: 0, lateWorkers: 0 };
function startWorkers() {
  if (workers >= 0) return;
  workers = 0;
  if (!MeshoptDecoder.supported || typeof Worker === 'undefined') return;
  try { const n = Math.max(1, Math.min(4, (globalThis.navigator?.hardwareConcurrency || 4) - 1)); MeshoptDecoder.useWorkers(n); workers = n; } catch { workers = 0; }
}
function onMain(count, size, source, mode, filter) {
  return MeshoptDecoder.ready.then(() => { const out = new Uint8Array(count * size); MeshoptDecoder.decodeGltfBuffer(out, count, size, source, mode, filter); meshoptStats.main++; return out; });
}
// what GLTFLoader calls for each compressed buffer view
const decoder = {
  supported: MeshoptDecoder.supported, ready: MeshoptDecoder.ready,
  decodeGltfBuffer: (...a) => MeshoptDecoder.decodeGltfBuffer(...a),
  decodeGltfBufferAsync(count, size, source, mode, filter) {
    startWorkers();
    if (!workers) return onMain(count, size, source, mode, filter);
    return new Promise((resolve, reject) => {
      let done = false;
      const late = setTimeout(() => { if (done) return; done = true; meshoptStats.lateWorkers++; try { MeshoptDecoder.useWorkers(0); } catch { } workers = 0; onMain(count, size, source, mode, filter).then(resolve, reject); }, WORKER_WAIT_MS);
      MeshoptDecoder.decodeGltfBufferAsync(count, size, source, mode, filter).then(
        (out) => { if (done) return; done = true; clearTimeout(late); meshoptStats.worker++; resolve(out); },
        () => { if (done) return; done = true; clearTimeout(late); onMain(count, size, source, mode, filter).then(resolve, reject); });
    });
  },
};
export function gltfLoader(manager) { const l = new GLTFLoader(manager); if (decoder.supported) l.setMeshoptDecoder(decoder); return l; }
