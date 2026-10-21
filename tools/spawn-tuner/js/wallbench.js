// THE WALL FIT BENCH (2026-10-13, wallbench.html). Harry: "a wall approval tool ... a two-story version of the wall tiles so that
// I can adjust size, mark ones that don't fit together nicely ... the occasional janky wall is still out there (that look great
// in isolation, just has scale issues!)". One wall family at a time, built by the game's own code (the engine's loader, the
// tuner's look.js edgeSpecs / cornerSpec / floorSpecs, the engine's roofs.js): a two-storey L-shaped run with every piece kind
// of the family in it. The smart layer measures every joint in inches and flags what is out; Harry's per-piece scale / offset /
// yaw corrections apply live to every instance, are saved as `wallfit` records, and "Use in game" ships them (the house look
// `wallfit`, read by js/look.js on the next load). The pure part (tolerances, seam and opening maths, snap, records) is js/wallfit.js.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { houseLink } from './fx/houselink.js';
import * as W from './wallfit.js';

const RUN = 16, DEPTH = 2, LEG = 4;            // the long run is 16 squares (80 ft) and 2 deep; the leg is 4 squares
const SEQ = ['S', 'S', 'S', 'S', 'W', 'W', 'S', 'D', 'S', 'Do', 'S', 'DD', 'DD2', 'S', 'S', 'S']; // the north run, square by square
const SLAB_COLOR = '#5d4630', SLAB_STONE = '#77736b';
const sevCol = { bad: '#ff4d3d', warn: '#f0b429', ok: '#7fbf6a' };

