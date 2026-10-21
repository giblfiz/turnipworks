// HOLD, TAP, PIN: how the three launchers' menus open and stay open (Harry 2026-10-06, docs/PAWNS.md "Opening":
// "you just have to hit the p button for a second, it's not that bad. We could also have a way to leave the menu open";
// then, of the three ways together, "hold tap and pin sound fine"). One rule for Pawns (P), Build (B) and Settings (S):
//   HOLD   hold the key: the menu is shown while the key is held, and goes when it is let go
//   TAP    tap the key (or click the launcher): the menu stays until the key is tapped again, Escape, or a click
//          outside it (the click outside is what each of them already did before this rule)
//   PIN    the pin in the menu's corner: the menu stays open while you work on the map. A click outside does not close
//          it and Escape passes it by (Escape is needed for the map's own tools). Its key, its launcher or its pin
//          closes it. A PINNED menu takes letter keys only while the pointer is over it: otherwise they are the game's.
// "Held" is HOLD_MS or longer, or any other key pressed or anything in the menu clicked while the key was down (so
// P+1 is "show, go to the first player's pawn, gone").
// One menu at a time, as before: opening one closes the others (a pinned one too; it is pinned again when it comes back).
import { icon } from '../icons.js';

export const HOLD_MS = 350;
// A DRIVEN BROWSER (the test suites) sends a key's release only after the page has finished with its press, and stamps
// it then: with the box busy, a "tap" arrives hundreds of milliseconds long (seen: both P and S read as holds while two
// other suites shared the GPU). A real keyboard's two events carry the times the key really moved. So under automation
// a hold is 1.5 s; the suite's hold checks wait for `tw.tray.holdMs`.
const AUTOMATION_HOLD_MS = 1500;
const KEYS = { p: 'pawns', b: 'build', s: 'settings' };
const CMD = { pawns: 'pawns.menu', build: 'build.menu', settings: 'settings.menu' };
const inField = (t) => t?.closest?.('input, textarea, select, [contenteditable]');

