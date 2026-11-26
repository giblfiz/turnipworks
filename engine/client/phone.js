// THE PHONE FRONT DOOR (2026-11-24, v2; docs/UI.md "The phone front door"). index.html decides (window.TW_PHONE: a new
// phone at the front door) and shows #front, its own static markup, instead of the game; this file is its behaviour and
// is the only script such a page loads (no main.js, no three.js). Why (the diagnosis, 2026-11-24): the v1 banner sat
// over the game's start form, appeared only after the game's ~9 s / 1.4 MB load on a slow phone, left by itself after
// 8 s, and asked for typing; 0 of ~40 ad-click phones used it, and 19 of 50 never got far enough to be shown it.
//   the film      phone/front-loop.mp4 (engine/tools/build_phone_media.sh: the approved 15C 4:5 cut's game footage, 447 KB),
//                 muted, looping, started here after the page is up (reduced motion: the poster and a play button)
//   the ask       "Send myself the link": the phone's own share sheet (Web Share: Messages, Mail, Notes, AirDrop, …);
//                 then Email it (the "email yourself your link" form, as before), Copy link, Reminder (a calendar file);
//                 a phone without Web Share shows the three. Every link carries this visit's utm_* / ref / ad click id and
//                 a handoff id of its own (relay/linkmail.js handoffLink's form), so opening it on a computer counts as
//                 "phone ad → desktop" (client/landing.js, relay/funnel.js).
//   the way in    "Or try it on this phone": remembered 30 days (tw.phone.ok), then the game, laid out for a phone
// The funnel lines (all to our own relay; no address, name or IP; relay/funnel.js): 'phone' (the page shown), one
// 'phone_step' per kind (the film started / finished, the buttons in view, which button, a share done / cancelled, a
// copy), 'handoff' with its `via` (email | share | copy | ics), and on the computer 'handoff_open'.
import { LANDING_CAPTURED, landing, KEYS } from './landing.js';

const qs = new URLSearchParams(location.search);
const relayBase = (qs.get('relay') || new URL('/api/tw-relay', location.href).href).replace(/\/$/, '');
const rid = (p, n) => p + Array.from(crypto.getRandomValues(new Uint8Array(n)), b => (b % 36).toString(36)).join('');
const pg = rid('pg_', 8);
const visit = LANDING_CAPTURED || landing() || null; // what every link will carry
const post = (p, body) => fetch(relayBase + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).then(r => r.json()).catch(() => null);
const onSite = /(^|\.)turnipworks\.net$/.test(location.hostname) || location.port === '8180';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const F = document.getElementById('front');
const PH = window.twPhone = { pg, visit, state: 'front', steps: [], links: [], sent: null, shown: null };
const step = (what) => { if (PH.steps.includes(what)) return; PH.steps.push(what); post('/linkmail/handoff/step', { pg, what }); };

document.title = 'Turnip Works · free 3D virtual tabletop';
document.getElementById('twl')?.remove(); // (the game's loading screen: nothing of the game loads here)
if (!onSite) { // (a local test site has no /privacy, /about …)
  for (const a of F.querySelectorAll('a[href^="/"]')) a.href = a.getAttribute('href') === '/privacy' ? 'site/privacy.html' : 'site' + a.getAttribute('href') + '.html';
}
PH.shown = post('/linkmail/handoff/shown', { pg, landing: visit });

// ---- a link for a computer: the site, this visit's tags and click id, and a handoff id (relay/linkmail.js handoffLink) ----
function makeLink() {
  const h = rid('hd_', 12), q = new URLSearchParams();
  for (const k of KEYS) if (visit?.[k]) q.set(k, visit[k]);
  q.set('tw_handoff', h);
  return { h, url: `${location.origin}/?${q}` };
}
const register = (L, via) => { PH.links.push({ ...L, via }); return post('/linkmail/handoff/link', { h: L.h, pg, landing: visit, via }); };
const msg = document.getElementById('fdMsg');
const say = (text, kind = '') => { msg.className = 'fd-msg' + (kind ? ' ' + kind : ''); msg.textContent = text; };

// ---- the film ----
const video = document.getElementById('fdFilm'), play = F.querySelector('.fd-play');
video.addEventListener('playing', () => step('video_start'), { once: true });
let lastT = 0; video.addEventListener('timeupdate', () => { if (video.currentTime < lastT - 1) step('video_end'); lastT = video.currentTime; }); // (it loops: a jump back is the end)
video.addEventListener('ended', () => step('video_end'));
const start = () => { if (!video.src) video.src = 'phone/front-loop.mp4?v=' + (window.TW_V || 'dev'); return video.play().then(() => { play.hidden = true; }, () => { play.hidden = false; }); };
play.addEventListener('click', () => { start(); });
video.addEventListener('click', () => { if (video.paused) start(); else video.pause(); });
if (reduced) play.hidden = false;
else if (document.readyState === 'complete') setTimeout(start, 50); else addEventListener('load', () => setTimeout(start, 50), { once: true });

