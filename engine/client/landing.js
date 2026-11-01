// WHERE A VISITOR CAME FROM (2026-10-23; the funnel, relay/funnel.js). Not a tracker. When the page is opened with ad /
// campaign parameters (utm_*, ref, an ad click id) they are noted ONCE in this browser (first touch, kept 30 days)
// together with the referring site's host, and taken out of the address bar, so they do not ride along into invite
// links (app.inviteLink copies location.search). The start form sends the note with the new table (POST /campaigns
// {landing}); the relay keeps it only on that table's funnel line, and keeps a click id only when the country may be
// used for ads (the geofence).
// THE HANDOFF (2026-10-24; client/phone.js, the phone banner; relay/linkmail.js): a link a phone emailed to itself carries the phone
// visit's parameters and `tw_handoff=<id>`. Opened here, that visit is the one that counts (it replaces an older note:
// the person told us where they came from), the note keeps `handoff`, and this file sends ONE line to our own relay,
// "handoff opened" (POST /linkmail/handoff/opened {h, device}), so the funnel can say "phone ad → desktop". Nothing is
// ever sent anywhere else.
export const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'rdt_cid', 'msclkid', 'ttclid', 'twclid'];
const STORE = 'tw.landing', KEEP_MS = 30 * 86400e3, HANDOFF = /^hd_[0-9a-z]{6,24}$/;
const clean = (v) => String(v).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);

// -> what THIS address carried (the keys above, and `handoff`), or null. The note is kept as before.
export function captureLanding(loc = location, doc = document, { device = 'desktop', relay = null } = {}) {
  let got = null;
  try {
    const q = new URLSearchParams(loc.search); got = {};
    for (const k of KEYS) { const v = q.get(k); if (v && clean(v)) got[k] = clean(v); }
    const h = q.get('tw_handoff'); if (h && HANDOFF.test(h)) got.handoff = h;
    let ref = null; try { const r = doc.referrer && new URL(doc.referrer); if (r && r.host && r.host !== loc.host && !/(^|\.)turnipworks\.net$/.test(r.hostname)) ref = r.hostname; } catch { }
    let old = null; try { old = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { }
    const fresh = old && Date.now() - (old.landed || 0) < KEEP_MS;
    let note = null;
    if (got.handoff) note = { ...got, landed: Date.now() };                // the handoff wins (above)
    else if (Object.keys(got).length && !fresh) note = { ...got, ...(ref && { referrer: ref }), landed: Date.now() };
    else if (!fresh && ref) note = { referrer: ref, landed: Date.now() };
    if (note) { try { localStorage.setItem(STORE, JSON.stringify(note)); } catch { } }
    if (got.handoff) opened(got.handoff, device, relay);
    if (Object.keys(got).length || q.has('tw_handoff')) { for (const k of [...KEYS, 'tw_handoff']) q.delete(k); history.replaceState(history.state, '', `${loc.pathname}${q.toString() ? '?' + q : ''}${loc.hash}`); }
    if (!Object.keys(got).length) got = null;
  } catch { }
  return got;
}
export function landing() {
  try { const n = JSON.parse(localStorage.getItem(STORE) || 'null'); return n && Date.now() - (n.landed || 0) < KEEP_MS ? n : null; } catch { return null; }
}
// the one line to our own relay (once per link and device in this browser; the relay keeps the first per link and device)
function opened(h, device, relay) {
  const k = `tw.handoff.${h}.${device}`;
  try { if (localStorage.getItem(k)) return; localStorage.setItem(k, String(Date.now())); } catch { }
  const base = (relay || new URL('/api/tw-relay', location.href).href).replace(/\/$/, '');
  try { fetch(`${base}/linkmail/handoff/opened`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ h, device }), keepalive: true }).catch(() => { }); } catch { }
}
// (a phone at the front door, since 2026-10-24 in the game itself with the phone banner, client/phone.js: noted as a phone)
export const LANDING_CAPTURED = captureLanding(location, document, { device: typeof window !== 'undefined' && window.TW_PHONE ? 'phone' : 'desktop', relay: new URLSearchParams(location.search).get('relay') });
