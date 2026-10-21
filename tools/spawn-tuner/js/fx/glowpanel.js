// The Far-fire glow panel's tools (Spawn Tuner only; the dials, presets, Send and "Use in game" come from fx/index.js's
// generic panel). The stand-in under tuning is fx/farglow.js. Here:
//   THE TEST ROOM  a common room (chandeliers, wall torches, a hearth, candles) with a floor brazier, wall sconces and
//                  table candles added, and a small room beside it sharing a wall (does the glow cross it?).
//   THE VIEW       three ways to light the same picture from the same camera, to flick between:
//                    1 every flame a REAL light (the reference)
//                    2 a pool of N real lights, the rest with NO stand-in (what the game shows today)
//                    3 a pool of N real lights, the rest with the STAND-IN (what the dials below change)
//                  and the pool size N (0 = no real light at all: the hardest test).
//   THE NUMBER     "difference from real": the three pictures are drawn at the same instant (flames held steady) and
//                  compared pixel by pixel over the LIT REGION (where the real lights change the picture at all):
//                  mean and largest difference, 0 to 255, for the stand-in and for no stand-in. Tuning has a target.
import * as THREE from 'three';
import { gltfLoader } from '../gltf.js';

const CELL = 5;                                      // the tuner's rooms are in cells of 5 ft
const ROOM = { x: 3, z: 42, w: 7, d: 6 }, SIDE = { x: 10, z: 43, w: 3, d: 4 }; // cells: the far south-west of the grid, clear of the default rooms
const MW = 320, MH = 200;                             // the measurement's picture

