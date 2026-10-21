// Variant B wall kit (Fauna 2026-10-02, Harry agreed to try it beside the generated walls): exact-module geometry.
// Pure data, no three.js, so node can test it (test/wallkit.test.mjs). js/wallkit3.js turns the plan into meshes.
//
// Every wall is built from LAYERS (plinth, body, cap; half-timber adds a sill beam), each an exact box on the 5-ft
// module, centred on the grid line. Where walls turn, end, change family or frame a door, a NODE (corner post, jamb)
// fills exactly the region the slabs would otherwise fight over; slabs stop on the node's faces. Straight joints have
// no node: the two slabs meet exactly at the grid vertex. Every face gets UVs from its WORLD position (one tiling
// material per family), so texture runs across joints. Doors and windows are exact too: a casing that fills the cut,
// leaves/shutters built from boxes, each hinged at its edge with {pivot, axis, openAngle} data.
//
// Units: feet. Solids: { b:[x0,x1,z0,z1], y0, y1, mat, tint, uv, part, ch? } (axis-aligned box; ch = top chamfer per
// side {px,nx,pz,nz}), or { poly:[[s,y]x4], dir:'h'|'v', c0, c1, ... } (a prism on a wall face, for braces),
// or { ring:{c:[x,y,z], r, tube, dir} }.
import { CELL, hash } from './walls.js';

export const DOOR_H = 100 / 12;           // matches the generated door leaves (100 in)
export const SILL = 3, HEAD = 6.5, WIN_W = 2.5;
export const H = 9;                       // 108 in, the catalog wall height
const FB = 2.5 / 12;                      // half-timber face boards stand 2.5 in proud of the plaster (1 in read flat: Gemini A/B 2026-10-02)
// hinge record, matching the open/close pilot's sidecar (experiments/2026-10-02-openclose/runtime/openclose.json):
// mode 'hinge', pivot, axis, openAngle in degrees about axis (right-hand rule), duration, eases. Kit pivots are world
// feet (Y up); the leaf's pivot group in the item visual sits at pivot minus the item origin.
export const HINGE = { mode: 'hinge', duration: 0.9, ease: 'inOutCubic', openEase: 'outBack' };
export const jambOf = (span) => (span || 1) === 1 ? 4 / 12 : 8 / 12; // leaf width = span*60in - 8 (single) or -16 (wide)

// texture world size (ft per repeat) and the shared texture each material samples
export const TEX = { stone: 8, plaster: 6, wood: 6 };

const L = (y0, y1, proud, mat, tint = 1, extra = {}) => ({ y0, y1, proud, mat, tint, ...extra });
export const KIT = {
  'kit-stone': {
    label: 'kit: stone', mesh: 'dressed-stone', T: 1.0,
    layers: [L(0, 1, 2 / 12, 'stone', 0.78, { ch: 1.5 / 12 }), L(1, 8 + 2 / 3, 0, 'stone', 1), L(8 + 2 / 3, H, 1.5 / 12, 'stone', 1.14, { ch: 1.5 / 12 })],
    nodeMat: ['stone', 'stone', 'stone'], nodeTint: [0.74, 0.93, 1.1], lintel: 'stone', casing: 'stone', casingTint: 1.18,
    leaf: 'studded', sill: 'stone', shutters: false,
  },
  'kit-half-timber': {
    label: 'kit: half-timber', mesh: 'half-timber', T: 0.75,
    layers: [L(0, 1, 2 / 12, 'stone', 0.8, { ch: 1.5 / 12 }), L(1, 1.5, FB, 'wood', 0.82), L(1.5, 8 + 2 / 3, 0, 'plaster', 1, { nodeProud: FB }), L(8 + 2 / 3, H, FB, 'wood', 0.82)],
    nodeMat: ['stone', 'wood', 'wood', 'wood'], nodeTint: [0.8, 0.82, 0.78, 0.82], lintel: 'wood', lintelTint: 0.78, casing: 'wood', casingTint: 0.78,
    leaf: 'panelled', sill: 'wood', shutters: true, faceBoards: true,
  },
  'kit-plank': {
    label: 'kit: plank', mesh: 'rough-timber', T: 0.5,
    layers: [L(0, 0.75, 1.5 / 12, 'stone', 0.82, { ch: 1 / 12 }), L(0.75, 8 + 2 / 3, 0, 'wood', 1, { nodeProud: 1 / 12 }), L(8 + 2 / 3, H, 1.5 / 12, 'wood', 0.8)],
    nodeMat: ['stone', 'wood', 'wood'], nodeTint: [0.82, 0.8, 0.8], lintel: 'wood', lintelTint: 0.8, casing: 'wood', casingTint: 0.72,
    leaf: 'ledged', sill: 'wood', shutters: true,
  },
};
export const KIT_FAMILIES = Object.keys(KIT);
export const isKit = (f) => !!KIT[f];
const RANK = { 'kit-stone': 3, 'kit-half-timber': 2, 'kit-plank': 1 };

