// "EMAIL YOURSELF YOUR LINK" (Harry 2026-10-21, decided; built 2026-10-23). The one email ask in Turnip Works: a GM
// emails themself their GM link, a player their seat link. No email invites to other people. The card is
// client/surfaces/linkmail.js; this is the relay side: the address book, the one transactional mail, the opt-out page.
// docs/NETCODE.md "Email yourself your link", docs/site/privacy.md.
//
// THE MAIL is purely factual (the link, what it is, who sent it): that keeps it transactional (CAN-SPAM 16 CFR
// §316.3; CASL SOR/2013-221 s.3(b); Australia "designated" message: docs/marketing/ads-rules-briefing-2026-10.md §2.1,
// §2.10, §2.11). Never add news or promotion to it. The link is minted here from the seat (relay/tokens.js), never taken
// from the request, so the mail can only ever carry the asker's own link to this site.
//
// WHERE: <DATA_DIR>/linkmail/ (backed up with the campaigns; the outbox and the test sandbox are not)
//   addresses.json   { addrs: { em_…: { id, email, at, updated, news, country, gpc, ad_matching_eligible,
//                     ads_opt_out, links: [{ c, seat, role, at, sent, n }] } } }   rewritten whole (atomic), mode 600, so
//                     a deleted address is really gone from the file (an append-only log would keep it)
//   suppress.json    { hashes: [sha256(address)] }: addresses that were deleted or opted out of ads; an address on it
//                     is never ad-matching eligible again, even if it is given again later
//   outbox/          the mailer's outbox transport (relay/mailer.js)
//   test-sandbox/<session>/   a request carrying X-TW-Test (tests/tw_sandbox.py) uses its own book and the outbox only
//
// ad_matching_eligible is decided AT COLLECTION and only ever goes from true to false: false for EEA + UK + CH +
// unknown/Tor (CF-IPCountry, relay/funnel.js NO_ADS), for a browser sending Global Privacy Control or Do Not Track, for a
// suppressed address, and once its owner opts out. Nothing here uploads anything anywhere; a later ads-list export
// reads only records with ad_matching_eligible true.
//
// HTTP (relay prefix /api/tw-relay)
//   POST /c/<cid>/linkmail?seat=TOKEN {email, news, gpc}   -> {ok, to (masked), transport}  (400 bad address, 429 too many)
//   GET  /c/<cid>/linkmail?seat=TOKEN                       -> {ok, saved, at, to}   (has this seat's link been emailed?)
//   GET  /linkmail/optout?a=<id>&k=<key>                    the opt-out page (the mail's footer link): a page, one press
//   POST /linkmail/optout  a, k, what = ads | news | delete -> the same page, saying what was done
//   GET  /linkmail/sandbox                                  {sandbox}: the test helper's check
//
// THE HANDOFF (2026-10-24; client/phone.js, docs/UI.md "The phone page"): a phone that lands on turnipworks.net is shown
// a short page instead of the 3D table, with one ask: email yourself the link, to open on your computer. The same
// address book, limits, eligibility rules, footer and opt-out page; its link record is { kind:'handoff', h, role:
// 'handoff', c:null, seat:null, … }. The mailed link is turnipworks.net with the phone visit's utm_* / ref / ad click id
// and `tw_handoff=<h>`, so the computer's visit (client/landing.js) is attributed "phone ad → desktop" (relay/funnel.js).
//   POST /linkmail/handoff {email, news, gpc, landing, pg}  -> {ok, to (masked), transport}  (400, 429, 502 as above)
//   POST /linkmail/handoff/shown {pg, landing}              -> {ok}   the funnel's 'phone' line
//   POST /linkmail/handoff/opened {h, device}               -> {ok, first}   the funnel's 'handoff_open' line
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { newId } from '../core/ids.js';
import { countryOf, adEligibleCountry, cleanLanding, LANDING_KEYS, CLICK_KEYS } from './funnel.js';

