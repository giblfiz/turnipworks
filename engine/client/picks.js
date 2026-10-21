// A command-bar multi-pick is a transient tool. Every preview member becomes an operation
// in ONE existing batch, so mixed figures/furniture share relay visibility and one undo.
import * as THREE from 'three';
import { newId } from '../core/ids.js';
import { pawnPoint, pawnCells, pawnLabel } from './pawns.js';
import { paintOps } from './tiles.js';
import * as ST from '../core/stairs.js';

const round = n => Math.round(n * 100) / 100;
// Sorted once: all pointer moves use the same nearest-first candidate lattice.
const candidates = [];
for (let x = -20; x <= 20; x++) for (let z = -20; z <= 20; z++) candidates.push([x, z]);
candidates.sort((a,b) => a[0] ** 2 + a[1] ** 2 - b[0] ** 2 - b[1] ** 2 || Math.atan2(a[1],a[0]) - Math.atan2(b[1],b[0]));
export function installPicks(app) {
  const F = app.assets.figures, label = document.getElementById('modeLabel');
  let ghost = null;
  const rayCamera = new THREE.PerspectiveCamera(); // surface raycasts may encounter a hidden-object label sprite
  const world = () => app.worldOf(app.area());
  // A placement preview must stay legible even in a dark area. Keep its texture and
  // shaded form, with a little self-light; cell highlights must never paint over it.
  const fade = g => g.traverse(o => {
    if (!o.isMesh) return;
    o.material = o.material.clone(); o.material.transparent = true;
    o.material.opacity = o.userData.pawnBase ? .6 : .8; o.material.depthWrite = false;
    if (o.material.emissive && !o.userData.pawnBase) {
      o.material.emissive.copy(o.material.color); o.material.emissiveMap = o.material.map;
      o.material.emissiveIntensity = Math.max(.65, o.material.emissiveIntensity || 0);
    }
    o.renderOrder = 26; o.userData.noPick = true;
  });
  const cells = (x, z, w, d) => {
    const out = [];
    for (let gx = Math.floor((x - w / 2 + .001) / 5); gx <= Math.floor((x + w / 2 - .001) / 5); gx++)
      for (let gz = Math.floor((z - d / 2 + .001) / 5); gz <= Math.floor((z + d / 2 - .001) / 5); gz++) out.push([gx, gz]);
    return out;
  };
  const footprint = (e, x = e.x, z = e.z, rot = e.rot || 0) => {
    if (e.kind === 'pawn' || e.kind === 'token') return pawnCells(x, z, e.size || F.sizeOf(e));
    const dims = e.size?.dims || e.dims || [5, 1, 5], c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
    return cells(x, z, Math.max(.1, dims[0] * c + dims[2] * s), Math.max(.1, dims[0] * s + dims[2] * c));
  };
  const tool = app.pickTool = {
    start(items) {
      if (!items?.length) return false;
      if (items.some(i => !app.can(i.kind === 'pawn' ? 'token.edit' : 'object'))) { app.toast('You cannot place these things here', true); return false; }
      const members = [];
      for (const item of items) {
        const f = item.kind === 'pawn' ? (typeof item.fig === 'string' ? F.get(item.fig) : item.fig) : null;
        const size = item.kind === 'pawn' ? f?.size || 1 : app.modes.fitted(item.cat, app.roomgen.sizeOf(item.cat.id, item.cat.sku));
        if (!size) { app.toast(`No usable mesh for ${item.cat.name}`, true); return false; }
        for (let i = 0; i < Math.max(1, Math.min(30, item.count | 0)); i++) members.push({ ...item, fig: f, size });
      }
      if (items.some(i => i.count > 30)) app.toast('30 per picked row is the most', true);
      app.modes.cancel();
      app.mode = { kind: 'place', pick: { members }, cat: { place: 'pick', name: `${members.length} picked` }, rot: 0, tool: false };
      const group = ghost = new THREE.Group(); group.visible = false; world().layers.deco.add(group);
      for (const m of members) {
        const holder = new THREE.Group(); group.add(holder); m.ghost = holder;
        if (m.kind === 'pawn') {
          const v = m.fig && F.pawnVisual({ fig: m.fig.id, size: m.size }, { color: app.myColor(), onReady: g => { if (ghost === group) fade(g); } }) || world().tokenMesh({ color: app.myColor() });
          holder.add(v); fade(v);
        } else {
          const stand = app.assets.placeholder(m.size.dims); holder.add(stand); fade(stand);
          app.assets.visualFor({ ...m.size, cat: m.cat.id, place: m.cat.place }).then(v => { if (!v || ghost !== group) return; holder.remove(stand); holder.add(v); fade(v); }).catch(() => {});
        }
      }
      app.refresh(); return true;
    },
    clear() { ghost?.parent?.remove(ghost); ghost = null; app.worlds.get(app.area())?.clearCells('pick-tool'); },
    plan(ground, ev) {
      const mode = app.mode, members = mode?.pick?.members;
      if (!ground || !members) return null;
      const y = ground.y || 0, busy = new Set(), key = c => c.join(':');
      for (const e of Object.values(app.entities())) if ((e.kind === 'token' || e.kind === 'object') && e.place !== 'tile' && Math.abs((e.y || 0) - y) < 5) for (const c of footprint(e)) busy.add(key(c));
      const free = !!mode.viaDrag && !app.pawnSnaps(!!ev?.shiftKey), anchorX = pawnPoint(ground[0]), anchorZ = pawnPoint(ground[1]);
      const dx = free ? ground[0] - anchorX : 0, dz = free ? ground[1] - anchorZ : 0;
      const result = [];
      for (const m of members) {
        let found = null;
        for (const [cx, cz] of candidates) {
          let x = anchorX + cx * 5, z = anchorZ + cz * 5, p;
          if (m.kind === 'pawn') p = { x: pawnPoint(x, m.size) + dx, z: pawnPoint(z, m.size) + dz, y, rot: mode.rot };
          else {
            x += dx; z += dz;
            const g = [x,z]; g.y = y;
            const ray = new THREE.Raycaster(new THREE.Vector3(x,y + 100,z), new THREE.Vector3(0,-1,0));
            ray.camera = rayCamera;
            p = app.modes.placementAt(m.cat,m.size,ray,g,{ rot: mode.rot, alt: ev?.altKey, free: !!mode.viaDrag && !!ev?.shiftKey });
          }
          if (!p) continue;
          const occupied = footprint(m,p.x,p.z,p.rot);
          if (occupied.some(c => busy.has(key(c)))) continue;
          occupied.forEach(c => busy.add(key(c))); found = { m, p, cells: occupied }; break;
        }
        if (!found) return null; // Never silently discard a member of the pick.
        result.push(found);
      }
      return result;
    },
    hover(ray, ground, ev) {
      const plan = tool.plan(ground,ev); if (!ghost) return;
      ghost.visible = !!plan;
      if (!plan) { world().clearCells('pick-tool'); label.hidden = true; return; }
      for (const { m,p } of plan) { m.ghost.position.set(p.x,p.y,p.z); m.ghost.rotation.y = p.rot; }
      world().showCells('pick-tool',{ lit: plan.flatMap(x => x.cells),dim: [],color: app.myColor(),y: ground.y || 0,opacity: .15 });
      if (ev) {
        label.hidden = false; label.classList.remove('bad'); label.textContent = `${plan.length} picked · ${app.mode.viaDrag ? 'let go to place' : 'click to place'} · R turns`;
        // Put the one hint outside the projected cluster, including its outer bases.
        const bounds = plan.flatMap(({ m,p,cells }) => cells.flatMap(([x,z]) => [0,5].flatMap(dx => [0,5].flatMap(dz => [p.y,p.y + (m.kind === 'pawn' ? (m.fig?.oh || 6) * F.scale() : m.size.dims[1])].map(y => app.screenOf(x * 5 + dx,z * 5 + dz,app.main,y))))));
        const bottom = Math.max(...bounds.map(p => p.y)), top = Math.min(...bounds.map(p => p.y));
        const left = Math.min(...bounds.map(p => p.x)), width = label.offsetWidth, height = label.offsetHeight;
        label.style.left = `${Math.max(8,Math.min(innerWidth - width - 8,left))}px`;
        label.style.top = `${Math.max(8,Math.min(innerHeight - height - 8,bottom + height + 20 < innerHeight ? bottom + 12 : top - height - 12))}px`;
      }
    },
    placeAt(ray,ground,ev) {
      const plan = tool.plan(ground,ev); if (!plan) { app.toast('No free cluster here',true); return false; }
      const totals = new Map(), names = new Map(), ops = [], ids = [];
      for (const {m} of plan) if (m.kind === 'pawn') { const b = pawnLabel(m.fig); totals.set(b,(totals.get(b) || 0) + 1); }
      for (const [b,n] of totals) names.set(b,app.pawnNames(b,n));
      for (const {m,p} of plan) {
        if (m.kind === 'pawn') {
          const id = newId('tok'); ids.push(id);
          ops.push({ type: 'token.create',args: { id,name: names.get(pawnLabel(m.fig)).shift(),x: round(p.x),z: round(p.z),...(p.y && {y: round(p.y)}),rot: round(p.rot),color: app.myColor(),...(m.fig && {fig: m.fig.id}),...(m.size > 1 && {size: m.size}) } });
        } else if (m.cat.place === 'tile') {
          const tileOps = paintOps(app,m.cat.id,[p.cell],{size:m.size,y:p.y}); ops.push(...tileOps); ids.push(...tileOps.filter(o => o.type === 'object.place').map(o => o.args.id));
        } else {
          const id = newId('obj'), s = m.size; ids.push(id);
          ops.push(app.modes.edgeTaken(p.edge),{type:'object.place',args:{id,name:m.cat.name,...(m.cat.id.startsWith('flavor-') && {flavor:app.lib.objects[m.cat.id]?.skus.find(k => k.sku === s.sku)?.shape}),cat:m.cat.id,sku:s.sku,url:s.url,flat:s.flat || undefined,place:m.cat.place,layer:m.cat.place === 'kit' && !ST.STAIR_ROLES[m.cat.id] ? (/^door-/.test(m.cat.id) ? 'openings' : 'walls') : 'furnish',x:p.x,y:p.y,z:p.z,rot:p.rot,yaw:s.yaw,s:s.s || undefined,dims:s.dims,parent:p.parent || undefined,room:p.room || undefined}});
        }
      }
      app.batch(ops); app.select(ids); app.lastPick = {ids,count:plan.length};
      if (app.mode.viaDrag || !ev?.shiftKey) app.modes.cancel();
      return true;
    },
  };
  app.dragPickOut = (ev,items,{onStart,onEnd} = {}) => app.dragOut(ev,{
    begin: () => { if (!tool.start(items)) return false; app.mode.viaDrag = true; onStart?.(); },
    move: (e,over) => { const g = over ? app.groundAt(e.clientX,e.clientY) : null; app.cursor = g; tool.hover(null,g,e); },
    drop: e => tool.placeAt(null,app.groundAt(e.clientX,e.clientY),e),
    key: (e,last) => { if (e.key.toLowerCase() !== 'r' || e.ctrlKey || e.metaKey || e.altKey || !app.mode?.pick) return false; app.mode.rot += (e.shiftKey ? -1 : 1) * Math.PI / 4; if (last) tool.hover(null,app.groundAt(last[0],last[1]),{clientX:last[0],clientY:last[1],shiftKey:last[2]}); return true; },
    end: done => { if (app.mode?.pick) app.modes.cancel(); label.hidden = true; onEnd?.(done); },
  });
}
