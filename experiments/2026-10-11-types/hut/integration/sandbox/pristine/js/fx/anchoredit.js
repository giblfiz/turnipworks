// Edit flames: Harry's fix tool for flame anchors (2026-10-02, "I want to fuss with that").
// Select a lit object in the tuner, press "Edit flames": its anchors show as dots. Click the object to add a flame
// there, drag a dot to move it (in the view plane; hold Shift to slide it over the object's surface), Delete removes
// the picked dot, Esc leaves. Changes apply live to every object of that sku. "Send flames" writes kind "fire_anchor"
// (name = sku, data.anchors normalised to the mesh bounds) to the server; "Auto" goes back to the derived anchors.
// Input is taken in the capture phase on window, only while editing, so the tuner's own camera/select keep working.
import * as THREE from 'three';

export function createAnchorEditor({ fire, camera, canvas, scene, items, api, toast, panel }) {
  const state = { on: false, it: null, sku: null, list: [], pick: -1, drag: false, dirty: false };
  const dots = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 13, sizeAttenuation: false, vertexColors: true, depthTest: false, transparent: true }));
  dots.renderOrder = 20; dots.userData.fx = true; dots.frustumCulled = false; dots.visible = false; scene.add(dots);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const $ = (s) => panel.querySelector(s);
  const status = (t) => { const el = $('#fx-anchor-state'); if (el) el.textContent = t; };

  function selectedItem() {
    const tag = window.tuner?.selectedTag?.(); if (!tag) return null;
    for (const it of items()) if (it.tag === tag) return it;
    return null;
  }
  function refresh() { // pull the current anchors of the selected item
    const a = state.it && fire.anchorsOf(state.it);
    state.list = a ? a.list.map(x => x.u.slice()) : [];
    draw();
    if (!state.it) status('Select a lit object (candle, lantern, torch, hearth…), then Edit flames.');
    else if (!a) status(`${state.it.spec.id} isn't a fire source.`);
    else status(`${state.it.tag} ${a.sku}: ${a.list.length} flame${a.list.length === 1 ? '' : 's'} (${a.source}${state.dirty ? ', unsent' : ''}). Click the object to add · drag a dot (Shift = on the surface) · Delete removes · Esc ends`);
  }
  const worldFromU = (u) => (state.it ? fire.worldOfU(state.it, u) : null);
  function draw() {
    dots.visible = state.on && !!state.it && state.list.length > 0;
    if (!dots.visible) return;
    const pos = [], col = [];
    state.list.forEach((u, i) => { const w = worldFromU(u); if (!w) return; pos.push(w.x, w.y, w.z); col.push(...(i === state.pick ? [0.45, 1, 0.3] : [1, 0.85, 0.2])); });
    dots.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    dots.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }
  function apply() { fire.setOverride(state.sku, state.list.map(u => u.slice())); state.dirty = true; refresh(); }
  function screenOf(w) { const v = w.clone().project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; }
  function setRay(e) { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
  function hitItem(e) { setRay(e); const h = ray.intersectObject(state.it.visual || state.it.group, true).find(x => x.object.isMesh); return h?.point || null; }
  let plane = new THREE.Plane();

  function onDown(e) {
    if (!state.on || !state.it || e.target !== canvas || e.button !== 0) return;
    let best = -1, bd = 14;
    state.list.forEach((u, i) => { const w = worldFromU(u); if (!w) return; const s = screenOf(w); const d = Math.hypot(s.x - e.clientX, s.y - e.clientY); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) {
      state.pick = best; state.drag = true;
      const w = worldFromU(state.list[best]); plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), w);
    } else {
      const p = hitItem(e); if (!p) return; // not on the object: let the tuner have the click (camera, select)
      state.list.push(fire.uOfWorld(state.it, p)); state.pick = state.list.length - 1; state.drag = true;
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), p);
      apply();
    }
    e.stopPropagation(); e.preventDefault(); draw();
  }
  function onMove(e) {
    if (!state.on || !state.drag) return;
    let p = e.shiftKey ? hitItem(e) : null;
    if (!p) { setRay(e); p = ray.ray.intersectPlane(plane, new THREE.Vector3()); }
    if (!p) return;
    state.list[state.pick] = fire.uOfWorld(state.it, p);
    fire.setOverride(state.sku, state.list.map(u => u.slice())); state.dirty = true; draw();
    e.stopPropagation(); e.preventDefault();
  }
  function onUp(e) { if (!state.on || !state.drag) return; state.drag = false; refresh(); e.stopPropagation(); e.preventDefault(); }
  function onKey(e) {
    if (!state.on || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.pick >= 0) { state.list.splice(state.pick, 1); state.pick = -1; apply(); e.stopPropagation(); e.preventDefault(); }
    else if (e.key === 'Escape') { setOn(false); e.stopPropagation(); e.preventDefault(); }
  }
  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('keydown', onKey, true);

  function setOn(on) {
    state.on = on; state.pick = -1;
    if (on) { state.it = selectedItem(); const a = state.it && fire.anchorsOf(state.it); if (!a) { state.on = false; toast('select a lit object first (candle, lantern, torch, hearth…)', true); } else state.sku = a.sku; }
    $('#fx-anchor-edit').textContent = state.on ? 'Done editing' : 'Edit flames';
    refresh();
  }
  $('#fx-anchor-edit').addEventListener('click', () => setOn(!state.on));
  $('#fx-anchor-send').addEventListener('click', async () => {
    if (!state.it) { toast('select a lit object and edit its flames first', true); return; }
    const ok = await send(state.sku, { anchors: state.list, id: state.it.spec.id, sku: state.it.spec.sku, mesh: state.sku, type: fire.anchorsOf(state.it)?.type });
    if (ok) { state.dirty = false; refresh(); }
  });
  $('#fx-anchor-auto').addEventListener('click', async () => {
    const it = state.it || selectedItem(); const a = it && fire.anchorsOf(it); if (!a) { toast('select a lit object first', true); return; }
    state.it = it; state.sku = a.sku;
    fire.setOverride(a.sku, null);
    if (await send(a.sku, { anchors: null, id: it.spec.id, type: a.type })) { state.dirty = false; refresh(); }
  });
  async function send(sku, data) {
    try {
      const r = await fetch(`${api}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'fire_anchor', name: sku, data, note: window.__fxTestNote || '' }) });
      const j = await r.json(); if (!r.ok || !j.ok) throw new Error(j.err || r.status);
      toast(data.anchors ? `sent ${data.anchors.length} flame position${data.anchors.length === 1 ? '' : 's'} for ${sku} (${j.at})` : `${sku}: back to the automatic flames (${j.at})`);
      return true;
    } catch (err) { toast(`send failed: ${err.message}; the flames stay changed in this page`, true); return false; }
  }
  // follow the selection: switching objects while editing re-targets the editor
  setInterval(() => { if (!state.on || state.drag) return; const it = selectedItem(); if (it !== state.it) { const a = it && fire.anchorsOf(it); if (a) { state.it = it; state.sku = a.sku; state.pick = -1; state.dirty = false; refresh(); } } else draw(); }, 300);
  refresh();
  return { state, setOn, refresh };
}
