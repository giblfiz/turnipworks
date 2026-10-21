// WATER mode: a water surface inside an empty vessel. There is no water shader yet, so the preview is a translucent
// tinted plane. Auto: rays straight down over a grid in the mesh's own frame give a height map (a thin overhang such
// as a bucket handle or a well roof is peeled away, a lid on the rim is not); vessel.js floods it from the border
// to find the pool, its rim (spill level) and floor. The surface sits at `level` of the way from floor to rim, and its
// footprint is the cells under that level, fitted as an ellipse or a convex polygon, inset from the walls.
// Drag the surface up/down to set the level (Shift-drag slides it sideways); ↑/↓ nudge the level; [ ] inset; - = size.
// Writes kind "water_surface", name = mesh id:
//   { level, y, floor, rim (fractions of the mesh's bbox height, GLB frame), shape, poly: [[u, w]…] (fractions of the
//     bbox in x and z: the footprint the renderer should fill), ellipse: { c: [u, w], r: [ft, ft], rot }, inset_in,
//     grow, shift: [du, dw], tint, opacity, none (true = "this holds no water"), auto (unchanged automatic fit) }
// A renderer maps (u, y, w) through the mesh root's world matrix exactly as fire anchors are mapped.
import { basin, footprint } from './vessel.js';

const DEF = { level: 0.8, inset_in: 0.6, shape: 'ellipse', grow: 1, shift: [0, 0], tint: '#3f8fb5', opacity: 0.6, none: false };
const defaults = () => ({ ...DEF, shift: [0, 0] });
const r4 = (x) => Math.round(x * 1e4) / 1e4;

