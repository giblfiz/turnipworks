// The Dice panel (Spawn Tuner only; the dials, presets, Send and "Use in game" come from fx/index.js's generic panel).
// THE ROLL BUTTONS THROW WHERE THE CAMERA LOOKS (Harry 2026-10-19: "I need to have the dice always roll near the middle
// of the camera, and to have them bounce off the objects there (including ... if I build a room or two and fill it up
// with stuff in the tuner)"): toward the point under the middle of the view, from a few feet back toward the camera,
// against WHATEVER IS THERE: the tuner's rooms (floors and walls, from the tuner's own wall edges), every placed thing
// as its box. The colliders are built by the GAME's own builder (engine/client/diceworld.js, loaded on the first roll),
// fed the tuner's scene. A roll never moves the camera, so the settling stays where Harry is looking.
// "Test table": two real furnished rooms (a common room and a storeroom, laid out and furnished by the tuner's own
// solver from the library), out of the way of the default rooms, and the camera on them. Close-up / Showcase line the
// seven dice up on a plank floor of their own.
import * as THREE from 'three';
import { diceOfRoll } from './dice.js';
import { encode } from './dicephys.js';
import { dieGeo } from './dicegeo.js';
import { dieTriangles } from './dicelook.js';

const FLOOR = { x0: -76, z0: 26, x1: -24, z1: 42, y: 0 }; // (the lineup's own plank floor)
const TEST_ROOMS = [['common', -16, -14, 7, 6], ['storeroom', -9, -14, 4, 6]]; // cells (5 ft): x -80..-25, z -70..-40
const STRUCT = new Set(['walls', 'floor', 'openings']);
let worldMod = null; // engine/client/diceworld.js (the game's collider builder), on the first roll
const diceworld = () => worldMod || (worldMod = import(new URL('../../../engine/client/diceworld.js', import.meta.url).href));
const ROLLS = [['d4', 'd4'], ['d6', 'd6'], ['d8', 'd8'], ['d10', 'd10'], ['d12', 'd12'], ['d20', 'd20'], ['d100', 'd100'], ['4d6', '4d6'], ['2d20', '2d20 (advantage)'], ['4d6+2d20+d100', '4d6 + 2d20 + d100']];

