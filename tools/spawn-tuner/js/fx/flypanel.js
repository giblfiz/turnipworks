// The Fly-away panel's tools (Spawn Tuner only; the dials, presets, Send and "Use in game" come from fx/index.js's
// generic panel). The tuner has no storeys, so a DEMO stands in: every second room is lifted
// one storey (the "upstairs"), and "Cut" sends those rooms away and brings them back with the look on screen.
// The demo only moves the drawn pieces; the rooms, their layouts and what gets sent are untouched.
const STOREY = 10;

export function mountFlyTools({ fly, panel, items = () => [], camera = null, focus = () => null, toast = () => {}, onChange = () => {} }) {
  if (!panel) return null;
  const box = document.createElement('div'); box.className = 'fxFly';
  box.innerHTML = `
    <label class="check"><input type="checkbox" id="fx-fly-on"> Fly-away on (off = levels just vanish, as before)</label>
    <div class="row"><button id="fx-fly-demo" title="lifts every second room by one storey, so there is an upstairs to send away">Demo: two levels</button><button id="fx-fly-cut" class="primary" title="what the game does when the cut drops below the upper level, and again when it rises">Cut: send the upper level away</button></div>
    <div class="muted small">Draw two or more rooms, press Demo, then Cut and Cut again. In the game the pieces leave outward from where you double-clicked; here, from the middle of the view.</div>
    <div id="fx-fly-state" class="muted small"></div>`;
  panel.insertBefore(box, panel.querySelector('#fx-cutfly-dials'));
  const $ = (s) => box.querySelector(s);
  const on = $('#fx-fly-on'), state = $('#fx-fly-state');
  on.checked = fly.params.on !== false;
  on.addEventListener('change', () => { fly.params.on = on.checked; onChange(); });

  let demo = false, away = false, pollT = -1e9, seen = null;
  // the upstairs: every second room, with its walls. The tuner gives a wall or post on a room's edge to whichever room
  // was drawn first, so a piece counts as upstairs when it stands on an upstairs room's outline and on no other room's.
  const C = 5, inside = (r, x, z) => x >= r.x * C - 0.6 && x <= (r.x + r.w) * C + 0.6 && z >= r.z * C - 0.6 && z <= (r.z + r.d) * C + 0.6;
  const upRooms = () => {
    const rooms = window.tuner?.rooms?.() || [], up = rooms.filter((_, i) => i % 2 === 1), down = rooms.filter((_, i) => i % 2 === 0), ids = new Set(up.map(r => r.id));
    return { size: ids.size, has: (id, it) => ids.has(id) || (!!it && (it.layer === 'walls' || it.layer === 'openings') && up.some(r => inside(r, it.x, it.z)) && !down.some(r => inside(r, it.x, it.z))) };
  };
  const lift = (it, dy) => { it.rest.y += dy; it.group.position.y += dy; it._flyLift = (it._flyLift || 0) + dy; };
  function applyDemo() {
    const up = demo ? upRooms() : new Set(); let n = 0;
    for (const it of items()) {
      if (!it?.rest || !it.group || fly.has(it.group.uuid)) continue;
      const want = up.has(it.roomId, it) ? STOREY : 0, has = it._flyLift || 0;
      if (want !== has) { lift(it, want - has); n++; }
      if (demo && away && up.has(it.roomId, it) && it.group.visible) it.group.visible = false; // drawn while the level is away: it is away too
    }
    return { rooms: up.size, moved: n };
  }
  function setDemo(v) {
    if (!!v === demo) return; fly.flush();
    if (!v && away) { for (const it of items()) if (it._flyHid) { it.group.visible = true; it._flyHid = false; } away = false; }
    demo = !!v; const r = applyDemo();
    $('#fx-fly-demo').textContent = demo ? 'Demo: put the rooms back' : 'Demo: two levels';
    $('#fx-fly-cut').textContent = 'Cut: send the upper level away';
    toast(demo ? (r.rooms ? `fly-away demo: ${r.rooms} room${r.rooms === 1 ? '' : 's'} lifted 10 ft` : 'fly-away demo: draw at least two rooms (every second room is lifted)') : 'fly-away demo off: rooms back on the ground', demo && !r.rooms);
  }
  function cut(v = !away) {
    if (!demo) setDemo(true);
    const up = upRooms(), dir = v ? 1 : -1, f = focus(), pieces = [];
    away = !!v;
    for (const it of items()) {
      if (!it?.group || !up.has(it.roomId, it)) continue;
      const g = it.group;
      if (dir < 0) { g.visible = true; it._flyHid = false; }
      else if (!g.visible && !fly.has(g.uuid)) continue;
      pieces.push({ key: g.uuid, obj: g, x: g.position.x, z: g.position.z, room: it.roomId, onEnd: (d) => { if (d > 0) { g.visible = false; it._flyHid = true; } } });
    }
    $('#fx-fly-cut').textContent = away ? 'Cut: bring the upper level back' : 'Cut: send the upper level away';
    if (!pieces.length) { toast('nothing upstairs: draw at least two rooms', true); return 0; }
    if (fly.params.on === false) { for (const p of pieces) p.onEnd(dir); return 0; }
    seen = { dir, n: pieces.length, at: performance.now(), ms: null };
    return fly.launch(pieces, dir, { origin: f ? [f.x, f.z] : null, scale: camera && f ? Math.max(1, camera.position.distanceTo(f) / 95) : 1 });
  }
  $('#fx-fly-demo').addEventListener('click', () => setDemo(!demo));
  $('#fx-fly-cut').addEventListener('click', () => cut());

  return {
    frame(now) {
      const active = fly.frame(now);
      if (seen && seen.ms == null && !active) seen.ms = Math.round(performance.now() - seen.at);
      if (now - pollT < 200) return; pollT = now;
      if (demo && !active) applyDemo(); // rooms drawn or re-rolled while the demo is on join it
      const s = fly.stats();
      state.textContent = `${fly.params.on === false ? 'off' : 'on'} · leaves in ${Math.round(s.fly_total_ms)} ms, back in ${Math.round(s.fly_back_ms)} ms${seen ? ` · last: ${seen.n} pieces ${seen.dir > 0 ? 'left' : 'came back'}${seen.ms != null ? ` in ${seen.ms} ms` : '…'}` : ''}${active ? ` · ${active} in flight` : ''}${demo ? ' · demo' : ''}`;
    },
    demo: (v) => { if (v !== undefined) setDemo(v); return demo; },
    cut, away: () => away, seen: () => seen && { ...seen },
    sync: () => { on.checked = fly.params.on !== false; },
  };
}
