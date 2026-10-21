// The Fog-of-war look panel's test scene and interactive tools (Spawn Tuner only; the dials, presets, Send and
// "Use in game" come from fx/index.js's generic panel).
// Test scene (south-centre of the grid, clear of default rooms, glowpanel and waterpanel):
//   - WEST room   (x 110..130, z 210..235): pre-explored ("remembered"), behind a closed doorway -> thin explored VEIL
//   - MIDDLE room (x 130..150, z 210..235): viewer PAWN + warm brazier -> IN SIGHT (clear, catching spilled fog)
//   - EAST room   (x 150..170, z 210..235): behind an interactive DOOR -> NEVER-SEEN heavy bank + 2.5-ft checker floor,
//     with a bright secrecy-test beacon, an unseen pawn, an interior wall, and a fire inside to verify secrecy invariants.
// DARK PREVIEW (2026-10-21, for the Light reach sliders; "the darkness tuner scene has no darkness"): an open field south of
// the rooms (x 10..410, z 230..630) with one light of each kind round the viewer pawn, 130 ft apart, in the dark. Seen = within the viewer pawn's darkvision
// (15 ft, Foggybottom's) or within a light's reach from the look's table (fx/lightreach.js reachTable: Count dim light,
// Overall light scale, the per-kind rows); the outer "Remembered edge" of every radius is the veil, as in the game. No walls
// out there, so each light's disc is its whole reach: move a slider and its disc grows or shrinks at once.
import * as THREE from 'three';
import { gltfLoader } from '../gltf.js';
import { reachTable, LIGHT_KINDS } from './lightreach.js';

const CELL = 5;
const WEST = { x: 22, z: 42, w: 4, d: 5 }; // x 110..130, z 210..235
const MID  = { x: 26, z: 42, w: 4, d: 5 }; // x 130..150, z 210..235
const EAST = { x: 30, z: 42, w: 4, d: 5 }; // x 150..170, z 210..235
const BOUNDS = [90, 190, 190, 260];         // [x0, z0, x1, z1]: x 90..190, z 190..260 (100x70 ft)
const CELL_FT = 0.5;
const MW = Math.round((BOUNDS[2] - BOUNDS[0]) / CELL_FT); // 200
const MD = Math.round((BOUNDS[3] - BOUNDS[1]) / CELL_FT); // 140
const FIELD = [10, 230, 410, 630], FCELL = 1; // the dark preview's field (400 x 400 ft, 1-ft cells)
const FW = Math.round((FIELD[2] - FIELD[0]) / FCELL), FD = Math.round((FIELD[3] - FIELD[1]) / FCELL);
const FIELD_PAWN = { x: 210, z: 430, darkvision: 15 };
// one catalog piece of each kind of light (engine/core/darkness.js lightKind puts each in that row), on a 3 x 3 grid 130 ft
// apart round the pawn (two default reaches, 60 + 60, never meet), reading like a page: candle, lamp, lantern / torch,
// (pawn), fire / chandelier, oven, glow
const FIELD_LIGHTS = [['candle', 'candlestick-floor', 0], ['lamp', 'lamp-oil-brass', 0], ['lantern', 'lantern-post', 0], ['torch', 'torch-stand', 0], ['fire', 'brazier-tripod', 0], ['chandelier', 'chandelier-ring', 7], ['oven', 'bread-oven', 0], ['glow', 'crystal-glowing', 0]]
  .map(([kind, id, y], i) => { const k = i < 4 ? i : i + 1; return { kind, id, y, x: 80 + (k % 3) * 130, z: 300 + Math.floor(k / 3) * 130 }; });