const OPP = { px: 'nx', nx: 'px', pz: 'nz', nz: 'pz' };
const vk = (gx, gz) => `${gx}:${gz}`;
const box = (x0, x1, z0, z1, y0, y1, o) => ({ b: [Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1)], y0, y1, ...o });
// a box given in wall coordinates: s along the wall, c across it
const wbox = (dir, s0, s1, c0, c1, y0, y1, o) => dir === 'h' ? box(s0, s1, c0, c1, y0, y1, o) : box(c0, c1, s0, s1, y0, y1, o);

// which way a door leaf swings: into the owner room. n = owner's interior normal across the wall (+1/-1 on c)
export const interiorSign = (e) => (e.owner.side === 'N' || e.owner.side === 'W') ? 1 : -1;

// ---- the plan ------------------------------------------------------------------------------------------------
// edges: Map from computeEdges. Returns { edgeItems: Map(edgeKey -> item), nodeItems: Map(vkey -> item), meshPostSkip:Set(vkey) }
// item = { key, kind:'edge'|'node', family, x, z, wallDir, solids:[], leaves:[{pivot, axis, openAngle, rest, solids}], sig }
export function planKit(edges) {
  const verts = new Map();
  const runs = [];
  // a wide exterior door's later segments are inside its opening, even where a link/reachability rule later re-marked
  // one of them 'door' (walls.js can do that; the generated variant then hangs two leaves in one opening). If another
  // wall meets the run INSIDE the opening (v1 lets a later room wall across a sticky wide door), the opening stops at
  // that vertex and the rest of its segments become plain wall.
  const touch = new Map();
  for (const e of edges.values()) {
    const B = e.dir === 'h' ? [e.gx + 1, e.gz] : [e.gx, e.gz + 1];
    for (const p of [[e.gx, e.gz], B]) { const k = vk(...p); if (!touch.has(k)) touch.set(k, new Set()); touch.get(k).add(e.key); }
  }
  const view = new Map(); // key -> edge as the kit sees it (kind / span possibly overridden)
  const inside = new Set();
  for (const e of edges.values()) {
    if (e.kind !== 'door' || (e.span || 1) < 2 || !e.spanKeys) continue;
    const keys = e.spanKeys;
    let n = keys.length;
    for (let i = 1; i < keys.length; i++) {
      const p = e.dir === 'h' ? [e.gx + i, e.gz] : [e.gx, e.gz + i];
      if ([...(touch.get(vk(...p)) || [])].some(k => !keys.includes(k))) { n = i; break; }
    }
    view.set(e.key, { ...e, span: n, spanKeys: keys.slice(0, n) });
    keys.slice(1, n).forEach(k => inside.add(k));
    for (const k of keys.slice(n)) { const x = edges.get(k); view.set(k, { ...x, kind: 'wall', span: 1, spanKeys: undefined }); }
  }
  for (const e0 of edges.values()) {
    const e = view.get(e0.key) || e0;
    if (e.kind === 'door-span' || inside.has(e.key)) continue;
    const n = e.kind === 'door' ? (e.span || 1) : 1;
    const A = [e.gx, e.gz], B = e.dir === 'h' ? [e.gx + n, e.gz] : [e.gx, e.gz + n];
    const run = { e, n, A, B, kit: isKit(e.family), door: e.kind === 'door' };
    runs.push(run);
    const at = (p, d) => { const k = vk(...p); if (!verts.has(k)) verts.set(k, { gx: p[0], gz: p[1], d: {} }); verts.get(k).d[d] = run; };
    at(A, e.dir === 'h' ? 'px' : 'pz'); at(B, e.dir === 'h' ? 'nx' : 'nz');
  }
  // nodes
  const nodes = new Map(); // vkey -> { fam, mixed, ext(d, li) }
  for (const [k, v] of verts) {
    const ds = Object.keys(v.d), entries = Object.values(v.d);
    const kits = entries.filter(r => r.kit);
    if (!kits.length) continue;
    const xs = ds.some(d => d.endsWith('x')), zs = ds.some(d => d.endsWith('z'));
    const fams = new Set(entries.map(r => r.e.family));
    const anyDoor = entries.some(r => r.door);
    if (!(xs && zs) && !anyDoor && fams.size === 1 && ds.length === 2) continue; // straight joint: slabs meet at the vertex
    const fam = kits.map(r => r.e.family).sort((a, b) => RANK[b] - RANK[a])[0];
    const F = KIT[fam], mixed = fams.size > 1;
    const jMax = Math.max(0, ...entries.filter(r => r.door).map(r => jambOf(r.n)));
    const wOf = (li) => { const Ly = F.layers[li]; return F.T + 2 * Math.max(Ly.proud, Ly.nodeProud || 0); };
    const wMax = Math.max(...F.layers.map((_, i) => wOf(i)));
    const ext = (d, li) => {
      const r = v.d[d];
      const w = mixed ? wMax : wOf(li);
      const alongAxis = d.endsWith('x') ? xs : zs, crossAxis = d.endsWith('x') ? zs : xs;
      // a door's jamb is exactly the generated leaf's (4 in single, 8 in wide), except where a wall turns at the jamb:
      // there the jamb grows to cover the crossing wall's thickness (else a notch opens beside the casing)
      if (r?.door) return crossAxis ? Math.max(jambOf(r.n), mixed ? wMax / 2 : Math.max(...F.layers.map((_, i) => wOf(i))) / 2) : jambOf(r.n);
      if (alongAxis && !crossAxis && anyDoor) return jMax; // a jamb on a straight run: symmetric post
      return w / 2;
    };
    nodes.set(k, { k, v, fam, F, mixed, ext, xs, zs });
  }
  const extAt = (p, d, li, fam) => {
    const nd = nodes.get(vk(...p));
    if (!nd) return 0;
    if (nd.mixed || nd.fam !== fam) return Math.max(...nd.F.layers.map((_, i) => nd.ext(d, i)));
    return nd.ext(d, li);
  };

  const edgeItems = new Map(), nodeItems = new Map();
  for (const run of runs) {
    if (!run.kit) continue;
    const { e, n, A, B } = run;
    const fam = e.family, F = KIT[fam], dir = e.dir;
    const sAx = (dir === 'h' ? A[0] : A[1]) * CELL, sBx = (dir === 'h' ? B[0] : B[1]) * CELL;
    const c = (dir === 'h' ? e.gz : e.gx) * CELL;
    const dA = dir === 'h' ? 'px' : 'pz', dB = dir === 'h' ? 'nx' : 'nz';
    const solids = [], leaves = [];
    const T2 = F.T / 2;
    F.layers.forEach((Ly, li) => {
      const sA = sAx + extAt(A, dA, li, fam), sB = sBx - extAt(B, dB, li, fam);
      const w2 = F.T / 2 + Ly.proud;
      const base = { mat: Ly.mat, tint: Ly.tint, uv: 'world', part: 'body' };
      const ch = Ly.ch ? (dir === 'h' ? { pz: Ly.ch, nz: Ly.ch } : { px: Ly.ch, nx: Ly.ch }) : null;
      if (e.kind === 'door') {
        if (Ly.y0 >= DOOR_H) solids.push(wbox(dir, sA, sB, c - w2, c + w2, Ly.y0, Ly.y1, { ...base, ch }));
        else if (Ly.y1 > DOOR_H) solids.push(wbox(dir, sA, sB, c - w2, c + w2, DOOR_H, Ly.y1, { ...base, mat: F.lintel, tint: F.lintelTint || Ly.tint, uv: F.lintel === 'wood' ? 'world' : 'world', part: 'body' }));
        return;
      }
      if (e.kind === 'window' && Ly.y0 < HEAD && Ly.y1 > SILL) {
        const mid = (sAx + sBx) / 2, w0 = mid - WIN_W / 2, w1 = mid + WIN_W / 2;
        if (Ly.y0 < SILL) solids.push(wbox(dir, sA, sB, c - w2, c + w2, Ly.y0, SILL, base));
        if (Ly.y1 > HEAD) solids.push(wbox(dir, sA, sB, c - w2, c + w2, HEAD, Ly.y1, { ...base, ch }));
        const p0 = Math.max(Ly.y0, SILL), p1 = Math.min(Ly.y1, HEAD);
        solids.push(wbox(dir, sA, w0, c - w2, c + w2, p0, p1, base), wbox(dir, w1, sB, c - w2, c + w2, p0, p1, base));
        return;
      }
      solids.push(wbox(dir, sA, sB, c - w2, c + w2, Ly.y0, Ly.y1, { ...base, ch }));
    });
    const sgn = interiorSign(e); // +1: owner interior at +c
    // half-timber face boards (posts at module ends, a mid rail, braces) on both faces
    if (F.faceBoards && e.kind !== 'door') {
      const body = F.layers.find(Ly => Ly.mat === 'plaster');
      const Y0 = body.y0, Y1 = body.y1, PW = 8 / 12, RY0 = 4.25, RY1 = 4.75;
      const nodeA = nodes.has(vk(...A)), nodeB = nodes.has(vk(...B));
      const li = F.layers.indexOf(body);
      const sA = sAx + extAt(A, dA, li, fam), sB = sBx - extAt(B, dB, li, fam);
      const pA = nodeA ? sA : sAx + PW / 2, pB = nodeB ? sB : sBx - PW / 2; // inner edges of the end posts
      for (const f of [-1, 1]) {
        const c0 = f > 0 ? c + T2 : c - T2 - FB, c1 = f > 0 ? c + T2 + FB : c - T2;
        const o = { mat: 'wood', tint: 0.8, part: 'face' };
        if (!nodeA) solids.push(wbox(dir, sAx, pA, c0, c1, Y0, Y1, { ...o, uv: 'vert' }));
        if (!nodeB) solids.push(wbox(dir, pB, sBx, c0, c1, Y0, Y1, { ...o, uv: 'vert' }));
        if (e.kind === 'window') {
          const mid = (sAx + sBx) / 2, w0 = mid - WIN_W / 2, w1 = mid + WIN_W / 2;
          // rail stops at the window; short posts frame it from sill board to head
          solids.push(wbox(dir, pA, w0 - PW / 2, c0, c1, RY0, RY1, { ...o, uv: 'world' }), wbox(dir, w1 + PW / 2, pB, c0, c1, RY0, RY1, { ...o, uv: 'world' }));
          solids.push(wbox(dir, w0 - PW / 2, w0, c0, c1, Y0, Y1, { ...o, uv: 'vert' }), wbox(dir, w1, w1 + PW / 2, c0, c1, Y0, Y1, { ...o, uv: 'vert' }));
          // the casing (below) lines the cut; above the head and below the sill the posts carry short rails
          solids.push(wbox(dir, w0, w1, c0, c1, HEAD, HEAD + 0.4, { ...o, uv: 'world' }), wbox(dir, w0, w1, c0, c1, SILL - 0.4, SILL, { ...o, uv: 'world' }));
        } else {
          solids.push(wbox(dir, pA, pB, c0, c1, RY0, RY1, { ...o, uv: 'world' }));
          const h = hash(e.key, 'brace');
          if (h % 3 !== 0) { // braces in two of three modules, leaning by seed: lower or upper panel
            const lower = h % 2 === 0, flip = (h >> 3) % 2 === 0, bw = 0.55, run = 1.9;
            const yb = lower ? Y0 : RY1, yt = lower ? RY0 : Y1;
            const s0 = flip ? pB - bw : pA, s1 = flip ? pB - bw - run : pA + run;
            solids.push({ poly: [[s0, yb], [s0 + bw, yb], [s1 + bw, yt], [s1, yt]], dir, c0, c1, mat: 'wood', tint: 0.8, uv: 'diag', part: 'brace' });
          }
        }
      }
    }
    // windows: a casing that fills the cut, a sill board, mullion + transom, glazing, shutters (timber families)
    if (e.kind === 'window') {
      const mid = (sAx + sBx) / 2, w0 = mid - WIN_W / 2, w1 = mid + WIN_W / 2, k = 0.25;
      const cp = F.faceBoards ? T2 + FB + 0.04 : T2 + 0.06; // casing stands proud of the face (and of face boards)
      const cm = { mat: F.casing, tint: F.casingTint, part: 'casing' };
      solids.push(wbox(dir, w0, w1, c - cp - 0.08, c + cp + 0.08, SILL, SILL + k, { ...cm, mat: F.sill, uv: 'world' })); // sill board, proud both faces
      solids.push(wbox(dir, w0, w1, c - cp, c + cp, HEAD - k, HEAD, { ...cm, uv: 'world' }));
      solids.push(wbox(dir, w0, w0 + k, c - cp, c + cp, SILL + k, HEAD - k, { ...cm, uv: 'vert' }), wbox(dir, w1 - k, w1, c - cp, c + cp, SILL + k, HEAD - k, { ...cm, uv: 'vert' }));
      const g0 = w0 + k, g1 = w1 - k, gy0 = SILL + k, gy1 = HEAD - k, bar = 0.17, ty = gy0 + (gy1 - gy0) * 0.62;
      solids.push(wbox(dir, g0, g1, c - 0.03, c + 0.03, gy0, gy1, { mat: 'glass', tint: 1, uv: 'world', part: 'glass' }));
      solids.push(wbox(dir, mid - bar / 2, mid + bar / 2, c - 0.09, c + 0.09, gy0, gy1, { mat: 'wood', tint: 0.7, uv: 'vert', part: 'glass' }));
      solids.push(wbox(dir, g0, g1, c - 0.09, c + 0.09, ty - bar / 2, ty + bar / 2, { mat: 'wood', tint: 0.7, uv: 'world', part: 'glass' }));
      if (F.shutters && e.sides.length === 1) {
        const ext = -sgn; // exterior face direction on c
        const st = 0.1, cc = c + ext * (cp + 0.02 + st / 2);
        for (const [hinge, freeTo] of [[w0, mid], [w1, mid]]) {
          const sl = [Math.min(hinge, freeTo), Math.max(hinge, freeTo)];
          const sh = [wbox(dir, sl[0], sl[1], cc - st / 2, cc + st / 2, gy0 - k, gy1 + k, { mat: 'wood', tint: 0.95, uv: 'vert', part: 'shutter' })];
          for (const y of [gy0 + 0.3, gy1 - 0.5]) sh.push(wbox(dir, sl[0] + 0.08, sl[1] - 0.08, cc + ext * st / 2, cc + ext * (st / 2 + 0.06), y, y + 0.22, { mat: 'wood', tint: 0.75, uv: 'world', part: 'shutter' }));
          const pivot = dir === 'h' ? [hinge, 0, cc] : [cc, 0, hinge];
          const u = Math.sign(freeTo - hinge); // leaf runs from the hinge toward +u on s
          // open flat against the outside wall: swing ~170 deg outward
          leaves.push({ ...HINGE, pivot, axis: [0, 1, 0], openAngle: swingSign(dir, u, ext) * 170, rest: 'open', solids: sh, what: 'shutter' });
        }
      }
    }
    // doors: casing + leaves
    if (e.kind === 'door') {
      const sA = sAx + extAt(A, dA, 0, fam), sB = sBx - extAt(B, dB, 0, fam), k = 0.25; // jamb faces (= the generated leaf span unless a wall turns there)
      // the casing stands as proud as the boldest band, never more: then a door beside a corner can't reach past the
      // corner node into a crossing wall's door casing
      const cp = Math.max(...F.layers.map(Ly => F.T / 2 + Math.max(Ly.proud, Ly.nodeProud || 0)));
      const cm = { mat: F.casing, tint: F.casingTint, part: 'casing' };
      solids.push(wbox(dir, sA, sA + k, c - cp, c + cp, 0, DOOR_H, { ...cm, uv: 'vert' }), wbox(dir, sB - k, sB, c - cp, c + cp, 0, DOOR_H, { ...cm, uv: 'vert' }));
      solids.push(wbox(dir, sA + k, sB - k, c - cp, c + cp, DOOR_H - k, DOOR_H, { ...cm, uv: 'world' }));
      const l0 = sA + k, l1 = sB - k, Hl = DOOR_H - k, nl = n > 1 ? 2 : 1, lw = (l1 - l0) / nl;
      const style = styleFor(e.doorType, F);
      const hs = hash(e.key, 'hinge');
      for (let i = 0; i < nl; i++) {
        const a = l0 + i * lw, b = a + lw;
        const hingeAtA = nl === 2 ? i === 0 : hs % 2 === 0;
        const hinge = hingeAtA ? a : b, u = hingeAtA ? 1 : -1;
        const sol = leafSolids(dir, a, b, c, Hl, style, sgn, hingeAtA, n);
        const pivot = dir === 'h' ? [hinge, 0, c] : [c, 0, hinge];
        leaves.push({ ...HINGE, pivot, axis: [0, 1, 0], openAngle: swingSign(dir, u, sgn) * 100, rest: 'closed', solids: sol, what: `door leaf (${style})` });
      }
    }
    const tr = dir === 'h' ? { x: (sAx + sBx) / 2, z: c } : { x: c, z: (sAx + sBx) / 2 };
    edgeItems.set(e.key, { key: e.key, kind: 'edge', ekind: e.kind, span: n, family: fam, ...tr, wallDir: dir, solids, leaves, room: e.owner.room, sig: '' });
  }
  for (const nd of nodes.values()) {
    const { v, F, fam } = nd;
    const x = v.gx * CELL, z = v.gz * CELL;
    const solids = F.layers.map((Ly, li) => {
      const e = (d) => nd.mixed ? Math.max(...F.layers.map((_, i) => nd.ext(d, i))) : nd.ext(d, li);
      const ch = Ly.ch ? Object.fromEntries(['px', 'nx', 'pz', 'nz'].filter(d => !v.d[d]).map(d => [d, Ly.ch])) : null;
      return box(x - e('nx'), x + e('px'), z - e('nz'), z + e('pz'), Ly.y0, Ly.y1, { mat: F.nodeMat[li], tint: F.nodeTint[li], uv: F.nodeMat[li] === 'wood' ? 'vert' : 'world', part: 'body', ch });
    });
    const room = Object.values(v.d).find(r => r.kit)?.e.owner.room;
    nodeItems.set(nd.k, { key: 'k' + nd.k, kind: 'node', family: fam, x, z, wallDir: 'c', solids, leaves: [], room, sig: '', allKit: Object.values(v.d).every(r => r.kit) });
  }
  for (const it of [...edgeItems.values(), ...nodeItems.values()]) it.sig = sigOf(it);
  return { edgeItems, nodeItems, view };
}