export function mountDiceTools({ dice, panel, scene, camera, items = () => [], toast = () => {} }) {
  if (!panel) return null;
  const box = document.createElement('div'); box.className = 'fxDice';
  box.innerHTML = `
    <div class="muted small">The Roll buttons throw at the MIDDLE OF THE VIEW: pan or orbit anywhere (into a room you built and furnished) and roll; the dice hit its walls and everything in it. The camera stays put. The roller's browser throws once (Rapier) and everyone plays that recording; the numbering is turned so the top face reads the roll.</div>
    <div class="row"><button id="fx-dice-scene" class="primary" title="Build two furnished rooms out of the way (once) and look at them">Test table</button><button id="fx-dice-closeup" title="Every die at rest, close (judge the shapes and numbers)">Close-up</button><button id="fx-dice-show" title="Every die turning slowly in the air">Showcase</button><button id="fx-dice-clear">Clear</button></div>
    <div class="row dice-rolls">${ROLLS.map(([e, l]) => `<button data-roll="${e}" title="roll ${l}">${l}</button>`).join('')}</div>

    <div id="fx-dice-state" class="muted small"></div>`;
  panel.insertBefore(box, panel.querySelector('#fx-dice-dials'));
  const $ = (s) => box.querySelector(s);
  const table = new THREE.Group(); table.name = 'dice-test-table'; table.visible = false; scene.add(table);
  let built = false, n = 0, last = null;
  const mats = { floor: new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 0.9 }), wall: new THREE.MeshStandardMaterial({ color: 0x8c8274, roughness: 0.95 }), table: new THREE.MeshStandardMaterial({ color: 0x5e3b22, roughness: 0.85 }), crate: new THREE.MeshStandardMaterial({ color: 0x9a7244, roughness: 0.9 }), barrel: new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.85 }), pawn: new THREE.MeshStandardMaterial({ color: 0x4f7fd0, roughness: 0.6 }) };
  function build() { // the lineup's plank floor
    if (built) { table.visible = true; return; } built = true; table.visible = true;
    const W = FLOOR.x1 - FLOOR.x0, D = FLOOR.z1 - FLOOR.z0, m0 = new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 0.9 });
    for (let i = 0; i < W / 1.5; i++) { const m = m0.clone(); m.color.offsetHSL(0, 0, ((i * 37) % 11 - 5) * 0.008); const b = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.3, D), m); b.position.set(FLOOR.x0 + 0.75 + i * 1.5, -0.15, (FLOOR.z0 + FLOOR.z1) / 2); b.receiveShadow = true; table.add(b); }
  }
  // THE TEST TABLE: real rooms, furnished by the tuner's solver (once; they stay like any room Harry builds)
  async function testRooms() {
    const T = window.tuner; if (!T?.createRoom) return null;
    const have = T.rooms();
    for (const [type, x, z, w, d] of TEST_ROOMS) if (!have.some(r => r.type === type && r.x === x && r.z === z)) await T.createRoom(type, x, z, w, d);
    const tc = T.cam; tc.focus.set(-55, 0, -55); tc.dist = 46; tc.pitch = 58; tc.yaw = 0; tc.update?.();
    return T.rooms().filter(r => TEST_ROOMS.some(([type, x, z]) => r.type === type && r.x === x && r.z === z));
  }
  // WHAT IS THERE: the tuner's scene as the game's entities -> the game's collider builder
  const _b = new THREE.Box3(), _c = new THREE.Vector3(), _s = new THREE.Vector3();
  async function sceneWorld(from) {
    const { diceWorld } = await diceworld();
    const T = window.tuner, ents = {};
    for (const r of T?.rooms?.() || []) ents[r.id] = { id: r.id, kind: 'room', recipe: { x: r.x, z: r.z, w: r.w, d: r.d, type: r.type } };
    if (built) ents.lineupFloor = { id: 'lineupFloor', kind: 'room', recipe: { x: FLOOR.x0 / 5, z: FLOOR.z0 / 5, w: (FLOOR.x1 - FLOOR.x0) / 5, d: (FLOOR.z1 - FLOOR.z0) / 5, type: 'yard' } };
    let k = 0;
    for (const it of items()) {
      const g = it.group; if (!g?.visible || STRUCT.has(it.spec?.layer) || !g.parent) continue;
      _b.setFromObject(g); if (_b.isEmpty()) continue; _b.getCenter(_c); _b.getSize(_s);
      const id = `thing_${(it.spec?.uid || it.spec?.key || ++k)}`.replace(/[^\w-]/g, '_');
      ents[id] = { id, kind: 'object', cat: it.spec?.id || 'thing', x: _c.x, z: _c.z, y: _b.min.y, dims: [_s.x, _s.y, _s.z], rot: 0 };
    }
    return diceWorld({ entities: ents, edges: T?.edges?.() || null, from, level: 0, reach: Math.max(30, dice.params.reject.reach + 6) });
  }
  function cam(which) {
    const tc = window.tuner?.cam; if (!tc) return;
    if (which === 'close') { tc.focus.set(-50, 0.8, 34); tc.dist = 34; tc.pitch = 30; tc.yaw = 0; }
    else if (typeof which === 'number') { const s = dice.params.look.size; tc.focus.set(-50 + (which - 3) * s * 1.9, s * 0.5, 34); tc.dist = s * 3.4; tc.pitch = 32; tc.yaw = 12; } // one die of the lineup, close
    tc.update?.();
  }
  const roll1 = (sides) => 1 + Math.floor(Math.random() * sides);
  // a roll as the game makes one: the numbers first (here: the panel's own), then the throw, then everyone plays it
  async function roll(expr) {
    const terms = []; for (const t of expr.split('+')) { const m = t.match(/^(\d*)d(\d+)$/); if (m) terms.push({ n: +(m[1] || 1), sides: +m[2] }); }
    const rolls = terms.flatMap(t => Array.from({ length: t.n }, () => roll1(t.sides)));
    const list = diceOfRoll(terms, rolls);
    // the middle of the view (the camera's focus, on the floor) and a hand a few feet back toward the camera
    const tc = window.tuner?.cam, cam3 = tc?.camera || camera, f = tc?.focus || new THREE.Vector3(-50, 0, 34);
    const fwd = new THREE.Vector3(f.x - cam3.position.x, 0, f.z - cam3.position.z); if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
    const to = { x: f.x, y: 0, z: f.z };
    const room = (window.tuner?.rooms?.() || []).find(r => to.x >= r.x * 5 && to.x <= (r.x + r.w) * 5 && to.z >= r.z * 5 && to.z <= (r.z + r.d) * 5);
    const from = { x: f.x - fwd.x * 7, y: 3, z: f.z - fwd.z * 7, r: 0, floor: 0 };
    if (room) { const m = Math.min(4, room.w * 2.5 - 0.5, room.d * 2.5 - 0.5), c = (v, a, b) => Math.max(a + m, Math.min(b - m, v)); from.x = c(from.x, room.x * 5, (room.x + room.w) * 5); from.z = c(from.z, room.z * 5, (room.z + room.d) * 5); }
    // in sight: on the screen, and in the room the view looks into (when it looks into one)
    const ndc = new THREE.Vector3();
    const inRoom = room ? (x, z) => x > room.x * 5 + 0.8 && x < (room.x + room.w) * 5 - 0.8 && z > room.z * 5 + 0.8 && z < (room.z + room.d) * 5 - 0.8 : () => true;
    const visible = (x, z) => { ndc.set(x, 0, z).project(cam3); return inRoom(x, z) && ndc.z < 1 && Math.abs(ndc.x) < 0.95 && Math.abs(ndc.y) < 0.93; };
    const world = await sceneWorld(from);
    const r = await dice.simulate({ dice: list.map(d => d.type), from, to, world, visible, by: 'tuner' });
    const id = `tuner_${++n}`;
    const p = dice.play({ id, rec: r.rec, values: list.map(d => d.value), color: '#c0392b', by: 'tuner' });
    last = { id, expr, rolls, room: room ? { id: room.id, x0: room.x * 5, z0: room.z * 5, x1: (room.x + room.w) * 5, z1: (room.z + room.d) * 5 } : null, colliders: { boxes: world.boxes.length, walls: world.boxes.filter(b => b.wall).length, props: world.boxes.filter(b => b.id).length }, touched: r.touched || [], sim: dice.stats().dice_last };
    show();
    p.then(() => { show(); toast(`${expr}: ${rolls.join(' + ')}${rolls.length > 1 ? ` = ${rolls.reduce((a, b) => a + b, 0)}` : ''}`); });
    return { id, rolls, values: list.map(d => d.value), types: list.map(d => d.type), sim: r, room: last.room, colliders: last.colliders, touched: last.touched };
  }
  // every die type at rest in a row (a flat drop: the physics' last resort) or turning in the air
  function lineup(spin) {
    build(); dice.clear();
    const types = ['d4', 'd6', 'd8', 'd10t', 'd10', 'd12', 'd20'], s = dice.params.look.size, F = spin ? 240 : 1;
    const frames = []; for (let f = 0; f < F; f++) {
      const fr = new Float64Array(types.length * 7);
      types.forEach((t, i) => {
        const g = dieGeo(t), x = -50 + (i - 3) * s * 1.9, y = spin ? 1.6 * s : g.inR * s, z = 34;
        let q = spin ? new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, f / F * Math.PI * 2 + i * 0.7, 0.3)) : restQuat(g);
        fr.set([x, y, z, q.x, q.y, q.z, q.w], i * 7);
      });
      frames.push(fr);
    }
    const rec = encode(frames, types, 30, s);
    const values = types.map(t => t === 'd10t' ? 20 : t === 'd10' ? 7 : t === 'd4' ? 4 : +t.slice(1));
    dice.play({ id: `lineup_${++n}`, rec, values, color: '#c0392b', at: performance.now() - (spin ? 0 : 1), hold: true });
    cam('close');
    last = { lineup: true, types, tris: Object.fromEntries(types.map(t => [t, dieTriangles(t, dice.params.look.round, dice.params.look.segments)])) };
    show();
    return last;
  }
  function restQuat(g) { // face 0 down (a d4: face 0 down too), turned a little so the camera sees two side faces
    const n = new THREE.Vector3(...g.faces[0].n), q = new THREE.Quaternion().setFromUnitVectors(n, new THREE.Vector3(0, -1, 0));
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5).multiply(q);
  }
  function show() {
    const st = dice.stats(), L = st.dice_last;
    $('#fx-dice-state').textContent = last?.lineup ? `Triangles per die: ${Object.entries(last.tris).map(([t, v]) => `${t === 'd10t' ? 'd%' : t} ${v}`).join(', ')}`
      : L ? `Last throw: ${L.tries} tr${L.tries === 1 ? 'y' : 'ies'}${Object.keys(L.reasons).length ? ` (rejected: ${Object.entries(L.reasons).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''}${L.gentled ? `, gentled (bounce ${L.gentled.bounce[0]}→${L.gentled.bounce[1]}, step ${L.gentled.step})` : ''}${L.fallback ? ', flat drop' : ''}; simulated in ${L.ms} ms; settles at ${L.settleAt} s; recording ${L.bytes} bytes, ${L.keys} keyframes. On the table: ${st.dice_throws} throw${st.dice_throws === 1 ? '' : 's'}, ${st.dice_tris} triangles. ${last?.colliders ? `Hit-able here: ${last.colliders.walls} wall pieces, ${last.colliders.props} things; touched ${last.touched.length}.` : ''}` : '';
  }
  box.addEventListener('click', (e) => { const b = e.target.closest('button[data-roll]'); if (b) roll(b.dataset.roll).catch(err => toast(`dice: ${err.message}`, true)); });
  $('#fx-dice-scene').addEventListener('click', () => { testRooms().then(r => toast(r ? 'test rooms: a furnished common room and storeroom; roll away (the dice go where the view looks)' : 'no tuner here', !r)); });
  $('#fx-dice-closeup').addEventListener('click', () => lineup(false));
  $('#fx-dice-show').addEventListener('click', () => lineup(true));
  $('#fx-dice-clear').addEventListener('click', () => { dice.clear(); show(); });
  return { roll, lineup, build, cam, testRooms, sceneWorld, info: () => ({ built, last, ...dice.stats(), throws: dice.info() }) };
}
