// First-visit pantomime (Harry 2026-10-03): a page can't move the real pointer, so a GHOST cursor (the LLM seats'
// look: a turning open ring, a name tag) acts the first build out. It is a PHANTOM SEAT: a real, scripted seat
// ("Intro", made like any agent seat) with its own cursor in the world. On screen its ghost opens Build, picks
// Fantasy → Tavern & inn → Common room (the menus fly out, the cursor changes) and drags a room out on the grid; the
// room itself is the phantom's own room.spawn through the relay's front door (the GET API every agent uses), so it
// arrives like anyone else's change: with the full spawn animation, and with the GM's floating undo chip beside it
// (one click removes it; surfaces/undochips.js). Then it hands over: "Press B to build", and the phantom leaves.
//   - only on a building seat's first visit (remembered per campaign and seat), never again unless replayed;
//   - ANY real input (a key, a click, the wheel) stops it at once, leaving whatever was already done;
//   - "Replay intro" lives in the bar and in the ? sheet (help.intro).
import { newId } from '../core/ids.js';

const COLOR = '#b48cff';

export function createIntro(app) {
  const I = { state: 'idle', steps: [] };
  const key = () => `tw.intro.${app.sync.campaign?.id}.${app.me()}`;
  const seen = () => { try { return !!localStorage.getItem(key()); } catch { return true; } };
  const mark = () => { try { localStorage.setItem(key(), String(Date.now())); } catch { } };
  let ghost = null, abort = null, pos = [innerWidth / 2, innerHeight / 2], phantom = null;
  const api = (path) => fetch(`${app.relayBase}/c/${app.sync.campaign.id}/a/${app.area()}/${path}${path.includes('?') ? '&' : '?'}seat=${phantom.token}`).then(r => r.json()).catch(() => null);

  function show() {
    ghost = document.createElement('div');
    ghost.id = 'introGhost';
    ghost.innerHTML = `<svg width="28" height="28" viewBox="0 0 28 28"><path d="M4 3 L4 22 L9.5 17 L13 25 L16.5 23.5 L13 15.8 L20.5 15.5 Z" fill="${COLOR}" stroke="#1b1426" stroke-width="1.6" stroke-linejoin="round"/></svg><span class="ig-ring"></span><span class="ig-tag">Intro · a guest seat showing you around <kbd>any key</kbd> stops it</span>`;
    document.body.append(ghost); place();
  }
  const place = () => { if (ghost) ghost.style.transform = `translate(${pos[0]}px, ${pos[1]}px)`; };
  const sleep = (ms) => new Promise((res, rej) => { const t = setTimeout(res, ms); abort = () => { clearTimeout(t); rej(new Error('interrupted')); }; });
  async function moveTo(x, y, ms = 700) {
    const [x0, y0] = pos, t0 = performance.now();
    while (true) {
      const k = Math.min(1, (performance.now() - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      pos = [x0 + (x - x0) * e, y0 + (y - y0) * e]; place();
      if (k >= 1) return;
      await sleep(16);
    }
  }
  async function click(el) { ghost.classList.remove('tap'); void ghost.offsetWidth; ghost.classList.add('tap'); await sleep(260); el?.click?.(); I.steps.push(el?.dataset?.id || el?.dataset?.l || 'click'); }
  const center = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  async function tile(id) {
    const el = await until(() => document.querySelector(`#buildMenu .btile[data-id="${id}"]`), 3000);
    el.scrollIntoView({ block: 'nearest' });
    await moveTo(...center(el), 650); await click(el); await sleep(550);
  }
  async function until(fn, ms) { const t0 = performance.now(); for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > ms) throw new Error('intro: missing ' + fn); await sleep(60); } }

  I.run = async ({ force = false } = {}) => {
    if (I.state === 'running') return;
    if (!force && (seen() || !app.can('room'))) return;
    I.state = 'running'; I.steps = []; mark();
    const before = app.build.current(); // an interrupted intro gives the Build menu back as it was (sticky)
    const stop = (ev) => { if (ev.isTrusted && I.state === 'running') { I.state = 'interrupted'; abort?.(); } };
    const evs = ['pointerdown', 'keydown', 'wheel'];
    for (const e of evs) addEventListener(e, stop, true);
    try {
      pos = [innerWidth * 0.55, innerHeight * 0.55]; show();
      // the phantom: a real seat (an agent seat of this GM, allowed rooms only), with its own cursor in the world
      const pid = newId('seat');
      const token = await app.createSeat({ id: pid, kind: 'llm', name: 'Intro', color: COLOR, scope: { areas: '*', classes: ['room'] } });
      if (!token) throw new Error('intro: no phantom seat');
      phantom = { token, id: pid };
      app.pv.hidden.add(pid); // its cursor in the world is NOT drawn on this screen: the ghost above is that cursor here (the world one, the relay's ghost for an AI seat, eases slowly toward what the seat last looked at: a second turning ring trailing seconds behind, Harry 2026-10-11). Other seats still see it.
      I.phantom = phantom;
      await sleep(400);
      const X = app.taxonomy, room = demoRoom();
      const path = X.pathOf(room.id);
      // 1. open Build from the launcher
      const launcher = document.querySelector('.launcher[data-l="build"]');
      await moveTo(...center(launcher), 800);
      app.build.reset?.(); await click(launcher); await sleep(500);
      // 2. Fantasy → Tavern & inn → Common room: the menus fly out, the cursor turns into the tools
      for (const id of path) await tile(id);
      await sleep(400);
      app.build.close();
      // 3. drag out a room on the grid, where there is room for one, through the room tool's own handlers
      const spot = freeSpot(room.cells || [6, 4]);
      const seed = I.planned && !I.planned.used ? I.planned.seed : Math.floor(Math.random() * 1e6); if (I.planned) I.planned.used = true; // (the first run builds the room the loading screen fetched the pieces of)
      const a = app.screenOf(spot.x * 5 + 0.5, spot.z * 5 + 0.5), b = app.screenOf((spot.x + spot.w) * 5 - 0.5, (spot.z + spot.d) * 5 - 0.5);
      await moveTo(a.x, a.y, 800);
      ghost.classList.add('down');
      app.modes.roomDown([spot.x * 5 + 0.5, spot.z * 5 + 0.5]); // the room tool's own rectangle, on the GM's screen
      api(`look?x=${spot.x * 5}&z=${spot.z * 5}&r=1`); // and the phantom's cursor in the world, through the agent API
      for (let i = 1; i <= 24; i++) {
        const k = i / 24, x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k; pos = [x, y]; place();
        const g = [spot.x * 5 + 0.5 + ((spot.x + spot.w) * 5 - 1 - spot.x * 5) * k, spot.z * 5 + 0.5 + ((spot.z + spot.d) * 5 - 1 - spot.z * 5) * k];
        app.modes.roomMove(g, { clientX: x, clientY: y });
        if (i % 8 === 0) api(`look?x=${g[0].toFixed(1)}&z=${g[1].toFixed(1)}&r=1`);
        await sleep(40);
      }
      // release: the PHANTOM builds it (the relay solves the room), not the GM's tool
      if (app.mode?.kind === 'room') app.modes.cancel();
      ghost.classList.remove('down');
      const rid = `room_intro${Math.random().toString(36).slice(2, 8)}`;
      const r = await api(`do?cmd=room.spawn&id=${rid}&type=${room.roomKey}&cx=${spot.x}&cz=${spot.z}&cw=${spot.w}&cd=${spot.d}&seed=${seed}&nonce=intro-${rid}`);
      if (!r?.ok) throw new Error(`intro: the phantom could not build (${r?.why})`);
      I.steps.push('room'); I.room = rid;
      await sleep(2600);
      // 4. hand over
      I.state = 'done';
    } catch (e) {
      if (I.state !== 'interrupted') { I.state = 'failed'; console.warn('intro', e); }
      if (before.length) app.build.restore?.(before);
      app.build.close?.();
      if (app.mode?.kind === 'room' && app.mode.start) app.modes.cancel();
    } finally {
      for (const e of evs) removeEventListener(e, stop, true);
      // the phantom leaves (its room stays, with the GM's undo chip beside it)
      if (phantom?.id) { const id = phantom.id; setTimeout(() => app.revokeSeat(id), 1500); }
      ghost?.classList.add('bye'); const g = ghost; ghost = null; setTimeout(() => g?.remove(), 400);
      if (I.state === 'done' || I.state === 'interrupted') hint();
    }
  };
  const demoRoom = () => app.taxonomy.get('r:TAV:common') || [...app.taxonomy.nodes.values()].find(n => n.level === 'room');
  // THE ROOM THE INTRO WILL BUILD, decided before it plays (main.js "the hold": the loading screen fetches its pieces, so
  // the room arrives whole the moment the phantom lets go). null where the intro will not play by itself.
  I.plan = () => {
    if (I.planned) return I.planned;
    if (seen() || !app.can('room') || !app.main) return null;
    const room = demoRoom(); if (!room) return null;
    return I.planned = { type: room.roomKey, ...freeSpot(room.cells || [6, 4]), seed: Math.floor(Math.random() * 1e6), used: false };
  };
  function hint() {
    const h = document.getElementById('introHint');
    const pad = app.trackpad || /Mac/.test(navigator.platform); // a Mac is most likely a trackpad: say how to move
    h.innerHTML = `Press <kbd>B</kbd> to build · <kbd>/</kbd> for anything else${pad ? `<br><span class="pad">Two fingers pan · pinch zooms · <kbd>⌥</kbd> + two fingers orbits · <kbd>?</kbd> for more</span>` : ''}`;
    h.hidden = false; h.classList.add('show');
    setTimeout(() => { h.classList.remove('show'); setTimeout(() => { h.hidden = true; }, 400); }, pad ? 10000 : 6000);
  }
  // free cells for the demo room near the middle of the view (rooms must not overlap)
  function freeSpot([w, d]) {
    const g = app.main.grab.focus, cx = Math.round(g.x / 5 - w / 2), cz = Math.round(g.z / 5 - d / 2);
    const rooms = Object.values(app.entities()).filter(e => e.kind === 'room').map(e => e.recipe);
    const clash = (x, z) => rooms.some(r => x < r.x + r.w + 1 && r.x < x + w + 1 && z < r.z + r.d + 1 && r.z < z + d + 1);
    for (let rad = 0; rad < 30; rad++) for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== rad) continue;
      if (!clash(cx + dx, cz + dz)) return { x: cx + dx, z: cz + dz, w, d };
    }
    return { x: cx, z: cz + 40, w, d };
  }
  I.info = () => ({ state: I.state, steps: I.steps, seen: seen() });
  return I;
}