// sign of the hinge rotation (about +Y) that swings a leaf lying along +u*s toward +side on c
export function swingSign(dir, u, side) {
  // leaf direction in world xz, and the target direction
  const L = dir === 'h' ? [u, 0] : [0, u], N = dir === 'h' ? [0, side] : [side, 0];
  // rotating (x,z) by +theta about +Y moves it along (z, -x)
  const dv = [L[1], -L[0]];
  return Math.sign(dv[0] * N[0] + dv[1] * N[1]) || 1;
}

function styleFor(doorType, F) {
  if (doorType === 'door-reinforced') return 'studded';
  if (doorType === 'door-double-grand') return 'panelled';
  if (doorType === 'door-barn-double') return 'barn';
  return F.leaf;
}

// leaf solids in world space (closed): boards + style hardware. sgn = owner interior side on c.
function leafSolids(dir, a, b, c, Hl, style, sgn, hingeAtA, span) {
  const t = 0.2, out = [], w = b - a;
  const W = (s0, s1, c0, c1, y0, y1, o) => out.push(wbox(dir, s0, s1, c0, c1, y0, y1, o));
  W(a, b, c - t / 2, c + t / 2, 0, Hl, { mat: 'wood', tint: style === 'panelled' ? 0.82 : 1, uv: 'vert', part: 'leaf' });
  const inn = sgn, out_ = -sgn; // interior / exterior faces
  const face = (side, th) => side > 0 ? [c + t / 2, c + t / 2 + th] : [c - t / 2 - th, c - t / 2];
  const hingeS = hingeAtA ? a : b, freeS = hingeAtA ? b : a, toward = hingeAtA ? 1 : -1;
  const iron = { mat: 'iron', tint: 1, uv: 'world', part: 'hardware' };
  if (style === 'ledged' || style === 'barn') {
    const ys = style === 'barn' ? [0.7, Hl / 2 - 0.3, Hl - 1.1] : [0.8, Hl - 1.2];
    for (const y of ys) W(a + 0.1, b - 0.1, ...face(inn, 0.08), y, y + 0.5, { mat: 'wood', tint: 0.78, uv: 'world', part: 'ledge' });
    if (style === 'barn' || span > 1) { // a Z brace between the ledges on the inside
      const [c0, c1] = face(inn, 0.08), y0 = ys[0] + 0.5, y1 = ys[1], bw = 0.5;
      out.push({ poly: hingeAtA ? [[a + 0.1, y0], [a + 0.1 + bw, y0], [b - 0.1, y1], [b - 0.1 - bw, y1]] : [[b - 0.1 - bw, y0], [b - 0.1, y0], [a + 0.1 + bw, y1], [a + 0.1, y1]], dir, c0, c1, mat: 'wood', tint: 0.78, uv: 'diag', part: 'ledge' });
    }
    for (const y of [1.2, Hl - 1.5]) { // strap hinges on the outside
      const s1 = hingeS + toward * w * 0.62;
      W(Math.min(hingeS, s1), Math.max(hingeS, s1), ...face(out_, 0.03), y, y + 0.22, iron);
    }
  } else if (style === 'studded') {
    const straps = [0.9, Hl / 2, Hl - 1.0];
    for (const side of [inn, out_]) for (const y of straps) W(a, b, ...face(side, 0.03), y - 0.11, y + 0.11, iron);
    const cols = Math.max(2, Math.round(w / 0.75)), [f0, f1] = face(out_, 0.06);
    for (let i = 0; i < cols; i++) {
      const s = a + (i + 0.5) * w / cols;
      for (const y of [(straps[0] + straps[1]) / 2, (straps[1] + straps[2]) / 2, straps[0] - 0.45, straps[2] + 0.5]) W(s - 0.05, s + 0.05, f0, f1, y - 0.05, y + 0.05, iron);
    }
  } else if (style === 'panelled') {
    const sw = Math.min(0.42, w * 0.18), rh = 0.42;
    for (const side of [inn, out_]) {
      const [f0, f1] = face(side, 0.07), o = { mat: 'wood', tint: 1.02, part: 'stile' };
      W(a, a + sw, f0, f1, 0, Hl, { ...o, uv: 'vert' }); W(b - sw, b, f0, f1, 0, Hl, { ...o, uv: 'vert' });
      for (const y of [0, Hl * 0.42, Hl - rh]) W(a + sw, b - sw, f0, f1, y, y + rh, { ...o, uv: 'world' });
      W((a + b) / 2 - sw / 2, (a + b) / 2 + sw / 2, f0, f1, rh, Hl - rh, { ...o, uv: 'vert' }); // muntin: four panels
    }
  }
  // ring pull near the free edge on both faces
  for (const side of [inn, out_]) {
    const [f0, f1] = face(side, 0.04), s = freeS - toward * 0.45, y = 3.4;
    W(s - 0.12, s + 0.12, f0, f1, y - 0.12, y + 0.12, iron);
    const cc = side > 0 ? f1 + 0.03 : f0 - 0.03;
    out.push({ ring: { c: dir === 'h' ? [s, y - 0.22, cc] : [cc, y - 0.22, s], r: 0.2, tube: 0.035, dir }, mat: 'iron', tint: 1, part: 'hardware' });
  }
  return out;
}