export const LINKMAIL_LIMITS = { perAddressDay: 5, perSeatHour: 4, perIpHour: 12, globalDay: 300 };
const SID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?)+$/;
export const normEmail = (s) => String(s || '').trim().toLowerCase();
export const validEmail = (s) => s.length <= 254 && EMAIL.test(s) && !/\.\./.test(s);
export const maskEmail = (s) => { const [u, d] = String(s).split('@'); return `${u.slice(0, 1)}${'•'.repeat(Math.min(3, Math.max(1, u.length - 1)))}@${d}`; };
const hashOf = (email) => crypto.createHash('sha256').update(normEmail(email)).digest('hex');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// the site the mail points at: the turnipworks.net host the request came through, else the channel's own
export function siteFor(req, channel, env = process.env) {
  if (env.TW_PUBLIC_SITE) return env.TW_PUBLIC_SITE.replace(/\/?$/, '/');
  const h = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase().split(':')[0];
  if (/^(www\.|dev\.)?turnipworks\.net$/.test(h)) return `https://${h.replace(/^www\./, '')}/`;
  return channel === 'prod' ? 'https://turnipworks.net/' : 'https://dev.turnipworks.net/';
}

// THE MAIL. Plain words, link first, sender identified, nothing promotional (see the top of this file).
export function linkMail({ role, campaignName, seatName, link, site, optout, news }) {
  const gm = role === 'gm', handoff = role === 'handoff', what = gm ? 'GM link' : 'seat link', table = String(campaignName || 'your table').replace(/[\r\n]+/g, ' ').slice(0, 60);
  // the handoff (from the phone page): the site's own link, to open on a computer. No seat in it, so no "keep it private".
  const subject = handoff ? 'Your Turnip Works link, for your computer' : `Your Turnip Works ${what}: ${table}`;
  const intro = handoff ? 'Here is the Turnip Works link you asked for on your phone:' : `Here is your ${what} for "${table}" on Turnip Works${!gm && seatName ? ` (your seat: ${String(seatName).slice(0, 40)})` : ''}:`;
  const after = handoff ? ['Open it on your computer: Turnip Works runs in a browser and is built for a computer screen with a mouse or trackpad.']
    : [gm ? 'Open it on any device to get back to your table as its GM.' : 'Open it on any device to get back to your seat at this table.', 'Anyone who has this link can use your seat, so keep it private.'];
  const lines = [
    intro,
    '',
    link,
    '',
    ...after,
    '',
    '--',
    `You asked for this email at ${site.replace(/^https?:\/\//, '').replace(/\/$/, '')}. We sent it once, because you asked.`,
    ...(news ? ['You also asked for occasional news about Turnip Works; you can stop that at the link below.'] : []),
    'Turnip Works is made by Fauna and giblfiz. Operator: Implausible Enterprises LLC. Contact: hello@turnipworks.net',
    `Stop using this address for ads${news ? ', stop news' : ''}, or delete it: ${optout}`,
    `Privacy Policy: ${site}privacy`,
  ];
  const html = `<!doctype html><html><body style="font:15px/1.55 -apple-system,'Segoe UI',Inter,sans-serif;color:#1a1917;max-width:560px">`
    + (handoff ? `<p>${esc(intro)}</p>` : `<p>Here is your ${what} for <b>${esc(table)}</b> on Turnip Works${!gm && seatName ? ` (your seat: ${esc(String(seatName).slice(0, 40))})` : ''}:</p>`)
    + `<p><a href="${esc(link)}" style="font-weight:600;word-break:break-all">${esc(link)}</a></p>`
    + `<p>${after.map(esc).join(' ')}</p>`
    + `<hr style="border:0;border-top:1px solid #ddd;margin:22px 0 10px"><p style="font-size:12.5px;color:#5f5c55">You asked for this email at ${esc(site.replace(/^https?:\/\//, '').replace(/\/$/, ''))}. We sent it once, because you asked.`
    + `${news ? ' You also asked for occasional news about Turnip Works; you can stop that at the link below.' : ''}<br>`
    + `Turnip Works is made by Fauna and giblfiz. Operator: Implausible Enterprises LLC. Contact: <a href="mailto:hello@turnipworks.net">hello@turnipworks.net</a><br>`
    + `<a href="${esc(optout)}">Stop using this address for ads${news ? ', stop news' : ''}, or delete it</a> · <a href="${esc(site)}privacy">Privacy Policy</a></p></body></html>`;
  return { subject, text: lines.join('\n'), html };
}

// the handoff link: the site, the phone visit's campaign tags and click id (known keys only, cleaned), and the marker
export function handoffLink(site, landing, h) {
  const L = cleanLanding(landing, { clicks: true }) || {}, q = new URLSearchParams();
  for (const k of [...LANDING_KEYS, ...CLICK_KEYS]) if (k !== 'referrer' && k !== 'landed' && L[k]) q.set(k, L[k]);
  q.set('tw_handoff', h);
  return `${site}?${q}`;
}