export async function start({ v = null } = {}) {
  const qs = new URLSearchParams(location.search), api = qs.get('api') ?? '/api/tw-ratings', q = v ? `?v=${v}` : `?t=${Date.now()}`;
  const $ = (s) => document.querySelector(s), stage = $('#wbStage');
  const toastEl = $('#wbToast'); let toastT = 0;
  const toast = (t, bad) => { toastEl.textContent = t; toastEl.style.display = 'block'; toastEl.style.color = bad ? '#e0b04a' : ''; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.style.display = 'none'; }, 6000); };
  const mod = (p) => import(new URL(`${p}${q}`, import.meta.url).href);
  const [TN, CORE, RF, HT, FIG] = await Promise.all([mod('../../engine/client/tuner.js'), mod('../../engine/core/roomgen.js'), mod('../../engine/client/roofs.js'), mod('../../engine/core/height.js'), mod('../../engine/client/figures.js')]);
  const base = new URL('./', import.meta.url).href.replace(/js\/$/, '');
  const T = await TN.loadTuner(base, api);   // the game's own loader: lib, orient (with Harry's fixes), ratings filter, hinges, house look
  const lib = T.lib, types = T.types, orient = T.orient;
  const figList = await fetch(`data/figures.json${q}`).then(r => r.json()).then(j => j.figures || []).catch(() => []);

  // ---------------------------------------------------------------- the corrections table (live: look.js reads it)
  const wallfit = {};                                   // sku -> { s, o, yaw }, what is applied right now
  const gameFit = { ...(T.house.wallfit || {}) };       // what the game uses now
  Object.assign(wallfit, JSON.parse(JSON.stringify(gameFit)));
  const getRecs = () => fetch(`${api}/tuner/wallfits`, { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
  let ST = W.stateFromRecords(api ? await getRecs() : {});
  for (const [sku, p] of Object.entries(ST.pieces)) wallfit[sku] = p.fit;     // Harry's working drafts win over what the game has
  const look = T.look.createLook({ lib, types, orient, wallfit, base, dials: () => T.look.LOOK_DIALS, solverOpts: () => CORE.SOLVER_OPTS });
  const applyFit = T.look.applyFit;
  const skuRec = look.skuRec;

  // ---------------------------------------------------------------- scene
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#23241f');
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 900), ctl = new OrbitControls(camera, renderer.domElement);
  scene.add(new THREE.HemisphereLight('#fff4dc', '#3a3428', 1.6));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.4); sun.position.set(30, 60, -40); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 40, bottom: -40, near: 1, far: 200 }); sun.target.position.set(40, 0, 6); scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 120), new THREE.MeshStandardMaterial({ color: '#3a4a2c', roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.set(40, -0.02, 6); ground.receiveShadow = true; scene.add(ground);
  const grid = new THREE.GridHelper(200, 40, '#c9c18c', '#6b6a4e'); grid.position.set(40, 0.012, 6); scene.add(grid);   // the 5-ft grid
  let dirty = true; const redraw = () => { dirty = true; };
  ctl.addEventListener('change', redraw);

  // ---------------------------------------------------------------- the queue
  const usable = (s) => T.solver.skuUsable(s, CORE.SOLVER_OPTS);   // the game's ratings filter: a piece Harry rated out is not drawn, so it is not judged
  const FAMS = W.families(lib, usable);
  const pieceSkusOf = (f) => W.piecesOfFamily(lib, orient, f, usable).map(p => p.sku);
  const staticOf = Object.fromEntries(FAMS.map(f => { const fl = W.stretchFlags(W.piecesOfFamily(lib, orient, f, usable)).flatMap(x => x.flags); return [f, fl]; }));
  const scan = {};                                   // family -> { flags, score } once built and measured
  const scoreOf = (f) => scan[f] ? scan[f].score : W.score(staticOf[f]);
  let order = [...FAMS].sort((a, b) => scoreOf(b) - scoreOf(a) || a.localeCompare(b));
  let cur = null;                                    // the current specimen
  let fam = qs.get('family') && FAMS.includes(qs.get('family')) ? qs.get('family') : order[0];

  // ---------------------------------------------------------------- the specimen
  const lineOf = (e) => e.dir === 'h' ? e.gz * 5 : e.gx * 5, startOf = (e) => e.dir === 'h' ? e.gx * 5 : e.gz * 5;
  function planFor(family) {
    const cells = []; for (let j = 0; j < DEPTH; j++) for (let i = 0; i < RUN; i++) cells.push([i, j]); for (let i = 0; i < LEG; i++) cells.push([i, DEPTH]);
    const room = { id: 'A', type: 'common', x: 0, z: 0, w: RUN, d: DEPTH + 1, cells, family, created: 1, seed: 7, wallSeed: 7, floor: 'auto', extDoor: null };
    const { edges, corners } = T.walls.computeEdges([room]);
    for (const e of edges.values()) { e.kind = 'wall'; delete e.span; delete e.spanKeys; delete e.doorType; e.family = family; }
    const E = (k) => edges.get(k);
    // the north run: every kind of opening, square by square
    SEQ.forEach((c, i) => {
      const e = E(`h:${i}:0`); if (!e) return;
      if (c === 'W') e.kind = 'window';
      else if (c === 'D') { e.kind = 'door'; e.span = 1; e.doorType = 'door-plank'; e.showOpen = false; }
      else if (c === 'Do') { e.kind = 'door'; e.span = 1; e.doorType = 'door-reinforced'; e.showOpen = true; }
      else if (c === 'DD') { e.kind = 'door'; e.span = 2; e.doorType = 'door-double-grand'; e.spanKeys = [`h:${i}:0`, `h:${i + 1}:0`]; }
      else if (c === 'DD2') { e.kind = 'door-span'; e.spanOf = `h:${i - 1}:0`; }
    });
    // the south run (the inside of the L's long arm): the family's special panels, one version of each
    const panels = []; for (const id of W.PANEL_IDS) for (const s of lib.objects[id]?.skus || []) if (s.family === family && s.kind === 'mesh' && s.bounds) panels.push({ panel: id, shape: s.shape || '' });
    panels.forEach((p, k) => { const e = E(`h:${5 + 2 * k}:${DEPTH}`); if (e && 5 + 2 * k < RUN) { e.panel = p.panel; e.panelShape = p.shape; } });
    // windows on the south run too (a second look at each window version, from the other side)
    for (const i of [13, 14]) { const e = E(`h:${i}:${DEPTH}`); if (e && !e.panel && i > 5 + 2 * panels.length) e.kind = 'window'; }
    // jamb posts frame every door (walls.js computeEdges does the same)
    const have = new Set(corners.map(c => `${c.gx}:${c.gz}`));
    for (const e of edges.values()) {
      if (e.kind !== 'door') continue;
      const last = edges.get((e.spanKeys || [e.key]).at(-1));
      const ends = e.dir === 'h' ? [[e.gx, e.gz], [last.gx + 1, last.gz]] : [[e.gx, e.gz], [last.gx, last.gz + 1]];
      for (const [vx, vz] of ends) if (!have.has(`${vx}:${vz}`)) { corners.push({ gx: vx, gz: vz, h: 1, v: 1, family: e.family, jamb: true, slim: (e.span || 1) === 1 }); have.add(`${vx}:${vz}`); }
    }
    return { room, edges, corners, panels, cells };
  }
  const HOLE = [1, DEPTH];                         // the stair's hole in the upper floor: the leg's second square
  async function buildSpecimen(family, opts = {}) {
    const t0 = performance.now(), light = !!opts.light;
    const P = planFor(family), group = new THREE.Group(), items = [], pending = [];
    scene.add(group);
    const addItem = (it) => {
      const g = new THREE.Group(); g.rotation.order = 'YXZ'; g.position.set(it.spec.x, it.spec.y || 0, it.spec.z); g.rotation.y = it.spec.rot || 0; group.add(g);
      it.group = g; items.push(it);
      pending.push(look.makeVisual(it.spec, false).then(vis => { if (vis) { g.add(vis); it.visual = vis; } }).catch(err => { it.err = String(err); }));
    };
    for (let k = 0; k < 2; k++) {
      const y = k * 10;
      for (const e of P.edges.values()) {
        for (const sp of look.edgeSpecs(e)) {
          sp.y = (sp.y || 0) + y;
          const leaf = /:door$/.test(sp.uid);
          if (leaf && (e.showOpen || false)) { const lr = skuRec.get(sp.sku), hr = T.hinges?.[lr?.mesh]; if (hr?.mode === 'hinge') { sp.hinge = hr; sp.open = true; } else sp.noOpen = true; }
          const role = leaf ? 'leaf' : sp.id === 'wall-straight' ? 'straight' : sp.id === 'wall-doorway' ? 'doorway' : sp.id === 'wall-window-small' ? 'window' : 'panel';
          addItem({ spec: sp, e, storey: k, role, sku: sp.sku, level: y });
        }
      }
      for (const v of P.corners) { const sp = look.cornerSpec(v); sp.y = (sp.y || 0) + y; addItem({ spec: sp, e: v, v, storey: k, role: 'post', sku: sp.sku, level: y }); }
      if (!light) {
        // the floor: the game's own tiles, minus the stair's hole; and above the ground, the 1-ft slab it stands on
        const fl = look.floorSpecs(P.room);
        for (const sp of fl.specs) { if (k && Math.floor(sp.x / 5) === HOLE[0] && Math.floor(sp.z / 5) === HOLE[1]) continue; sp.y = (sp.y || 0) + y; addItem({ spec: sp, e: null, storey: k, role: 'floor', sku: sp.sku, level: y }); }
      }
      if (k) {
        const mat = new THREE.MeshStandardMaterial({ color: HT.isStoneFamily(family) ? SLAB_STONE : SLAB_COLOR, roughness: 0.92 });
        const slab = new THREE.Group(); slab.position.set(0, y - 1, 0);
        for (const [x0, z0, x1, z1] of HT.slabRects(RUN, DEPTH + 1, P.cells, (i, j) => i === HOLE[0] && j === HOLE[1], 5)) { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.98, z1 - z0), mat); m.position.set((x0 + x1) / 2, 0.49, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; slab.add(m); } // (the game's own plan: height.js slabRects)
        group.add(slab); items.push({ role: 'slab', storey: k, group: slab, visual: slab, level: y - 1 });
      }
    }
    await Promise.all(pending);
    const S = { family, group, items, plan: P, light, built: performance.now() - t0, figures: [], roof: null };
    // the roof edge of the family's roof style, on the upper storey (the game's own planner and builder)
    if (!light) {
      try {
        const style = HT.ROOF_BY_FAMILY[family] || HT.ROOF_DEFAULT, cellsAbs = P.cells.map(([i, j]) => [i, j]);
        const plan = RF.planRoofs([{ id: 'A', building: 'A', x: 0, z: 0, w: RUN, d: DEPTH + 1, cells: cellsAbs, top: 19, y: 10, style, seed: 3 }], { fires: [], has: () => false, dormers: false, finials: false });
        const tex = RF.loadRoofTextures(THREE, (cat) => { const k = lib.objects[cat]?.skus.find(x => x.kind === 'flat' && x.url); return k ? `${base}${T.look.deliver?.(k.url) ?? k.url}` : null; }, redraw, T.look.loadTexture || null);
        const roof = plan.roofs[0]; if (roof) { const rg = RF.buildRoof(roof, { THREE, textures: tex, sections: null, wallColor: '#b9ad98' }); rg.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); group.add(rg); S.roof = rg; S.roofStyle = style; }
      } catch (err) { S.roofErr = String(err); }
    }
    group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.updateMatrixWorld(true);
    return S;
  }
  function dispose(S) { if (!S) return; scene.remove(S.group); }

  // ---------------------------------------------------------------- measuring (inches)
  const worldBox = (obj) => new THREE.Box3().setFromObject(obj, true);
  function trisOf(visual, e, level) { // the visual's triangles in the wall frame: [along, up] inches from the segment's start and the storey's floor
    const out = [], P = new THREE.Vector3(), start = startOf(e);
    visual.updateWorldMatrix(true, true);
    visual.traverse(m => {
      if (!m.isMesh || !m.geometry?.attributes?.position) return;
      const pos = m.geometry.attributes.position, ix = m.geometry.index, n = ix ? ix.count : pos.count, a = (i) => { P.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m.matrixWorld); return [W.inch((e.dir === 'h' ? P.x : P.z) - start), W.inch(P.y - level)]; };
      for (let i = 0; i < n; i += 3) { const A = a(ix ? ix.getX(i) : i), B = a(ix ? ix.getX(i + 1) : i + 1), C = a(ix ? ix.getX(i + 2) : i + 2); out.push(...A, ...B, ...C); }
    });
    return out;
  }
  function measure(S) {
    const F = [], add = (f) => { if (f.kind === 'structure') f.sev = 'warn'; F.push(f); return f; };
    const wallish = S.items.filter(i => i.visual && i.e && i.role !== 'floor' && i.role !== 'post' && i.role !== 'leaf');
    const posts = S.items.filter(i => i.visual && i.role === 'post'), leaves = S.items.filter(i => i.visual && i.role === 'leaf');
    for (const it of S.items) if (it.visual && it.role !== 'slab') it.world = worldBox(it.visual);
    const fr = (it, ref = it.e) => W.wallFrame(W.box(it.world), ref.dir, ref.owner.side, lineOf(ref), 0, it.level);
    const nOf = (it) => it.e.kind === 'door' ? (it.e.span || 1) : 1;
    const posAt = (it, a, off = 0) => { const e = it.e, w = it.world, c = (w.min.y + w.max.y) / 2 + off; return e.dir === 'h' ? new THREE.Vector3(a / 12, c, (w.min.z + w.max.z) / 2) : new THREE.Vector3((w.min.x + w.max.x) / 2, c, a / 12); };
    const tag = (it) => `L${it.storey + 1}`;
    const famStraights = wallish.filter(i => i.role === 'straight').map(i => fr(i));
    const thickRef = W.median(famStraights.map(f => f.c1 - f.c0)) || 12, hRef = 108;
    S.pieceData = {};
    for (const it of wallish) {
      const f = fr(it), e = it.e, n = nOf(it), a0 = W.inch(startOf(e)), L = W.lenOf(f), D = (lib.objects[it.spec.id]?.size[1] ?? 12), pd = (S.pieceData[it.sku] ||= { n: 0 });
      it.frame = f; pd.n++;
      const rec = [['along length', L - n * 60, 'seam', 'long', 'short'], ['height', (f.y1 - f.y0) - hRef, 'height', 'tall', 'short'], ['base', f.y0, 'seam', 'floats up', 'sunk'], ['room face', f.c1 - 6, 'step', 'proud (room side)', 'sunk (room side)']];
      for (const [nm, val, tk, up, dn] of rec) { const sev = W.judge(val, W.TOL[tk]); if (sev !== 'ok') add({ kind: 'piece', sev, sku: it.sku, tag: tag(it), pos: posAt(it, a0 + n * 30), value: val, text: `${tag(it)} ${it.sku}: ${nm} ${val > 0 ? up : dn} by ${Math.abs(val).toFixed(1)} in` }); }
      const thickWant = it.role === 'panel' ? D : thickRef, tv = (f.c1 - f.c0) - thickWant, ts = W.judge(tv, W.TOL.thick); if (ts !== 'ok') add({ kind: 'piece', sev: ts, sku: it.sku, tag: tag(it), pos: posAt(it, a0 + n * 30), value: tv, text: `${tag(it)} ${it.sku}: ${tv > 0 ? 'thicker' : 'thinner'} than ${it.role === 'panel' ? 'its catalog' : 'the family\'s walls'} by ${Math.abs(tv).toFixed(1)} in` });
      const skr = skuRec.get(it.sku); if (skr && skr.family !== S.family) add({ kind: 'borrowed', sev: 'warn', sku: it.sku, tag: tag(it), pos: posAt(it, a0 + n * 30), value: 0, text: `${tag(it)} ${it.sku}: the family has no ${it.spec.id}; it borrows ${skr.family || 'any'}'s` });
    }
    // horizontal joints and corner closure, per wall line and storey
    const vkey = (gx, gz, k) => `${gx}:${gz}:${k}`, postAt = new Map(posts.map(p => [vkey(p.v.gx, p.v.gz, p.storey), p]));
    const lines = new Map(); for (const it of wallish) { const k = `${it.e.dir}:${lineOf(it.e)}:${it.storey}`; (lines.get(k) || lines.set(k, []).get(k)).push(it); }
    for (const arr of lines.values()) {
      arr.sort((a, b) => startOf(a.e) - startOf(b.e));
      for (let i = 0; i < arr.length; i++) {
        const A = arr[i], eA = A.e, nA = nOf(A), vx = eA.dir === 'h' ? [eA.gx + nA, eA.gz] : [eA.gx, eA.gz + nA];
        const post = postAt.get(vkey(vx[0], vx[1], A.storey)), B = arr[i + 1], contiguous = B && startOf(B.e) === startOf(eA) + nA * 5;
        const whereV = posAt(A, W.inch(startOf(eA)) + nA * 60);
        if (post) { const r = W.seamPost(A.frame, fr(post, eA), 'a1'); for (const [nm, val] of [['stops short of the post', r.hole], ['pokes through the post', r.poke]]) { const sev = W.judge(Math.max(0, val), W.TOL.seam); if (sev !== 'ok') add({ kind: 'seam', sev, sku: A.sku, tag: tag(A), pos: whereV, value: val, text: `${tag(A)} ${A.sku} ${nm} by ${val.toFixed(1)} in` }); } }
        else if (contiguous) { const r = W.seamH(A.frame, B.frame); const chk = [['gap', r.gap, 'seam'], ['room-face step', r.stepIn, 'step'], ['outer-face step', r.stepOut, 'step'], ['top step', r.top, 'height']].filter(c => !(c[0] === 'outer-face step' && (A.role === 'panel' || B.role === 'panel'))); // (a panel is thicker than the wall by design: its room face is flush, the extra depth goes outward)
          for (const [nm, val, tk] of chk) { const sev = W.judge(val, W.TOL[tk]); if (sev !== 'ok') add({ kind: 'seam', sev, sku: A.sku, sku2: B.sku, tag: tag(A), pos: whereV, value: val, text: `${tag(A)} ${A.sku} | ${B.sku}: ${nm} ${val > 0 ? '+' : ''}${val.toFixed(1)} in${nm === 'gap' ? (val > 0 ? ' (gap)' : ' (overlap)') : ''}` }); } }
        // a post that starts the line
        if (i === 0) { const sv = eA.dir === 'h' ? [eA.gx, eA.gz] : [eA.gx, eA.gz], p0 = postAt.get(vkey(sv[0], sv[1], A.storey)); if (p0) { const r = W.seamPost(A.frame, fr(p0, eA), 'a0'); for (const [nm, val] of [['starts short of the post', r.hole], ['pokes out through the post', r.poke]]) { const sev = W.judge(Math.max(0, val), W.TOL.seam); if (sev !== 'ok') add({ kind: 'seam', sev, sku: A.sku, tag: tag(A), pos: posAt(A, W.inch(startOf(eA))), value: val, text: `${tag(A)} ${A.sku} ${nm} by ${val.toFixed(1)} in` }); } } }
      }
    }
    // posts against the walls they stand in: the top
    for (const p of posts) {
      const w = W.box(p.world), top = W.inch(w.y1 - p.level), base = W.inch(w.y0 - p.level);
      const dv = top - 108, sev = dv > 0 ? W.judge(dv, W.TOL.proud) : W.judge(dv, W.TOL.seam);
      if (sev !== 'ok') add({ kind: 'piece', sev, sku: p.sku, tag: tag(p), pos: new THREE.Vector3((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2), value: dv, text: `${tag(p)} post ${p.sku} at (${p.v.gx},${p.v.gz}) ${dv > 0 ? 'stands' : 'stops'} ${Math.abs(dv).toFixed(1)} in ${dv > 0 ? 'above' : 'short of'} the wall top` });
      if (Math.abs(base) > W.TOL.seam) add({ kind: 'piece', sev: W.judge(base, W.TOL.seam), sku: p.sku, tag: tag(p), pos: new THREE.Vector3((w.x0 + w.x1) / 2, w.y0, (w.z0 + w.z1) / 2), value: base, text: `${tag(p)} post ${p.sku}: base ${base > 0 ? 'floats' : 'sunk'} ${Math.abs(base).toFixed(1)} in` });
    }
    // doors: the leaf against the opening it hangs in
    S.doors = [];
    for (const lf of leaves) {
      const e = lf.e, fL = fr(lf), wide = (e.span || 1) > 1, n = nOf(lf), a0 = W.inch(startOf(e));
      // the game hangs every door between two jamb posts, up to the wall head (look.js edgeSpecs: no doorway piece is drawn)
      let op = null;
      const pl = postAt.get(vkey(e.gx, e.gz, lf.storey)), pr = postAt.get(vkey(e.dir === 'h' ? e.gx + n : e.gx, e.dir === 'h' ? e.gz : e.gz + n, lf.storey));
      if (pl && pr) op = { x0: W.wallFrame(W.box(pl.world), e.dir, e.owner.side, lineOf(e), 0, lf.level).a1, x1: W.wallFrame(W.box(pr.world), e.dir, e.owner.side, lineOf(e), 0, lf.level).a0, top: 108, frameC: null };
      const dr = { storey: lf.storey, sku: lf.sku, wide, leaf: { w: W.lenOf(fL), h: fL.y1 - fL.y0, a0: fL.a0, a1: fL.a1, y0: fL.y0, y1: fL.y1 }, open: op ? { w: op.x1 - op.x0, h: op.top, a0: op.x0, a1: op.x1 } : null, open_: !!e.showOpen && !lf.spec.noOpen };
      S.doors.push(dr); lf.door = dr; lf.opening = op;
      if (!op) { add({ kind: 'door', sev: 'warn', sku: lf.sku, tag: tag(lf), pos: posAt(lf, a0 + n * 30), value: 0, text: `${tag(lf)} ${lf.sku}: no clear opening found in its doorway piece to check the leaf against` }); continue; }
      if (e.showOpen && lf.spec.hinge) continue; // (an open leaf stands across the opening: only the closed one is measured against it)
      const chk = [['left clearance', fL.a0 - op.x0], ['right clearance', op.x1 - fL.a1], ['head clearance', op.top - fL.y1], ['floor clearance', fL.y0]];
      for (const [nm, val] of chk) { const sev = W.judge(val, W.TOL.clear, 2); if (sev !== 'ok') add({ kind: nm === 'head clearance' ? 'structure' : 'door', sev, sku: lf.sku, tag: tag(lf), pos: posAt(lf, a0 + n * 30), value: val, text: `${tag(lf)} leaf ${lf.sku} between its jamb posts: ${nm} ${val.toFixed(1)} in${val < 0 ? ' (leaf overlaps the frame)' : ' (open gap)'}` }); }
    }
    // windows: the clear opening of each version (sill, head, width) and whether the versions agree
    S.windows = [];
    for (const it of wallish.filter(i => i.role === 'window' && i.storey === 0)) {
      const e = it.e, g = W.rasterize(trisOf(it.visual, e, it.level), 60, 108), o = W.windowOpening(g, 60, 108);
      S.windows.push({ sku: it.sku, open: o }); it.window = o;
    }
    const wins = S.windows.filter(w => w.open);
    if (wins.length > 1) { const s0 = Math.min(...wins.map(w => w.open.y0)), s1 = Math.max(...wins.map(w => w.open.y0)); if (W.judge(s1 - s0, 6) !== 'ok') add({ kind: 'window', sev: W.judge(s1 - s0, 6), sku: wins[0].sku, tag: 'L1', pos: null, value: s1 - s0, text: `window versions differ in sill height by ${(s1 - s0).toFixed(1)} in (${wins.map(w => `${w.open.y0}`).join(' / ')} in)` }); }
    // storeys: wall top to the slab under the next floor, and the slab top to the wall above
    const slabs = S.items.filter(i => i.role === 'slab'); S.vertical = [];
    if (slabs.length) {
      const sb = worldBox(slabs[0].group), sY0 = W.inch(sb.min.y), sY1 = W.inch(sb.max.y);
      const lowers = wallish.filter(i => i.storey === 0), uppers = new Map(wallish.filter(i => i.storey === 1).map(i => [i.spec.uid, i]));
      for (const A of lowers) { const B = [...uppers.values()].find(u => u.e.key === A.e.key && u.sku === A.sku); if (!B) continue; const r = W.seamV(W.inch(A.world.max.y), sY0, sY1, W.inch(B.world.min.y)); S.vertical.push({ sku: A.sku, ...r });
        for (const [nm, val] of [['wall top to the slab', r.toSlab], ['the slab top to the wall above', r.fromSlab]]) { const sev = W.judge(val, W.TOL.seam); if (sev !== 'ok') add({ kind: 'storey', sev, sku: A.sku, tag: 'L1|L2', pos: new THREE.Vector3(...[(A.world.min.x + A.world.max.x) / 2, 9.5, (A.world.min.z + A.world.max.z) / 2]), value: val, text: `storey seam ${A.sku}: ${nm} ${val > 0 ? '+' : ''}${val.toFixed(1)} in` }); } }
    }
    // the slab edge against the wall's outer face (the same in every family; the game's slab plan, so not a piece to correct): + = the wall overhangs
    { const n0 = wallish.find(i => i.e.key === 'h:2:0' && i.storey === 1); if (n0 && n0.frame && slabs.length) { const sb0 = worldBox(slabs[0].group), over = W.inch(sb0.min.z) - n0.frame.c0; S.slabOver = over; if (Math.abs(over) > W.TOL.seam) add({ kind: 'structure', sev: 'warn', sku: null, tag: 'L2', pos: new THREE.Vector3(10, 9.5, 0), value: over, text: `structure (every family): the 1-ft slab ends ${over.toFixed(1)} in ${over > 0 ? 'inside' : 'outside'} the wall's outer face, so the wall above ${over > 0 ? 'overhangs it' : 'is set back from it'}` }); } }
    for (const f of staticOf[S.family] || []) add({ ...f, tag: 'data', pos: null });
    for (const f of F) f.key = `${f.kind}|${f.sev}|${f.sku}|${f.sku2 || ''}|${f.text.replace(/^L\d(\|L\d)? /, '').replace(/ at \(\d+,\d+\)/, '').replace(/[+-]?\d+\.\d in/g, m => m)}`;
    S.findings = F;
    const uniq = new Map(F.filter(f => f.kind !== 'structure').map(f => [f.key, f])); S.unique = [...uniq.values()];
    S.score = W.score(S.unique);
    return F;
  }

  // ---------------------------------------------------------------- the piece list and the controls
  const ROLE_ORDER = ['straight', 'window', 'doorway', 'leaf', 'panel', 'post'];
  function pieceList(S) {
    const m = new Map();
    for (const it of S.items) { if (!it.sku || !it.visual || it.role === 'floor') continue; if (!m.has(it.sku)) m.set(it.sku, { sku: it.sku, role: it.role, items: [] }); m.get(it.sku).items.push(it); }
    return [...m.values()].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.sku.localeCompare(b.sku));
  }
  let pieces = [], sel = 0, axes = 'xyz', pendingSnap = null, undo = [];
  const fitOf = (sku) => wallfit[sku] ? W.cleanFit(wallfit[sku]) : W.cleanFit(null);
  const stOf = (sku) => ST.pieces[sku] || { fit: fitOf(sku), mark: null, approved: false };
  const post = (body) => fetch(`${api}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json().catch(() => ({})); });
  async function saveThe(sku) { // one wallfit record: the working state of one piece (append-only; the newest wins)
    const st = ST.pieces[sku] ||= { fit: fitOf(sku), mark: null, approved: false };
    st.fit = fitOf(sku);
    if (!api) return;
    try { await post({ kind: 'wallfit', name: sku, note: st.mark?.note || '', data: { sku, family: skuRec.get(sku)?.family || fam, ...W.cleanFit(st.fit), mark: st.mark || null, approved: !!st.approved } }); } catch (e) { toast(`could not save ${sku}: ${e.message}`, true); }
    link?.changed();
  }
  let saveT = 0; const saveSoon = (sku) => { clearTimeout(saveT); saveT = setTimeout(() => saveThe(sku), 700); };
  function setFit(sku, f, { record = true } = {}) {
    if (record) undo.push({ sku, before: JSON.parse(JSON.stringify({ fit: fitOf(sku), mark: stOf(sku).mark, approved: stOf(sku).approved })) });
    if (undo.length > 200) undo.shift();
    wallfit[sku] = W.cleanFit(f);
    const p = pieces.find(x => x.sku === sku);
    for (const it of p?.items || []) { const m = it.visual?.userData?.fitBase ? it.visual : findRoot(it.visual); if (m?.userData?.fitBase) applyFit(m, m.userData.fitBase, wallfit[sku]); }
    cur?.group.updateMatrixWorld(true); remeasure(); redraw(); drawPanel();
  }
  const findRoot = (v) => { let r = null; v?.traverse?.(o => { if (!r && o.userData?.fitBase) r = o; }); return r; };
  let mT = 0; const remeasure = () => { clearTimeout(mT); mT = setTimeout(() => { if (!cur) return; measure(cur); drawFindings(); drawMarkers(); drawPanel(); queueDraw(); redraw(); }, 60); };

  // ---------------------------------------------------------------- the snap guess (AI guess, Harry confirms)
  function proposeSnap(p) {
    const cur0 = fitOf(p.sku), inv = new THREE.Matrix4(), parts = [];
    const have = { x: [], y: [], z: [] }, want = { x: [], y: [], z: [] };
    const props = [];
    for (const it of p.items) {
      if (!it.world || !it.e) continue;
      it.group.updateMatrixWorld(true); inv.copy(it.group.matrixWorld).invert();
      const hb = it.world.clone().applyMatrix4(inv);
      const e = it.e; let wb = null, axs = 'xyz';
      if (it.role === 'post') { wb = it.world.clone(); wb.min.y = it.level; wb.max.y = it.level + 9; axs = 'y'; }
      else if (it.role === 'leaf') {
        if (!it.opening) continue; const o = it.opening, dir = e.dir, st = startOf(e) * 12;
        const aLo = (st + o.x0 + 0.5) / 12, aHi = (st + o.x1 - 0.5) / 12; wb = it.world.clone();
        if (dir === 'h') { wb.min.x = aLo; wb.max.x = aHi; } else { wb.min.z = aLo; wb.max.z = aHi; }
        wb.min.y = it.level; wb.max.y = it.level + Math.max(0, (o.top - 0.5)) / 12; axs = 'xy';
      } else {
        const n = it.e.kind === 'door' ? (it.e.span || 1) : 1, D = (lib.objects[it.spec.id]?.size[1] ?? 12) / 12, line = lineOf(e), s = (e.owner.side === 'N' || e.owner.side === 'W') ? 1 : -1, a0 = startOf(e);
        const c0 = 0.5 - D, c1 = 0.5, cLo = s > 0 ? line + c0 : line - c1, cHi = s > 0 ? line + c1 : line - c0;
        wb = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
        if (e.dir === 'h') { wb.min.set(a0, it.level, cLo); wb.max.set(a0 + n * 5, it.level + 9, cHi); } else { wb.min.set(cLo, it.level, a0); wb.max.set(cHi, it.level + 9, a0 + n * 5); }
      }
      const wl = wb.clone().applyMatrix4(inv);
      props.push({ have: hb, want: wl, axs });
    }
    if (!props.length) return null;
    const mid = (k, f) => W.median(props.map(x => f(x))), axs = props[0].axs;
    const haveI = { x: [mid('x', x => W.inch(x.have.min.x)), mid('x', x => W.inch(x.have.max.x))], y: [mid('y', x => W.inch(x.have.min.y)), mid('y', x => W.inch(x.have.max.y))], z: [mid('z', x => W.inch(x.have.min.z)), mid('z', x => W.inch(x.have.max.z))] };
    const wantI = { x: [mid('x', x => W.inch(x.want.min.x)), mid('x', x => W.inch(x.want.max.x))], y: [mid('y', x => W.inch(x.want.min.y)), mid('y', x => W.inch(x.want.max.y))], z: [mid('z', x => W.inch(x.want.min.z)), mid('z', x => W.inch(x.want.max.z))] };
    return W.snapFit(cur0, haveI, wantI, axs);
  }

  // ---------------------------------------------------------------- panel drawing
  const fmtFit = (f) => `scale ${f.s.map(v => (v * 100).toFixed(1)).join(' / ')} %  offset ${f.o.map(v => (v * 12).toFixed(2)).join(' / ')} in  yaw ${f.yaw.toFixed(1)}°`;
  function drawQueue() {
    $('#wbQueue').innerHTML = order.map((f, i) => {
      const s = W.familyStatus(f, pieceSkusOf(f), ST), sc = scoreOf(f), c = scan[f] ? (scan[f].score > 6 ? 'bad' : scan[f].score > 2 ? 'warn' : 'ok') : (sc > 2 ? 'warn' : 'ok');
      return `<li class="${f === fam ? 'on' : ''} st-${s.status}" data-f="${f}"><span class="fn">${f}</span><span class="chip ${s.status}">${s.status === 'marks' ? `marks ${s.marked}` : s.status === 'approved' && s.marked ? `approved, ${s.marked} marked` : s.status}</span><span class="sc ${c}">${scan[f] ? scan[f].score : '~' + sc}</span></li>`;
    }).join('');
    const done = FAMS.filter(f => ST.fams[f]?.approved).length;
    $('#wbQueueHead').textContent = `Families · ${done} of ${FAMS.length} approved${Object.keys(scan).length < FAMS.length ? ` · measuring ${Object.keys(scan).length}/${FAMS.length}` : ''}`;
  }
  const queueDraw = drawQueue;
  function drawFindings() {
    if (!cur) return;
    const groups = new Map(); for (const f of cur.findings || []) f.n = 0; for (const f of cur.findings || []) { const g = groups.get(f.key); if (g) g.n++; else { f.n = 1; groups.set(f.key, f); } }
    const F = [...groups.values()].sort((a, b) => ({ bad: 0, warn: 1, ok: 2 }[a.sev] - { bad: 0, warn: 1, ok: 2 }[b.sev]) || Math.abs(b.value || 0) - Math.abs(a.value || 0));
    const bad = F.filter(f => f.sev === 'bad' && f.kind !== 'structure').length, warn = F.filter(f => f.sev === 'warn' && f.kind !== 'structure').length;
    $('#wbFindHead').innerHTML = `Measured · <b class="${bad ? 'bad' : warn ? 'warn' : 'ok'}">${bad} red, ${warn} amber</b> <span class="muted">(tolerance ${W.TOL.seam} in; red beyond twice that)</span>`;
    $('#wbFind').innerHTML = F.slice(0, 60).map((f, i) => `<li class="${f.sev}" data-i="${(cur.findings).indexOf(f)}">${f.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}${f.n > 1 ? ` <b>×${f.n}</b>` : ''}</li>`).join('') || '<li class="ok">nothing out of tolerance</li>';
  }
  function drawPanel() {
    const p = pieces[sel]; if (!p) { $('#wbPiece').innerHTML = '<div class="muted">no pieces</div>'; return; }
    const f = fitOf(p.sku), st = stOf(p.sku), rec = skuRec.get(p.sku), it0 = p.items.find(i => i.frame || i.world), fl = (cur?.findings || []).filter(x => x.sku === p.sku || x.sku2 === p.sku);
    const worst = fl.reduce((a, x) => W.worse(a, x.sev), 'ok');
    const str = rec?.bounds ? W.stretchOf(lib.objects[rec.id || p.items[0]?.spec.id]?.size || [60, 12, 108], rec.bounds, orient[rec.mesh] ?? 0) : null;
    $('#wbPieceHead').innerHTML = `${sel + 1}/${pieces.length} · <b>${p.role}</b> <code>${p.sku}</code> ×${p.items.length}`;
    $('#wbPiece').innerHTML = `
      <div class="row2"><span class="k ${axes.includes('x') ? 'ax' : ''}">scale X</span><b>${(f.s[0] * 100).toFixed(1)}%</b><span class="k ${axes.includes('y') ? 'ax' : ''}">Y</span><b>${(f.s[1] * 100).toFixed(1)}%</b><span class="k ${axes.includes('z') ? 'ax' : ''}">Z</span><b>${(f.s[2] * 100).toFixed(1)}%</b></div>
      <div class="row2"><span class="k">offset x</span><b>${(f.o[0] * 12).toFixed(2)}″</b><span class="k">y</span><b>${(f.o[1] * 12).toFixed(2)}″</b><span class="k">z</span><b>${(f.o[2] * 12).toFixed(2)}″</b><span class="k">yaw</span><b>${f.yaw.toFixed(1)}°</b></div>
      <div class="small muted">${str ? `face pulled ${str.aniso.toFixed(2)}× out of shape (${str.s.map(v => v.toFixed(1)).join(' / ')} ft per mesh unit, along / tall / deep)` : ''}</div>
      <div class="small">status: <b class="${worst}">${worst === 'ok' ? 'no problems measured' : fl.length + ' problem(s)'}</b>${st.approved ? ' · <span class="ok">approved</span>' : ''}${st.mark ? ` · <span class="bad">marked: ${(st.mark.note || 'doesn\'t fit').replace(/</g, '&lt;')}</span>` : ''}</div>
      ${pendingSnap ? `<div class="snap">Snap proposed: ${fmtFit(pendingSnap)}<br><b>Enter</b> keep · <b>Esc</b> undo</div>` : ''}
      <div class="small muted">axes for the scale keys: <b>${axes === 'xyz' ? 'all (even)' : axes.toUpperCase()}</b></div>`;
    $('#wbCurFit').textContent = fmtFit(f);
    $('#wbMarkRow').hidden = !markOpen;
    drawDoors();
  }
  function drawDoors() {
    if (!cur) return;
    const door = cur.doors?.find(d => !d.wide && d.storey === 0), wide = cur.doors?.find(d => d.wide && d.storey === 0);
    const fig = cur.figInfo, rows = [];
    if (door?.open) rows.push(`door: posts leave ${(door.open.w).toFixed(1)} in; leaf ${door.leaf.w.toFixed(1)} × ${door.leaf.h.toFixed(1)} in`);
    if (wide?.open) rows.push(`wide opening ${wide.open.w.toFixed(1)} in; leaf ${wide.leaf.w.toFixed(1)} × ${wide.leaf.h.toFixed(1)} in`);
    if (fig && door?.leaf) { const room = door.leaf.h - fig.h * 12; rows.push(`figure ${fig.h.toFixed(2)} ft (house scale ${fig.k.toFixed(2)}) ${room > 0 ? `<span class="ok">clears the doorway by ${room.toFixed(1)} in</span>` : `<span class="bad">is ${(-room).toFixed(1)} in too tall for it</span>`}`); }
    if (cur.windows?.length) rows.push('windows: ' + cur.windows.map(w => w.open ? `sill ${w.open.y0}″ head ${w.open.y1}″ ${w.open.w}″ wide` : 'closed or glazed').join(' · '));
    $('#wbDoors').innerHTML = rows.map(r => `<div class="small">${r}</div>`).join('');
  }

  // ---------------------------------------------------------------- markers on the specimen (flagged joints, in red)
  const markerGroup = new THREE.Group(); scene.add(markerGroup);
  const labels = [];
  function drawMarkers() {
    markerGroup.clear(); for (const l of labels.splice(0)) l.remove();
    if (!cur) return;
    const F = (cur.findings || []).filter(f => f.pos && f.sev !== 'ok' && f.kind !== 'structure').sort((a, b) => (a.sev === 'bad' ? 0 : 1) - (b.sev === 'bad' ? 0 : 1) || Math.abs(b.value) - Math.abs(a.value)).slice(0, 36);
    for (const f of F) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: sevCol[f.sev], depthTest: false, transparent: true, opacity: 0.9 })); m.position.copy(f.pos); m.renderOrder = 20; markerGroup.add(m);
      const d = document.createElement('div'); d.className = `lab ${f.sev}`; d.textContent = `${f.value > 0 ? '+' : ''}${(+f.value).toFixed(1)}″`; stage.append(d); labels.push(d); f.label = d; f.mark = m;
    }
    redraw();
  }
  const tmp = new THREE.Vector3();
  function placeLabels() {
    if (!cur) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    for (const f of cur.findings || []) {
      if (!f.label) continue; tmp.copy(f.pos).project(camera);
      const on = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05 && f.mark.visible !== false && showLabels;
      f.label.style.display = on ? 'block' : 'none'; if (on) f.label.style.transform = `translate(${((tmp.x + 1) / 2 * w).toFixed(0)}px, ${((1 - tmp.y) / 2 * h - 22).toFixed(0)}px)`;
    }
  }
  let showLabels = true;

  // ---------------------------------------------------------------- selection outline, figures, cameras
  let outline = null;
  function drawOutline() {
    if (outline) { scene.remove(outline); outline = null; }
    const p = pieces[sel]; if (!p) return;
    outline = new THREE.Group();
    for (const it of p.items) { if (!it.world) continue; const h = new THREE.Box3Helper(worldBox(it.visual), 0x2ee6ff); outline.add(h); }
    scene.add(outline); redraw();
  }
  async function addFigures(S) {
    const figures = FIG.createFigures({ list: figList, base: '', look, shadows: () => true });
    const k = T.house.figures ? FIG.figureScaleOf(T.house.figures) : FIG.FIGURE_SCALE; figures.setScale(k);
    const lst = [[1, 'hero-fighter-human-m', '#d9a441', 0, 36.5, 3], [2, 'town-human-guard', '#5aa9e6', 10, 34, 3]];
    const door = S.items.find(i => i.role === 'doorway' && i.storey === 0);
    const vis = [];
    for (const [, id, col, y, x, z] of lst) { const v = figures.pawnVisual({ fig: id }, { color: col }); if (!v) continue; v.position.set(door ? door.group.position.x + 0.2 : x, y, 3.2); S.group.add(v); vis.push(v); }
    await Promise.all(vis.map(v => v.userData.ready).filter(Boolean));
    if (vis[0]) { const m = figures.measure(vis[0]); S.figInfo = { h: m.height_ft, k }; }
    S.figures = vis; S.figuresApi = figures;
  }

  const dir = { out: 1, inn: -1 };
  let face = 'out', hideRoof = false;
  function focusBox(b) { return { c: b.getCenter(new THREE.Vector3()), s: b.getSize(new THREE.Vector3()) }; }
  function setFarVisible(runN, runS, legs) { if (!cur) return; for (const it of cur.items) { if (!it.e || it.role === 'floor' || it.role === 'slab') continue; const e = it.e, isN = e.dir === 'h' && e.gz === 0, isS = e.dir === 'h' && e.gz === DEPTH && e.gx >= LEG; const isCorner = it.role === 'post'; it.group.visible = isCorner ? true : isN ? runN : isS ? runS : legs; } }
  const views = {
    front() { setFarVisible(true, true, true); if (face === 'out') cam([40, 12, -100], [40, 9, 0]); else { setFarVisible(true, false, false); cam([40, 10, 85], [40, 9, 0]); } },
    three() { setFarVisible(true, true, true); cam(face === 'out' ? [-50, 46, -66] : [110, 50, 60], [36, 8, 6]); },
    inside() { face = 'inn'; setFarVisible(true, false, false); cam([40, 9, 85], [40, 9, 0]); },
    panels() { setFarVisible(false, true, false); if (face === 'inn') cam([48, 8, -26], [48, 7, DEPTH * 5]); else cam([48, 8, 40], [48, 7, DEPTH * 5]); },
    seam() { // top seam close-up: the storey seam over the selected piece
      setFarVisible(true, true, true); const p = pieces[sel], it = p?.items.find(i => i.world) || cur?.items.find(i => i.role === 'straight'); if (!it) return;
      const c = it.world.getCenter(new THREE.Vector3()), side = face === 'out' ? -1 : 1; const e = it.e; const nz = e.dir === 'h' ? [0, 0, side * (e.owner.side === 'S' ? -1 : 1)] : [side * (e.owner.side === 'E' ? -1 : 1), 0, 0];
      cam([c.x + nz[0] * 7, it.level + 9.5 + 2.2, c.z + nz[2] * 7 + 1], [c.x, it.level + 9.6, c.z]);
    },
  };
  function cam(pos, at) { camera.position.set(...pos); ctl.target.set(...at); ctl.update(); redraw(); }
  let lastView = 'front';
  const goView = (n) => { lastView = n; views[n](); $('#wbFace').textContent = face === 'out' ? 'outside' : 'inside'; };

  // ---------------------------------------------------------------- loading a family
  let loading = 0;
  async function load(f) {
    const token = ++loading; fam = f; sel = 0; pendingSnap = null; undo = undo.filter(() => false);
    $('#wbTitle').textContent = `${f} · building…`; const t0 = performance.now();
    const S = await buildSpecimen(f);
    if (token !== loading) { dispose(S); return; }
    dispose(cur); cur = S; pieces = pieceList(S);
    await addFigures(S).catch(() => { });
    measure(S); S.group.updateMatrixWorld(true);
    scan[f] = { score: S.score, flags: S.findings.length, at: Date.now() };
    if (qs.get('piece')) sel = Math.max(0, pieces.findIndex(p => p.sku === qs.get('piece')));
    roofVis(); drawQueue(); drawFindings(); drawMarkers(); drawPanel(); drawPieces(); drawOutline(); goView(lastView);
    $('#wbTitle').textContent = f; $('#wbBuilt').textContent = `${S.items.length} parts built in ${(S.built / 1000).toFixed(1)} s · roof ${S.roofStyle || '?'}`;
    history.replaceState(null, '', `?${new URLSearchParams({ ...(api === '/api/tw-ratings' ? {} : { api }), family: f })}`);
    link?.changed(); redraw();
  }
  const roofVis = () => { if (cur?.roof) cur.roof.visible = !hideRoof; redraw(); };
  let scanP = null, scanDone = false;
  function scanAll() { // measure every family in the background (headless: no floors, no roof), then sort the queue worst first
    return scanP ||= (async () => {
      for (const f of FAMS) { if (scan[f]) continue; try { const S = await buildSpecimen(f, { light: true }); measure(S); scan[f] = { score: S.score, flags: S.findings.length, findings: S.findings.map(x => ({ ...x, pos: null, label: null, mark: null })), at: Date.now() }; dispose(S); drawQueue(); } catch (err) { scan[f] = { score: 0, flags: 0, err: String(err) }; } }
      const keep = fam; order = [...FAMS].sort((a, b) => scoreOf(b) - scoreOf(a) || a.localeCompare(b)); fam = keep; drawQueue(); scanDone = true; toast('every family measured; the queue is sorted worst first');
    })();
  }


  // ---------------------------------------------------------------- keys
  let markOpen = false;
  const step = (e) => e.shiftKey ? 0.2 : e.ctrlKey || e.metaKey ? 5 : 1;
  function nudge(kind, dirn, e) {
    const p = pieces[sel]; if (!p) return; const f = fitOf(p.sku);
    if (kind === 'scale') { const d = dirn * step(e) / 100; ['x', 'y', 'z'].forEach((a, i) => { if (axes.includes(a)) f.s[i] = +(f.s[i] * (1 + d)).toFixed(5); }); }
    else if (kind === 'off') { const [i, d] = dirn; f.o[i] = +(f.o[i] + d * (e.shiftKey ? 0.1 : e.ctrlKey ? 2 : 0.5) / 12).toFixed(5); }
    else if (kind === 'yaw') f.yaw = +(f.yaw + dirn * (e.shiftKey ? 0.1 : e.ctrlKey ? 5 : 1)).toFixed(3);
    setFit(p.sku, f); saveSoon(p.sku);
  }
  function selectPiece(i) { if (!pieces.length) return; sel = (i + pieces.length) % pieces.length; pendingSnap = null; drawPanel(); drawOutline(); drawPieces(); const it = pieces[sel].items.find(x => x.world); if (it && lastView === 'seam') views.seam(); }
  function drawPieces() { $('#wbPieces').innerHTML = pieces.map((p, i) => { const fl = (cur?.findings || []).filter(x => x.sku === p.sku || x.sku2 === p.sku).reduce((a, x) => W.worse(a, x.sev), 'ok'), st = stOf(p.sku); return `<li class="${i === sel ? 'on' : ''}" data-i="${i}"><span class="dot ${fl}"></span><span class="pn">${p.role} · ${p.sku.replace(/^(wall-|door-)?/, '').slice(0, 34)}</span><span class="tag">${st.mark ? '<b class="bad">marked</b>' : st.approved ? '<b class="ok">✓</b>' : ''}${!W.isIdentity(fitOf(p.sku)) ? ' <b class="chg">fit</b>' : ''}</span></li>`; }).join(''); }
  function commitSnap() { if (!pendingSnap) return; const p = pieces[sel]; const f = pendingSnap; pendingSnap = null; setFit(p.sku, f, { record: false }); saveThe(p.sku); toast(`snap kept for ${p.sku}`); drawPieces(); }
  function cancelSnap() { if (!pendingSnap) return; const p = pieces[sel]; const u = undo.pop(); if (u) { wallfit[p.sku] = W.cleanFit(u.before.fit); setFit(p.sku, u.before.fit, { record: false }); } pendingSnap = null; drawPanel(); }
  function doSnap() {
    const p = pieces[sel]; if (!p) return; const prop = proposeSnap(p);
    if (!prop || W.fitSame(prop, fitOf(p.sku), 5e-4)) { toast(`${p.sku}: nothing to close — it already fills its box. A bad look here is in the mesh itself: mark it.`); return; }
    undo.push({ sku: p.sku, before: JSON.parse(JSON.stringify({ fit: fitOf(p.sku), mark: stOf(p.sku).mark, approved: stOf(p.sku).approved })) });
    pendingSnap = prop; setFit(p.sku, prop, { record: false }); pendingSnap = prop; drawPanel();
  }
  function undoOne() {
    if (pendingSnap) return cancelSnap(); const u = undo.pop(); if (!u) return toast('nothing to undo');
    const st = ST.pieces[u.sku] ||= { fit: u.before.fit, mark: null, approved: false }; st.mark = u.before.mark; st.approved = u.before.approved;
    setFit(u.sku, u.before.fit, { record: false }); saveThe(u.sku); drawPieces(); toast(`undone: ${u.sku}`);
  }
  function mark(note) { const p = pieces[sel]; if (!p) return; undo.push({ sku: p.sku, before: JSON.parse(JSON.stringify({ fit: fitOf(p.sku), mark: stOf(p.sku).mark, approved: stOf(p.sku).approved })) }); const st = ST.pieces[p.sku] ||= { fit: fitOf(p.sku), mark: null, approved: false }; st.mark = { note: note || "doesn't fit", at: new Date().toISOString() }; st.approved = false; saveThe(p.sku); drawPieces(); drawPanel(); drawQueue(); toast(`marked ${p.sku}: ${st.mark.note}`); }
  function clearMark() { const p = pieces[sel]; if (!p || !stOf(p.sku).mark) return; undo.push({ sku: p.sku, before: JSON.parse(JSON.stringify({ fit: fitOf(p.sku), mark: stOf(p.sku).mark, approved: stOf(p.sku).approved })) }); ST.pieces[p.sku].mark = null; saveThe(p.sku); drawPieces(); drawPanel(); drawQueue(); }
  function approvePiece() { const p = pieces[sel]; if (!p) return; undo.push({ sku: p.sku, before: JSON.parse(JSON.stringify({ fit: fitOf(p.sku), mark: stOf(p.sku).mark, approved: stOf(p.sku).approved })) }); const st = ST.pieces[p.sku] ||= { fit: fitOf(p.sku), mark: null, approved: false }; st.approved = !st.approved; if (st.approved) st.mark = null; saveThe(p.sku); drawPieces(); drawPanel(); drawQueue(); toast(`${p.sku} ${st.approved ? 'approved' : 'approval cleared'}`); }
  async function approveFamily() {
    const was = ST.fams[fam]?.approved; const marked = pieces.filter(p => stOf(p.sku).mark).length;
    ST.fams[fam] = { approved: !was, note: '', scan: { score: cur?.score ?? null, bad: (cur?.findings || []).filter(x => x.sev === 'bad').length }, at: new Date().toISOString() };
    if (api) try { await post({ kind: 'wallfit', name: `family/${fam}`, note: `${was ? 'approval cleared' : 'approved'}${marked ? ` with ${marked} marked piece(s)` : ''}`, data: { family: fam, approved: !was, scan: ST.fams[fam].scan } }); } catch (e) { toast(`could not save: ${e.message}`, true); }
    drawQueue(); toast(`${fam} ${!was ? 'approved' : 'approval cleared'}${!was && marked ? ` (${marked} marked piece(s) still open)` : ''}`);
    if (!was) { const nxt = order.find(f => f !== fam && !ST.fams[f]?.approved); if (nxt) load(nxt); }
  }
  const nextFam = (d) => { const i = order.indexOf(fam); load(order[(i + d + order.length) % order.length]); };
  const nextOpen = () => { const i = order.indexOf(fam); for (let k = 1; k <= order.length; k++) { const f = order[(i + k) % order.length]; if (!ST.fams[f]?.approved) return load(f); } };

  addEventListener('keydown', (e) => {
    const t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) { if (e.key === 'Escape') { markOpen = false; t.blur(); drawPanel(); } return; }
    const k = e.key; let used = true;
    if (k === ']') nextFam(1); else if (k === '[') nextFam(-1); else if (k === 'n') nextOpen();
    else if (k === 'Tab') selectPiece(sel + (e.shiftKey ? -1 : 1));
    else if (k === '1') goView('front'); else if (k === '2') goView('three'); else if (k === '3') goView('inside'); else if (k === '4') goView('seam'); else if (k === '5') goView('panels');
    else if (k === 'i') { face = face === 'out' ? 'inn' : 'out'; goView(lastView === 'inside' ? 'front' : lastView); }
    else if (k === 'h') { hideRoof = !hideRoof; roofVis(); } else if (k === 'l') { showLabels = !showLabels; redraw(); }
    else if (k === 'x' || k === 'y' || k === 'z') { axes = axes.includes(k) && axes.length === 1 ? 'xyz' : k; drawPanel(); } else if (k === 'u') { axes = 'xyz'; drawPanel(); }
    else if (k === '=' || k === '+') nudge('scale', 1, e); else if (k === '-' || k === '_') nudge('scale', -1, e);
    else if (k === 'ArrowRight') nudge('off', [0, 1], e); else if (k === 'ArrowLeft') nudge('off', [0, -1], e);
    else if (k === 'ArrowUp') nudge('off', [2, 1], e); else if (k === 'ArrowDown') nudge('off', [2, -1], e);
    else if (k === 'PageUp') nudge('off', [1, 1], e); else if (k === 'PageDown') nudge('off', [1, -1], e);
    else if (k === '.' || k === '>') nudge('yaw', 1, e); else if (k === ',' || k === '<') nudge('yaw', -1, e);
    else if (k === 's') doSnap(); else if (k === 'Enter') { if (pendingSnap) commitSnap(); else used = false; } else if (k === 'Escape') { if (pendingSnap) cancelSnap(); else used = false; }
    else if (k === '0') { const p = pieces[sel]; if (p) { setFit(p.sku, W.cleanFit(null)); saveThe(p.sku); } }
    else if (k === 'm') { markOpen = true; drawPanel(); setTimeout(() => $('#wbMarkNote').focus(), 0); } else if (k === 'M') clearMark();
    else if (k === 'a') approvePiece(); else if (k === 'A') approveFamily();
    else if ((k === 'z' && (e.ctrlKey || e.metaKey)) || k === 'Z') undoOne();
    else if (k === 'U') $('#wbHouse').click();
    else used = false;
    if (used) { e.preventDefault(); }
  });
  addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoOne(); } }, true);
  $('#wbMarkNote').addEventListener('keydown', (e) => { if (e.key === 'Enter') { mark($('#wbMarkNote').value.trim()); $('#wbMarkNote').value = ''; markOpen = false; $('#wbMarkNote').blur(); drawPanel(); } });
  $('#wbQueue').addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) load(li.dataset.f); });
  $('#wbPieces').addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) selectPiece(+li.dataset.i); });
  $('#wbFind').addEventListener('click', (e) => { const li = e.target.closest('li'); const f = cur?.findings?.[+li?.dataset.i]; if (!f) return; const pi = pieces.findIndex(p => p.sku === f.sku); if (pi >= 0) selectPiece(pi); if (f.pos) { ctl.target.copy(f.pos); const d = camera.position.clone().sub(ctl.target).normalize().multiplyScalar(14); camera.position.copy(ctl.target.clone().add(d)); ctl.update(); redraw(); } });
  for (const b of document.querySelectorAll('[data-view]')) b.addEventListener('click', () => goView(b.dataset.view));
  $('#wbFace').addEventListener('click', () => { face = face === 'out' ? 'inn' : 'out'; goView(lastView === 'inside' ? 'front' : lastView); });
  $('#wbRoof').addEventListener('click', () => { hideRoof = !hideRoof; roofVis(); });
  $('#wbSnap').addEventListener('click', doSnap); $('#wbUndo').addEventListener('click', undoOne); $('#wbReset').addEventListener('click', () => { const p = pieces[sel]; if (p) { setFit(p.sku, W.cleanFit(null)); saveThe(p.sku); } });
  $('#wbMark').addEventListener('click', () => { markOpen = true; drawPanel(); setTimeout(() => $('#wbMarkNote').focus(), 0); });
  $('#wbApprove').addEventListener('click', approvePiece); $('#wbApproveFam').addEventListener('click', approveFamily); $('#wbClearMark').addEventListener('click', clearMark);
  $('#wbScan').addEventListener('click', () => { for (const f of Object.keys(scan)) if (f !== fam) delete scan[f]; scanP = null; scanDone = false; scanAll(); });

  // ---------------------------------------------------------------- Use in game, Send
  const table = () => W.gameTable(Object.fromEntries(Object.keys(wallfit).map(s => [s, { fit: wallfit[s] }])));
  const link = houseLink({ api, key: 'wallfit', label: 'wall fixes', sendBtn: $('#wbSend'), houseBtn: $('#wbHouse'), current: table, norm: (g) => W.gameTable(Object.fromEntries(Object.entries(g || {}).map(([s, f]) => [s, { fit: f }]))), toast });
  $('#wbSend').addEventListener('click', async () => {
    const marks = Object.entries(ST.pieces).filter(([, p]) => p.mark).map(([s, p]) => ({ sku: s, note: p.mark.note }));
    try { await post({ kind: 'note', name: 'wall fit review', note: `${marks.length} marked piece(s)`, data: { wallfit: { marks, corrections: table(), approvedFamilies: Object.keys(ST.fams).filter(f => ST.fams[f].approved) } } }); link.sent('wall fit review'); } catch (e) { toast(`could not send: ${e.message}`, true); }
  });
  $('#wbHouse').addEventListener('click', async () => {
    for (const s of Object.keys(ST.pieces)) await saveThe(s).catch(() => { });
    const t = table(), n = `${Object.keys(t).length} wall fixes`;
    try { await post({ kind: 'house', name: 'house', note: `wallfit "${n}" is now the game's house look`, data: { wallfit: t } }); link.used(n); } catch (e) { toast(`could not set the house look: ${e.message}`, true); }
  });

  // ---------------------------------------------------------------- run
  const fit = () => { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); redraw(); };
  addEventListener('resize', fit); fit();
  renderer.setAnimationLoop(() => { if (!dirty) return; dirty = false; renderer.render(scene, camera); placeLabels(); });
  drawQueue();
  await load(fam);
  scanAll();   // every family, in the background: a couple of seconds, then the queue is sorted by what was measured
  window.__wallbench = {
    ready: true, raster: (sku) => { const it = cur.items.find(i => i.sku === sku && i.storey === 0 && i.visual); const g = W.rasterize(trisOf(it.visual, it.e, it.level), 60, 108); const rows = []; for (let y = 107; y >= 0; y -= 4) { let r = ''; for (let x = 0; x < 60; x += 2) r += g[y * 60 + x] ? '#' : '.'; rows.push(r); } return rows.join('\n'); }, families: () => [...FAMS], order: () => [...order], family: () => fam, load, wallfit, state: () => ST, specimen: () => cur, pieces: () => pieces.map(p => ({ sku: p.sku, role: p.role, n: p.items.length })), selected: () => pieces[sel]?.sku,
    findings: () => (cur?.findings || []).map(f => ({ kind: f.kind, sev: f.sev, sku: f.sku, sku2: f.sku2, value: f.value, text: f.text, tag: f.tag })), score: () => cur?.score, doors: () => cur?.doors, windows: () => cur?.windows, vertical: () => cur?.vertical,
    setFit: (sku, f) => setFit(sku, f), select: (i) => selectPiece(i), selectSku: (s) => selectPiece(pieces.findIndex(p => p.sku === s)), snap: () => { doSnap(); return pendingSnap; }, commit: commitSnap, remeasureNow: () => { measure(cur); drawFindings(); drawMarkers(); return cur.findings.length; },
    scan: () => scan, scanAll, scanDone: () => scanDone, view: goView, face: () => face, table, link: () => link.state(), mark, approvePiece, approveFamily, saveThe, undo: undoOne, T, look, buildSpecimen, measure, camera, cam, FAMS, labelsShown: () => labels.filter(l => l.style.display !== 'none').length, build: (f, o) => buildSpecimen(f, o),
  };
}