export function createWaterMode(ctx) {
  const { THREE, LAYER } = ctx;
  const st = { root: null, fit: null, p: defaults(), foot: null, dirty: false, drag: null, entry: null };
  const holder = new THREE.Group(); holder.matrixAutoUpdate = false; ctx.scene.add(holder);
  const mat = new THREE.MeshStandardMaterial({ color: DEF.tint, transparent: true, opacity: DEF.opacity, roughness: 0.12, metalness: 0.05, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const surf = new THREE.Mesh(new THREE.BufferGeometry(), mat); surf.renderOrder = 3; surf.name = 'water'; holder.add(surf);
  const edge = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.9, depthTest: false }));
  edge.layers.set(LAYER.helpers); edge.renderOrder = 21; edge.userData.helper = true; holder.add(edge);
  const rimLine = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: '#e8b460', dashSize: 0.05, gapSize: 0.04, transparent: true, opacity: 0.8, depthTest: false }));
  rimLine.layers.set(LAYER.helpers); rimLine.renderOrder = 21; rimLine.userData.helper = true; holder.add(rimLine);
  holder.visible = false;
  let el = null;
  const plane = new THREE.Plane(), _v = new THREE.Vector3();

  // ---- the auto fit: height map by raycasting the mesh root, in its own (GLB) frame
  function fitVessel(root) {
    root.updateMatrixWorld(true);
    const box = ctx.hinge.glbBox(root), size = box.getSize(new THREE.Vector3());
    const S = new THREE.Vector3(); root.getWorldScale(S); // GLB units -> feet (the item group is unscaled)
    const fx = size.x * Math.abs(S.x), fz = size.z * Math.abs(S.z), cell = Math.max(fx, fz) / 44;
    const nx = Math.max(6, Math.ceil(fx / cell)), nz = Math.max(6, Math.ceil(fz / cell));
    // two height maps: H0 = the first surface from above; H1 = the surface under a thin overhang (hit 0 enters a slab,
    // hit 1 leaves it, hit 2 is the next surface below an air gap): a bucket handle, a well roof, or a closed lid
    const H0 = new Float64Array(nx * nz).fill(NaN), H1 = new Float64Array(nx * nz).fill(NaN), under = new Float64Array(nx * nz).fill(NaN);
    const ray = new THREE.Raycaster(), dir = new THREE.Vector3(0, -1, 0);
    const top = box.max.y + size.y * 0.05;
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const gx = box.min.x + (ix + 0.5) / nx * size.x, gz = box.min.z + (iz + 0.5) / nz * size.z, i = iz * nx + ix;
      ray.set(root.localToWorld(new THREE.Vector3(gx, top, gz)), dir);
      const ys = ray.intersectObject(root, true).filter(h => h.object.isMesh && !h.object.userData.helper).map(h => root.worldToLocal(h.point.clone()).y);
      if (!ys.length) continue;
      H0[i] = H1[i] = ys[0];
      if (ys.length >= 3 && ys[1] - ys[2] > size.y * 0.04) { H1[i] = ys[2]; under[i] = ys[1]; }
    }
    const minDepth = size.y * 0.035;
    let B = basin({ nx, nz, H: H1, floorY: box.min.y, minDepth }), peel = 'none';
    if (B) { // was anything peeled inside the pool, and was it OVERHEAD (handle, roof) or a LID sitting on the rim?
      const peeled = B.cells.filter(i => Number.isFinite(under[i]));
      const overhead = peeled.filter(i => under[i] > B.rim + size.y * 0.08).length;
      if (peeled.length > B.cells.length * 0.3 && overhead < peeled.length * 0.5) { B = basin({ nx, nz, H: H0, floorY: box.min.y, minDepth }); peel = 'lid'; }
      else if (peeled.length) peel = 'overhead';
    }
    const H = H1;
    return { box, size, S: S.clone(), nx, nz, H, B, peel, cell: { x: size.x / nx, z: size.z / nz } };
  }

  // ---- footprint at the current params (feet in the GLB frame's axes, then back to bbox fractions)
  function compute() {
    const f = st.fit, p = st.p; if (!f) return null;
    const { box, size, S } = f, sx = Math.abs(S.x), sz = Math.abs(S.z);
    const B = f.B;
    const floorY = B ? B.floor : box.min.y + size.y * 0.15, rimY = B ? B.rim : box.max.y - size.y * 0.05;
    const yG = floorY + p.level * (rimY - floorY);
    let cells;
    if (B) {
      cells = B.cells.filter(i => B.Hc[i] < yG);
      if (!cells.length) cells = [B.cells.reduce((a, b) => (B.Hc[b] < B.Hc[a] ? b : a))];
    } else { // no interior found: a centred disc at 80% of the box, for Harry to fix or mark "no water"
      cells = []; for (let iz = 0; iz < f.nz; iz++) for (let ix = 0; ix < f.nx; ix++) { const u = (ix + 0.5) / f.nx - 0.5, w = (iz + 0.5) / f.nz - 0.5; if (u * u + w * w < 0.16) cells.push(iz * f.nx + ix); }
    }
    const toFt = (i) => [(box.min.x + ((i % f.nx) + 0.5) / f.nx * size.x) * sx, (box.min.z + (((i / f.nx) | 0) + 0.5) / f.nz * size.z) * sz];
    const cellFt = Math.max(f.cell.x * sx, f.cell.z * sz);
    // water cells: in the pool and below the level (feet in -> cell index); the outline must stay over them
    const wet = new Set(cells);
    const inside = !B ? null : (x, z) => {
      const ix = Math.floor((x / sx - box.min.x) / size.x * f.nx), iz = Math.floor((z / sz - box.min.z) / size.z * f.nz);
      return ix >= 0 && iz >= 0 && ix < f.nx && iz < f.nz && wet.has(iz * f.nx + ix);
    };
    const fp = footprint(cells.map(toFt), cellFt, { shape: p.shape, inset: p.inset_in / 12, grow: p.grow, shift: [p.shift[0] * size.x * sx, p.shift[1] * size.z * sz], inside });
    const u = ([x, z]) => [r4((x / sx - box.min.x) / size.x), r4((z / sz - box.min.z) / size.z)];
    return {
      y: r4((yG - box.min.y) / size.y), floor: r4((floorY - box.min.y) / size.y), rim: r4((rimY - box.min.y) / size.y),
      poly: fp.poly.map(u), ellipse: { c: u(fp.ellipse.c), r: fp.ellipse.r.map(r4), rot: r4(fp.ellipse.rot) },
      found: !!B, depthIn: (rimY - floorY) * Math.abs(S.y) * 12, cells: fp.cells, rect: fp.rect, fit: fp.ellipse.fit,
    };
  }
  function build() {
    st.foot = compute(); const F = st.foot, f = st.fit;
    holder.visible = !!F && !st.p.none;
    if (!F) return;
    const { box, size } = f, g = (u) => [box.min.x + u[0] * size.x, box.min.z + u[1] * size.z];
    const yG = box.min.y + F.y * size.y, rimG = box.min.y + F.rim * size.y;
    const shape = new THREE.Shape(F.poly.map(p => { const [x, z] = g(p); return new THREE.Vector2(x, -z); }));
    const geo = new THREE.ShapeGeometry(shape); geo.rotateX(-Math.PI / 2); geo.translate(0, yG, 0);
    surf.geometry.dispose(); surf.geometry = geo;
    const ring = F.poly.flatMap(p => { const [x, z] = g(p); return [x, yG, z]; });
    edge.geometry.dispose(); edge.geometry = new THREE.BufferGeometry(); edge.geometry.setAttribute('position', new THREE.Float32BufferAttribute(ring, 3));
    const rim = F.poly.flatMap(p => { const [x, z] = g(p); return [x, rimG, z]; });
    rimLine.geometry.dispose(); rimLine.geometry = new THREE.BufferGeometry(); rimLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(rim, 3)); rimLine.computeLineDistances();
    mat.color.set(st.p.tint); mat.opacity = st.p.opacity;
    paint();
  }
  const set = (patch) => { Object.assign(st.p, patch); st.dirty = true; build(); ctx.changed(); };

  function panel(root) {
    el = root;
    root.innerHTML = `<div class="group"><h3>Water surface</h3>
      <label>Level <input type="range" id="w-level" min="0" max="1.1" step="0.01"><output id="w-level-o"></output></label>
      <label>Inset <input type="range" id="w-inset" min="0" max="4" step="0.05"><output id="w-inset-o"></output></label>
      <label>Size <input type="range" id="w-grow" min="0.5" max="1.5" step="0.01"><output id="w-grow-o"></output></label>
      <div class="seg"><button type="button" data-shape="ellipse">Ellipse</button><button type="button" data-shape="poly">Polygon</button><button type="button" id="w-reshift">Recentre</button></div>
      <label>Tint <input type="color" id="w-tint"><output></output></label>
      <label>Opacity <input type="range" id="w-op" min="0.15" max="0.95" step="0.01"><output id="w-op-o"></output></label>
      <label class="check"><input type="checkbox" id="w-none"> Holds no water (closed, solid, or not a vessel) <kbd>X</kbd></label>
      <p class="muted" id="w-fit"></p></div>`;
    const on = (id, f) => root.querySelector(id).addEventListener('input', f);
    on('#w-level', e => set({ level: +e.target.value }));
    on('#w-inset', e => set({ inset_in: +e.target.value }));
    on('#w-grow', e => set({ grow: +e.target.value }));
    on('#w-tint', e => set({ tint: e.target.value }));
    on('#w-op', e => set({ opacity: +e.target.value }));
    root.querySelector('#w-none').addEventListener('change', e => set({ none: e.target.checked }));
    root.querySelectorAll('[data-shape]').forEach(b => b.addEventListener('click', () => set({ shape: b.dataset.shape })));
    root.querySelector('#w-reshift').addEventListener('click', () => set({ shift: [0, 0] }));
  }
  function paint() {
    if (!el) return; const p = st.p, F = st.foot;
    el.querySelector('#w-level').value = p.level; el.querySelector('#w-level-o').textContent = `${Math.round(p.level * 100)}%`;
    el.querySelector('#w-inset').value = p.inset_in; el.querySelector('#w-inset-o').textContent = `${p.inset_in.toFixed(2)}″`;
    el.querySelector('#w-grow').value = p.grow; el.querySelector('#w-grow-o').textContent = `${p.grow.toFixed(2)}×`;
    el.querySelector('#w-tint').value = p.tint; el.querySelector('#w-op').value = p.opacity; el.querySelector('#w-op-o').textContent = p.opacity.toFixed(2);
    el.querySelector('#w-none').checked = !!p.none;
    el.querySelectorAll('[data-shape]').forEach(b => b.classList.toggle('on', b.dataset.shape === p.shape));
    el.querySelector('#w-fit').textContent = !st.fit ? '' : F?.found
      ? `Auto fit: a pool ${F.depthIn.toFixed(1)} in deep, rim at ${Math.round(F.rim * 100)}% of the height${st.fit.peel === 'overhead' ? ', seen under a handle or roof' : ''}${st.fit.B.pools > 1 ? ` (${st.fit.B.pools} pools; the largest is used)` : ''}.`
      : `Auto fit found no open interior${st.fit.peel === 'lid' ? ' (a lid covers it)' : ' (closed top?)'}. The disc is a placeholder: shape it, or mark "holds no water".`;
  }
  function fromRecord(d) {
    const p = defaults();
    for (const k of Object.keys(DEF)) if (d?.[k] !== undefined) p[k] = Array.isArray(DEF[k]) ? d[k].slice() : d[k];
    return p;
  }
  const isAuto = () => JSON.stringify({ ...st.p, tint: 0, opacity: 0 }) === JSON.stringify({ ...st.autoP, tint: 0, opacity: 0 });

  return {
    key: 'water',
    get dirty() { return st.dirty; },
    keys: [['drag surface', 'raise / lower (Shift: slide it)'], ['↑ ↓', 'level ±2% (Shift ±10%)'], ['[ ]', 'inset ∓ ¼ in'], ['- =', 'smaller / bigger'], ['E', 'ellipse ↔ polygon'], ['X', 'holds no water']],
    panel,
    async open(entry, cur) {
      st.entry = entry; st.root = cur.root; st.dirty = false;
      st.fit = fitVessel(cur.root);
      st.autoP = defaults(); st.p = st.autoP;
      if (compute()?.rect) st.autoP.shape = 'poly'; // troughs and basins fill their box: a polygon, not an oval
      const rec = ctx.record()?.data;
      st.p = rec ? fromRecord(rec) : { ...st.autoP };
      build();
    },
    close() { holder.visible = false; st.root = null; st.fit = null; },
    auto() { if (!st.fit) return; st.fit = fitVessel(st.root); st.p = { ...st.autoP, shift: [0, 0], tint: st.p.tint, opacity: st.p.opacity }; st.dirty = true; build(); },
    record() {
      const F = st.foot, p = st.p;
      return { level: r4(p.level), y: F?.y, floor: F?.floor, rim: F?.rim, shape: p.shape, poly: F?.poly, ellipse: F?.ellipse, inset_in: p.inset_in, grow: r4(p.grow), shift: p.shift.map(r4),
        tint: p.tint, opacity: p.opacity, none: !!p.none, auto: isAuto(), found: !!F?.found, frame: 'glb-bbox-fractions' };
    },
    saved() { st.dirty = false; },
    summary() {
      const F = st.foot; if (!F) return '';
      if (st.p.none) return '<b>holds no water</b>';
      return `<b>${Math.round(st.p.level * 100)}% full</b> · ${st.p.shape} · inset ${st.p.inset_in.toFixed(2)} in · ${isAuto() ? 'automatic fit' : 'edited'}`;
    },
    state: () => ({ p: { ...st.p }, foot: st.foot && { ...st.foot }, found: !!st.fit?.B, dirty: st.dirty,
      surfScreen: (() => { if (!st.foot || !holder.visible) return null; const b = new THREE.Box3().setFromObject(surf); return b.isEmpty() ? null : ctx.screenOf(b.getCenter(new THREE.Vector3())); })() }),
    pointerdown(e) {
      if (!holder.visible) return false;
      const h = ctx.setRay(e).intersectObject(surf, false)[0]; if (!h) return false;
      st.drag = { shift: e.shiftKey, start: h.point.clone(), shift0: st.p.shift.slice() };
      if (e.shiftKey) plane.setFromNormalAndCoplanarPoint(_v.set(0, 1, 0), h.point);
      else { const n = ctx.camera.getWorldDirection(new THREE.Vector3()); n.y = 0; if (n.lengthSq() < 1e-6) n.set(0, 0, 1); plane.setFromNormalAndCoplanarPoint(n.normalize().negate(), h.point); }
      return true;
    },
    pointermove(e) {
      if (!st.drag || !st.fit) return;
      const p = ctx.setRay(e).ray.intersectPlane(plane, new THREE.Vector3()); if (!p) return;
      const f = st.fit, F = st.foot;
      if (st.drag.shift) {
        const a = st.root.worldToLocal(st.drag.start.clone()), b = st.root.worldToLocal(p.clone());
        st.p.shift = [st.drag.shift0[0] + (b.x - a.x) / f.size.x, st.drag.shift0[1] + (b.z - a.z) / f.size.z];
      } else {
        const yG = st.root.worldToLocal(p.clone()).y, fl = f.box.min.y + F.floor * f.size.y, rim = f.box.min.y + F.rim * f.size.y;
        st.p.level = Math.max(0, Math.min(1.1, (yG - fl) / Math.max(1e-6, rim - fl)));
      }
      st.dirty = true; build();
    },
    pointerup() { st.drag = null; },
    key(e) {
      const k = e.key;
      if (k === 'ArrowUp' || k === 'ArrowDown') { set({ level: Math.max(0, Math.min(1.1, r4(st.p.level + (k === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 0.1 : 0.02)))) }); return true; }
      if (k === '[' || k === ']') { set({ inset_in: Math.max(0, Math.min(4, st.p.inset_in + (k === ']' ? -0.25 : 0.25))) }); return true; }
      if (k === '-' || k === '=' || k === '+') { set({ grow: Math.max(0.5, Math.min(1.5, r4(st.p.grow + (k === '-' ? -0.03 : 0.03)))) }); return true; }
      if (k === 'e' || k === 'E') { set({ shape: st.p.shape === 'ellipse' ? 'poly' : 'ellipse' }); return true; }
      if (k === 'x' || k === 'X') { set({ none: !st.p.none }); return true; }
      return false;
    },
    frame() { if (st.root) { st.root.updateWorldMatrix(true, false); holder.matrix.copy(st.root.matrixWorld); holder.matrixWorldNeedsUpdate = true; } },
  };
}