export function makeLinkMail({ dataDir, secret, tokens, mailer, channel = 'dev', log = () => {}, now = Date.now, limits = LINKMAIL_LIMITS, funnel = null }) {
  const root = path.join(dataDir, 'linkmail');
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const books = new Map();  // '' live | sandbox session -> { dir, addrs, suppress:Set }
  const rate = new Map();   // bucket -> [ms]
  function bookOf(sid) {
    const k = sid || '';
    if (books.has(k)) return books.get(k);
    const dir = sid ? path.join(root, 'test-sandbox', sid) : root;
    if (sid) { // sessions are short-lived: drop the stale ones
      const sb = path.join(root, 'test-sandbox'); fs.mkdirSync(sb, { recursive: true });
      for (const old of fs.readdirSync(sb)) { const p = path.join(sb, old); try { if (now() - fs.statSync(p).mtimeMs > 2 * 86400e3) { fs.rmSync(p, { recursive: true, force: true }); books.delete(old); } } catch { } }
      fs.mkdirSync(dir, { recursive: true });
    }
    let addrs = {}, suppress = new Set();
    try { addrs = JSON.parse(fs.readFileSync(path.join(dir, 'addresses.json'), 'utf8')).addrs || {}; } catch { }
    try { suppress = new Set(JSON.parse(fs.readFileSync(path.join(dir, 'suppress.json'), 'utf8')).hashes || []); } catch { }
    const b = { dir, addrs, suppress, test: !!sid };
    books.set(k, b); return b;
  }
  const write = (file, obj) => { const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(obj, null, 1), { mode: 0o600 }); fs.renameSync(tmp, file); };
  const save = (b) => { write(path.join(b.dir, 'addresses.json'), { v: 1, addrs: b.addrs }); write(path.join(b.dir, 'suppress.json'), { v: 1, hashes: [...b.suppress] }); };
  const findAddr = (b, email) => Object.values(b.addrs).find(a => a.email === email) || null;
  const keyOf = (id) => crypto.createHmac('sha256', secret).update('linkmail-optout:' + id).digest('hex').slice(0, 24);
  const okKey = (id, k) => { const want = keyOf(id); return typeof k === 'string' && k.length === want.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(want)); };
  function allow(bucket, max, win) {
    const t = now(), a = (rate.get(bucket) || []).filter(x => t - x < win);
    if (a.length >= max) { rate.set(bucket, a); return false; }
    a.push(t); rate.set(bucket, a); return true;
  }
  const ipOf = (req) => String(req.headers['x-real-ip'] || req.socket?.remoteAddress || '?');
  const sidOf = (req) => { const s = String(req.headers['x-tw-test'] || ''); return SID.test(s) ? s : null; };

  async function request({ req, rt, seat, body }) {
    const s = rt.state.seats[seat];
    if (s?.kind !== 'human') return [403, { ok: false, code: 'denied', why: 'a link is emailed to a person\'s own seat' }];
    const email = normEmail(body?.email);
    if (!validEmail(email)) return [400, { ok: false, code: 'bad_address', why: 'that does not look like an email address' }];
    const sid = sidOf(req), b = bookOf(sid), pre = sid ? `t:${sid}|` : '';
    // limits: the address, the seat, the network, everything (a stranger's address can't be flooded through us)
    if (!allow(`${pre}g`, limits.globalDay, 86400e3) || !allow(`${pre}a|${hashOf(email)}`, limits.perAddressDay, 86400e3) || !allow(`${pre}s|${rt.id}|${seat}`, limits.perSeatHour, 3600e3) || !allow(`${pre}i|${ipOf(req)}`, limits.perIpHour, 3600e3))
      return [429, { ok: false, code: 'too_many', why: 'too many link emails just now: try again later' }];
    const country = countryOf(req) || 'XX';
    const gpc = !!body?.gpc || req.headers['sec-gpc'] === '1' || req.headers['dnt'] === '1';
    const t = now(), role = s.role === 'gm' ? 'gm' : 'player';
    let a = findAddr(b, email);
    const eligibleNow = adEligibleCountry(country) && !gpc && !b.suppress.has(hashOf(email));
    if (!a) {
      a = { id: newId('em', 14), email, at: t, updated: t, news: !!body?.news, newsAt: body?.news ? t : null, country, gpc, ad_matching_eligible: eligibleNow, ads_opt_out: false, links: [] };
      b.addrs[a.id] = a;
    } else {
      a.updated = t;
      if (body?.news && !a.news) { a.news = true; a.newsAt = t; } // ticking it again turns news on; leaving it unticked never turns it off
      if (!eligibleNow) a.ad_matching_eligible = false;           // only ever true -> false
      if (gpc) a.gpc = true;
      if (!adEligibleCountry(country)) a.country = country;       // the most restrictive place it was given from
    }
    let L = a.links.find(l => l.c === rt.id && l.seat === seat);
    if (!L) { L = { c: rt.id, seat, role, at: t, sent: null, n: 0 }; a.links.push(L); if (a.links.length > 50) a.links.shift(); }
    const site = siteFor(req, channel), link = `${site}#s=${tokens.mint(rt.id, s)}`, optout = `${site}api/tw-relay/linkmail/optout?a=${a.id}&k=${keyOf(a.id)}`;
    const mail = linkMail({ role, campaignName: rt.state.name, seatName: s.name, link, site, optout, news: a.news });
    const sent = await mailer.send({ to: email, ...mail }, { outboxDir: path.join(b.dir, 'outbox'), test: b.test });
    if (!sent.ok) { save(b); return [502, { ok: false, code: 'not_sent', why: sent.why || 'the mail could not be sent' }]; }
    L.sent = t; L.n++;
    save(b);
    log(`linkmail: ${rt.id} ${role} seat -> ${maskEmail(email)} (${country}${a.ad_matching_eligible ? '' : ', not for ads'}${sid ? ', test ' + sid : ''}) via ${sent.transport}`);
    return [200, { ok: true, to: maskEmail(email), transport: sent.transport, news: a.news }];
  }
  // the phone page's ask (THE HANDOFF, top): the same book, limits and rules as a seat's link; no table, no seat
  async function handoff({ req, body }) {
    const email = normEmail(body?.email);
    if (!validEmail(email)) return [400, { ok: false, code: 'bad_address', why: 'that does not look like an email address' }];
    const sid = sidOf(req), b = bookOf(sid), pre = sid ? `t:${sid}|` : '';
    if (!allow(`${pre}g`, limits.globalDay, 86400e3) || !allow(`${pre}a|${hashOf(email)}`, limits.perAddressDay, 86400e3) || !allow(`${pre}i|${ipOf(req)}`, limits.perIpHour, 3600e3))
      return [429, { ok: false, code: 'too_many', why: 'too many link emails just now: try again later' }];
    const country = countryOf(req) || 'XX';
    const gpc = !!body?.gpc || req.headers['sec-gpc'] === '1' || req.headers['dnt'] === '1';
    const t = now(), eligibleNow = adEligibleCountry(country) && !gpc && !b.suppress.has(hashOf(email));
    let a = findAddr(b, email);
    if (!a) { a = { id: newId('em', 14), email, at: t, updated: t, news: !!body?.news, newsAt: body?.news ? t : null, country, gpc, ad_matching_eligible: eligibleNow, ads_opt_out: false, links: [] }; b.addrs[a.id] = a; }
    else {
      a.updated = t;
      if (body?.news && !a.news) { a.news = true; a.newsAt = t; }
      if (!eligibleNow) a.ad_matching_eligible = false;
      if (gpc) a.gpc = true;
      if (!adEligibleCountry(country)) a.country = country;
    }
    const h = newId('hd', 12), L = { kind: 'handoff', h, c: null, seat: null, role: 'handoff', at: t, sent: null, n: 0 };
    a.links.push(L); if (a.links.length > 50) a.links.shift();
    const site = siteFor(req, channel), link = handoffLink(site, body?.landing, h), optout = `${site}api/tw-relay/linkmail/optout?a=${a.id}&k=${keyOf(a.id)}`;
    const mail = linkMail({ role: 'handoff', link, site, optout, news: a.news });
    const sent = await mailer.send({ to: email, ...mail }, { outboxDir: path.join(b.dir, 'outbox'), test: b.test });
    if (!sent.ok) { save(b); return [502, { ok: false, code: 'not_sent', why: sent.why || 'the mail could not be sent' }]; }
    L.sent = t; L.n++;
    save(b);
    try { funnel?.handoffSent({ req, h, pg: body?.pg, landing: body?.landing }); } catch (e) { log(`funnel: ${e.message}`); }
    log(`linkmail: handoff ${h} -> ${maskEmail(email)} (${country}${a.ad_matching_eligible ? '' : ', not for ads'}${sid ? ', test ' + sid : ''}) via ${sent.transport}`);
    return [200, { ok: true, to: maskEmail(email), transport: sent.transport, news: a.news }];
  }
  function status({ req, rt, seat }) {
    const b = bookOf(sidOf(req));
    const all = sidOf(req) ? [...Object.values(bookOf(null).addrs), ...Object.values(b.addrs)] : Object.values(b.addrs);
    let best = null;
    for (const a of all) for (const l of a.links) if (l.c === rt.id && l.seat === seat && l.sent && (!best || l.sent > best.at)) best = { at: l.sent, to: maskEmail(a.email) };
    return [200, { ok: true, saved: !!best, ...(best || {}) }];
  }
  // ---- the opt-out page: a GET only shows it (a mail scanner opening links must not act); one press does it ----
  function optoutPage({ a, k, done = null, bad = false, site }) {
    const rec = a, title = 'Turnip Works · your email address';
    const btn = (what, label) => `<form method="post" action=""><input type="hidden" name="a" value="${esc(rec.id)}"><input type="hidden" name="k" value="${esc(k)}"><input type="hidden" name="what" value="${what}"><button>${label}</button></form>`;
    const body = bad ? `<p>This link is not valid any more. If you want us to delete your address, email <a href="mailto:hello@turnipworks.net">hello@turnipworks.net</a>.</p>`
      : done === 'delete' ? `<p><b>Deleted.</b> We removed ${esc(maskEmail(rec.email))} from our list. We keep only a scrambled (hashed) copy, so it never goes back into our ad lists.</p>`
      : `${done ? `<p class="ok"><b>Done.</b> ${done === 'ads' ? 'We will never use this address for ads.' : 'No more news emails.'}</p>` : ''}
        <p>Address: <b>${esc(maskEmail(rec.email))}</b></p>
        <ul><li>Used for ads: <b>${rec.ad_matching_eligible ? 'may be' : 'no'}</b>${rec.ads_opt_out ? ' (you opted out)' : ''}</li><li>News emails: <b>${rec.news ? 'yes' : 'no'}</b></li></ul>
        ${rec.ad_matching_eligible ? btn('ads', 'Never use my address for ads') : ''}
        ${rec.news ? btn('news', 'Stop news emails') : ''}
        ${btn('delete', 'Delete my address')}
        <p class="small">Deleting it stops everything. You can still email yourself a link again later.</p>`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{margin:0;background:#e9e6df;color:#1a1917;font:16px/1.6 Inter,system-ui,-apple-system,'Segoe UI',sans-serif}main{max-width:34rem;margin:40px auto;padding:28px 28px 22px;background:#fcfbf8;border:1px solid rgba(20,20,20,.14);border-radius:14px}h1{font-size:22px;margin:0 0 14px}form{display:inline-block;margin:6px 8px 6px 0}button{font:600 15px Inter,system-ui,sans-serif;padding:9px 14px;border-radius:9px;border:1px solid rgba(20,20,20,.25);background:#1a1917;color:#fcfbf8;cursor:pointer}.ok{color:#2d6a2d}.small{font-size:13px;color:#5f5c55}a{color:#a8770f}</style></head>
<body><main><h1>Your email address</h1>${body}<p class="small"><a href="${esc(site)}privacy">Privacy Policy</a> · Turnip Works is made by Fauna and giblfiz · Implausible Enterprises LLC · hello@turnipworks.net</p></main></body></html>`;
  }
  function optout({ req, q, form, site }) {
    const id = String(form?.a || q.get('a') || ''), k = String(form?.k || q.get('k') || '');
    // an opt-out link works whatever sandbox the request carries: look in the live book, then the session's
    const b = [bookOf(null), ...(sidOf(req) ? [bookOf(sidOf(req))] : [])].find(x => x.addrs[id]);
    const a = b?.addrs[id];
    if (!a || !okKey(id, k)) return [404, optoutPage({ a: { id: '', email: '@' }, k: '', bad: true, site })];
    if (!form) return [200, optoutPage({ a, k, site })];
    const what = String(form.what || '');
    if (what === 'ads') { a.ad_matching_eligible = false; a.ads_opt_out = true; a.updated = now(); b.suppress.add(hashOf(a.email)); }
    else if (what === 'news') { a.news = false; a.newsAt = null; a.updated = now(); }
    else if (what === 'delete') { b.suppress.add(hashOf(a.email)); delete b.addrs[id]; }
    else return [400, optoutPage({ a, k, site })];
    save(b);
    log(`linkmail: opt-out "${what}" for ${id}${b.test ? ' (test)' : ''}`);
    return [200, optoutPage({ a, k, done: what, site })];
  }
  const summary = () => { const A = Object.values(bookOf(null).addrs); return { addresses: A.length, eligible: A.filter(a => a.ad_matching_eligible).length, news: A.filter(a => a.news).length, gm: A.filter(a => a.links.some(l => l.role === 'gm')).length, player: A.filter(a => a.links.some(l => l.role === 'player')).length, handoff: A.filter(a => a.links.some(l => l.role === 'handoff')).length, suppressed: bookOf(null).suppress.size, transport: mailer.describe() }; };

  // the routes; true when this module answered
  async function handle(req, res, { url, parts, send, auth, readBody }) {
    const sendHtml = (status, html) => { res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'referrer-policy': 'no-referrer' }); res.end(html); };
    if (parts[0] === 'linkmail' && parts[1] === 'sandbox' && !parts[2]) { send(200, { ok: true, sandbox: sidOf(req) }); return true; }
    if (parts[0] === 'linkmail' && parts[1] === 'handoff' && (!parts[2] || ((parts[2] === 'shown' || parts[2] === 'opened') && !parts[3]))) {
      if (req.method !== 'POST') { send(405, { ok: false, why: 'POST' }); return true; }
      let body = {}; try { body = JSON.parse((await readBody(req, 4096)).toString('utf8') || '{}'); } catch { send(400, { ok: false, why: 'send JSON' }); return true; }
      if (!parts[2]) { send(...await handoff({ req, body })); return true; }
      // the two funnel lines: cheap, but a page can be reloaded in a loop: a cap per network (in memory), quietly
      const pre = sidOf(req) ? `t:${sidOf(req)}|` : '';
      if (!allow(`${pre}f|${ipOf(req)}`, 120, 3600e3)) { send(429, { ok: false, code: 'too_many' }); return true; }
      if (parts[2] === 'shown') { try { funnel?.phoneShown({ req, pg: String(body?.pg || ''), landing: body?.landing }); } catch (e) { log(`funnel: ${e.message}`); } send(200, { ok: true }); return true; }
      let first = false; try { first = !!funnel?.handoffOpened({ req, h: String(body?.h || ''), device: body?.device }); } catch (e) { log(`funnel: ${e.message}`); }
      send(200, { ok: true, first }); return true;
    }
    if (parts[0] === 'linkmail' && parts[1] === 'optout' && !parts[2]) {
      const site = siteFor(req, channel);
      if (req.method === 'GET') { const [st, html] = optout({ req, q: url.searchParams, form: null, site }); sendHtml(st, html); return true; }
      if (req.method === 'POST') {
        let raw = ''; try { raw = (await readBody(req, 4096)).toString('utf8'); } catch { sendHtml(413, 'too large'); return true; }
        let form = {}; try { form = raw.trim().startsWith('{') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw)); } catch { }
        const [st, html] = optout({ req, q: url.searchParams, form, site }); sendHtml(st, html); return true;
      }
      send(405, { ok: false, why: 'GET or POST' }); return true;
    }
    if (parts[0] === 'c' && parts[1] && parts[2] === 'linkmail' && !parts[3]) {
      const a = auth(req, url.searchParams, parts[1]);
      if (a.err) { send(...a.err); return true; }
      if (req.method === 'GET') { send(...status({ req, rt: a.rt, seat: a.seat })); return true; }
      if (req.method === 'POST') {
        let body = {}; try { body = JSON.parse((await readBody(req, 4096)).toString('utf8') || '{}'); } catch { send(400, { ok: false, why: 'send JSON {email, news}' }); return true; }
        send(...await request({ req, rt: a.rt, seat: a.seat, body })); return true;
      }
      send(405, { ok: false, why: 'GET or POST' }); return true;
    }
    return false;
  }
  return { handle, summary, book: (sid) => bookOf(sid), keyOf };
}
