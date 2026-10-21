// REAL 3D DICE (2026-10-19; Harry 2026-10-16: "Dice I think requires some fancy animated dice that make players go
// 'ohhho'"). One runtime for the Spawn Tuner's Dice panel and the game (engine/client/surfaces/dice.js), so what
// Harry tunes is what the table plays. Knobs: DICE_DEFAULTS; the house look's `dice` field ("Use in game").
//
//   const dice = createDice({ scene, params, rapierUrl, onSettle(id, values) })
//   await dice.simulate({ dice: ['d6', …], from, to, world, visible, seed })   THE ROLLER ONLY: the throw, once
//        -> { rec, tries, reasons, fallback, ms }
//   dice.play({ id, rec, values: [n per die], color, at: performance.now() })  EVERY SEAT: plays a recording
//        (values are the committed roll's numbers; the numbering is turned to them here, never the die)
//   dice.frame(now) -> true while anything is in the air or fading;  dice.active();  dice.stirrers() (fog)
//   dice.lying() -> the dice still lying on the table (type, body pose): obstacles for the next throw
// Cost: nothing at all with no dice out (no objects in the scene, frame() returns at once).
import * as THREE from 'three';
import { dieGeo, remap, qMul, topIndex, labelOf, valueOfLabel } from './dicegeo.js';
import { loadRapier, throwDiceAsync, decode } from './dicephys.js';
import { DICE_DEFAULTS, normDice, physOf } from './diceparams.js';
export { DICE_DEFAULTS, DICE_SCHEMA, DICE_BUILTINS, normDice, physOf } from './diceparams.js';
import { dieMesh } from './dicelook.js';
import { timeline } from './dicetime.js';
export { diceOfRoll } from './dicephys.js';

