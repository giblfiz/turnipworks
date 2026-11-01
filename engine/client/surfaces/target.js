// A PAWN'S TARGET (Harry 2026-10-29: "the key missing piece for attacks is designating who is attacked ... ONE simple,
// shared targeting primitive"). Stored on the ATTACKER's pawn: `target: <pawn id>` (token.set; '' clears; core/commands.js).
// Its owner or the GM sets it; everyone sees it. No range, no AC, no line of sight: TW knows no rules.
//
//   Set      the ring button "Target" on the pawn to aim at (it aims YOUR pawn: the last pawn of yours you selected, else
//            your main pawn, else your first; the GM's: the last pawn the GM selected before this one), or T while the
//            pointer is over a pawn. Pressing Target again (it reads "Untarget") takes it off.
//   Clear    T over empty ground, or Esc (when nothing else is open for Esc to close).
//   Seen     a reticle on the target (data/icons/target-reticle.png, a generated picture; the vendored crosshair icon until it loads), in the attacker's seat colour, laid on
//            the floor round its base) for every seat that can see both pawns, and a faint line from the attacker to it
//            while either of the two is selected here.
//   Used     the Attack button and Beyond20's attack rolls (surfaces/beyond20.js): "<pawn> attacks <target>: ...". The GET
//            API lists it (relay/llm.js "target", "targetName"); the rules card says a player's "attack" means it.
import { icon } from '../icons.js';
import { baseUnder } from '../../core/height.js';

export const TARGET_KEY = 't';
export const RETICLE = { scale: 1.45, lift: 0.07, opacity: 0.95, line: 0.45, px: 256 };

