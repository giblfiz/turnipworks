// FIRE mode: the live flames (the tuner's fire.js, the game's house look) at their anchors on one lit object.
// Click the object to add a flame; drag a dot to move it (in the view plane; Shift slides it over the surface);
// Delete removes the picked one; [ and ] size the picked flame. Lanterns also get a light marker (L to edit it).
// Writes kind "fire_anchor", name = mesh id, data.anchors = [[u, v, w(, size)]] normalised to the mesh's own bounds,
// or null when the automatic anchors are confirmed unchanged (so a re-derivation still reaches them).
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const same = (a, b) => JSON.stringify((a || []).map(u => u.slice(0, 4).map(r4))) === JSON.stringify((b || []).map(u => u.slice(0, 4).map(r4)));
const HELP = {
  hearth: 'Hearths, ovens, braziers and torches burn ONE volumetric flame: only the first anchor is used.',
  oven: 'Ovens burn one volumetric flame at the first anchor, lit from the mouth.',
  brazier: 'One volumetric flame at the first anchor (the coal bed).',
  torch: 'One volumetric flame at the first anchor (the head).',
  lantern: 'One small flame per anchor. The light hangs at the flame unless you move it (L).',
  candle: 'One small flame per anchor: put each on a wick tip.',
  candelabra: 'One small flame per anchor: one per candle.',
  stubs: 'One small flame per anchor: one per stub.',
  chandelier: 'One small flame per anchor: one per candle.',
};

