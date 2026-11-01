// "EMAIL YOURSELF YOUR LINK" (Harry 2026-10-21, decided: "the only email ask"; built 2026-10-23; docs/UI.md "Email
// yourself your link"). The GM is asked to email themself their GM link, a player their seat link. Never anyone else's.
//   LOUD, then it settles: a prominent card a few seconds into the visit; after LOUD_MS untouched it goes down into the
//   chat as an action line, "Keep your GM link: email it to yourself · [Email me]" (our contextual-option rule,
//   surfaces/condbutton.js rule 6). Every visit until the link has been emailed. It never blocks play: no backdrop, it
//   never takes the keyboard by itself, the table works around it, × sends it to the chat at once. Nothing is gated.
//   At the field: a Privacy Policy link, and a separate "send me news" box that starts UNTICKED.
//   Saved = the relay says this seat's link was emailed (GET /c/<cid>/linkmail), so another browser knows too.
//   Also in the command bar: "email my link" (rule: never the only way).
// SEQUENCE with a player's first arrival (client/arrival.js): the "This is you … choose who you are" offer goes first;
// the card waits until that offer has gone down into the chat (or the pawn is chosen), then waits AFTER_HINT_MS more.
// It also waits for the GM's first-visit intro to end, the loading screen, an open dialog, and anything being typed in.
// The relay side: relay/linkmail.js (the mail, the address book, the opt-out page).
import { icon } from '../icons.js';
import { loadPrefs } from './settings.js';