// ---- the buttons in view (the first time half of the primary one is on screen) ----
const shareBtn = document.getElementById('fdShare');
const canShare = typeof navigator.share === 'function';
if (!canShare) F.classList.add('no-share');
const watched = canShare ? shareBtn : document.getElementById('fdEmail');
if ('IntersectionObserver' in window) { const io = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) { step('cta_visible'); io.disconnect(); } }, { threshold: 0.5 }); io.observe(watched); }
else step('cta_visible');

// ---- 1. the share sheet (called inside the tap: the link is made here, not fetched) ----
shareBtn.addEventListener('click', async () => {
  step('tap_share');
  const L = makeLink();
  try {
    await navigator.share({ title: 'Turnip Works', text: 'Turnip Works, a free 3D virtual tabletop. Open this on my computer:', url: L.url });
    step('share_done'); register(L, 'share'); PH.state = 'shared';
    say('Sent. Open it on your computer when you get there.', 'ok');
  } catch (e) {
    if (e?.name === 'AbortError') { step('share_cancel'); return; }
    say('Your phone would not open its share menu. Try Email it or Copy link.', 'bad'); // (NotAllowedError, a webview…)
  }
});

// ---- 2. email it: the "email yourself your link" form (same endpoint, rules and limits as v1) ----
const emailBtn = document.getElementById('fdEmail'), form = document.getElementById('fdMail'), addr = document.getElementById('fdAddr');
emailBtn.addEventListener('click', () => {
  step('tap_email');
  const open = form.hidden; form.hidden = !open; emailBtn.setAttribute('aria-expanded', String(open));
  if (open) { addr.focus({ preventScroll: true }); setTimeout(() => form.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }), 250); } // (above the keyboard)
});
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const email = addr.value.trim(), news = form.querySelector('input[name=news]').checked;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('That does not look like an email address.', 'bad'); addr.focus(); return; }
  const btn = form.querySelector('button'); btn.disabled = true; say('Sending…');
  const r = await post('/linkmail/handoff', { email, news, gpc: !!navigator.globalPrivacyControl, landing: visit, pg });
  btn.disabled = false;
  if (!r?.ok) { step('email_fail'); say(r?.why ? r.why.replace(/^./, c => c.toUpperCase()) + '.' : 'Could not send just now. Try again in a moment.', 'bad'); return; }
  form.hidden = true; emailBtn.setAttribute('aria-expanded', 'false');
  say(`Sent to ${r.to}. Open it on your computer. Not there in a few minutes? Look in spam.`, 'ok');
  PH.sent = r; PH.state = 'sent';
});

// ---- 3. copy link ----
document.getElementById('fdCopy').addEventListener('click', async () => {
  step('tap_copy');
  const L = makeLink();
  let ok = false;
  try { await navigator.clipboard.writeText(L.url); ok = true; } catch { }
  if (!ok) { // (an older webview: the old way)
    const t = document.createElement('textarea'); t.value = L.url; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.append(t); t.select(); t.setSelectionRange(0, L.url.length);
    try { ok = document.execCommand('copy'); } catch { } t.remove();
  }
  if (!ok) { say('Could not copy here. Try Email it instead.', 'bad'); return; }
  step('copy_ok'); register(L, 'copy'); PH.state = 'copied';
  say('Link copied. Paste it into a note or a message to yourself.', 'ok');
});

// ---- 4. a calendar reminder: the next 7 pm at least two hours away, on this phone's clock ----
document.getElementById('fdIcs').addEventListener('click', async () => {
  step('tap_ics');
  const L = makeLink(), when = new Date(); when.setHours(19, 0, 0, 0);
  if (when - Date.now() < 2 * 3600e3) when.setDate(when.getDate() + 1);
  say('Opening your calendar…');
  const r = await register(L, 'ics');
  if (!r?.ok) { say('Could not make the reminder just now. Try Copy link.', 'bad'); return; }
  PH.state = 'reminder';
  say(`A reminder for ${when.toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' })}, with the link in it. Add it in your calendar.`, 'ok');
  location.href = `${relayBase}/linkmail/handoff/ics?h=${L.h}&t=${when.getTime()}`;
});

// ---- the way in: this phone (remembered 30 days; then the game, laid out for a phone) ----
for (const a of F.querySelectorAll('#fdHere, .fd-here2')) a.addEventListener('click', (ev) => {
  ev.preventDefault(); step('tap_here');
  try { localStorage.setItem('tw.phone.ok', String(Date.now())); } catch { }
  const q = new URLSearchParams(location.search); q.delete('phone');
  setTimeout(() => { history.replaceState(history.state, '', `${location.pathname}${q.toString() ? '?' + q : ''}#tw-phone-ok`); location.reload(); }, 60); // (the step's POST is keepalive)
});

