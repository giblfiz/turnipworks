// OPEN/SHUT mode: hinges for things that swing, and an aligned swap for things with a catalog "-open" twin.
//   hinge  the tuner's js/hinge.js rig (the same code look.js runs in the game): pivot on a bounding-box edge, an axis,
//          an open angle; 'whole' swings the entire mesh (doors, gates, trapdoors), 'lid' cuts it at a height and
//          swings the top (chests). Click the object to snap the pivot to the nearest box edge; E steps through edges.
//   swap   the closed mesh is replaced by its open twin; an offset (fractions of the catalog box) and a yaw keep the
//          swap from jumping. The other state shows as a ghost (G) to align against.
// Preview: auto-cycles open/shut (C), O toggles. Writes kind "hinge", name = the CLOSED mesh id, in the open/close
// pilot's openclose.json shape: { mode, parts: { moving, split }, pivot, axis, openAngle, duration, ease, openEase } or
// { mode: 'swap', open: { sku, mesh }, offset, yaw, duration }.
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const EDGE_ORDER = ['top back', 'top front', 'top left', 'top right', 'back left', 'back right', 'front left', 'front right', 'bottom back', 'bottom front', 'bottom left', 'bottom right'];

export function createOpenMode(ctx) {
  const { THREE, hinge, LAYER } = ctx;
  const st = { entry: null, p: null, autoP: null, box: null, S: null, yaw: 0, rig: null, closedV: null, openV: null, ghost: null, t: 0, target: 1, cycle: true, hold: 0, dirty: false, showGhost: true, busy: false, again: false, edges: [] };
  const marker = new THREE.Group(); marker.visible = false; ctx.scene.add(marker);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: '#ff7a3c', depthTest: false, transparent: true }));
  const axisLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1)]), new THREE.LineBasicMaterial({ color: '#ff7a3c', depthTest: false, transparent: true }));
  for (const o of [ball, axisLine]) { o.layers.set(LAYER.helpers); o.renderOrder = 22; o.userData.helper = true; marker.add(o); }
  let el = null;
  const _v = new THREE.Vector3(), _q = new THREE.Quaternion();

  // ---- frames: oriented (front +Z after the orient yaw) <-> GLB
  const toG = (dx, dz) => { const a = -st.yaw * Math.PI / 180; return [dx * Math.cos(a) + dz * Math.sin(a), -dx * Math.sin(a) + dz * Math.cos(a)]; };
  const toO = (gx, gz) => { const a = st.yaw * Math.PI / 180; return [gx * Math.cos(a) + gz * Math.sin(a), -gx * Math.sin(a) + gz * Math.cos(a)]; };
  const sideName = (j, v) => { if (j === 1) return v ? 'top' : 'bottom'; const g = j === 0 ? [v ? 1 : -1, 0] : [0, v ? 1 : -1]; const [ox, oz] = toO(...g); return Math.abs(ox) > Math.abs(oz) ? (ox > 0 ? 'right' : 'left') : (oz > 0 ? 'front' : 'back'); };
  function buildEdges() { // the 12 box edges in bbox fractions, named in the oriented frame
    const out = [];
    for (let k = 0; k < 3; k++) { const [j1, j2] = [0, 1, 2].filter(j => j !== k); for (const a of [0, 1]) for (const b of [0, 1]) {
      const u = [0.5, 0.5, 0.5]; u[j1] = a; u[j2] = b; const axis = [0, 0, 0]; axis[k] = 1;
      const names = [[j1, a], [j2, b]].map(([j, v]) => sideName(j, v)).sort((x, y) => (x === 'top' || x === 'bottom' ? -1 : y === 'top' || y === 'bottom' ? 1 : x.localeCompare(y)));
      out.push({ k, u, axis, name: names.join(' ') });
    } }
    return out.sort((x, y) => EDGE_ORDER.indexOf(x.name) - EDGE_ORDER.indexOf(y.name));
  }
  const sizeFt = () => [0, 1, 2].map(i => st.box.getSize(new THREE.Vector3()).getComponent(i) * Math.abs(st.S.getComponent(i)));
  // choose the swing direction: lids and trapdoors lift, doors and gates swing to the back (push open)
  function goodAngle(pivotU, axis, mag) {
    const sz = sizeFt(), P = new THREE.Vector3(...pivotU.map((u, i) => u * sz[i])), C = new THREE.Vector3(sz[0] / 2, sz[1] / 2, sz[2] / 2), A = new THREE.Vector3(...axis).normalize();
    const score = (deg) => { const c = C.clone().sub(P).applyQuaternion(_q.setFromAxisAngle(A, deg * Math.PI / 180 * 0.4)).add(P); const d = c.sub(C);
      if (Math.abs(axis[1]) < 0.5) return d.y; const [, oz] = toO(d.x, d.z); return -oz; };
    return score(mag) >= score(-mag) ? mag : -mag;
  }
  function edgeParams(edge, p) {
    const pivot = edge.u.slice();
    if (p.moving === 'above' && edge.k !== 1) pivot[1] = p.split; // a lid hinges at the top of the body
    return { pivot, axis: edge.axis.slice(), edge: edge.name, openAngle: goodAngle(pivot, edge.axis, Math.abs(p.openAngle) || 100) };
  }

  function autoParams(entry) {
    const base = { mode: 'hinge', moving: 'whole', split: 0.62, duration: 0.9, offset: [0, 0, 0], yaw: 0, openAngle: 95 };
    const find = (name) => st.edges.find(e => e.name === name) || st.edges[0];
    let p;
    if (entry.kind === 'trapdoor') p = { ...base, openAngle: 105, ...edgeParams(find('top back'), { ...base, openAngle: 105 }) };
    else if (entry.kind === 'lid') { const q = { ...base, moving: 'above', openAngle: 105 }; p = { ...q, ...edgeParams(find('top back'), q) }; }
    else p = { ...base, ...edgeParams(find('back left'), base) };
    // two leaves, cupboards, windows, chests that have a generated open twin: the swap is what the game shows today
    if (entry.twin && (entry.kind === 'other' || entry.kind === 'lid' || /double/.test(entry.id))) p.mode = 'swap';
    return p;
  }
  function fromRecord(d, autoP) {
    if (d?.mode === 'swap') return { ...autoP, mode: 'swap', offset: (d.offset || [0, 0, 0]).slice(), yaw: d.yaw || 0, duration: d.duration ?? autoP.duration };
    if (d?.mode === 'hinge') return { ...autoP, mode: 'hinge', moving: d.parts?.moving || 'whole', split: d.parts?.split ?? autoP.split, pivot: d.pivot.slice(), axis: d.axis.slice(), openAngle: d.openAngle, duration: d.duration ?? autoP.duration, edge: d.edge || '' };
    return { ...autoP };
  }
  const hingeRec = () => ({ mode: 'hinge', parts: { moving: st.p.moving, split: r4(st.p.split) }, pivot: st.p.pivot.map(r4), axis: st.p.axis.map(r4), openAngle: Math.round(st.p.openAngle), duration: st.p.duration, ease: 'inOutCubic', openEase: 'outBack' });
  const twinSpec = () => {
    const e = st.entry, tw = e.twin, closed = ctx.specOf(e);
    const od = tw.size ? [tw.size[0] / 12, tw.size[2] / 12, tw.size[1] / 12] : closed.dims;
    const dims = e.place === 'kit' ? od : closed.dims, sc = Math.max(...closed.dims) / Math.max(...tw.bounds);
    return { ...closed, id: tw.id, sku: tw.sku, url: tw.url, s: [sc, sc, sc], dims, closedDims: closed.dims };
  };
  function ghostOf(v) {
    const g = v.clone(true); g.visible = true;
    g.traverse(o => { o.visible = true; if (o.isMesh) { o.material = (Array.isArray(o.material) ? o.material : [o.material]).map(m => { const c = m.clone(); c.transparent = true; c.opacity = 0.28; c.depthWrite = false; return c; }); if (o.material.length === 1) o.material = o.material[0]; o.renderOrder = 4; o.userData.helper = true; } });
    return g;
  }

  // ---- (re)build the preview for the current params
  async function rebuild() {
    if (st.busy) { st.again = true; return; }
    st.busy = true;
    const entry = st.entry, cur = ctx.cur();
    try {
      for (const o of [st.openV, st.ghost]) o?.removeFromParent();
      st.openV = st.ghost = null; st.rig = null;
      const v = await ctx.makeVisual(ctx.specOf(entry));
      if (st.entry !== entry || ctx.cur() !== cur) return;
      ctx.replaceVisual(v);
      if (st.p.mode === 'hinge') {
        st.rig = hinge.rigHinge(ctx.meshRootOf(v), { ...hingeRec() });
        st.rig?.set(curveT());
      } else if (entry.twin) {
        const ov = await ctx.makeVisual(twinSpec());
        if (st.entry !== entry || ctx.cur() !== cur) return;
        st.openV = ov; cur.it.group.add(ov);
        placeSwap(); // the ghost of the other state is made in frame()
      }
    } finally { st.busy = false; }
    if (st.again) { st.again = false; rebuild(); }
    paint();
  }
  function placeSwap() {
    if (!st.openV) return;
    const sp = hinge.swapPlacement({ offset: st.p.offset, yaw: st.p.yaw }, ctx.specOf(st.entry).dims);
    const root = ctx.meshRootOf(st.openV);
    if (!root.userData.baseYaw && root.userData.baseYaw !== 0) root.userData.baseYaw = root.rotation.y;
    root.position.set(sp.x, sp.y, sp.z); root.rotation.y = root.userData.baseYaw + sp.yaw;
    if (st.ghost) {
      const showOpen = st.t >= 0.5, gr = ctx.meshRootOf(st.ghost);
      if (gr.userData.baseYaw === undefined) gr.userData.baseYaw = gr.rotation.y;
      if (showOpen) { gr.position.set(0, 0, 0); gr.rotation.y = gr.userData.baseYaw; } else { gr.position.set(sp.x, sp.y, sp.z); gr.rotation.y = gr.userData.baseYaw + sp.yaw; }
    }
  }
  const curveT = () => { const E = hinge.EASE; return st.target > 0.5 ? E.outBack(st.t) : E.inOutCubic(st.t); };
  let rebuildT = 0;
  const change = (patch, { rebuildNow = true } = {}) => {
    Object.assign(st.p, patch); st.dirty = true; paint(); ctx.changed();
    if (rebuildNow) { cancelAnimationFrame(rebuildT); rebuildT = requestAnimationFrame(() => rebuild()); }
  };
  function snapEdge(edge) { change({ ...edgeParams(edge, st.p) }); }
  function stepEdge(dir) { const i = st.edges.findIndex(e => e.name === st.p.edge); snapEdge(st.edges[(i + dir + st.edges.length) % st.edges.length]); }
  function setMode(m) {
    if (m === 'swap' && !st.entry.twin) { ctx.toast('no generated "-open" twin for this one: hinge only', true); return; }
    if (m === 'swap') return change({ mode: 'swap' });
    const moving = m === 'lid' ? 'above' : 'whole';
    const p = { ...st.p, mode: 'hinge', moving };
    const edge = st.edges.find(e => e.name === st.p.edge) || st.edges.find(e => e.name === (moving === 'above' ? 'top back' : 'back left'));
    change({ mode: 'hinge', moving, ...edgeParams(edge, p) });
  }
  const modeName = () => (st.p.mode === 'swap' ? 'swap' : st.p.moving === 'above' ? 'lid' : 'whole');

  function panel(root) {
    el = root;
    root.innerHTML = `<div class="group"><h3>How it opens <kbd>M</kbd></h3>
        <div class="seg"><button type="button" data-m="whole">Hinge: whole</button><button type="button" data-m="lid">Hinge: lid</button><button type="button" data-m="swap">Swap to open twin</button></div>
        <div class="row"><button type="button" id="o-toggle">Open / shut <kbd>O</kbd></button><button type="button" id="o-cycle">Auto-cycle <kbd>C</kbd></button></div></div>
      <div class="group" id="o-hinge"><h3>Hinge</h3>
        <label>Edge <select id="o-edge"></select><output></output></label>
        <label>Pivot x <input type="range" id="o-px" min="0" max="1" step="0.005"><output id="o-px-o"></output></label>
        <label>Pivot y <input type="range" id="o-py" min="0" max="1" step="0.005"><output id="o-py-o"></output></label>
        <label>Pivot z <input type="range" id="o-pz" min="0" max="1" step="0.005"><output id="o-pz-o"></output></label>
        <label>Open angle <input type="range" id="o-ang" min="-180" max="180" step="1"><output id="o-ang-o"></output></label>
        <label id="o-split-row">Lid split <input type="range" id="o-split" min="0.05" max="0.95" step="0.005"><output id="o-split-o"></output></label>
        <p class="muted">Click the object to snap the hinge to the nearest box edge. R reverses the swing.</p></div>
      <div class="group" id="o-swap"><h3>Swap alignment</h3>
        <label>Offset x <input type="range" id="o-ox" min="-0.5" max="0.5" step="0.005"><output id="o-ox-o"></output></label>
        <label>Offset y <input type="range" id="o-oy" min="-0.5" max="0.5" step="0.005"><output id="o-oy-o"></output></label>
        <label>Offset z <input type="range" id="o-oz" min="-0.5" max="0.5" step="0.005"><output id="o-oz-o"></output></label>
        <label>Turn <input type="range" id="o-yaw" min="-45" max="45" step="0.5"><output id="o-yaw-o"></output></label>
        <label class="check"><input type="checkbox" id="o-ghost"> Show the other state as a ghost <kbd>G</kbd></label>
        <p class="muted" id="o-twin"></p></div>`;
    root.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.m)));
    root.querySelector('#o-toggle').addEventListener('click', () => toggle());
    root.querySelector('#o-cycle').addEventListener('click', () => { st.cycle = !st.cycle; paint(); });
    root.querySelector('#o-edge').addEventListener('change', (e) => snapEdge(st.edges.find(x => x.name === e.target.value)));
    const num = (id, f) => root.querySelector(id).addEventListener('input', (e) => f(+e.target.value));
    num('#o-px', v => change({ pivot: [v, st.p.pivot[1], st.p.pivot[2]], edge: 'custom' }));
    num('#o-py', v => change({ pivot: [st.p.pivot[0], v, st.p.pivot[2]], edge: 'custom' }));
    num('#o-pz', v => change({ pivot: [st.p.pivot[0], st.p.pivot[1], v], edge: 'custom' }));
    num('#o-ang', v => change({ openAngle: v }));
    num('#o-split', v => change({ split: v, pivot: [st.p.pivot[0], Math.abs(st.p.axis[1]) < 0.5 ? v : st.p.pivot[1], st.p.pivot[2]] }));
    num('#o-ox', v => { change({ offset: [v, st.p.offset[1], st.p.offset[2]] }, { rebuildNow: false }); placeSwap(); });
    num('#o-oy', v => { change({ offset: [st.p.offset[0], v, st.p.offset[2]] }, { rebuildNow: false }); placeSwap(); });
    num('#o-oz', v => { change({ offset: [st.p.offset[0], st.p.offset[1], v] }, { rebuildNow: false }); placeSwap(); });
    num('#o-yaw', v => { change({ yaw: v }, { rebuildNow: false }); placeSwap(); });
    root.querySelector('#o-ghost').addEventListener('change', (e) => { st.showGhost = e.target.checked; paint(); });
  }
  function paint() {
    if (!el || !st.p) return;
    const p = st.p, m = modeName();
    el.querySelectorAll('[data-m]').forEach(b => { b.classList.toggle('on', b.dataset.m === m); if (b.dataset.m === 'swap') b.disabled = !st.entry?.twin; });
    el.querySelector('#o-cycle').classList.toggle('on', st.cycle);
    el.querySelector('#o-hinge').hidden = p.mode !== 'hinge'; el.querySelector('#o-swap').hidden = p.mode !== 'swap';
    const sel = el.querySelector('#o-edge');
    if (sel.options.length !== st.edges.length + 1) sel.replaceChildren(...st.edges.map(e => new Option(e.name, e.name)), new Option('custom', 'custom'));
    sel.value = st.edges.some(e => e.name === p.edge) ? p.edge : 'custom';
    const out = (id, v, txt) => { el.querySelector(id).value = v; el.querySelector(`${id}-o`).textContent = txt ?? (+v).toFixed(2); };
    out('#o-px', p.pivot[0]); out('#o-py', p.pivot[1]); out('#o-pz', p.pivot[2]); out('#o-ang', p.openAngle, `${Math.round(p.openAngle)}°`);
    el.querySelector('#o-split-row').hidden = p.moving !== 'above'; out('#o-split', p.split);
    out('#o-ox', p.offset[0]); out('#o-oy', p.offset[1]); out('#o-oz', p.offset[2]); out('#o-yaw', p.yaw, `${(+p.yaw).toFixed(1)}°`);
    el.querySelector('#o-ghost').checked = st.showGhost;
    el.querySelector('#o-twin').textContent = st.entry?.twin ? `Open twin: ${st.entry.twin.sku} (${st.entry.twin.mesh})` : 'No generated open twin.';
  }
  function toggle() { st.cycle = false; st.target = st.t >= 0.5 ? 0 : 1; paint(); }
  const isAuto = () => JSON.stringify(st.p) === JSON.stringify(st.autoP);

  return {
    key: 'open',
    get dirty() { return st.dirty; },
    keys: [['O', 'open / shut'], ['C', 'auto-cycle on/off'], ['M', 'hinge whole → lid → swap'], ['click', 'snap the hinge to the nearest box edge'], ['E / Shift+E', 'next / previous edge'], ['R', 'reverse the swing'], ['[ ]', 'open angle ∓ 5°'], ['↑ ↓', 'lid split (lid) · offset y (swap)'], ['G', 'ghost of the other state (swap)']],
    panel,
    async open(entry, cur) {
      st.entry = entry; st.dirty = false; st.t = 0; st.target = 1; st.cycle = true; st.hold = 0.4;
      const root = cur.root; st.box = hinge.glbBox(root); st.S = root.scale.clone(); st.yaw = ctx.look.meshYawDeg({ sku: entry.sku, yaw: 0 });
      st.edges = buildEdges();
      st.autoP = autoParams(entry);
      const rec = ctx.record()?.data;
      st.p = rec ? fromRecord(rec, st.autoP) : JSON.parse(JSON.stringify(st.autoP));
      paint();
      await rebuild();
    },
    close() { for (const o of [st.openV, st.ghost]) o?.removeFromParent(); st.openV = st.ghost = st.rig = null; st.entry = null; marker.visible = false; },
    auto() { if (!st.entry) return; st.p = JSON.parse(JSON.stringify(st.autoP)); st.dirty = true; paint(); rebuild(); },
    record() {
      const e = st.entry, common = { kind: e.kind, auto: isAuto(), closed: { sku: e.sku, mesh: e.mesh } };
      if (st.p.mode === 'swap') return { mode: 'swap', open: { sku: e.twin.sku, mesh: e.twin.mesh }, offset: st.p.offset.map(r4), yaw: r4(+st.p.yaw), duration: st.p.duration, ...common };
      return { ...hingeRec(), edge: st.p.edge, ...common };
    },
    saved() { st.dirty = false; },
    summary() {
      if (!st.p) return '';
      if (st.p.mode === 'swap') return `<b>swap</b> to ${st.entry.twin?.sku} · offset ${st.p.offset.map(v => v.toFixed(3)).join(', ')} · turn ${(+st.p.yaw).toFixed(1)}° · ${isAuto() ? 'automatic' : 'edited'}`;
      return `<b>hinge (${st.p.moving === 'above' ? 'lid' : 'whole'})</b> on the ${st.p.edge || 'custom'} edge · ${Math.round(st.p.openAngle)}° · ${isAuto() ? 'automatic' : 'edited'}`;
    },
    state: () => ({ p: JSON.parse(JSON.stringify(st.p)), auto: st.autoP, t: st.t, target: st.target, cycle: st.cycle, rigged: !!st.rig, openShown: !!st.openV?.visible, dirty: st.dirty, edges: st.edges.map(e => e.name), yaw: st.yaw,
      pivotScreen: marker.visible ? ctx.screenOf(ball.getWorldPosition(new THREE.Vector3())) : null }),
    click(e) {
      if (st.p?.mode !== 'hinge' || !st.rig) return;
      if (st.t > 0.01) { st.t = 0; st.target = 0; st.cycle = false; st.rig.set(0); ctx.cur().it.group.updateMatrixWorld(true); }
      const h = ctx.hit(e); if (!h) return;
      const root = st.rig.root, l = root.worldToLocal(h.point.clone()); // rigged root: feet in the GLB axes (scale baked)
      const size = st.box.getSize(new THREE.Vector3());
      const u = [0, 1, 2].map(i => (l.getComponent(i) / Math.abs(st.S.getComponent(i)) - st.box.min.getComponent(i)) / size.getComponent(i));
      const sz = sizeFt();
      let best = null, bd = Infinity;
      for (const ed of st.edges) { // distance to the edge line, in feet
        const d = Math.hypot(...[0, 1, 2].filter(i => i !== ed.k).map(i => (u[i] - ed.u[i]) * sz[i]));
        if (d < bd) { bd = d; best = ed; }
      }
      if (best) { snapEdge(best); ctx.toast(`hinge on the ${best.name} edge`); }
    },
    key(e) {
      const k = e.key;
      if (k === 'o' || k === 'O') { toggle(); return true; }
      if (k === 'c' || k === 'C') { st.cycle = !st.cycle; paint(); return true; }
      if (k === 'm' || k === 'M') { const order = ['whole', 'lid', ...(st.entry?.twin ? ['swap'] : [])]; setMode(order[(order.indexOf(modeName()) + 1) % order.length]); return true; }
      if (k === 'g' || k === 'G') { st.showGhost = !st.showGhost; paint(); return true; }
      if (st.p?.mode === 'hinge') {
        if (k === 'e' || k === 'E') { stepEdge(e.shiftKey ? -1 : 1); return true; }
        if (k === 'r' || k === 'R') { change({ openAngle: -st.p.openAngle }); return true; }
        if (k === '[' || k === ']') { const m = Math.max(5, Math.min(180, Math.abs(st.p.openAngle) + (k === ']' ? 5 : -5))); change({ openAngle: Math.sign(st.p.openAngle || 1) * m }); return true; }
        if ((k === 'ArrowUp' || k === 'ArrowDown') && st.p.moving === 'above') { const v = Math.max(0.05, Math.min(0.95, r4(st.p.split + (k === 'ArrowUp' ? 0.01 : -0.01)))); change({ split: v, pivot: [st.p.pivot[0], Math.abs(st.p.axis[1]) < 0.5 ? v : st.p.pivot[1], st.p.pivot[2]] }); return true; }
      } else if (k === 'ArrowUp' || k === 'ArrowDown') { change({ offset: [st.p.offset[0], r4(st.p.offset[1] + (k === 'ArrowUp' ? 0.005 : -0.005)), st.p.offset[2]] }, { rebuildNow: false }); placeSwap(); return true; }
      return false;
    },
    frame(dt) {
      if (!st.entry || !st.p) return;
      const s = dt / 1000, dur = Math.max(0.2, st.p.duration || 0.9);
      if (st.t !== st.target) st.t = st.target > st.t ? Math.min(st.target, st.t + s / dur) : Math.max(st.target, st.t - s / dur);
      else if (st.cycle) { st.hold -= s; if (st.hold <= 0) { st.target = st.target > 0.5 ? 0 : 1; st.hold = 0.7; } }
      if (st.rig) {
        st.rig.set(curveT());
        marker.visible = true;
        const root = st.rig.root, sz = sizeFt(), r = Math.max(0.03, Math.max(...sz) * 0.025);
        st.rig.pivot.getWorldPosition(marker.position); ball.scale.setScalar(r);
        const dir = st.rig.axisLocal.clone().transformDirection(root.matrixWorld);
        marker.quaternion.setFromUnitVectors(_v.set(0, 0, 1), dir); axisLine.scale.set(1, 1, Math.max(...sz) * 0.75); ball.scale.setScalar(r);
      } else marker.visible = false;
      if (st.openV) {
        const cur = ctx.cur(), showOpen = st.t >= 0.5;
        cur.it.visual.visible = !showOpen; st.openV.visible = showOpen;
        if (st.ghost) {
          const want = showOpen ? 'closed' : 'open';
          if (st.ghost.userData.of !== want) { st.ghost.removeFromParent(); st.ghost = ghostOf(showOpen ? cur.it.visual : st.openV); st.ghost.userData.of = want; st.ghost.visible = true; cur.it.group.add(st.ghost); placeSwap(); }
          st.ghost.visible = st.showGhost;
        }
      }
    },
  };
}
