// The caps on an uploaded model (docs/UPLOADS.md "Limits"). Shared by the converter (worker.mjs) and the relay
// (relay/uploads.js), which checks the cheap ones before a worker is ever started. Change them here only.
export const LIMITS = Object.freeze({
  bytes: 32 * 1024 * 1024,      // the file as uploaded
  jsonBytes: 4 * 1024 * 1024,   // a glTF's scene description
  trianglesIn: 500000,          // before simplifying (a print-resolution sculpt goes through the Import Lab first)
  accessorCount: 2000000,       // elements in any one accessor (a sparse accessor with no buffer is `count` zeros)
  nodes: 2000, meshes: 512, primitives: 1024, materials: 64, textures: 32, images: 32, accessors: 8192,
  imageSide: 4096,              // a picture's width or height, read from its header before it is decoded
  imageBytes: 16 * 1024 * 1024, // one picture, encoded
  objLines: 4000000,
  unpackedBytes: 256 * 1024 * 1024, // what meshopt-compressed geometry in the file says it decodes to
});
// The tiers we make, best first (docs/ASSET_DELIVERY.md: the library's props are drawn at 10,000 faces with 128 to 256 px
// colour maps; an import's default is 20,000 triangles with a 1024 normal map, docs/IMPORTS.md). The game's Graphics
// detail picks one: High -> t0, Medium -> t1, Low -> t2.
export const TIERS = Object.freeze([
  { name: 't0', tris: 20000, tex: 1024, maxBytes: 8 * 1024 * 1024 },
  { name: 't1', tris: 5000, tex: 512, maxBytes: 4 * 1024 * 1024 },
  { name: 't2', tris: 1500, tex: 256, maxBytes: 2 * 1024 * 1024 },
]);
// an uncoloured model's look: a pewter miniature
export const PEWTER = Object.freeze({ color: [0.56, 0.57, 0.6, 1], metallic: 0.55, roughness: 0.48 });
// the worker's box (relay/uploads.js)
export const SANDBOX = Object.freeze({ wallMs: 90000, cpuSeconds: 60, rssBytes: 1536 * 1024 * 1024, heapMb: 1024, fileBytes: 64 * 1024 * 1024, nice: 15 });
