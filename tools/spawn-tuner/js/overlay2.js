// v2 bench overlays (Cliff's plan-drawing, in 3D): walking paths in yellow, zone outlines + labels, command sight lines
// from the main door to each primary spot (green = door in view, red = not), and a red room outline on purposeFail.
import * as THREE from 'three';

const Y = 0.14;
const mat = (color, opacity = 1) => new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest: false });
const line = (pts, m) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, Y, z))), m); l.renderOrder = 20; return l; };

function label(text, color = '#f1e8d6') {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = '600 36px "DM Mono", monospace';
  c.width = Math.ceil(g.measureText(text).width) + 20; c.height = 52;
  g.font = '600 36px "DM Mono", monospace';
  g.fillStyle = 'rgba(20,21,16,0.75)'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, 10, 26);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const h = 0.9; s.scale.set(h * c.width / c.height, h, 1); s.renderOrder = 21;
  return s;
}

// layout: a v2 layout; rect: room rect {x0,z0,x1,z1}; opts: {paths, zones, sight}
export function buildOverlay(layout, rect, opts = { paths: true, zones: true, sight: true }) {
  const g = new THREE.Group();
  if (!layout || layout.engine !== 'v2') return g;
  if (opts.paths) for (const p of layout.paths || []) {
    if (p.pts.length < 2) continue;
    g.add(line(p.pts, mat(p.ok ? '#ffd23f' : '#ff5a3c')));
    const mid = p.pts[Math.floor(p.pts.length / 2)];
    const s = label(`${p.kind}${p.ok ? '' : ' ✗'}`, p.ok ? '#ffd23f' : '#ff5a3c'); s.position.set(mid[0], 1.2, mid[1]); g.add(s);
  }
  if (opts.zones) for (const z of layout.zones || []) {
    const [x0, z0, x1, z1] = z.rect;
    g.add(line([[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]], mat('#6fd0c0', 0.9)));
    const s = label(z.label, '#6fd0c0'); s.position.set((x0 + x1) / 2, 0.8, (z0 + z1) / 2); g.add(s);
  }
  if (opts.sight && layout.mainDoor) {
    const d = layout.mainDoor.inner;
    for (const c of layout.checks?.command || []) {
      const p = layout.placements.find(q => q.uid === c.uid); if (!p) continue;
      g.add(line([d, [p.x, p.z]], mat(c.doorView ? '#5fd35f' : '#ff5a3c', 0.85)));
      const s = label(`${c.label}: ${['tortoise', 'phoenix', 'flanks', 'doorView'].map(k => c[k] === null ? '–' : c[k] ? '✓' : '✗').join('')}`, c.score >= 0.75 ? '#5fd35f' : '#ffb35c');
      s.position.set(p.x, 2.2 + p.dims[1], p.z); g.add(s);
    }
  }
  if (layout.yard?.gateAt && opts.paths) { // outdoors: where the yard's path leaves (no wall, so no gate piece yet)
    const [x, z] = layout.yard.gateAt, h = layout.yard.gate === 'N' || layout.yard.gate === 'S';
    g.add(line(h ? [[x - 2.5, z], [x + 2.5, z]] : [[x, z - 2.5], [x, z + 2.5]], mat('#5fd35f')));
    const s = label('gate', '#5fd35f'); s.position.set(x, 1.2, z); g.add(s);
  }
  if (layout.purposeFail) {
    const o = 0.3, r = rect;
    const l = line([[r.x0 + o, r.z0 + o], [r.x1 - o, r.z0 + o], [r.x1 - o, r.z1 - o], [r.x0 + o, r.z1 - o], [r.x0 + o, r.z0 + o]], new THREE.LineBasicMaterial({ color: '#ff3b30', depthTest: false }));
    g.add(l);
    const s = label(`PURPOSE FAIL: ${layout.purposeFail}`, '#ff3b30'); s.position.set((r.x0 + r.x1) / 2, 4, (r.z0 + r.z1) / 2); g.add(s);
  }
  return g;
}
