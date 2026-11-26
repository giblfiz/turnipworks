// BACK CLOSES WHAT IS OPEN, ON A PHONE (2026-11-11; docs/UI.md "On a phone": Back). Only under html.tw-hand.
// The game leans on Escape (17 handlers in 12 files: the ring, the trays, the bar, Settings, rulers, the avatars' menu,
// the link card, labels, Share, a drag out of a list, the key layer's own stack). A phone has no Escape, and with no
// history of our own Android's Back (and iOS's swipe back) LEFT THE GAME: on the real Moto, Build open, Back went to the
// page before (2026-11-11, engine/test/moto_back.py). So here, one small mechanism for every one of them:
//   OPEN     anything escapable opening (the list below) pushes ONE history entry for itself, same address
//            (history.state.twEsc = how many are open), in the frame after the tap that opened it
//   BACK     popstate (Back, a swipe back) is the Escape key: the very same keydown, sent where a real Escape would go
//            (the focused field, an open Share window or link card, else the page), so each handler does what Escape
//            does, newest first. If that Escape closed nothing that counts (a closer whose thing was gone), once more.
//   CLOSED   anything closed another way (its ✕, Done, a tap outside, Escape on a keyboard) takes its entries back off
//            (history.go(-n)), so the history stays as it was and Back with nothing open leaves, as a page's Back does.
// What counts as open (each one entry; the counts are what one Escape at a time takes down, in order):
//   a live tool (place, a room, a building, a pawn, paint) · the selection (its ring) · the ring opened (☰) and a
//   group in it · an open tray (Pawns, Build, Settings: not a PINNED one, which Escape passes by too) · the Pawns
//   tray's little menu · the command bar's list · the shortcut sheet · an output card · Share · the link card ·
//   the avatars' menu · the ring's damage field · looking through a pawn's eyes
// A computer never loads this (main.js: phones only), so a computer's Escape and Back are exactly as before.
export function installEscapable(app) {
  const vis = (sel) => () => { const e = typeof sel === 'string' ? document.querySelector(sel) : sel(); if (!e || !e.isConnected || e.hidden) return false; const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const bar = () => app.registry?.surfaces?.find(s => s.name === 'bar');
  const LAYERS = [
    ['tool', () => !!app.mode],
    ['selection', () => app.sel?.size > 0],
    ['ring', () => { const s = app.ringState?.(); return s === 'nested' ? 2 : s === 'expanded' ? 1 : 0; }],
    ['tray', () => ['pawns', 'build', 'settings'].filter(n => app[n]?.isOpen && app.tray?.dismissable(n)).length],
    ['pawnsMenu', () => !!app.pawns?.hasPop?.()],
    ['bar', () => !!bar()?.isOpen()],
    ['sheet', vis('#sheet')],
    ['output', vis('#output')],
    ['share', vis('#shareModal')],
    ['linkmail', vis('#linkMail')],
    ['avatarMenu', vis('.rosterpop')],
    ['damage', () => !!app.ringDamageEdit?.()],
    ['eyes', () => !!app.fpv?.active?.()],
  ];
  const open = () => LAYERS.map(([k, f]) => { let v = 0; try { v = +f() || 0; } catch { } return [k, v]; }).filter(([, v]) => v > 0);
  const depth = () => open().reduce((a, [, v]) => a + v, 0);
  const sid = Math.random().toString(36).slice(2, 10); // this page's entries (a reload starts a new count)
  const ours = (st) => st && st.twEscSid === sid;
  let n = ours(history.state) ? history.state.twEsc : 0; // entries of ours at and below the current one
  let going = null; // a history.go(-k) of our own on its way: { to, at }
  const E = app.escapable = { depth, open: () => Object.fromEntries(open()), entries: () => n, log: [], going: () => !!going };
  const note = (what) => { E.log.push({ what, n, d: depth(), t: Math.round(performance.now()) }); if (E.log.length > 40) E.log.shift(); };

  // where a real Escape would go: the focused field (it has its own Escape), an open window that listens on itself
  function escapeTarget() {
    const a = document.activeElement;
    if (a && a !== document.body && a.matches?.('input, textarea, select, [contenteditable]')) return a;
    for (const id of ['shareModal', 'linkMail']) { const e = document.getElementById(id); if (e && !e.hidden && e.isConnected) return e; }
    return a && a !== document.body && document.body.contains(a) ? a : document.body;
  }
  function escape() {
    const t = escapeTarget();
    t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true, composed: true }));
    t.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true, composed: true }));
  }
  E.escape = escape; // (tests)

  addEventListener('popstate', (ev) => {
    const to = ours(ev.state) ? ev.state.twEsc : 0;
    if (going) { n = to; going = null; note('ours'); sync(); return; } // our own go(-k): nothing to close
    // BACK: one Escape per entry the person went back over (one, from a button; a long-press history list: several)
    let steps = Math.max(0, n - to); n = to;
    note(`back ${steps}`);
    while (steps-- > 0) {
      const d0 = depth();
      if (!d0) break;
      for (let tries = 0; tries < 3 && depth() >= d0; tries++) escape();
    }
    app.refresh?.();
    sync();
  });

  // keep one entry per open thing: push for what opened, go back over what closed
  function sync() {
    if (going) { if (performance.now() - going.at > 1500) going = null; else return; } // (a go() that never answered: carry on)
    const d = depth();
    if (d > n) {
      while (n < d) { n++; history.pushState({ ...(history.state || {}), twEsc: n, twEscSid: sid }, '', location.href); }
      note('push');
    } else if (d < n) {
      const k = n - d; going = { to: d, at: performance.now() };
      note(`go -${k}`);
      history.go(-k);
    }
  }
  E.sync = sync;
  app.on?.((ev) => { if (ev === 'refresh' || ev === 'selection' || ev === 'frame') sync(); });
  setInterval(sync, 150); // (a frame may not come: an idle table draws nothing)
  // a tap or a key may have opened or closed something: look straight after it has been handled
  for (const t of ['pointerup', 'click', 'keyup']) addEventListener(t, () => setTimeout(sync, 0), true);
}