export function mountFogWarTools({ fx, fogwar, atmos, lighting, fire, water, panel, camera, scene, renderer, toast = () => {}, dataBase = 'data/', onChange = () => {}, redraw = () => {} }) {
  if (!panel) return null;
  const box = document.createElement('div');
  box.className = 'fxFogWar';
  box.innerHTML = `
    <label class="check"><input type="checkbox" id="fx-fogwar-on"> Vision fog of war on (test scene)</label>
    <div class="muted small">Three rooms side by side: <b>remembered veil</b> (west), <b>in sight</b> with the viewer pawn (middle), and <b>never-seen bank</b> behind a door (east). Drag the pawn, click the door, or wave the cursor through the bank.</div>
    <div class="row">
      <button id="fx-fogwar-scene" class="primary" title="Build the 3-room fog-of-war test scene">Build test scene</button>
      <button id="fx-fogwar-door" title="Open or close the east door (or click the door in 3D)">Open door</button>
      <button id="fx-fogwar-reset-mem" title="Restore west room as remembered and east room as never-seen">Reset memory</button>
    </div>
    <div class="row">
      <button id="fx-fogwar-walk" title="Walk the pawn through the doorway and back">Walk pawn</button>
      <button id="fx-fogwar-move-mode" title="Click or drag on the floor to move the viewer pawn">Move pawn</button>
      <button id="fx-fogwar-wave" title="Wave a cursor stroke across the fog bank">Wave cursor</button>
    </div>
    <div class="row">
      <button id="fx-fogwar-cam-high" title="High overview of remembered veil, clear room, and unseen bank">High view</button>
      <button id="fx-fogwar-cam-door" title="3/4 view of the doorway spill and feathered sight edge">Door &amp; spill</button>
      <button id="fx-fogwar-cam-low" title="Low grazing angle across the never-seen bank and checker floor">Low angle</button>
      <button id="fx-fogwar-cam-veil" title="Look across the remembered room's thin veil">Veil view</button>
    </div>
    <label class="check"><input type="checkbox" id="fx-fogwar-low-preset"> Low preset / Fog &amp; mist off (checker + feathered edge only)</label>
    <label class="check"><input type="checkbox" id="fx-fogwar-dark"> Dark preview: one light of each kind in a dark field (for Darkness ▸ Light reach below)</label>
    <div id="fx-fogwar-state" class="muted small"></div>`;
  panel.insertBefore(box, panel.querySelector('#fx-fogwar-dials'));
  const $ = (s) => box.querySelector(s);

  const onCheck = $('#fx-fogwar-on');
  const lowCheck = $('#fx-fogwar-low-preset');

  const explored = new Uint8Array(MW * MD);
  const current = new Uint8Array(MW * MD);
  const maskData = new Uint8Array(MW * MD * 4);
  let rev = 1;
  let active = false;
  let built = false;
  let doorOpen = false;
  let westDoorOpen = false;
  let moveMode = false;
  let walkAnim = null;
  let waveAnim = null;
  const pawnPos = { x: 141.0, z: 222.5 };
  let doorSpan = [220.0, 225.0]; // z-interval of the east doorway at x = 150

  // 3D test objects in the scene
  const testGroup = new THREE.Group();
  testGroup.name = 'fogwar-test-scene';
  scene.add(testGroup);
  let viewerPawn = null;
  let unseenPawn = null;
  let unseenBeacon = null;
  let knownT = 0, unseenWall = null, farMount = null, farWall = null, fixtureWall = null, fixtureOuter = null;
  let doorLeafGroup = null;
  let eastDoorMeshes = [];
  const extras = [];

  let lib = null;
  const loader = gltfLoader();
  const glbs = new Map();
  const libP = fetch(`${dataBase}library.json?v=1`).then(r => r.json()).then(j => (lib = j)).catch(() => null);

  async function placeProp(id, x, y, z, yawDeg = 0, sku = null) {
    await libP;
    const o = lib?.objects?.[id];
    const s = o?.skus?.find(k => !sku || k.sku === sku);
    if (!s) return null;
    if (!glbs.has(s.url)) glbs.set(s.url, loader.loadAsync(s.url).then(g => g.scene));
    const src = await glbs.get(s.url);
    const m = src.clone(true);
    m.scale.setScalar(Math.max(...o.size) / 12 / Math.max(...s.bounds));
    m.userData.meshRoot = true;
    m.traverse(c => { if (c.isMesh) c.castShadow = c.receiveShadow = true; });
    const group = new THREE.Group();
    group.add(m);
    group.rotation.y = yawDeg * Math.PI / 180;
    const b = new THREE.Box3().setFromObject(m);
    m.position.y = -b.min.y;
    group.position.set(x, y, z);
    scene.add(group);
    const it = { group, visual: m, layer: 'furnish', spec: { id, sku: s.sku, uid: `fogwar-test:${id}:${x}:${z}`, kind: 'mesh', dims: [o.size[0] / 12, o.size[2] / 12, o.size[1] / 12] }, rest: { x, y, z, rot: group.rotation.y } };
    group.userData.item = it;
    water?.addExtra?.(it);
    extras.push(it);
    return it;
  }

  function makePawnMesh(bodyColor, ringColor, name) {
    const g = new THREE.Group();
    g.name = name;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.28, 24), new THREE.MeshStandardMaterial({ color: '#2b2623', roughness: 0.6, metalness: 0.2 }));
    base.position.y = 0.14;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.18, 1.42, 32), new THREE.MeshBasicMaterial({ color: ringColor, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 3.6, 20), new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45 }));
    body.position.y = 2.08;
    const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.82, 20, 14), new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45 }));
    shoulders.scale.set(1, 0.65, 0.8);
    shoulders.position.y = 3.75;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.58, 20, 16), new THREE.MeshStandardMaterial({ color: '#f0d2b8', roughness: 0.55 }));
    head.position.y = 4.65;
    g.add(base, ring, body, shoulders, head);
    g.traverse(c => { if (c.isMesh) c.castShadow = c.receiveShadow = true; });
    return g;
  }

  function ensureTestMeshes() {
    if (viewerPawn) return;
    viewerPawn = makePawnMesh('#3a7bd5', '#78c6ff', 'fogwar-viewer-pawn');
    viewerPawn.position.set(pawnPos.x, 0, pawnPos.z);
    const pawnItem = { group: viewerPawn, visual: viewerPawn, layer: 'furnish', spec: { id: 'pawn-viewer', uid: 'fogwar:viewer-pawn', kind: 'mesh', dims: [2.5, 5.2, 2.5] }, rest: { x: pawnPos.x, y: 0, z: pawnPos.z, rot: 0 } };
    viewerPawn.userData.item = pawnItem;
    water?.addExtra?.(pawnItem);
    testGroup.add(viewerPawn);

    // Unseen room secrecy test objects:
    // 1. Brightly coloured unlit beacon (#ff00ff magenta body + #00ffcc top) at (160, 0, 222.5)
    unseenBeacon = new THREE.Group();
    unseenBeacon.name = 'fogwar-unseen-beacon';
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4.2, 2.4), new THREE.MeshBasicMaterial({ color: 0xff00ff }));
    pillar.position.y = 2.1;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 2.6), new THREE.MeshBasicMaterial({ color: 0x00ffcc }));
    cap.position.y = 4.6;
    unseenBeacon.add(pillar, cap);
    unseenBeacon.position.set(160.0, 0, 222.5);
    testGroup.add(unseenBeacon);

    // 2. Unseen pawn at (158.0, 0, 228.0) — hidden when not in sight, visible when revealed
    unseenPawn = makePawnMesh('#ff1133', '#ff4466', 'fogwar-unseen-pawn');
    unseenPawn.position.set(158.0, 0, 228.0);
    testGroup.add(unseenPawn);

    // 3. Hidden interior wall inside the unseen room at (162.5, 0, 215.5)
    unseenWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9.0, 8.0), new THREE.MeshStandardMaterial({ color: '#8a8275', roughness: 0.9 }));
    unseenWall.position.set(162.5, 4.5, 215.5);
    unseenWall.castShadow = unseenWall.receiveShadow = true;
    const wallItem = { group: unseenWall, visual: unseenWall, layer: 'walls', spec: { id: 'wall-unseen-inner', uid: 'fogwar:unseen-wall', layer: 'walls', kind: 'mesh', dims: [0.8, 9.0, 8.0], x: 162.5, y: 0, z: 215.5, rot: 0 }, rest: { x: 162.5, y: 0, z: 215.5, rot: 0 } };
    unseenWall.userData.item = wallItem;
    water?.addExtra?.(wallItem);
    testGroup.add(unseenWall);

    // 5. (2026-10-18, walls known through their thickness) three leak fixtures on the far side of the middle room's east
    // wall and one fixture wall: a lantern box hung on the wall's never-seen face, a perpendicular wall joining it from
    // the never-seen side, and a fixture wall in the south wall's line whose OUTER face has its own material
    farMount = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 1.4), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    farMount.position.set(150.95, 5.5, 228.5); farMount.name = 'fogwar-far-mount'; farMount.userData.cullAs = { kind: 'item', dims: [0.6, 1.2, 1.4] }; testGroup.add(farMount);
    farWall = new THREE.Mesh(new THREE.BoxGeometry(6, 9, 0.7), new THREE.MeshStandardMaterial({ color: '#d04a2a', roughness: 0.8 }));
    farWall.position.set(153.6, 4.5, 231.5); farWall.name = 'fogwar-far-perpendicular-wall'; farWall.userData.cullAs = { kind: 'wall', dims: [6, 9, 0.7] }; testGroup.add(farWall);
    const inner = new THREE.MeshStandardMaterial({ color: '#8a7a62', roughness: 0.9 }); fixtureOuter = new THREE.MeshStandardMaterial({ color: '#2a6ad0', roughness: 0.9 });
    fixtureWall = new THREE.Mesh(new THREE.BoxGeometry(4.6, 9.5, 0.9), [inner, inner, inner, inner, fixtureOuter, inner]); // (+z, the outside, is box face 4)
    fixtureWall.position.set(142.5, 4.75, 235); fixtureWall.name = 'fogwar-fixture-wall'; fixtureWall.userData.wallFixture = [4.6, 9.5, 0.9]; testGroup.add(fixtureWall);

    // 4. Interactive door leaf at the east doorway (x = 150, z = doorSpan[0]..doorSpan[1])
    doorLeafGroup = new THREE.Group();
    doorLeafGroup.position.set(150.0, 0, doorSpan[0] + 0.35);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.32, 6.8, (doorSpan[1] - doorSpan[0]) - 0.7), new THREE.MeshStandardMaterial({ color: '#6e472b', roughness: 0.75 }));
    leaf.position.set(0, 3.4, ((doorSpan[1] - doorSpan[0]) - 0.7) / 2);
    leaf.castShadow = leaf.receiveShadow = true;
    doorLeafGroup.add(leaf);
    testGroup.add(doorLeafGroup);
  }

  function segHit(ax, az, bx, bz, cx, cz, dx, dz) {
    const rpx = bx - ax, rpz = bz - az, spx = dx - cx, spz = dz - cz;
    const denom = rpx * spz - rpz * spx;
    if (Math.abs(denom) < 1e-6) return false;
    const qpx = cx - ax, qpz = cz - az;
    const t = (qpx * spz - qpz * spx) / denom;
    const u = (qpx * rpz - qpz * rpx) / denom;
    return t > 0.02 && t < 0.98 && u >= -0.01 && u <= 1.01;
  }

  function wallSegments() {
    const [dz0, dz1] = doorSpan;
    const segs = [
      // Outer perimeter of the 3-room building (x 110..170, z 210..235)
      [110, 210, 170, 210],
      [110, 235, 170, 235],
      [110, 210, 110, 235],
      [170, 210, 170, 235],
      // West wall between Remembered room (110..130) and Viewer's room (130..150) at x = 130
      [130, 210, 130, 220],
      [130, 225, 130, 235],
      // East wall between Viewer's room (130..150) and Unseen room (150..170) at x = 150
      [150, 210, 150, dz0],
      [150, dz1, 150, 235],
      // Interior baffle wall in the East room
      [162.5, 211.5, 162.5, 219.5],
    ];
    // West doorway (130, 220..225) is closed unless the pawn walks into/near the west room or westDoorOpen is true
    if (!westDoorOpen && pawnPos.x > 132.5) segs.push([130, 220, 130, 225]);
    // East doorway (150, dz0..dz1) blocks sight when closed
    if (!doorOpen) segs.push([150, dz0, 150, dz1]);
    return segs;
  }

  // the dark preview's mask: seen = darkvision or a light's reach (no walls in the field); the outer hint ft = remembered
  const fieldData = new Uint8Array(FW * FD * 4), fieldSeen = new Uint8Array(FW * FD);
  let darkMode = false, darkKey = '', fieldProps = null;
  const darkKeyOf = () => { const p = fogwar.params; return JSON.stringify([reachTable(p), p?.dark?.hint ?? 2]); };
  function updateDark(snap) {
    const P = fogwar.params, table = reachTable(P), hint = Math.max(0, Math.min(6, P?.dark?.hint ?? 2)); darkKey = darkKeyOf();
    const srcs = [{ x: FIELD_PAWN.x, z: FIELD_PAWN.z, r: FIELD_PAWN.darkvision }, ...FIELD_LIGHTS.map(L => ({ x: L.x, z: L.z, r: table[L.kind] || 0 }))];
    let nSeen = 0, nBand = 0;
    for (let iz = 0; iz < FD; iz++) {
      const wz = FIELD[1] + (iz + 0.5) * FCELL;
      for (let ix = 0; ix < FW; ix++) {
        const wx = FIELD[0] + (ix + 0.5) * FCELL, i = iz * FW + ix;
        let seen = false, band = false;
        for (const S of srcs) { if (!(S.r > 0)) continue; const d = Math.hypot(wx - S.x, wz - S.z); if (d <= S.r - hint) { seen = true; break; } if (d <= S.r) band = true; }
        const o = i * 4; fieldSeen[i] = seen ? 1 : 0;
        fieldData[o] = seen ? 255 : 0; fieldData[o + 1] = seen || band ? 255 : 0; fieldData[o + 2] = seen ? 0 : band ? 186 : 255; fieldData[o + 3] = 255;
        if (seen) nSeen++; else if (band) nBand++;
      }
    }
    viewerPawn.position.set(FIELD_PAWN.x, 0, FIELD_PAWN.z);
    fogwar.setFlyers([viewerPawn]);
    fogwar.setState({ enabled: true, revision: ++rev, bounds: FIELD, floorY: 0, snap, levels: [{ y: 0, floorY: 0, width: FW, height: FD, bounds: FIELD, data: fieldData }] });
    cullUnseen(); fogwar.setKnown([]);
    const el = $('#fx-fogwar-state');
    if (el) el.textContent = `Dark preview (${P?.dark?.dim === false ? 'bright light only' : 'bright + dim'}, scale ${+(P?.dark?.scale ?? 1).toFixed(2)}×, edge ${hint} ft): ` + FIELD_LIGHTS.map(L => `${L.kind} ${table[L.kind]} ft`).join(' · ') + ` · pawn darkvision ${FIELD_PAWN.darkvision} ft · ${nSeen} cells seen, ${nBand} remembered`;
  }
  async function setDark(on) {
    darkMode = !!on; $('#fx-fogwar-dark').checked = darkMode;
    if (!active) setActive(true);
    if (darkMode && !fieldProps) { fieldProps = []; for (const L of FIELD_LIGHTS) fieldProps.push(await placeProp(L.id, L.x, L.y, L.z)); }
    if (darkMode) { updateDark(true); setCameraView('dark'); } else { updateVision(true); setCameraView('high'); }
  }

  function updateVision(snap = false) {
    if (!active) return;
    ensureTestMeshes();
    if (darkMode) { updateDark(snap); return; }
    viewerPawn.position.set(pawnPos.x, 0, pawnPos.z);
    if (viewerPawn.userData.item?.rest) {
      viewerPawn.userData.item.rest.x = pawnPos.x;
      viewerPawn.userData.item.rest.z = pawnPos.z;
    }
    const segs = wallSegments();
    const px = pawnPos.x, pz = pawnPos.z;
    const maxR2 = 46 * 46;
    let nSight = 0, nVeil = 0, nUnseen = 0;

    for (let iz = 0; iz < MD; iz++) {
      const wz = BOUNDS[1] + (iz + 0.5) * CELL_FT;
      const inZ = wz >= 210.0 && wz <= 235.0;
      for (let ix = 0; ix < MW; ix++) {
        const wx = BOUNDS[0] + (ix + 0.5) * CELL_FT;
        const idx = iz * MW + ix;
        const inFootprint = inZ && wx >= 110.0 && wx <= 170.0;
        let vis = 0;
        if (inFootprint) {
          const dx = wx - px, dz = wz - pz, d2 = dx * dx + dz * dz;
          if (d2 <= maxR2) {
            let blocked = false;
            for (let s = 0; s < segs.length; s++) {
              const seg = segs[s];
              if (segHit(px, pz, wx, wz, seg[0], seg[1], seg[2], seg[3])) { blocked = true; break; }
            }
            if (!blocked) vis = 255;
          }
        }
        current[idx] = vis;
        if (vis) explored[idx] = 255;
        const exp = explored[idx];
        const o = idx * 4;
        maskData[o] = vis;
        maskData[o + 1] = exp;
        maskData[o + 2] = vis ? 0 : (exp ? 186 : 255);
        maskData[o + 3] = 255;
        if (inFootprint) {
          if (vis) nSight++;
          else if (exp) nVeil++;
          else nUnseen++;
        }
      }
    }

    fogwar.setFlyers([viewerPawn]);
    fogwar.setState({
      enabled: true,
      revision: ++rev,
      bounds: BOUNDS,
      floorY: 0,
      snap,
      levels: [{ y: 0, floorY: 0, width: MW, height: MD, bounds: BOUNDS, data: maskData }],
    });

    // As in the game (engine/client/fog.js rule): a thing the viewer has never seen any of is not drawn at all (its fire
    // neither lights nor smokes). The test beacon, unseen pawn and baffle wall below are NOT culled on purpose: they
    // prove the shader's secrecy floor on its own.
    cullUnseen();
    fogwar.setKnown(knownWalls());
    // Pawns the viewer cannot see stay undrawn; visible pawns stay drawn in spilled fog.
    if (unseenPawn) {
      unseenPawn.visible = fogwar.isPointVisible(unseenPawn.position.x, unseenPawn.position.z, 0);
    }
    updateStatus(nSight, nVeil, nUnseen);
  }

  function seenInBox(x0, z0, x1, z1) {
    if (darkMode) {
      const i0 = Math.max(0, Math.floor((x0 - FIELD[0]) / FCELL)), i1 = Math.min(FW - 1, Math.floor((x1 - FIELD[0]) / FCELL));
      const j0 = Math.max(0, Math.floor((z0 - FIELD[1]) / FCELL)), j1 = Math.min(FD - 1, Math.floor((z1 - FIELD[1]) / FCELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (fieldData[(j * FW + i) * 4 + 1]) return true;
      return false;
    }
    const i0 = Math.max(0, Math.floor((x0 - BOUNDS[0]) / CELL_FT)), i1 = Math.min(MW - 1, Math.floor((x1 - BOUNDS[0]) / CELL_FT));
    const j0 = Math.max(0, Math.floor((z0 - BOUNDS[1]) / CELL_FT)), j1 = Math.min(MD - 1, Math.floor((z1 - BOUNDS[1]) / CELL_FT));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (explored[j * MW + i] || current[j * MW + i]) return true;
    return false;
  }
  // walls known through their thickness, as the game decides (engine/client/world.js knownWalls): a wall piece whose long
  // face is seen a little off the wall (ends left out); test fixtures marked userData.wallFixture take part
  const seenAt = (x, z) => seenInBox(x, z, x, z);
  const candOf = (it) => ({ g: it.group, x: it.rest?.x ?? it.group.position.x, z: it.rest?.z ?? it.group.position.z, rot: it.rest?.rot ?? it.group.rotation.y, dims: it.spec?.dims || [5, 10, 1], post: it.spec?.wallDir === 'c' });
  function wallKnown(c) {
    const [w = 5, , d = 1] = c.dims, ax = Math.cos(c.rot), az = -Math.sin(c.rot), nx = Math.sin(c.rot), nz = Math.cos(c.rot);
    if (c.post) { const r = Math.max(w, d) / 2 + 0.4; return [[r, 0], [-r, 0], [0, r], [0, -r]].some(([a, b]) => seenAt(c.x + a, c.z + b)); }
    for (const t of [-0.3, 0, 0.3]) for (const side of [-1, 1]) { const off = side * (d / 2 + 0.4); if (seenAt(c.x + ax * t * w + nx * off, c.z + az * t * w + nz * off)) return true; }
    return false;
  }
  function knownWalls() {
    if (!active) return [];
    return [...fx().items().filter(it => it.layer === 'walls' && it.group?.visible).map(candOf),
      ...testGroup.children.filter(o => o.userData.wallFixture && o.visible).map(o => ({ g: o, x: o.position.x, z: o.position.z, rot: o.rotation.y, dims: o.userData.wallFixture, post: false }))]
      .filter(wallKnown).map(c => c.g);
  }
  function cullUnseen() {
    // the far-side fixtures go through the game's own rules (a thing: any of its box seen; a wall: its face known)
    for (const o of testGroup.children) { const c = o.userData.cullAs; if (!c) continue;
      const [w, , d] = c.dims, show = !active || (c.kind === 'wall' ? wallKnown({ x: o.position.x, z: o.position.z, rot: o.rotation.y, dims: [w, 9, d], post: false }) : seenInBox(o.position.x - w / 2, o.position.z - d / 2, o.position.x + w / 2, o.position.z + d / 2));
      o.userData.cullVisible = show; o.visible = show; }
    for (const it of new Set([...fx().items(), ...extras])) {
      const g = it.group; if (!g || testGroup === g.parent) continue;
      const x = it.rest?.x ?? g.position.x, z = it.rest?.z ?? g.position.z, [w = 1, , d = 1] = it.spec?.dims || [];
      const c = Math.abs(Math.cos(it.rest?.rot ?? g.rotation.y)), n = Math.abs(Math.sin(it.rest?.rot ?? g.rotation.y));
      const rx = Math.max(0.3, (c * w + n * d) / 2), rz = Math.max(0.3, (n * w + c * d) / 2);
      const hide = active && !g.userData.fogForce && (it.layer === 'walls' ? !wallKnown(candOf(it)) : !seenInBox(x - rx, z - rz, x + rx, z + rz)); // (a wall: only when its face is known, as in the game)
      if (g.userData.fogHidden && !hide && it.rested !== false && !g.userData.hidden && !g.userData.testHidden) g.visible = true;
      g.userData.fogHidden = hide; if (hide) g.visible = false;
    }
  }
  function resetMemory(snap = true) {
    explored.fill(0);
    // Pre-mark the West room (x 110..130, z 210..235) as remembered (explored = 255)
    for (let iz = 0; iz < MD; iz++) {
      const wz = BOUNDS[1] + (iz + 0.5) * CELL_FT;
      if (wz < 210.0 || wz > 235.0) continue;
      for (let ix = 0; ix < MW; ix++) {
        const wx = BOUNDS[0] + (ix + 0.5) * CELL_FT;
        if (wx >= 110.0 && wx <= 130.0) explored[iz * MW + ix] = 255;
      }
    }
    updateVision(snap);
  }

  function syncDoorVisuals() {
    const [dz0] = doorSpan;
    if (doorLeafGroup) {
      doorLeafGroup.position.set(150.0, 0, dz0 + 0.35);
      doorLeafGroup.rotation.y = doorOpen ? -Math.PI * 0.48 : 0;
    }
    for (const m of eastDoorMeshes) {
      m.rotation.y = m.userData.baseRot + (doorOpen ? -Math.PI * 0.48 : 0);
    }
    $('#fx-fogwar-door').textContent = doorOpen ? 'Close door' : 'Open door';
  }

  function setDoorOpen(open, snap = false) {
    doorOpen = !!open;
    syncDoorVisuals();
    updateVision(snap);
    // Swirl the atmosphere through the doorway on toggle
    const cz = (doorSpan[0] + doorSpan[1]) * 0.5;
    const dir = doorOpen ? 1 : -1;
    for (let i = -2; i <= 2; i++) {
      atmos.splat(150.0 + dir * 2.0, cz + i * 1.4, dir * 4.0, i * 1.2, 0, 2.8, 0); // (a draught through the door; the roll / pour fronts move the bank)
    }
  }

  function setActive(on) {
    active = !!on;
    onCheck.checked = active;
    testGroup.visible = active;
    if (!active) {
      fogwar.setState({ enabled: false });
      cullUnseen();
      $('#fx-fogwar-state').textContent = 'Vision fog of war is off in the tuner.';
    } else {
      resetMemory(true);
    }
  }

  let sceneReady = false;
  function setCameraView(which) {
    const tc = window.tuner?.cam;
    if (!tc) return;
    if (which === 'high') {
      tc.focus.set(140, 0, 222.5); tc.dist = 68; tc.pitch = 62; tc.yaw = 0;
    } else if (which === 'door') {
      tc.focus.set(151, 0, (doorSpan[0] + doorSpan[1]) / 2 + 4); tc.dist = 46; tc.pitch = 46; tc.yaw = -18;
    } else if (which === 'low') {
      tc.focus.set(158, 0, 223); tc.dist = 18; tc.pitch = 12; tc.yaw = 120; // eye height ~4 ft, just outside the east wall (the cut opens it)
    } else if (which === 'dark') {
      tc.focus.set(FIELD_PAWN.x, 0, FIELD_PAWN.z); tc.dist = 520; tc.pitch = 80; tc.yaw = 0;
    } else if (which === 'veil') {
      tc.focus.set(124, 0, 222.5); tc.dist = 34; tc.pitch = 44; tc.yaw = 22;
    }
    tc.update?.();
    if (active) atmos.warm(4);
  }

  async function buildScene() {
    sceneReady = false;
    const T = window.tuner;
    ensureTestMeshes();
    if (T?.createRoom && !built) {
      built = true;
      const lod = document.querySelector('#lodFaces');
      if (lod) lod.value = 'baked';
      const wk = document.querySelector('#wallKit');
      if (wk) wk.value = 'kit';
      const have = T.rooms();
      const free = (r) => !have.some(h => h.x < r.x + r.w && h.x + h.w > r.x && h.z < r.z + r.d && h.z + h.d > r.z);
      if (free(WEST)) await T.createRoom('desk', WEST.x, WEST.z, WEST.w, WEST.d);
      if (free(MID))  await T.createRoom('common', MID.x, MID.z, MID.w, MID.d);
      if (free(EAST)) await T.createRoom('guest', EAST.x, EAST.z, EAST.w, EAST.d);

      // Find the connecting doorway between MID and EAST if one was generated on x = 150 (gx = 30)
      const midRoom = T.rooms().find(r => r.x === MID.x && r.z === MID.z);
      const eastOp = midRoom?.openings?.find(o => o.side === 'E' && o.kind === 'door');
      if (eastOp) {
        const gz = MID.z + (eastOp.index || 0);
        const sp = eastOp.span || 1;
        doorSpan = [gz * CELL, (gz + sp) * CELL];
      }
      // Hide any solver-placed door leaf at x = 150 so our interactive doorLeafGroup controls the opening cleanly
      eastDoorMeshes = [];
      for (const it of fx().items()) {
        if (it.layer === 'openings' && Math.abs((it.rest?.x ?? it.group.position.x) - 150) < 1.5 && (it.rest?.z ?? it.group.position.z) >= 210 && (it.rest?.z ?? it.group.position.z) <= 235) {
          it.group.userData.baseRot = it.group.rotation.y;
          eastDoorMeshes.push(it.group);
          if (doorLeafGroup) doorLeafGroup.visible = false;
        }
      }
      // Place a warm brazier in the Viewer's room (near the doorway so spilled fog catches real firelight)
      // and a fire inside the Unseen room (to prove unseen fires never light the war fog bank)
      await placeProp('brazier-tripod', 144.5, 0, 218.0);
      await placeProp('brazier-tripod', 161.0, 0, 218.0);
      await placeProp('candlestick-floor', 120.0, 0, 222.5);
      // the fixture wall stands in for the middle room's south wall piece at x 140..145 (that kit piece is hidden)
      for (const it of fx().items()) if (it.layer === 'walls' && it.spec?.wallDir !== 'c' && Math.abs((it.rest?.z ?? it.group.position.z) - 235) < 1 && Math.abs((it.rest?.x ?? it.group.position.x) - 142.5) < 1) { it.group.userData.testHidden = true; it.group.visible = false; }
    }
    pawnPos.x = 141.0;
    pawnPos.z = 222.5;
    doorOpen = false;
    westDoorOpen = false;
    syncDoorVisuals();
    setActive(true);
    setCameraView('high');
    atmos.warm(90);
    sceneReady = true;
    toast('Fog-of-war test scene ready: remembered room (west), viewer room (middle), unseen room (east)');
    return true;
  }

  function updateStatus(nSight, nVeil, nUnseen) {
    const el = $('#fx-fogwar-state');
    if (!el || !active) return;
    el.textContent = `Pawn (${pawnPos.x.toFixed(1)}, ${pawnPos.z.toFixed(1)}) · East door: ${doorOpen ? 'open' : 'closed'} · Cells: ${nSight} in sight, ${nVeil} remembered veil, ${nUnseen} never-seen`;
  }

  // ---- Interactive pointer controls (drag the pawn, click the door, or Move pawn mode)
  const raycaster = new THREE.Raycaster();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPt = new THREE.Vector3();
  let draggingPawn = false;

  const canvas = renderer.domElement;
  function groundPoint(e) {
    const r = canvas.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    return raycaster.ray.intersectPlane(floorPlane, hitPt) ? hitPt : null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!active || e.button !== 0) return;
    const p = groundPoint(e);
    if (!p) return;
    // Click near the east doorway (x ~ 150, z in doorSpan) toggles the door
    if (!moveMode && Math.abs(p.x - 150.0) < 2.2 && p.z >= doorSpan[0] - 0.5 && p.z <= doorSpan[1] + 0.5) {
      e.stopImmediatePropagation();
      setDoorOpen(!doorOpen);
      return;
    }
    // Click on the viewer pawn or anywhere when moveMode is on starts dragging the pawn
    if (moveMode || Math.hypot(p.x - pawnPos.x, p.z - pawnPos.z) < 2.6) {
      e.stopImmediatePropagation();
      draggingPawn = true;
      movePawnTo(p.x, p.z);
    }
  }, true);

  window.addEventListener('pointermove', (e) => {
    if (!draggingPawn || !active) return;
    const p = groundPoint(e);
    if (p) movePawnTo(p.x, p.z);
  }, { passive: true });

  window.addEventListener('pointerup', () => { draggingPawn = false; }, { passive: true });

  function movePawnTo(x, z, snap = false) {
    const nx = Math.max(112, Math.min(168, x));
    const nz = Math.max(212, Math.min(233, z));
    const dt = 1 / 60;
    const vx = (nx - pawnPos.x) / dt, vz = (nz - pawnPos.z) / dt;
    pawnPos.x = nx;
    pawnPos.z = nz;
    if (Math.hypot(vx, vz) > 0.5) {
      atmos.splat(nx, nz, Math.max(-25, Math.min(25, vx * 0.35)), Math.max(-25, Math.min(25, vz * 0.35)), -0.15, 2.2, -0.65);
    }
    updateVision(snap);
  }

  function startWave(cx = 156.0, cz = 222.5, radius = 4.5, durMs = 1400) {
    waveAnim = { t0: performance.now(), dur: durMs, cx, cz, radius, lastX: null, lastZ: null };
  }

  function startWalk() {
    if (!active) return;
    if (!doorOpen) setDoorOpen(true);
    walkAnim = { t0: performance.now(), dur: 3600, x0: 141.0, z0: 222.5, x1: 158.0, z1: 222.5 };
  }

  // ---- UI bindings
  onCheck.addEventListener('change', () => setActive(onCheck.checked));
  $('#fx-fogwar-scene').addEventListener('click', buildScene);
  $('#fx-fogwar-door').addEventListener('click', () => { if (!active) setActive(true); setDoorOpen(!doorOpen); });
  $('#fx-fogwar-reset-mem').addEventListener('click', () => { if (!active) setActive(true); doorOpen = false; westDoorOpen = false; pawnPos.x = 141.0; pawnPos.z = 222.5; syncDoorVisuals(); resetMemory(true); atmos.warm(60); });
  $('#fx-fogwar-walk').addEventListener('click', startWalk);
  $('#fx-fogwar-move-mode').addEventListener('click', () => {
    moveMode = !moveMode;
    $('#fx-fogwar-move-mode').classList.toggle('primary', moveMode);
    toast(moveMode ? 'Move pawn on: click or drag on the floor to walk the pawn' : 'Move pawn off');
  });
  $('#fx-fogwar-wave').addEventListener('click', () => { if (!active) setActive(true); startWave(); });
  $('#fx-fogwar-cam-high').addEventListener('click', () => setCameraView('high'));
  $('#fx-fogwar-cam-door').addEventListener('click', () => setCameraView('door'));
  $('#fx-fogwar-cam-low').addEventListener('click', () => setCameraView('low'));
  $('#fx-fogwar-cam-veil').addEventListener('click', () => setCameraView('veil'));

  $('#fx-fogwar-dark').addEventListener('change', (e) => setDark(e.target.checked));
  lowCheck.addEventListener('change', () => {
    const low = lowCheck.checked;
    atmos.setOff(low);
    fogwar.setDecorative(!low);
    const lOn = document.querySelector('#fx-lighting-on');
    if (lOn && lOn.checked === low) {
      lighting.params.on = !low;
      lOn.checked = !low;
      lighting.apply();
    }
  });

  const self = {
    frame(now) {
      if (active && darkMode) { if (darkKeyOf() !== darkKey) updateDark(false); } // a Light reach slider moved: redraw the field
      else if (active && now - (knownT || 0) > 500) { knownT = now; fogwar.setKnown(knownWalls()); } // (walls arrive animated: recheck twice a second)
      if (walkAnim) {
        const u = (now - walkAnim.t0) / walkAnim.dur;
        if (u >= 1) {
          movePawnTo(walkAnim.x0, walkAnim.z0);
          walkAnim = null;
        } else {
          const s = u < 0.5 ? (u * 2) : (2 - u * 2);
          const ease = s * s * (3 - 2 * s);
          movePawnTo(walkAnim.x0 + (walkAnim.x1 - walkAnim.x0) * ease, walkAnim.z0 + (walkAnim.z1 - walkAnim.z0) * ease);
        }
      }
      if (waveAnim) {
        const u = (now - waveAnim.t0) / waveAnim.dur;
        if (u >= 1) {
          waveAnim = null;
        } else {
          const ang = u * Math.PI * 4;
          const wx = waveAnim.cx + Math.cos(ang) * waveAnim.radius;
          const wz = waveAnim.cz + Math.sin(ang * 2) * (waveAnim.radius * 0.65);
          if (waveAnim.lastX != null) {
            const vx = (wx - waveAnim.lastX) * 35, vz = (wz - waveAnim.lastZ) * 35;
            atmos.splat(wx, wz, vx, vz, -0.35, 3.0, -1.35);
          }
          waveAnim.lastX = wx;
          waveAnim.lastZ = wz;
        }
      }
    },
    buildScene,
    setActive,
    setDoorOpen,
    isDoorOpen: () => doorOpen,
    setWestDoorOpen(open, snap = false) { westDoorOpen = !!open; updateVision(snap); },
    resetMemory,
    movePawnTo,
    pawnPos: () => ({ ...pawnPos }),
    doorSpan: () => [...doorSpan],
    setCameraView,
    startWave,
    startWalk,
    setDark, isDark: () => darkMode, fieldLights: () => FIELD_LIGHTS.map(L => ({ ...L, radius: reachTable(fogwar.params)[L.kind] })), fieldPawn: () => ({ ...FIELD_PAWN }),
    // (tests) is this point seen in the dark preview's field
    fieldSeen: (x, z) => { const i = Math.floor((x - FIELD[0]) / FCELL), j = Math.floor((z - FIELD[1]) / FCELL); return i >= 0 && j >= 0 && i < FW && j < FD && !!fieldSeen[j * FW + i]; },
    setLowMode(low) { lowCheck.checked = !!low; lowCheck.dispatchEvent(new Event('change')); },
    extras: () => extras,
    isReady: () => sceneReady,
    testObjects: () => ({ viewerPawn, unseenPawn, unseenBeacon, unseenWall, farMount, farWall, fixtureWall, fixtureOuter }),
    knownWalls: () => knownWalls(),
    // tests: draw (and light) one culled thing anyway, to prove the fog ignores a fire in a room nobody has seen
    forceShow: (it, on = true) => { it.group.userData.fogForce = !!on; if (on) { it.group.userData.fogHidden = false; it.group.visible = true; } else updateVision(); },
  };
  return self;
}