export function mountGlowTools({ fx, fire, farglow, lighting, water, panel, camera, scene, renderer, toast = () => {}, dataBase = 'data/', onChange = () => {}, redraw = () => {} }) {
  if (!panel) return null;
  const box = document.createElement('div'); box.className = 'fxGlow';
  box.innerHTML = `
    <div class="muted small">Only the nearest few fires are real lights on a big map. This is the stand-in for the rest. Build the test room, flick between the three views, and tune view 3 until it reads like view 1.</div>
    <div class="row"><button id="fx-glow-room" class="primary" title="a common room with many kinds of light, far south-west of the grid">Build the test room</button><button id="fx-glow-look" title="put the camera on the test room">Look at it</button></div>
    <div class="row glowViews" role="radiogroup" aria-label="How the picture is lit">
      <button data-view="real" title="every flame is a real light: the reference">1 Real</button>
      <button data-view="none" title="a pool of real lights; the others light nothing">2 Pool, no stand-in</button>
      <button data-view="glow" title="a pool of real lights; the others get the stand-in under tuning">3 Pool + stand-in</button>
    </div>
    <div class="row small"><label>Real lights in the pool <select id="fx-glow-pool">${[0, 1, 2, 4, 8, 16].map(n => `<option value="${n}"${n === 2 ? ' selected' : ''}>${n === 0 ? 'none (everything is a stand-in)' : n}</option>`).join('')}</select></label></div>
    <div class="row small"><label class="check"><input type="checkbox" id="fx-glow-flick"> Flick between 1 and 3 every second</label><label class="check"><input type="checkbox" id="fx-glow-steady"> Hold flames steady</label></div>
    <div class="row small"><label>Show <select id="fx-glow-debug"><option value="picture">the picture</option><option value="gain">only what the stand-in adds</option><option value="normal">which way surfaces face (as the stand-in sees them)</option></select></label></div>
    <div id="fx-glow-diff" class="glowDiff small" role="status">Difference from real: not measured yet.</div>
    <div class="row"><button id="fx-glow-measure" title="draws views 1, 2 and 3 at the same instant and compares them">Measure the difference from real</button></div>
    <div id="fx-glow-state" class="muted small"></div>`;
  panel.insertBefore(box, panel.querySelector('#fx-farglow-dials'));
  const $ = (s) => box.querySelector(s);

  // ---- the view
  let view = 'real', pool = 2, flickT = 0, flickOn = false;
  function setView(v, now = false) {
    view = v;
    const n = v === 'real' ? Infinity : pool;
    if (now) fire.setCapNow(n); else fire.setCap(n);
    farglow.setViewer(v === 'glow');
    for (const b of box.querySelectorAll('[data-view]')) { const on = b.dataset.view === v; b.classList.toggle('primary', on); b.setAttribute('aria-pressed', on); }
    state();
  }
  for (const b of box.querySelectorAll('[data-view]')) b.addEventListener('click', () => { $('#fx-glow-flick').checked = false; flickOn = false; setView(b.dataset.view); });
  $('#fx-glow-pool').addEventListener('change', (e) => { pool = +e.target.value; setView(view); queueMeasure(); });
  $('#fx-glow-flick').addEventListener('change', (e) => { flickOn = e.target.checked; flickT = 0; if (!flickOn) setView('glow', true); });
  $('#fx-glow-steady').addEventListener('change', (e) => fire.setLite(e.target.checked));
  $('#fx-glow-debug').addEventListener('change', (e) => farglow.setView(e.target.value));
  farglow.setViewer(false); // (the tuner opens on view 1: every flame real, as ever)

  // ---- the test room
  let lib = null; const loader = gltfLoader(); const glbs = new Map(), extras = [];
  const libP = fetch(`${dataBase}library.json?v=1`).then(r => r.json()).then(j => (lib = j)).catch(() => null);
  async function place(id, x, y, z, yawDeg = 0, sku = null) {
    await libP; const o = lib?.objects[id]; const s = o?.skus.find(k => !sku || k.sku === sku); if (!s) return null;
    if (!glbs.has(s.url)) glbs.set(s.url, loader.loadAsync(s.url).then(g => g.scene));
    const src = await glbs.get(s.url), m = src.clone(true);
    m.scale.setScalar(Math.max(...o.size) / 12 / Math.max(...s.bounds)); m.userData.meshRoot = true;
    m.traverse(c => { if (c.isMesh) c.castShadow = c.receiveShadow = true; });
    const group = new THREE.Group(); group.add(m); group.rotation.y = yawDeg * Math.PI / 180;
    const b = new THREE.Box3().setFromObject(m); m.position.y = -b.min.y;
    group.position.set(x, y, z); scene.add(group);
    const it = { group, visual: m, layer: 'furnish', spec: { id, sku: s.sku, uid: `glow-test:${id}:${x}:${z}`, kind: 'mesh', dims: [o.size[0] / 12, o.size[2] / 12, o.size[1] / 12] }, rest: { x, y, z } };
    group.userData.item = it; water.addExtra(it); extras.push(it); return it;
  }
  const rect = (r) => ({ x0: r.x * CELL, z0: r.z * CELL, x1: (r.x + r.w) * CELL, z1: (r.z + r.d) * CELL });
  let built = false;
  function look() { const R = rect(ROOM), tc = window.tuner?.cam; if (!tc) return; tc.focus.set((R.x0 + R.x1) / 2 + 4, 0, (R.z0 + R.z1) / 2); tc.dist = 62; tc.pitch = 52; tc.yaw = 20; tc.update?.(); }
  async function buildRoom() {
    const T = window.tuner; if (!T?.createRoom) { toast('the test room needs the Spawn Tuner page', true); return false; }
    if (!built) {
      built = true;
      const have = T.rooms(), free = (r) => !have.some(h => h.x < r.x + r.w && h.x + h.w > r.x && h.z < r.z + r.d && h.z + h.d > r.z);
      if (free(ROOM)) await T.createRoom('common', ROOM.x, ROOM.z, ROOM.w, ROOM.d);
      if (free(SIDE)) await T.createRoom('guest', SIDE.x, SIDE.z, SIDE.w, SIDE.d);
      const R = rect(ROOM);
      // a floor brazier, two sconces on the wall shared with the side room, a torch on the west wall, candles on a table
      await place('brazier-tripod', R.x0 + 8, 0, R.z1 - 7);
      await place('sconce-candle-double', R.x1 - 0.75, 4.5, R.z0 + 9, -90);
      await place('sconce-candle-double', R.x1 - 0.75, 4.5, R.z1 - 6, -90);
      await place('torch-sconce', R.x0 + 0.8, 4.5, (R.z0 + R.z1) / 2 + 4, 90);
      const tables = [...fx().items()].filter(it => /table/.test(it.spec?.id || '') && it.rest && it.rest.x > R.x0 && it.rest.x < R.x1 && it.rest.z > R.z0 && it.rest.z < R.z1 && !it.spec.parent).slice(0, 2);
      for (const t of tables) { const b = new THREE.Box3().setFromObject(t.visual || t.group); await place('candlestick', (b.min.x + b.max.x) / 2 + 0.6, b.max.y, (b.min.z + b.max.z) / 2); }
      if (!tables.length) await place('candlestick-floor', R.x0 + 14, 0, R.z0 + 8);
    }
    look(); setView('glow'); toast('test room: flick between 1 Real, 2 Pool with no stand-in and 3 Pool + stand-in'); queueMeasure(2500);
    return true;
  }
  $('#fx-glow-room').addEventListener('click', buildRoom);
  $('#fx-glow-look').addEventListener('click', look);

  // ---- the number: views 1, 2 and 3 drawn at one instant, compared over the lit region
  const mc = document.createElement('canvas'); mc.width = MW; mc.height = MH; const mg = mc.getContext('2d', { willReadFrequently: true });
  function still(v, now) {
    fire.setCapNow(v === 'real' ? Infinity : pool); farglow.setViewer(v === 'glow');
    const F = fx(); F.frame(0, now); F.frame(0, now); F.render(0);
    mg.drawImage(renderer.domElement, 0, 0, MW, MH); return mg.getImageData(0, 0, MW, MH).data;
  }
  let last = null;
  function measure() {
    if (!lighting.params.on) { $('#fx-glow-diff').textContent = 'Difference from real: needs Lighting FX on (the stand-in is drawn in the post stack).'; return null; }
    const was = { view, lite: fire.isLite(), dbg: $('#fx-glow-debug').value }, now = performance.now();
    fire.setLite(true); farglow.setView('picture');
    const A = still('real', now), B = still('none', now), C = still('glow', now);
    fire.setLite(was.lite); farglow.setView(was.dbg); setView(was.view, true);
    let n = 0, sG = 0, sN = 0, mG = 0, mN = 0, bias = 0; const dG = [];
    for (let i = 0; i < A.length; i += 4) {
      const lit = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (lit <= 8) continue; n++;
      const g = (Math.abs(C[i] - A[i]) + Math.abs(C[i + 1] - A[i + 1]) + Math.abs(C[i + 2] - A[i + 2])) / 3, nn = (Math.abs(B[i] - A[i]) + Math.abs(B[i + 1] - A[i + 1]) + Math.abs(B[i + 2] - A[i + 2])) / 3;
      sG += g; sN += nn; mG = Math.max(mG, g); mN = Math.max(mN, nn); dG.push(g);
      bias += (0.3 * (C[i] - A[i]) + 0.6 * (C[i + 1] - A[i + 1]) + 0.1 * (C[i + 2] - A[i + 2]));
    }
    dG.sort((a, b) => a - b);
    last = n ? { lit: +(n / (MW * MH)).toFixed(3), mean: +(sG / n).toFixed(2), max: +mG.toFixed(1), p95: +dG[Math.floor(dG.length * 0.95)].toFixed(1), none_mean: +(sN / n).toFixed(2), none_max: +mN.toFixed(1), bias: +(bias / n).toFixed(2), pool, mode: farglow.params.how.mode, standins: farglow.stats().farglow_lights }
      : { lit: 0, pool, mode: farglow.params.how.mode };
    const el = $('#fx-glow-diff');
    if (!n) el.textContent = `Difference from real: nothing to compare (with a pool of ${pool} no fire in view is left out; lower the pool, or look at the test room).`;
    else el.innerHTML = `Difference from real, over the lit region (${Math.round(last.lit * 100)}% of the picture), 0 to 255:<br><b>stand-in: mean ${last.mean}, largest ${last.max}</b> (95% of it under ${last.p95}; on the whole ${last.bias > 0.5 ? 'brighter' : last.bias < -0.5 ? 'darker' : 'neither brighter nor darker'} than real by ${Math.abs(last.bias)})<br>no stand-in: mean ${last.none_mean}, largest ${last.none_max}`;
    el.dataset.mean = last.mean ?? ''; return last;
  }
  let mT = 0; function queueMeasure(ms = 500) { clearTimeout(mT); mT = setTimeout(() => { if (built || $('#fx-glow-diff').dataset.mean) measure(); }, ms); }
  $('#fx-glow-measure').addEventListener('click', measure);
  panel.addEventListener('input', (e) => { if (e.target.closest('#fx-farglow-dials')) queueMeasure(); });
  panel.addEventListener('change', (e) => { if (e.target.closest('#fx-farglow-dials')) queueMeasure(); });

  function state() {
    const s = farglow.stats(), p = fire.pool();
    $('#fx-glow-state').textContent = view === 'real' ? `View 1: every flame is a real light (${p.lit} lights).` : `View ${view === 'none' ? 2 : 3}: ${p.real} real light${p.real === 1 ? '' : 's'} of ${p.lit}; ${view === 'glow' ? `${s.farglow_mode === 'projected' ? s.farglow_lights : fire.glowCount()} stand-in${s.farglow_mode === 'projected' ? ' lights (one draw into the light map, one full-screen pass)' : ' discs on the floor'}` : 'the rest light nothing'}.`;
  }
  let stT = 0;
  const self = {
    frame(now) {
      if (flickOn && now - flickT > 1000) { flickT = now; setView(view === 'real' ? 'glow' : 'real', true); }
      if (now - stT > 500) { stT = now; state(); }
    },
    buildRoom, look, setView, measure, get view() { return view; }, get pool() { return pool; }, setPool(n) { pool = n; $('#fx-glow-pool').value = String(n); setView(view, true); }, last: () => last, extras: () => extras,
  };
  setView('real');
  return self;
}