function sigOf(it) {
  let h = 0;
  const s = JSON.stringify([it.family, it.solids, it.leaves.map(l => [l.pivot, l.openAngle, l.solids])]);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return `kit|${it.family}|${h.toString(36)}|${s.length}`;
}

// ---- UVs: a pure function of world position + face normal, so abutting faces sample the same texels -----------
// 'world': vertical faces u = (x+z)/S, v = y/S (u = x+z keeps outer corners continuous, mirrored); tops u = x, v = z.
// 'vert' : grain/boards vertical (posts, door boards): u = y/S on vertical faces swapped with v.
// 'diag' : braces: u along the brace direction (dirVec in the s-y plane), v across.
export function faceUV(mode, mat, p, nrm, dirVec) {
  const S = TEX[mat] || 6;
  const ax = Math.abs(nrm[0]), ay = Math.abs(nrm[1]), az = Math.abs(nrm[2]);
  if (ay > ax && ay > az) return [p[0] / S, p[2] / S];
  const h = p[0] + p[2];
  if (mode === 'vert') return [p[1] / S, h / S];
  if (mode === 'diag' && dirVec) { const s = h; return [(s * dirVec[0] + p[1] * dirVec[1]) / S, (-s * dirVec[1] + p[1] * dirVec[0]) / S]; }
  return [h / S, p[1] / S];
}

// ---- measurement helpers (used by test/wallkit.test.mjs and the in-browser kitSeams hook) ---------------------
export function boxSolids(plan, parts = ['body', 'face', 'casing', 'leaf']) {
  const out = [];
  for (const it of [...plan.edgeItems.values(), ...plan.nodeItems.values()]) {
    for (const s of it.solids) if (s.b && parts.includes(s.part)) out.push({ ...s, item: it.key });
    for (const l of it.leaves) if (l.rest === 'closed') for (const s of l.solids) if (s.b && parts.includes(s.part)) out.push({ ...s, item: it.key + ':leaf' });
  }
  return out;
}
// overlap volume of two solids' boxes (cu ft); touching = 0
export function overlapVol(a, b) {
  const dx = Math.min(a.b[1], b.b[1]) - Math.max(a.b[0], b.b[0]);
  const dz = Math.min(a.b[3], b.b[3]) - Math.max(a.b[2], b.b[2]);
  const dy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return dx > 1e-9 && dy > 1e-9 && dz > 1e-9 ? dx * dy * dz : 0;
}
