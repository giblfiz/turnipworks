// THE PHONE BANNER (2026-10-24; docs/UI.md "The phone banner"). A phone at the front door goes straight into the game
// (index.html: window.TW_PHONE, loaded after main.js); this is all that is left of the phone page it used to get instead
// ("Built for your computer"): a small banner, never in the way, that offers to email the link to a bigger screen.
//   shut    "Bigger screen? Email yourself the link" and ×, over the bottom of the screen; it goes by itself after
//           AWAY_MS untouched (and at once on ×); once per visit (this tab: sessionStorage)
//   open    a press on it: the "email yourself your link" card's own form (.lmcard): the field, the button, the
//           Privacy Policy link and the news box, UNTICKED; sent: "Sent to f•••@…", and it goes a few seconds later
// The relay mails a turnipworks.net link that carries this visit's utm_* / ref / ad click id and a handoff id
// (relay/linkmail.js "THE HANDOFF"), so opening it on a computer counts as "phone ad → desktop" (client/landing.js,
// relay/funnel.js). Same endpoints, limits and ad-matching rules as the phone page had, and the same funnel lines:
// 'phone' (shown), 'handoff' (sent), and on the computer 'handoff_open'.
import { LANDING_CAPTURED, landing } from './landing.js';
import { icon } from './icons.js';

const AWAY_MS = 8000, SENT_MS = 6000, SEEN = 'tw.phone.banner';
const qs = new URLSearchParams(location.search);
const relayBase = (qs.get('relay') || new URL('/api/tw-relay', location.href).href).replace(/\/$/, '');
const pg = 'pg_' + Array.from(crypto.getRandomValues(new Uint8Array(8)), b => (b % 36).toString(36)).join('');
const post = (p, body) => fetch(relayBase + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const privacyHref = /(^|\.)turnipworks\.net$/.test(location.hostname) || location.port === '8180' ? '/privacy' : 'site/privacy.html';
const PH = window.twPhone = { pg, visit: null, sent: null, shown: null, state: 'waiting' };

let seen = false; try { seen = !!sessionStorage.getItem(SEEN); } catch { }
if (seen && qs.get('phone') !== '1') PH.state = 'seen';
else {
  // after the loading screen (the start page or a table), so it is not lost behind it
  const t0 = Date.now();
  const wait = () => { const twl = document.getElementById('twl'); if ((!twl || twl.hidden || getComputedStyle(twl).display === 'none' || twl.classList.contains('gone')) || Date.now() - t0 > 20000) show(); else setTimeout(wait, 250); };
  wait();
}

function show() {
  try { sessionStorage.setItem(SEEN, String(Date.now())); } catch { }
  const visit = PH.visit = LANDING_CAPTURED || landing() || null; // what the link will carry
  const el = document.createElement('aside');
  el.id = 'phoneBanner'; el.setAttribute('aria-label', 'Email yourself the link');
  el.innerHTML = `
    <div class="pb-shut"><button class="pb-open" type="button">${icon('monitor', 17)}<span>Bigger screen? <b>Email yourself the link</b></span></button><button class="pb-x" type="button" aria-label="Close">${icon('x', 16)}</button></div>
    <section class="lmcard pb-card" hidden>
      <button class="lm-x" type="button" aria-label="Close">${icon('x', 16)}</button>
      <div class="lm-h">${icon('mail', 18)}<span>Email yourself the link</span></div>
      <div class="lm-sub">Open it on your computer when you're there.</div>
      <form class="lm-row" novalidate><input class="lm-email" type="email" name="email" inputmode="email" autocomplete="email" spellcheck="false" placeholder="Email address" aria-label="Your email address" maxlength="254"><button class="lm-send" type="submit">Email me the link</button></form>
      <div class="lm-foot"><label class="lm-news"><input type="checkbox" name="news"> Also send me occasional Turnip Works news</label><a class="lm-privacy" href="${privacyHref}" target="_blank" rel="noopener">Privacy Policy</a></div>
      <div class="lm-msg" aria-live="polite"></div>
    </section>`;
  document.body.append(el);
  PH.state = 'shut';
  PH.shown = post('/linkmail/handoff/shown', { pg, landing: visit });

  let timer = null;
  const go = () => { clearTimeout(timer); if (!el.isConnected) return; el.classList.add('away'); PH.state = 'gone'; setTimeout(() => el.remove(), 400); };
  const later = (ms) => { clearTimeout(timer); timer = setTimeout(go, ms); };
  later(AWAY_MS);
  const card = el.querySelector('.pb-card'), shut = el.querySelector('.pb-shut');
  el.querySelector('.pb-open').addEventListener('click', () => { clearTimeout(timer); shut.hidden = true; card.hidden = false; el.classList.add('open'); PH.state = 'open'; });
  for (const x of el.querySelectorAll('.pb-x, .lm-x')) x.addEventListener('click', go);

  const form = card.querySelector('form'), input = card.querySelector('.lm-email'), msg = card.querySelector('.lm-msg');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = input.value.trim(), news = card.querySelector('input[name=news]').checked;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.className = 'lm-msg bad'; msg.textContent = 'That does not look like an email address.'; input.focus(); return; }
    const btn = card.querySelector('.lm-send'); btn.disabled = true; msg.className = 'lm-msg'; msg.textContent = 'Sending…';
    const r = await post('/linkmail/handoff', { email, news, gpc: !!navigator.globalPrivacyControl, landing: visit, pg });
    btn.disabled = false;
    if (!r?.ok) { msg.className = 'lm-msg bad'; msg.textContent = r?.why ? r.why.replace(/^./, c => c.toUpperCase()) + '.' : 'Could not send just now. Try again in a moment.'; return; }
    card.classList.add('done');
    card.innerHTML = `<div class="lm-h ok">${icon('check', 18)}<span>Sent to ${esc(r.to)}</span></div><div class="lm-sub">Open the link on your computer. Not there in a few minutes? Look in spam.</div>`;
    PH.sent = r; PH.state = 'sent';
    later(SENT_MS);
  });
}