export function targetSurface(R, app) {
  const THREE = app.THREE;
  const E = () => app.entities();
  const hist = []; // the pawns this seat may move, most recently selected last
  app.on((what) => {
    if (what !== 'selection') return;
    const s = app.selected();
    if (s.length === 1 && s[0].kind === 'token' && app.canTouch(s[0])) { const i = hist.indexOf(s[0].id); if (i >= 0) hist.splice(i, 1); hist.push(s[0].id); if (hist.length > 8) hist.shift(); }
  });
  // whose target a press sets, when it is pressed on pawn `x` (never x itself)
  function actorFor(x) {
    const ents = E();
    const sel = app.selected().filter(e => e.kind === 'token' && app.canTouch(e) && e.id !== x?.id);
    if (sel.length === 1) return sel[0];
    for (let i = hist.length - 1; i >= 0; i--) { const e = ents[hist[i]]; if (e?.kind === 'token' && e.id !== x?.id && app.canTouch(e)) return e; }
    if (app.gm()) return null;
    const own = Object.values(ents).filter(e => e.kind === 'token' && e.owner === app.me() && e.id !== x?.id);
    return own.find(e => e.main) || own.sort((a, b) => String(a.name).localeCompare(String(b.name)))[0] || null;
  }
  app.actorFor = actorFor;
  app.targetOf = (e) => { const t = e?.target && E()[e.target]; return t?.kind === 'token' ? t : null; };
  app.setTarget = (att, tgt) => {
    if (!att) return false;
    if ((att.target || '') === (tgt?.id || '')) return false;
    app.dispatch('token.set', { id: att.id, target: tgt?.id || '' });
    app.toast(tgt ? `${att.name} targets ${tgt.name}` : `${att.name} has no target`);
    return true;
  };
  R.add({ id: 'pawn.target', icon: 'crosshair', group: 'Pawn', menu: true, cls: 'pawn', synonyms: ['target', 'aim', 'aim at', 'untarget', 'attack target', 'mark target'],
    title: (ctx) => { const a = actorFor(ctx?.one); return !a ? 'Target' : a.target === ctx.one?.id ? `Untarget (${a.name} stops aiming here)` : `Target: ${a.name} aims here`; },
    short: 'Target',
    ring: { kinds: ['pawn'], slot: 15.34 },
    // on the ring of a pawn someone might aim at: a player's, not on her own pawns; the GM's, between a person's pawn and
    // a monster (GM pawn on GM pawn, or a player on her own: T over it still does it)
    when: (ctx) => { const x = ctx.one, a = x?.kind === 'token' && actorFor(x); return !!a && (app.gm() ? !!(x.owner || a.owner) : x.owner !== app.me()); },
    run: (ctx) => { const a = actorFor(ctx.one); if (a) app.setTarget(a, a.target === ctx.one.id ? null : ctx.one); } });
  // T over a pawn aims at it; T over empty ground (or over anything that is not a pawn) clears; Esc clears
  const field = (ev) => !!ev.target?.closest?.('input, textarea, select, [contenteditable]');
  app.keyLayers = app.keyLayers || [];
  app.keyLayers.push((ev) => {
    if (field(ev) || ev.ctrlKey || ev.metaKey || ev.altKey || app.mode || !app.main) return false;
    const k = ev.key.toLowerCase();
    if (k === TARGET_KEY && !ev.shiftKey) {
      if (app.tray?.takesKeys?.('build') || app.tray?.takesKeys?.('pawns')) return false; // (an open menu owns its letters)
      const h = app.hover && E()[app.hover];
      if (h?.kind === 'token') { const a = actorFor(h); if (!a) { app.toast('Select your pawn first, then T over the one it aims at'); return true; } app.setTarget(a, a.target === h.id ? null : h); return true; }
      const a = actorFor(null); if (a?.target) { app.setTarget(a, null); return true; }
      return false;
    }
    if (k === 'escape' && !app.escapeStack?.length) { const a = actorFor(null); if (a?.target) { app.setTarget(a, null); return true; } }
    return false;
  });

  // ---------- drawing: a reticle on each target, a faint line while either end is selected ----------
  // THE RETICLE: a generated picture (data/icons/target-reticle.png, git-ignored like every picture: Codex image generation, white on transparent, 2026-10-29),
  // tinted per seat; until it has loaded (or if it cannot), the vendored crosshair icon stands in
  let tex = null, png = null;
  function texture() {
    if (png) return png;
    if (!texture.asked) { texture.asked = true; new THREE.TextureLoader().load(new URL('../data/icons/target-reticle.png', import.meta.url).href, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; png = t; for (const d of drawn.values()) { d.ret.material.map = t; d.ret.material.needsUpdate = true; } app.gfx?.wake?.('target'); app.refresh?.(); }, undefined, () => { }); }
    return crosshair();
  }
  function crosshair() {
    if (tex) return tex;
    const N = RETICLE.px, c = document.createElement('canvas'); c.width = c.height = N;
    const ctx = c.getContext('2d');
    tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    // the vendored icon, twice: a dark under-stroke for contrast on any floor, then the light line (tinted per seat)
    const svg = (stroke, w) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon('crosshair', N).replace(/stroke="currentColor"/g, `stroke="${stroke}"`).replace(/stroke-width="[\d.]+"/, `stroke-width="${w}"`))}`;
    const draw = (src) => new Promise(res => { const im = new Image(); im.onload = () => { ctx.drawImage(im, 0, 0, N, N); res(); }; im.onerror = res; im.src = src; });
    draw(svg('rgba(10,12,16,0.85)', 3.6)).then(() => draw(svg('#ffffff', 1.7))).then(() => { tex.needsUpdate = true; app.gfx?.wake?.('target'); app.refresh?.(); });
    return tex;
  }
  const drawn = new Map(); // attacker id -> { ret, line, world }
  function clear(id) { const d = drawn.get(id); if (!d) return; d.world.scene.remove(d.ret); d.world.scene.remove(d.line); d.ret.material.dispose(); d.ret.geometry.dispose(); d.line.material.dispose(); d.line.geometry.dispose(); drawn.delete(id); }
  const footY = (ents, e) => baseUnder(ents, e.x, e.z, e.y || 0).y;
  const visible = (e, area) => !!e && app.canSeePawn?.(e, area) !== false;
  function frame() {
    const area = app.area(), w = area && app.worldOf?.(area); if (!w?.scene) return;
    const ents = E(), keep = new Set();
    for (const a of Object.values(ents)) {
      if (a.kind !== 'token' || !a.target) continue;
      const t = ents[a.target];
      if (t?.kind !== 'token' || !visible(a, area) || !visible(t, area)) continue;
      keep.add(a.id);
      let d = drawn.get(a.id);
      if (d && d.world !== w) { clear(a.id); d = null; }
      if (!d) {
        const ret = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texture(), transparent: true, opacity: RETICLE.opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, toneMapped: false }));
        ret.rotation.x = -Math.PI / 2; ret.renderOrder = 5; ret.userData.noCast = true; ret.userData.target = a.id;
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ transparent: true, opacity: RETICLE.line, depthWrite: false, toneMapped: false }));
        line.renderOrder = 5; line.userData.noCast = true;
        w.scene.add(ret); w.scene.add(line);
        d = { ret, line, world: w }; drawn.set(a.id, d);
      }
      const col = new THREE.Color(app.seatColor(a.owner) || app.myColor());
      if (!a.owner) col.set('#e5484d'); // (the GM's pawns: red)
      d.ret.material.color.copy(col); d.line.material.color.copy(col);
      const s = RETICLE.scale * 5 * Math.max(1, t.size || 1), ty = footY(ents, t) + RETICLE.lift, ay = footY(ents, a) + RETICLE.lift;
      d.ret.scale.set(s, s, 1); d.ret.position.set(t.x, ty, t.z);
      const p = d.line.geometry.attributes.position; p.setXYZ(0, a.x, ay + 0.25, a.z); p.setXYZ(1, t.x, ty + 0.25, t.z); p.needsUpdate = true; d.line.geometry.computeBoundingSphere();
      d.line.visible = !!(app.sel?.has(a.id) || app.sel?.has(t.id));
      d.t = t.id;
    }
    for (const id of [...drawn.keys()]) if (!keep.has(id)) clear(id);
  }
  app.on((what) => { if (what === 'frame' || what === 'change' || what === 'selection' || what === 'refresh') frame(); });
  // (tests) every target drawn here: who aims at whom, the reticle's place and size, whether the line shows
  app.targets = { info: () => [...drawn.entries()].map(([id, d]) => ({ attacker: id, target: d.t, at: [d.ret.position.x, d.ret.position.y, d.ret.position.z].map(v => Math.round(v * 100) / 100), size: Math.round(d.ret.scale.x * 100) / 100, line: d.line.visible, ready: !!png || (!!tex?.image && tex.version > 0), picture: png ? 'reticle' : 'crosshair' })) };
  return { name: 'target' };
}