export function createFireMode(ctx) {
  const { THREE, fire, LAYER } = ctx;
  const st = { it: null, key: null, type: null, list: [], auto: [], light: null, pick: -1, drag: null, dirty: false, editLight: false };
  const mkDots = (size) => {
    const p = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, depthTest: false, transparent: true }));
    p.renderOrder = 20; p.frustumCulled = false; p.layers.set(LAYER.helpers); p.userData.helper = true; p.visible = false; ctx.scene.add(p); return p;
  };
  const dots = mkDots(13), lightDot = mkDots(11);
  const plane = new THREE.Plane(), _v = new THREE.Vector3();
  let el = null;

  const worldOf = (u) => fire.worldOfU(st.it, u);
  function draw() {
    if (!st.it) { dots.visible = lightDot.visible = false; return; }
    const pos = [], col = [];
    st.list.forEach((u, i) => { const w = worldOf(u); if (!w) return; pos.push(w.x, w.y, w.z); col.push(...(i === st.pick ? [0.45, 1, 0.3] : [1, 0.85, 0.2])); });
    dots.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    dots.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    dots.visible = pos.length > 0;
    const lw = st.type === 'lantern' ? worldOf(st.light || st.list[0] || [0.5, 0.5, 0.5]) : null;
    lightDot.visible = !!lw;
    if (lw) { lightDot.geometry.setAttribute('position', new THREE.Float32BufferAttribute([lw.x, lw.y, lw.z], 3)); lightDot.geometry.setAttribute('color', new THREE.Float32BufferAttribute(st.editLight ? [0.4, 0.8, 1] : [0.3, 0.5, 0.9], 3)); }
  }
  function apply() { fire.setOverride(st.key, st.list.map(u => u.slice()), { light: st.light }); st.dirty = true; draw(); paint(); ctx.changed(); }
  function pull() { const a = fire.anchorsOf(st.it); st.list = (a?.list || []).map(x => x.u.slice()); st.light = a?.light || null; st.type = a?.type || null; st.key = a?.sku || null; }

  function panel(root) {
    el = root;
    root.innerHTML = `<div class="group"><h3>Flames</h3>
      <p class="muted" id="fx-help"></p>
      <label>Picked size <input type="range" id="fx-size" min="0.3" max="3" step="0.05" value="1"><output id="fx-size-o">1×</output></label>
      <div class="row"><button type="button" id="fx-del">Delete picked <kbd>Del</kbd></button><button type="button" id="fx-next">Pick next <kbd>Tab</kbd></button></div>
      <div class="row" id="fx-light-row"><button type="button" id="fx-light">Edit light <kbd>L</kbd></button><button type="button" id="fx-light-reset">Light at flame</button></div>
    </div>`;
    root.querySelector('#fx-size').addEventListener('input', (e) => setSize(+e.target.value));
    root.querySelector('#fx-del').addEventListener('click', () => del());
    root.querySelector('#fx-next').addEventListener('click', () => { cycle(); });
    root.querySelector('#fx-light').addEventListener('click', () => { st.editLight = !st.editLight; paint(); draw(); });
    root.querySelector('#fx-light-reset').addEventListener('click', () => { st.light = null; apply(); });
  }
  function paint() {
    if (!el) return;
    const u = st.list[st.pick], s = u?.[3] || 1;
    el.querySelector('#fx-help').textContent = HELP[st.type] || '';
    const sz = el.querySelector('#fx-size'); sz.disabled = !u; sz.value = s; el.querySelector('#fx-size-o').textContent = u ? `${s.toFixed(2)}×` : '–';
    el.querySelector('#fx-del').disabled = !u;
    el.querySelector('#fx-light-row').hidden = st.type !== 'lantern';
    el.querySelector('#fx-light').classList.toggle('on', st.editLight);
  }
  function setSize(s) {
    const u = st.list[st.pick]; if (!u) return;
    if (Math.abs(s - 1) < 0.01) u.length = 3; else { u.length = 3; u.push(+s.toFixed(3)); }
    apply();
  }
  function del() { if (st.pick < 0) return; st.list.splice(st.pick, 1); st.pick = Math.min(st.pick, st.list.length - 1); apply(); }
  function cycle() { if (!st.list.length) return; st.pick = (st.pick + 1) % st.list.length; draw(); paint(); }

  function nearest(e) {
    let best = -1, bd = 16;
    st.list.forEach((u, i) => { const w = worldOf(u); if (!w) return; const s = ctx.screenOf(w), d = Math.hypot(s.x - e.clientX, s.y - e.clientY); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  return {
    key: 'fire',
    get dirty() { return st.dirty; },
    keys: [['click', 'add a flame on the object'], ['drag dot', 'move it (Shift: along the surface)'], ['Del', 'delete the picked flame'], ['Tab', 'pick the next flame'], ['[ ]', 'smaller / bigger picked flame'], ['L', 'lanterns: edit where the light hangs']],
    panel,
    async open(entry, cur) {
      st.it = cur.it; st.pick = -1; st.dirty = false; st.editLight = false;
      fire.sync([cur.it]);
      pull();
      st.auto = (entry.auto?.anchors || []).map(u => u.slice());
      if (st.list.length) st.pick = 0;
      draw(); paint();
    },
    close() { fire.sync([]); st.it = null; draw(); },
    auto() {
      if (!st.it) return;
      fire.setOverride(st.key, null); pull(); st.light = null; st.pick = st.list.length ? 0 : -1; st.dirty = true; draw(); paint();
    },
    record() {
      const isAuto = !st.light && same(st.list, st.auto);
      return { anchors: isAuto ? null : st.list.map(u => u.map(r4)), ...(st.light && { light: st.light.map(r4) }), type: st.type, src: isAuto ? 'auto' : 'bench', count: st.list.length };
    },
    saved() { st.dirty = false; },
    summary() {
      if (!st.it) return '';
      const isAuto = !st.light && same(st.list, st.auto);
      return `<b>${st.type}</b> · ${st.list.length} flame${st.list.length === 1 ? '' : 's'} · ${isAuto ? 'automatic anchors' : 'edited anchors'}${st.light ? ' · light moved' : ''}`;
    },
    state: () => ({ list: st.list.map(u => u.slice()), auto: st.auto, light: st.light, pick: st.pick, type: st.type, key: st.key, dirty: st.dirty,
      screen: st.list.map(u => { const w = worldOf(u); return w ? ctx.screenOf(w) : null; }), source: st.it ? fire.anchorsOf(st.it)?.source : null }),
    pointerdown(e) {
      if (!st.it) return false;
      if (st.editLight && st.type === 'lantern') {
        const w = worldOf(st.light || st.list[0] || [0.5, 0.5, 0.5]); const s = ctx.screenOf(w);
        if (Math.hypot(s.x - e.clientX, s.y - e.clientY) < 16) { st.drag = { light: true }; plane.setFromNormalAndCoplanarPoint(ctx.camera.getWorldDirection(_v).negate(), w); return true; }
      }
      const i = nearest(e); if (i < 0) return false;
      st.pick = i; st.drag = { light: false };
      plane.setFromNormalAndCoplanarPoint(ctx.camera.getWorldDirection(_v).negate(), worldOf(st.list[i]));
      draw(); paint(); return true;
    },
    pointermove(e) {
      if (!st.drag) return;
      let p = e.shiftKey ? ctx.hit(e)?.point : null;
      if (!p) p = ctx.setRay(e).ray.intersectPlane(plane, new THREE.Vector3());
      if (!p) return;
      const u = fire.uOfWorld(st.it, p); if (!u) return;
      if (st.drag.light) st.light = u;
      else { const old = st.list[st.pick]; if (old?.[3]) u.push(old[3]); st.list[st.pick] = u; }
      fire.setOverride(st.key, st.list.map(x => x.slice()), { light: st.light }); st.dirty = true; draw();
    },
    pointerup() { if (!st.drag) return; st.drag = null; paint(); },
    click(e) {
      if (!st.it) return;
      const h = ctx.hit(e);
      if (!h) { st.pick = -1; draw(); paint(); return; }
      const u = fire.uOfWorld(st.it, h.point);
      if (st.editLight && st.type === 'lantern') st.light = u; else { st.list.push(u); st.pick = st.list.length - 1; }
      apply();
    },
    key(e) {
      const k = e.key;
      if (k === 'Delete' || k === 'Backspace') { del(); return true; }
      if (k === 'Tab') { cycle(); return true; }
      if (k === '[' || k === ']') { const u = st.list[st.pick]; if (!u) return true; setSize(Math.max(0.3, Math.min(3, (u[3] || 1) * (k === ']' ? 1.15 : 1 / 1.15)))); return true; }
      if ((k === 'l' || k === 'L') && st.type === 'lantern') { st.editLight = !st.editLight; draw(); paint(); return true; }
      return false;
    },
    frame() { if (st.it) draw(); },
  };
}
