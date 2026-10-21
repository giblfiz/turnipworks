// LEVELS ABOVE THE CUT FLY AWAY (Harry 2026-10-06): "Instead of just disappearing, levels above the cut should fly up
// into the sky offscreen in a (very) short animation ... a 'not all at once' thing, sort of like the way stuff builds,
// but faster." The look (timing, order, rise, easing, fade) is the tuner's Fly-away panel; the game plays the house
// preset with the tuner's own runner (fx/cutfly.js, world.fx.cutfly), the way the spawn animation is the tuner's.
//
// IT NEVER GETS IN THE WAY, BY CONSTRUCTION. The cut still hides and shows at once, exactly as before: the real piece
// is invisible (and unpickable, its lamps out) from the frame the cut moves. What flies is a CARRIER: an empty group in
// a layer of its own that borrows the piece's drawn children for the length of the flight and hands them back when it
// ends. So nothing that asks "is this hidden?" (picks, selection, lamps, labels, the touchable audit, tests) can tell
// an animation is playing, and a piece in flight has nothing to click. Coming back is the same in reverse: the piece
// counts as shown at once, its drawn children arrive when they land.
//
//   world.cutFly.leave(group, owner) / arrive(group, owner)   queued by the cut pass and the roof pass as they flip a piece
//   world.cutFly.commit()                                     one batch per pass: staggered by the house preset's order
//   world.cutFly.frame(now, camera)                           steps; with nothing in flight it does nothing at all
//   world.cutFly.flush()                                      everything lands now (an area picture is being taken)
// Off (everything is instant, as before 2026-10-06): the browser asks for reduced motion, Settings ▸ Me ▸ Reduced
// motion, Settings ▸ Me ▸ "Levels fly away" off, the house preset says off, or the tuner's runner is not there.
import * as THREE from 'three';

let pointer = null; // the last press on the canvas, in client pixels: pieces leave outward from it
if (typeof addEventListener === 'function') addEventListener('pointerdown', (ev) => { pointer = ev.target?.id === 'c' ? { x: ev.clientX, y: ev.clientY, at: performance.now(), el: ev.target } : null; }, true);
const reduced = () => { try { const c = document.documentElement.classList; return c.contains('reduce-motion') || c.contains('no-cutfly') || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export function gameFly(world) {
  const runner = () => world.fx?.cutfly || null;
  const layer = new THREE.Group(); layer.name = 'cut-fly'; world.scene.add(layer);
  const carriers = new Map(); // the real group -> its carrier
  let queue = [], camera = null, uid = 0;
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
  const enabled = () => { const R = runner(); return !!R && R.params.on !== false && !world.flyMuted && !world.cutLift && !reduced(); };

  // hand the drawn children back (those still ours; a visual replaced meanwhile is dropped, not doubled)
  function giveBack(g, c) {
    carriers.delete(g); layer.remove(c);
    for (const kid of [...c.children]) {
      c.remove(kid);
      const v = c.userData.owner?.visual;
      if (c.userData.dispose || (kid === c.userData.visualWas && v && v !== kid)) { if (c.userData.dispose) kid.traverse(o => { if (o.isMesh) o.geometry?.dispose?.(); }); continue; }
      g.add(kid);
    }
  }
  function carrierFor(g, owner, dispose) {
    let c = carriers.get(g); if (c) return c;
    c = new THREE.Group(); c.userData = { key: `fly${++uid}`, owner, visualWas: owner?.visual || null, dispose: !!dispose };
    g.updateWorldMatrix(true, false); g.matrixWorld.decompose(_p, _q, _s); c.position.copy(_p); c.quaternion.copy(_q); c.scale.copy(_s);
    for (const kid of [...g.children]) c.add(kid);
    layer.add(c); carriers.set(g, c);
    return c;
  }
  // where the ripple starts: under the last press on the canvas, on the plane of the cut (a click on the meter or a key: the middle of the batch)
  function origin() {
    if (!pointer || !camera || performance.now() - pointer.at > 1500) return null;
    const r = pointer.el.getBoundingClientRect(); if (!r.width) return null;
    _ndc.set((pointer.x - r.left) / r.width * 2 - 1, -((pointer.y - r.top) / r.height) * 2 + 1); _ray.setFromCamera(_ndc, camera);
    const o = _ray.ray.origin, d = _ray.ray.direction, y = Math.max(0, world.cut ?? 0); if (Math.abs(d.y) < 1e-6) return null;
    const t = (y - o.y) / d.y; return t > 0 ? [o.x + d.x * t, o.z + d.z * t] : null;
  }

  const self = {
    layer,
    // a piece the cut (or the roof switch) has just hidden / shown. `was`: it was being drawn until now.
    leave(g, owner, was = true, dispose = false) { if (was && (g.children.length || carriers.has(g)) && enabled() && !world.anims.has(g)) queue.push({ g, owner, dir: 1, dispose }); else self.drop(g); },
    arrive(g, owner) { if (enabled() && !world.anims.has(g) && (g.children.length || carriers.has(g))) queue.push({ g, owner, dir: -1 }); else self.drop(g); },
    drop(g) { const c = carriers.get(g); if (c) runner()?.cancel(c.userData.key); if (carriers.has(g)) giveBack(g, carriers.get(g)); },
    commit() {
      if (!queue.length) return 0;
      const R = runner(), q = queue; queue = [];
      if (!R) return 0;
      const out = [], back = [];
      for (const it of q) {
        const g = it.g, c = carrierFor(g, it.owner, it.dispose), room = it.owner?.roomId ?? it.owner?.entity?.room ?? it.owner?.id ?? '';
        (it.dir > 0 ? out : back).push({ key: c.userData.key, obj: c, x: c.position.x, z: c.position.z, room, onEnd: () => { if (carriers.get(g) === c) giveBack(g, c); } });
      }
      const o = origin(), scale = camera ? Math.max(1, camera.position.y / 80) : 1; // the rise grows with the camera's height, so a piece leaves the top of the view at any zoom
      let ms = 0;
      if (out.length) ms = Math.max(ms, R.launch(out, 1, { origin: o, scale }));
      if (back.length) ms = Math.max(ms, R.launch(back, -1, { origin: o, scale }));
      return ms;
    },
    frame(now, cam) { if (cam) camera = cam; if (!carriers.size) return 0; return runner()?.frame(now) || 0; },
    flush() { queue = []; runner()?.flush(); for (const [g, c] of [...carriers]) giveBack(g, c); },
    // a roof about to be dropped (roofs switched off): its drawn parts fly off and are disposed where they end
    leaveRoofs() { if (!enabled()) return; for (const rec of world.roofRecs?.values() || []) if (rec.group.visible && !carriers.has(rec.group)) queue.push({ g: rec.group, owner: rec, dir: 1, dispose: true }); self.commit(); },
    enabled, busy: () => carriers.size > 0,
    stats: () => ({ carriers: carriers.size, queued: queue.length, enabled: enabled(), ...(runner()?.stats() || {}) }),
  };
  return self;
}