export function createDice({ scene, params = null, rapierUrl, onSettle = () => {}, reduced = () => false, simple = () => false, colorOf = () => null }) {
  let P = normDice(params);
  const root = new THREE.Group(); root.name = 'dice'; scene.add(root);
  const throws = new Map(); // id -> { dice: [{ group, body, q, ... }], rec, t0, settled, ... }
  const st = { played: 0, simulated: 0, lastSim: null, frames: 0, tris: 0 };
  let R = null;

  const self = {
    get params() { return P; },
    set(p) { P = normDice(p); },
    apply() { },
    root,
    async ready() { R = R || await loadRapier(rapierUrl); return R; },
    // THE ROLLER: throw once (Rapier), with the dice already lying out as obstacles
    async simulate({ dice, from, to, world = {}, visible = null, rest = null, seed = (Math.random() * 2 ** 32) >>> 0, by = null }) {
      await self.ready();
      if (by) for (const T of throws.values()) if (T.by === by && T.settled) self.fadeNow(T.id); // my next roll clears my last (it has been read); others' dice stay, as obstacles
      const t = performance.now();
      const r = await throwDiceAsync(R, { dice, P: physOf(P), from, to, world: { ...world, dice: [...(world.dice || []), ...self.lying()] }, visible, rest, seed });
      r.ms = +(performance.now() - t).toFixed(1); st.simulated++; st.lastSim = { tries: r.tries, reasons: r.reasons, fallback: r.fallback, ms: r.ms, settleAt: +r.settleAt.toFixed(2), bytes: r.rec.b.length, keys: r.rec.f, touched: r.touched || [], gentled: r.gentled || null };
      return r;
    },
    // EVERY SEAT: play a recording; `values` are the committed numbers, in the recording's die order
    play({ id, rec, values, color = null, at = performance.now(), tagFor = null, hold = false, by = null }) {
      if (throws.has(id)) return throws.get(id).promise;
      const D = decode(rec);
      const look = { ...P.look, color: P.look.colorMode === 'seat' && color ? color : P.look.color, size: D.size || P.look.size };
      if (simple()) look.segments = 1;
      const dice = D.dice.map((type, i) => {
        const g = dieGeo(type), fin = D.final[i];
        const { g: sym } = remap(g, fin.q, values[i]); // the numbering turned so the top reads values[i]
        const group = dieMesh(type, look); root.add(group);
        group.userData.dieId = `${id}:${i}`;
        return { type, g, group, sym, value: values[i], tag: null };
      });
      let resolve; const promise = new Promise(r => { resolve = r; });
      const tl = timeline(D.duration, P.throw);
      const T = { id, D, dice, t0: at, tl, dur: tl.dur, settled: false, resolve, promise, values, fadeFrom: null, tagFor, hold, by };
      if (reduced()) T.t0 = at - T.dur * 1000; // reduced motion: they are simply there, at rest
      throws.set(id, T); st.played++;
      place(T, performance.now());
      return promise;
    },
    frame(now) {
      if (!throws.size) return false;
      st.frames++;
      for (const T of [...throws.values()]) place(T, now);
      return throws.size > 0;
    },
    // (tests, frame strips) put a throw at `sec` seconds of its playback and hold it there
    seek(id, sec) { const T = throws.get(id); if (!T) return null; T.paused = sec; place(T, performance.now()); return { dur: T.dur, settled: T.settled }; },
    duration: (id) => throws.get(id)?.dur ?? null,
    active: () => throws.size,
    busy: () => [...throws.values()].some(T => !T.settled || T.fadeFrom != null || !T.tagsIn), // (in the air, a tag coming in, or fading: drawn at full rate)
    has: (id) => throws.has(id),
    settled: (id) => throws.get(id)?.settled ?? null,
    // what is on screen: per throw, the dice with the number on their top (for tests: read off the visual mesh)
    info: () => [...throws.values()].map(T => ({ id: T.id, settled: T.settled, values: T.values, dice: T.dice.map(d => { const q = d.group.quaternion; const vq = [q.x, q.y, q.z, q.w]; const top = topIndex(d.g, vq);
      return { type: d.type, p: d.group.position.toArray().map(v => +v.toFixed(4)), q: vq.map(v => +v.toFixed(5)), reads: valueOfLabel(d.g, d.g.labels[top]), label: labelOf(d.g, top), opacity: d.group.userData.opacity ?? 1 }; }) })),
    stirrers: () => [...throws.values()].filter(T => !T.settled).flatMap(T => T.dice.map(d => d.group)),
    // the dice lying on the table (their BODY pose: the symmetry turn is only the paint) for the next throw to hit
    lying: () => [...throws.values()].filter(T => T.settled && T.fadeFrom == null).flatMap(T => T.dice.map((d, i) => ({ type: d.type, p: T.D.final[i].p, q: T.D.final[i].q, size: T.D.size }))),
    clear() { for (const T of throws.values()) remove(T); throws.clear(); },
    // fade out early (a newer throw lands where they lie; the panel's Clear)
    fadeNow(id) { const T = throws.get(id); if (T && T.fadeFrom == null) T.fadeFrom = performance.now() - Math.max(0, P.timing.fade - 0.35) * 1000; }, // (a quick fade: about a third of a second)
    stats: () => ({ dice_throws: throws.size, dice_played: st.played, dice_simulated: st.simulated, dice_frames: st.frames, dice_last: st.lastSim, dice_tris: [...throws.values()].reduce((a, T) => a + T.dice.reduce((b, d) => b + d.group.userData.tris, 0), 0) }),
  };

  const _q = new THREE.Quaternion(), _s = new THREE.Quaternion();
  function place(T, now) {
    if (T.paused != null) T.t0 = now - T.paused * 1000;
    const t = Math.max(0, (now - T.t0) / 1000), u = Math.min(T.D.duration, T.tl.u(t));
    T.dice.forEach((d, i) => {
      const ps = T.D.pose(u, i);
      d.group.position.set(ps.p[0], ps.p[1], ps.p[2]);
      _q.set(ps.q[0], ps.q[1], ps.q[2], ps.q[3]); _s.set(d.sym[0], d.sym[1], d.sym[2], d.sym[3]);
      d.group.quaternion.copy(_q).multiply(_s); // visual = body * symmetry: same shape, numbers turned
    });
    if (!T.settled && t >= T.dur) {
      T.settled = true; T.settledAt = now;
      try { onSettle(T.id, T.values); } catch (e) { console.warn('dice settle', e); }
      T.resolve(T.values);
    }
    // the tag comes in P.tag.delay s after the dice settle, fading in over P.tag.fadeIn s (reduced motion: at once)
    if (T.settled && !T.tagged && (reduced() || now - T.settledAt >= P.tag.delay * 1000)) { T.tagged = true; T.taggedAt = reduced() ? now - 1e6 : now; addTags(T); }
    if (T.tagged && !T.tagsIn) { const k = P.tag.fadeIn > 0 ? Math.min(1, (now - T.taggedAt) / (P.tag.fadeIn * 1000)) : 1; tagOpacity(T, k); if (k >= 1) T.tagsIn = true; }
    if (T.settled && !T.hold && T.fadeFrom == null && now - T.settledAt > P.timing.linger * 1000) T.fadeFrom = now; // (hold: the panel's lineups stay until cleared)
    if (T.fadeFrom != null) {
      const f = 1 - (now - T.fadeFrom) / (P.timing.fade * 1000);
      if (f <= 0) { remove(T); throws.delete(T.id); if (!T.settled) T.resolve(T.values); return; }
      for (const d of T.dice) setOpacity(d, f);
    }
  }
  function tagOpacity(T, k) {
    for (const d of T.dice) d.tag?.traverse(o => { if (o.isSprite) { o.userData.baseOpacity = k; o.material.opacity = k * (d.group.userData.opacity ?? 1); } });
  }
  function setOpacity(d, f) {
    d.group.userData.opacity = f;
    if (!d.faded) { d.faded = true; d.group.traverse(o => { if (o.isMesh || o.isSprite) { o.material = o.material.clone(); o.material.transparent = true; o.userData.ownMat = true; } }); }
    d.group.traverse(o => { if ((o.isMesh || o.isSprite) && o.userData.ownMat) { o.material.opacity = f * (o.userData.baseOpacity ?? 1); o.material.depthWrite = f > 0.98 && !o.isSprite; } });
  }
  function remove(T) {
    for (const d of T.dice) { root.remove(d.group); d.group.traverse(o => { if (o.userData.ownMat) o.material.dispose(); if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } }); }
  }
  // THE TAG: a small number over each settled die, readable zoomed out (the height labels' style)
  function addTags(T) {
    if (P.tag.style === 'off') return;
    // a d100 is one tag over its pair (tens + units)
    const groups = []; for (let i = 0; i < T.dice.length; i++) { const d = T.dice[i]; if (d.type === 'd10t' && T.dice[i + 1]?.type === 'd10') { const v = (d.value + T.dice[i + 1].value % 10) || 100; groups.push([d, String(v), T.dice[i + 1]]); i++; } else groups.push([d, String(d.value)]); }
    for (const [d, text, other] of groups) {
      const s = d.group.scale.x, sp = tagSprite(text, P.tag.style, T.tagFor?.color || null); sp.scale.multiplyScalar(P.tag.size / s); // (a screen-sized sprite inside the die's scaled group)
      sp.position.set(0, d.g.radius + 0.55, 0);
      if (other) { const a = d.group.position, b = other.group.position; sp.position.set((b.x - a.x) / 2 / s, d.g.radius + 0.55, (b.z - a.z) / 2 / s); }
      // the tag rides in the die's group but must not turn with it: a holder that undoes the die's rotation
      const holder = new THREE.Group(); holder.quaternion.copy(d.group.quaternion).invert(); holder.add(sp);
      d.group.add(holder); d.tag = holder;
    }
  }
  return self;
}

export function tagSprite(text, style = 'pill', accent = null) {
  const font = '700 30px Inter, system-ui, sans-serif';
  const c = document.createElement('canvas'), x = c.getContext('2d'); x.font = font;
  const w = Math.ceil(Math.max(40, x.measureText(text).width + 26)), h = 42; c.width = w; c.height = h;
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  if (style === 'pill') {
    x.fillStyle = 'rgba(18,20,24,0.88)'; x.beginPath(); x.roundRect(0, 0, w, h, 10); x.fill();
    if (accent) { x.fillStyle = accent; x.fillRect(0, h - 4, w, 4); }
    x.fillStyle = '#f2efe8'; x.fillText(text, w / 2, h / 2 + 1);
  } else { x.lineWidth = 6; x.strokeStyle = 'rgba(10,10,12,0.9)'; x.lineJoin = 'round'; x.strokeText(text, w / 2, h / 2 + 1); x.fillStyle = '#fff8e6'; x.fillText(text, w / 2, h / 2 + 1); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, transparent: true }));
  sp.renderOrder = 40; sp.scale.set(w * 0.00088, h * 0.00088, 1); sp.userData.halo = true; sp.userData.noPick = true; sp.userData.diceTag = text;
  return sp;
}
