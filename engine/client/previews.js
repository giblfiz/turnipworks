// Living previews: catalog results (and "replace with similar" variants) show the ACTUAL model turning at 6 rpm.
// One renderer, one transparent canvas laid over the UI (pointer-events: none), one scissor viewport per visible slot,
// the same technique as web/review's three-view turntable. A slot is a DOM element; until its mesh arrives the
// element shows its static icon, and it gets class "live" once the model is drawn over it.
import * as THREE from 'three';

const OMEGA = (6 * 2 * Math.PI) / 60; // 6 rpm, rad/s

export function createPreviews({ canvas, assets }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404858, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2, 3, 4); scene.add(key);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const slots = new Map(); // element -> { url, sku, yaw, pivot, ready }
  const t0 = performance.now();

  // register a DOM element as a live preview (idempotent per key). make() returns a Promise<Object3D>: the game passes
  // the tuner's own makeVisual, so a preview is the same mesh, LOD tier and orientation the world will draw.
  function attach(el, { key, make }) {
    if (!el || !make) return;
    const prev = slots.get(el);
    if (prev && prev.key === key) return;
    const s = { key, ready: false, pivot: new THREE.Group() };
    slots.set(el, s);
    el.classList.remove('live');
    make().then(m => {
      if (!m || slots.get(el) !== s) return;
      // normalize to a unit box centred at the origin so every model fills its slot the same way
      const b = new THREE.Box3().setFromObject(m), size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
      const k = 1 / Math.max(size.x, size.y, size.z, 1e-3);
      const holder = new THREE.Group(); m.position.sub(c); holder.add(m); holder.scale.setScalar(k);
      s.pivot.add(holder); s.ready = true; el.classList.add('live');
    }).catch(() => el.classList.add('failed'));
  }
  function detachAll(root) { for (const el of [...slots.keys()]) if (!root || root.contains(el)) slots.delete(el); }

  function render() {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * renderer.getPixelRatio()) || canvas.height !== Math.round(H * renderer.getPixelRatio())) renderer.setSize(W, H, false);
    renderer.setScissorTest(false); renderer.clear();
    const cr = canvas.getBoundingClientRect();
    const ang = ((performance.now() - t0) / 1000) * OMEGA;
    let drawn = 0;
    renderer.setScissorTest(true);
    for (const [el, s] of slots) {
      if (!el.isConnected) { slots.delete(el); continue; }
      if (!s.ready) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.bottom < cr.top || r.top > cr.bottom || el.closest('[hidden]') || getComputedStyle(el).visibility === 'hidden') continue;
      const clip = el.closest('.clip')?.getBoundingClientRect(); // a scrolled list hides what scrolled out of it
      if (clip && (r.bottom < clip.top || r.top > clip.bottom)) continue;
      const x = r.left - cr.left, y = H - (r.bottom - cr.top);
      renderer.setViewport(x, y, r.width, r.height); renderer.setScissor(x, y, r.width, r.height);
      camera.aspect = r.width / r.height; camera.position.set(0, 0.55, 2.3); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
      s.pivot.rotation.y = ang;
      scene.add(s.pivot); renderer.render(scene, camera); scene.remove(s.pivot);
      drawn++;
    }
    renderer.setScissorTest(false);
    return drawn;
  }
  return { attach, detachAll, render, slots, renderer };
}