export const LOUD_MS = 9000, FIRST_DELAY_MS = 5000, AFTER_HINT_MS = 3000;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function installLinkMail(app, { lab = false } = {}) {
  const C = () => app.sync.campaign;
  const key = () => `tw.linkmail.${C()?.id}.${app.me()}`;
  const local = () => { try { return JSON.parse(localStorage.getItem(key()) || 'null'); } catch { return null; } };
  const remember = (v) => { try { localStorage.setItem(key(), JSON.stringify(v)); } catch { } };
  const role = () => app.gm() ? 'gm' : 'player';
  const what = () => role() === 'gm' ? 'GM link' : 'seat link';
  const privacyHref = () => /(^|\.)turnipworks\.net$/.test(location.hostname) || location.port === '8180' ? '/privacy' : 'site/privacy.html';
  const api = () => `${app.relayBase}/c/${C().id}/linkmail?seat=${encodeURIComponent(app.sync.token)}`;
  const human = () => C()?.my?.kind === 'human';
  let ro = null, el = null, mode = null, shownAt = 0, hold = 0, settleTimer = null, savedState = null; // mode: 'loud' | 'open' (from the chat line or the bar)
  const L = app.linkMail = { shown: 0, settled: 0, mode: () => mode, saved: () => !!(savedState || local()?.saved), state: () => ({ mode, saved: L.saved(), shown: L.shown, settled: L.settled, el: !!el }) };

  app.actionLines?.kind('linkmail', { restorable: true, valid: () => L.saved() ? 'saved' : null, run: () => { open('open'); } });
  app.registry?.add?.({ id: 'linkmail.open', title: 'Email yourself your link', short: 'Email my link', synonyms: ['email my link', 'email link', 'save my link', 'email me my link', 'send me my link', 'keep my link'], icon: 'mail', group: 'Me', when: () => human() && !lab, run: () => open('open') });

  function card() {
    const d = document.createElement('div');
    d.id = 'linkMail'; d.className = 'lmcard'; d.setAttribute('role', 'region'); d.setAttribute('aria-label', `Email yourself your ${what()}`);
    const gm = role() === 'gm';
    d.innerHTML = `<button class="lm-x" type="button" title="Later: it goes down into the chat" aria-label="Later">${icon('x', 15)}</button>
      <div class="lm-h">${icon('mail', 18)}<span>Keep your ${what()}</span></div>
      <div class="lm-sub">${gm ? 'This link is the only way back to this table as its GM.' : 'This link is the only way back to your seat at this table.'} Email it to yourself so you don't lose it.</div>
      <form class="lm-row" novalidate><input class="lm-email" type="email" name="email" inputmode="email" autocomplete="email" spellcheck="false" placeholder="Email address" aria-label="Your email address" maxlength="254"><button class="lm-send" type="submit">Email me my link</button></form>
      <div class="lm-foot"><label class="lm-news"><input type="checkbox" name="news"> Also send me occasional Turnip Works news</label><a class="lm-privacy" href="${privacyHref()}" target="_blank" rel="noopener">Privacy Policy</a></div>
      <div class="lm-msg" aria-live="polite"></div>`;
    const input = d.querySelector('.lm-email'), form = d.querySelector('form'), msg = d.querySelector('.lm-msg');
    d.addEventListener('pointerdown', (ev) => ev.stopPropagation()); // the table under it never sees a press on the card
    d.addEventListener('wheel', (ev) => ev.stopPropagation());
    d.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Escape') { ev.preventDefault(); input.blur(); settle(); } });
    d.addEventListener('pointerenter', () => { hold++; }); d.addEventListener('pointerleave', () => { hold = Math.max(0, hold - 1); });
    d.querySelector('.lm-x').onclick = () => settle();
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const email = input.value.trim(), news = d.querySelector('input[name=news]').checked;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.className = 'lm-msg bad'; msg.textContent = 'That does not look like an email address.'; input.focus(); return; }
      const btn = d.querySelector('.lm-send'); btn.disabled = true; msg.className = 'lm-msg'; msg.textContent = 'Sending…';
      let r = null; try { r = await fetch(api(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, news, gpc: !!navigator.globalPrivacyControl }) }).then(x => x.json()); } catch { }
      btn.disabled = false;
      if (!r?.ok) { msg.className = 'lm-msg bad'; msg.textContent = r?.why ? r.why.replace(/^./, c => c.toUpperCase()) + '.' : 'Could not send just now. Try again in a moment.'; return; }
      savedState = { saved: Date.now(), to: r.to }; remember(savedState);
      d.classList.add('done');
      d.innerHTML = `<div class="lm-h ok">${icon('check', 18)}<span>Sent to ${esc(r.to)}</span></div><div class="lm-sub">Check your inbox for your ${what()}. Not there in a few minutes? Look in spam, or use "email my link" in the bar.</div>`;
      dropLines(); app.actionLines?.render?.();
      setTimeout(() => { if (el === d) close(); }, 5000);
    });
    return d;
  }
  function place() { // beside the chat, the corner it settles into: just above it
    const box = document.getElementById('chat')?.getBoundingClientRect();
    if (!el || !box) return;
    const ts = parseFloat(getComputedStyle(el).zoom) || 1; // (the text scale zooms the card: its offsets are in zoomed px)
    el.style.left = `${Math.max(12, box.left) / ts}px`; el.style.bottom = `${Math.max(12, innerHeight - box.top + 10) / ts}px`;
  }
  function open(m) {
    if (!human() || lab) return false;
    if (L.saved() && m === 'loud') return false;
    if (!el) { el = card(); document.body.append(el); }
    if (!ro && window.ResizeObserver && document.getElementById('chat')) { ro = new ResizeObserver(() => place()); ro.observe(document.getElementById('chat')); } // (the chat grows: the card stays above it)
    mode = m; shownAt = performance.now(); el.classList.toggle('loud', m === 'loud'); el.classList.toggle('opened', m === 'open'); el.hidden = false; place();
    if (m === 'loud') { L.shown++; dropLines(); }
    if (m === 'open') setTimeout(() => el?.querySelector('.lm-email')?.focus({ preventScroll: true }), 30); // asked for (the line's button, the bar): the field may take the keys
    return true;
  }
  function close() { el?.remove(); el = null; mode = null; hold = 0; }
  const dropLines = () => app.actionLines?.drop?.((l) => l.kind === 'linkmail' && !l.done);
  // it goes down into the chat: the card shrinks onto its own line's button (FLIP), and the line shows
  function settle() {
    if (!el) return;
    const d = el, from = d.getBoundingClientRect(), wasOpen = mode === 'open';
    el = null; mode = null; hold = 0; L.settled++;
    if (L.saved()) { d.remove(); return; }
    dropLines();
    const line = app.actionLines?.add({ kind: 'linkmail', text: `Keep your ${what()}: email it to yourself`, button: 'Email me', group: 'linkmail', area: app.area() }, { pending: true });
    const target = line && app.actionLines.buttonEl(line.id), to = target?.getBoundingClientRect();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion');
    const reveal = (fade) => { d.remove(); if (line) app.actionLines.reveal(line.id, fade); };
    if (wasOpen || reduced || !to?.width) { d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250 }).finished.then(() => reveal(true), () => reveal(true)); return; }
    d.style.transformOrigin = '0 0'; const ts = parseFloat(getComputedStyle(d).zoom) || 1;
    d.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${(to.left - from.left) / ts}px, ${(to.top - from.top) / ts}px) scale(${Math.max(0.08, to.width / from.width)}, ${Math.max(0.08, to.height / from.height)})`, opacity: 0.6 }], { duration: 520, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' })
      .finished.then(() => reveal(false), () => reveal(false));
  }
  // ---- when: once per visit, LOUD, at a quiet moment ----
  const busy = () => {
    if (!app.ready?.() || !app.loaded?.()) return 'loading';
    if (app.intro?.state === 'running') return 'intro';
    if (app.condButtons?.has?.('placeholder-hint')) return 'arrival';
    if (document.querySelector('[aria-modal="true"]:not([hidden])')) return 'dialog';
    const a = document.activeElement; if (a && a !== document.body && a.closest?.('input, textarea, [contenteditable]')) return 'typing';
    return null;
  };
  let quietSince = null, lastBusy = null, tries = 0, statusAsked = false;
  const tick = () => {
    if (!C() || loadPrefs().linkMail === false || lab) return;
    if (!human()) return;
    if (L.saved() || L.shown) return;
    if (!statusAsked && app.sync.token) { // another browser may have saved it already
      statusAsked = true;
      fetch(api()).then(r => r.json()).then(r => { if (r?.saved) { savedState = { saved: r.at, to: r.to }; remember(savedState); } }).catch(() => { });
    }
    const b = busy();
    if (b) { if (b === 'arrival' || b === 'intro') lastBusy = performance.now(); quietSince = null; }
    else {
      quietSince ??= performance.now();
      const wait = lastBusy || app.arrival?.hinted ? AFTER_HINT_MS : FIRST_DELAY_MS;
      if (performance.now() - quietSince >= wait && !L.saved()) { open('loud'); return; }
    }
    if (++tries < 2400) setTimeout(tick, 250);
  };
  setTimeout(tick, 400);
  // the loud card's time: LOUD_MS, held while the pointer is on it, it has the focus, or something is typed in it
  app.on((w) => {
    if (w !== 'frame' || !el) return;
    place();
    if (mode !== 'loud') return;
    const typed = el.querySelector('.lm-email')?.value, focused = el.contains(document.activeElement);
    if (hold || focused || typed) { shownAt = performance.now(); return; }
    if (performance.now() - shownAt > LOUD_MS) settle();
  });
  L.open = open; L.settle = settle; L.close = close; // (tests)
  return L;
}