export function traySurface(R, app) {
  let pins = {}; try { pins = JSON.parse(localStorage.getItem('tw.traypin') || '{}') || {}; } catch { }
  const els = {}; // name -> () => the menu's element (for "is the pointer over it")
  let press = null; // { key, name, t, used }: a launcher key that is down and opened its menu
  const T = app.tray = {
    HOLD_MS, holdMs: navigator.webdriver ? AUTOMATION_HOLD_MS : HOLD_MS,
    register: (name, el) => { els[name] = el; },
    pinned: (name) => !!pins[name],
    setPin(name, on) { pins = { ...pins, [name]: !!on }; try { localStorage.setItem('tw.traypin', JSON.stringify(pins)); } catch { } app.emit('tray.pin', name); app.refresh(); },
    over: (name) => { const el = els[name]?.(); return !!el && !el.hidden && el.matches(':hover'); },
    // does this open menu own the letter keys right now? (a pinned one: only under the pointer)
    takesKeys: (name) => !!app[name]?.isOpen && (!pins[name] || T.over(name)),
    // an outside click or Escape: does it close this menu? (not a pinned one)
    dismissable: (name) => !pins[name],
    held: () => press?.name || null,
    // the pin button every menu carries in its corner
    pinButton: (name) => `<button class="tpin${pins[name] ? ' on' : ''}" data-pin="${name}" tabindex="-1" aria-pressed="${!!pins[name]}" data-tip="${pins[name] ? 'Pinned: stays open while you work. Click to unpin' : 'Pin: keep this open while you work on the map'}" aria-label="${pins[name] ? 'Unpin' : 'Pin open'}">${icon('pin', 15)}</button>`,
    wirePin(root) { for (const b of root.querySelectorAll('.tpin')) { b.onmousedown = (ev) => ev.preventDefault(); b.onclick = (ev) => { ev.stopPropagation(); T.setPin(b.dataset.pin, !pins[b.dataset.pin]); }; } },
    state: () => ({ pins: { ...pins }, held: press?.name || null, open: Object.values(KEYS).filter(n => app[n]?.isOpen) }),
  };

  addEventListener('keydown', (ev) => {
    if (press && ev.key.toLowerCase() !== press.key && !['Shift', 'Control', 'Alt', 'Meta'].includes(ev.key)) press.used = true;
    const key = ev.key.length === 1 ? ev.key.toLowerCase() : '', name = KEYS[key];
    if (!name || ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey || inField(ev.target) || app.chordState?.()) return;
    const menu = app[name], c = R.get(CMD[name]);
    if (!menu || !c || !R.permitted(c, R.ctx())) return;
    const stop = () => { ev.preventDefault(); ev.stopImmediatePropagation(); };
    if (press?.key === key) { stop(); return; } // the key's own auto-repeat while it is held
    // another open menu keeps the letter when it is an item of the list it is showing (in Build, P or S may be a room)
    for (const other of Object.values(KEYS)) if (other !== name && T.takesKeys(other) && app[other].ownsKey?.(key)) return;
    if (menu.isOpen) {
      if (ev.repeat) { stop(); return; }
      if (T.takesKeys(name) && menu.ownsKey?.(key)) return; // its own letter is an item of its list (Build ▸ … ▸ B…): the item wins, as before
      stop(); menu.close(); return; // TAP again: closed
    }
    if (ev.repeat) { stop(); return; }
    stop();
    const t0 = performance.now();
    R.run(c); // (through the registry: usage counts, and the same door as the bar's "Pawns…")
    // the EVENTS' own times, less the time opening the menu itself took: neither a busy frame nor a slow first draw
    // (Settings, with its pictures) between the two may turn a tap into a hold
    if (menu.isOpen) press = { key, name, t: ev.timeStamp + (performance.now() - t0), used: false };
  }, true);
  const release = (forced, at = performance.now()) => {
    if (!press) return;
    const p = press; press = null;
    const held = forced || p.used || at - p.t >= T.holdMs;
    T.last = { name: p.name, forced: !!forced, used: p.used, ms: Math.round(at - p.t), held }; // (tests)
    if (held && app[p.name]?.isOpen && !pins[p.name]) { app[p.name].close(); app.emit('tray.released', p.name); }
  };
  addEventListener('keyup', (ev) => { if (press && ev.key.toLowerCase() === press.key) release(false, ev.timeStamp); }, true);
  addEventListener('blur', () => release(true));
  // a click inside the menu while its key is held counts as use
  addEventListener('pointerdown', (ev) => { if (press && els[press.name]?.()?.contains(ev.target)) press.used = true; }, true);

  // ONE floating hover name for everything in the menus that carries data-tip (icons have no words: Harry, "we need
  // hover text for sure"). Shown at once, above the thing, never clipped by a scrolling list.
  const tip = document.createElement('div'); tip.id = 'traytip'; tip.hidden = true; tip.setAttribute('role', 'tooltip');
  document.body.append(tip);
  let tipFor = null;
  const hideTip = () => { tip.hidden = true; tipFor = null; };
  addEventListener('pointerover', (ev) => {
    const el = ev.target.closest?.('[data-tip]');
    if (!el) { if (tipFor) hideTip(); return; }
    if (el === tipFor) return;
    tipFor = el; tip.textContent = el.dataset.tip; tip.hidden = false;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.top - h - 6;
    if (y < 4) y = r.bottom + 6;
    tip.style.left = `${Math.max(4, Math.min(innerWidth - w - 4, x))}px`; tip.style.top = `${y}px`;
  }, true);
  addEventListener('pointerdown', hideTip, true);
  addEventListener('keydown', hideTip, true);
  app.on((what) => { if (tipFor && (!tipFor.isConnected || /\.close$/.test(what))) hideTip(); }); // (its thing was redrawn or its menu closed under a pointer that did not move)
  app.trayTip = () => tip.hidden ? null : tip.textContent; // (tests)
  return { name: 'tray' };
}
