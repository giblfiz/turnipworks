// SHOW LIGHT REACH (Harry 2026-10-21, on darkness in the Ring Lab: "a tiny one-candle lamp is doing like 40 foot circle,
// and maybe you are giving me vision between light sources and the pawn"). A GM-side view: every lit light's reach drawn
// on its floor as a faint disc with an outline, tinted by kind, so the GM can see which thing lights what.
//
//   "light reach" in the command bar  ·  Settings ▸ Me "Show light reach"  ·  tw.lightReach() / tw.setLightReach(on)
//
// THIS BROWSER ONLY (localStorage `tw.lightReach`, like the labels switch): nothing is sent, nothing is stored in the
// campaign. Only a GM-side seat has the command and the switch (a player's registry does not list it), and it goes off
// while this seat is not GM-side (the switch is kept for when it is again: a reload joins as a player for a moment).
//
// THE SAME NUMBERS AND SHAPES AS THE DARKNESS RULE. The lights and radii are the fog's own (app.fog.lightsOf: lit,
// unhidden, the GM's own lightRadius first, else the Fog of war look's table), and each disc is the light's own
// radius-limited visibility polygon over the same walls and shut doors (client/darksight.js radiusPolygon over
// vision.js blockingSegments), so a light behind a wall stops at the wall here as it does in the dark. Drawn for any
// area, dark or not (a lit room is what the switch is for), on levels the cut shows.
//
// CHEAP. Off: one test per frame. On: the lights are listed again only when the area's entities, the walls or the table
// change, and the discs are rebuilt only when that list changes; one mesh (vertex colours) for the fills and one line set
// per kind for the outlines.
import { radiusPolygon } from '../darksight.js';
import { blockingSegments } from '../vision.js';
import { visibleAt } from '../../core/height.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

// THE LOOK, in one place: a colour per kind of light (the tuner's dark preview uses the same: fx/lightreach.js)
export const REACH_LOOK = {
  colors: { candle: '#ffd36b', lamp: '#ff9a3c', lantern: '#ff5f8f', torch: '#ff4a2a', fire: '#c86bff', chandelier: '#4fd1ff', oven: '#8aff6b', glow: '#6b8bff' },
  fillOpacity: 0.12, lineWidth: 2, lineOpacity: 0.85, lift: 0.07, // ft over its floor
};
const KEY = 'tw.lightReach';

export function lightReachSurface(R, app) {
  const THREE = app.THREE;
  let on = false; try { on = localStorage.getItem(KEY) === 'on'; } catch { }
  const canvas = document.getElementById('c');
  const mats = new Map(); // kind -> LineMaterial
  const lineMat = (kind) => { if (!mats.has(kind)) mats.set(kind, new LineMaterial({ color: REACH_LOOK.colors[kind] || '#ffffff', linewidth: REACH_LOOK.lineWidth, transparent: true, opacity: REACH_LOOK.lineOpacity, depthWrite: false, toneMapped: false })); return mats.get(kind); };
  const fillMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: REACH_LOOK.fillOpacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide, toneMapped: false });
  const flat = (o, order) => { o.renderOrder = order; o.userData.halo = true; o.userData.noPick = true; o.userData.lightReach = true; o.raycast = () => {}; o.frustumCulled = false; return o; };
  let shown = null; // { area, w, group, sig, lights, E, edges, table }
  function clear() { if (!shown) return; shown.w.layers.deco.remove(shown.group); shown.group.traverse(o => o.geometry?.dispose()); shown = null; }
  function build(w, lights) {
    const group = new THREE.Group(); group.userData.lightReach = true;
    const E = w.view?.entities || {}, walls = new Map(), segsAt = (l) => { if (!walls.has(l)) walls.set(l, blockingSegments(w.edges || new Map(), E, l)); return walls.get(l); };
    const pos = [], col = [], lines = new Map(), c = new THREE.Color();
    for (const L of lights) {
      const poly = radiusPolygon([L.x, L.z], segsAt(L.level), L.radius); if (!poly || poly.length < 3) continue;
      const y = L.level + REACH_LOOK.lift; c.set(REACH_LOOK.colors[L.kind] || '#ffffff');
      // a light's visibility polygon is star-shaped round the light: a fan from its centre covers it exactly
      for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; pos.push(L.x, y, L.z, a[0], y, a[1], b[0], y, b[1]); for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b); }
      const seg = lines.get(L.kind) || []; lines.set(L.kind, seg);
      for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; seg.push(a[0], y + 0.01, a[1], b[0], y + 0.01, b[1]); }
    }
    if (pos.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); group.add(flat(new THREE.Mesh(g, fillMat), 26)); }
    for (const [kind, seg] of lines) { const g = new LineSegmentsGeometry(); g.setPositions(seg); const o = flat(new LineSegments2(g, lineMat(kind)), 27); o.userData.kind = kind; group.add(o); }
    w.layers.deco.add(group);
    return group;
  }
  app.on((what) => {
    if (what !== 'frame') return;
    if (!on) { if (shown) clear(); return; }
    if (!app.gm()) { clear(); return; } // not on the GM side (yet, or any more): nothing is drawn
    const area = app.area(), w = app.worlds.get(area);
    if (!w || w.local || !app.fog?.lightsOf) { clear(); return; }
    const E = w.view?.entities || {}, table = app.fog.lightTable?.(area), tkey = table ? Object.values(table).join(',') : '';
    if (shown && shown.area === area && shown.w === w && shown.E === E && shown.edges === w.edges && shown.tkey === tkey && shown.cut === w.cut) return;
    const lights = app.fog.lightsOf(area).filter(L => visibleAt(L.level, w.cut ?? null));
    const sig = JSON.stringify(lights) + '|' + (w.edges?.size || 0);
    if (shown && shown.area === area && shown.w === w && shown.sig === sig && shown.edges === w.edges) { Object.assign(shown, { E, tkey, cut: w.cut }); return; }
    clear();
    shown = { area, w, group: build(w, lights), sig, lights, E, edges: w.edges, tkey, cut: w.cut };
    app.gfx?.wake?.('lightReach');
  });
  app.on((what) => { if (what !== 'frame' || !mats.size || !canvas) return; for (const m of mats.values()) m.resolution.set(canvas.clientWidth, canvas.clientHeight); });
  app.lightReach = () => on && !!app.gm();
  app.setLightReach = (v, { quiet = false } = {}) => {
    if (!app.gm()) return false;
    v = !!v; if (v === on) return on;
    on = v; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { } if (!on) clear();
    if (!quiet) app.toast(on ? 'Light reach on: each lit light\'s reach on its floor, by kind (this browser only)' : 'Light reach off');
    app.refresh();
    return on;
  };
  // (tests) what is drawn: each light's kind, place and radius, and the outline sets by kind
  app.lightReachInfo = () => ({ on: app.lightReach(), area: shown?.area || null, lights: (shown?.lights || []).map(L => ({ id: L.id, kind: L.kind, radius: L.radius, x: L.x, z: L.z, level: L.level })), sets: shown ? shown.group.children.map(o => o.userData.kind || 'fill') : [], drawn: !!shown?.group?.parent });
  R.add({ id: 'view.lightReach', toggle: { of: () => [1], is: () => app.lightReach(), on: ['Light reach off', 'eye-off'], off: ['Show light reach: each light\'s reach on the floor', 'lightbulb'] }, short: 'Light reach', synonyms: ['light reach', 'show lights', 'light circles', 'what lights what', 'lit area', 'show light radius'], group: 'View', cls: (ctx) => ctx.gm ? true : null, run: () => app.setLightReach(!app.lightReach()) });
  return { name: 'lightReach' };
}
