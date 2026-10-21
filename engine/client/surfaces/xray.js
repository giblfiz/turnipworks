// PAWN X-RAY (Harry 2026-10-06: "it's the 'oh fuck where did I leave that vampire' button among many things";
// docs/PAWNS.md, docs/UI.md "Pawn X-ray"). A GM-side toggle: every pawn in the area is drawn again as a glowing outline
// THROUGH walls, floors and roofs, on ALL levels (the cut does not hide it), players' pawns in one colour and every
// other pawn in another; pawns hidden from players included (it is the GM's view).
//
//   key X  ·  "pawn x-ray" in the command bar  ·  tw.xray() / tw.setXray(on)
//
// THIS SEAT'S VIEW ONLY. It is a switch in this browser, like the cut and the roofs: nothing is sent, nothing is stored
// in the campaign. Only a GM-side seat has the command and the key (a player's registry does not list it), and a
// player holds no data about hidden pawns or hidden levels to draw anyway.
//
// CHEAP, AND OUT OF THE RENDER LOOP'S WAY. Off (the usual state) it costs one test per frame. On, each pawn mesh is drawn
// once more with ONE small shader shared by all pawns of a colour: no depth test, no depth write, no lights, no
// shadows, no extra pass or render target; the geometry is the pawn's own (shared, not copied). The outline is the
// shader's doing: a surface seen edge-on is bright, one seen face-on is nearly clear, so a figure reads as its
// silhouette with a faint body. The copies live in the world's overlay layer (with pings and selection marks), are
// placed from the pawn's own data (so a level that has flown away above the cut still shows where its pawns stand),
// and are rebuilt only when a pawn's look changes (its figure arrives, its owner changes).
export const XRAY_KEY = 'X';
export const XRAY = { player: '#39d5ff', other: '#ffae2b', power: 2.6, min: 0.05, max: 1.0, baseMin: 0.14 }; // power: how thin the outline is; min: how much of the body shows inside it

export function xraySurface(R, app) {
  const THREE = app.THREE;
  let on = false;
  const mats = new Map(); // colour|base -> material
  const material = (color, base) => {
    const k = `${color}|${base}`;
    if (!mats.has(k)) mats.set(k, new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: XRAY.power }, uMin: { value: base ? XRAY.baseMin : XRAY.min }, uMax: { value: XRAY.max } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uPower; uniform float uMin; uniform float uMax; varying vec3 vN; varying vec3 vV; void main() { float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(uColor, uMin + (uMax - uMin) * pow(f, uPower)); }',
      transparent: true, depthTest: false, depthWrite: false, side: THREE.FrontSide, toneMapped: false, fog: false,
    }));
    return mats.get(k);
  };
  const items = new Map(); // `${area}|${id}` -> { g, layer, stamp, meshes, tris, color }
  const _inv = new THREE.Matrix4();
  const stampOf = (rec) => { const U = rec.visual?.userData || {}; return `${rec.visual?.uuid}|${U.loaded}|${U.detail}|${rec.entity.owner ? 1 : 0}|${(rec.footDrop || 0).toFixed(1)}`; }; // (footDrop: a raised pawn's base is that far under its figure; the copy is rebuilt when it steps)
  function build(w, rec) {
    const vis = rec.visual, color = rec.entity.owner ? XRAY.player : XRAY.other, g = new THREE.Group();
    g.userData.halo = true; g.userData.xray = true; g.renderOrder = 60;
    let meshes = 0, tris = 0;
    if (vis) {
      vis.updateWorldMatrix(true, true); _inv.copy(vis.matrixWorld).invert();
      const skip = vis.userData.nameG || null; // the lettering round the base is a picture of text, not a shape
      vis.traverse(o => {
        if (!o.isMesh || !o.geometry?.attributes?.normal) return;
        for (let p = o; p && p !== vis; p = p.parent) if (p === skip) return;
        const m = new THREE.Mesh(o.geometry, material(color, !!o.userData.pawnBase)); // the pawn's own geometry, shared
        m.matrixAutoUpdate = false; m.matrix.multiplyMatrices(_inv, o.matrixWorld).premultiply(vis.matrix); // where it sits in the pawn, whatever the pawn is in now
        m.renderOrder = 60; m.frustumCulled = o.frustumCulled; m.raycast = () => {}; m.castShadow = false; m.receiveShadow = false; m.userData.halo = true;
        g.add(m); meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      });
    }
    w.layers.deco.add(g);
    return { g, layer: w.layers.deco, stamp: stampOf(rec), meshes, tris: Math.round(tris), color };
  }
  function drop(k) { const it = items.get(k); if (!it) return; it.layer.remove(it.g); items.delete(k); } // (geometry and materials are shared: nothing to dispose)
  function clear() { for (const k of [...items.keys()]) drop(k); }
  let ms = 0, frames = 0;
  app.on((what) => {
    if (what !== 'frame') return;
    if (!on) { if (items.size) clear(); return; }
    if (!app.gm()) { on = false; clear(); return; } // no longer on the GM side: it goes
    const t0 = performance.now(), want = new Set();
    for (const [area, w] of app.worlds) {
      if (area !== app.area() && area !== app.pip?.area) continue;
      for (const rec of w.recs.values()) {
        if (rec.entity.kind !== 'token') continue;
        const k = `${area}|${rec.entity.id}`; want.add(k);
        let it = items.get(k);
        if (it && it.stamp !== stampOf(rec)) { drop(k); it = null; }
        if (!it) { it = build(w, rec); items.set(k, it); }
        const G = rec.group;
        it.g.position.copy(G.position); it.g.rotation.copy(G.rotation); it.g.scale.copy(G.scale); // from the pawn's own data: drawn whether or not its level is
      }
    }
    for (const k of [...items.keys()]) if (!want.has(k)) drop(k);
    ms += performance.now() - t0; frames++;
  });
  app.xray = () => on;
  app.setXray = (v, { quiet = false } = {}) => {
    v = !!v && app.gm();
    if (v === on) return on;
    on = v; ms = 0; frames = 0; if (!on) clear();
    if (!quiet) app.toast(on ? `Pawn X-ray on: players' pawns blue, the rest amber, through every wall and floor (${XRAY_KEY})` : 'Pawn X-ray off');
    app.refresh();
    return on;
  };
  // (tests, and the cost) what is drawn, and the time this surface itself takes per frame
  app.xrayInfo = () => ({ on, pawns: [...items].filter(([k]) => k.startsWith(app.area() + '|')).map(([k, it]) => ({ id: k.split('|')[1], color: it.color, meshes: it.meshes, tris: it.tris, at: [+it.g.position.x.toFixed(2), +it.g.position.y.toFixed(2), +it.g.position.z.toFixed(2)] })), tris: [...items.values()].reduce((n, it) => n + it.tris, 0), draws: [...items.values()].reduce((n, it) => n + it.meshes, 0), materials: mats.size, cpuMs: frames ? +(ms / frames).toFixed(4) : 0 });
  R.add({ id: 'view.xray', toggle: { of: () => [1], is: () => on, on: ['Pawn X-ray off', 'eye-off'], off: ['Pawn X-ray: every pawn through walls and floors', 'eye'] }, short: 'Pawn X-ray', synonyms: ['x-ray', 'xray', 'pawn x-ray', 'find pawns', 'where is', 'see through walls', 'show all pawns', 'outline pawns', 'lost pawn'], keys: [XRAY_KEY], group: 'View', cls: (ctx) => ctx.gm ? true : null, run: () => app.setXray(!on) });
  return { name: 'xray' };
}
