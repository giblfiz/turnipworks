// THE FUNNEL: "a table that played" (Harry 2026-10-20, rule zero: measure before spending; approved 2026-10-23).
// The counted event is a table that played: a GM opened a table and at least one OTHER person (a different human seat)
// joined it. Not page views, and no trackers in the game: the relay sees all of it already, so it is counted here.
// Upstream, cheaply: tables started, invites made, the first join. docs/NETCODE.md "The funnel".
//
// WHERE: <DATA_DIR>/funnel/events.jsonl, append-only, one small JSON line per event, backed up with the campaigns.
//   {ev:'campaign', at, c, test, country, landing}   a table started (POST /campaigns)
//   {ev:'open', at, c}                               the creating GM's seat first connected
//   {ev:'invite', at, c, seat}                       a human seat made by someone (an invite)
//   {ev:'join', at, c, seat}                         that seat's first connection (once per seat, ever)
//   {ev:'played', at, c, id, seat, together, sameNet, country, adEligible, landing}   once per table: the counted event
//   {ev:'together', at, c}                           once per table: the GM and another person connected at the same time
//   {ev:'acted', at, c, what}                        once per table: the GM's first real action (what: placed | moved |
//                                                    built | rolled | invited)
//   {ev:'gmtime', at, c, ms}                         the GM's time on the table so far, written when the GM's last
//                                                    connection closes, until the table is engaged (so a restart keeps it)
//   {ev:'engaged', at, c, secs, what}                once per table: ENGAGED (below)
//   {ev:'exclude' | 'include', at, c, why}           by hand (engine/tools/funnel_report.mjs --exclude); c may also be a
//                                                    phone page's pg_… or a handoff's hd_… (a pg_ takes its handoffs out too)
// Only tables started after this existed have a 'campaign' line; older tables are never counted.
//
// ENGAGED (2026-10-24): the GM's table counts as engaged when the GM has been on it at least ENGAGED_MS (180 s, added
// up over visits: the time any connection of the GM's own seat was open, as the relay saw it) AND the GM's own seat has
// done at least one real action: placed, moved or built something, rolled a die, or invited someone (REAL_ACTIONS).
// Server-side only: the relay sees every command. Chat, settings, fog, the camera and the intro's phantom seat do not
// count. The time a relay restart cuts off mid-visit is lost up to the restart (the GM's connections close on a clean
// stop, which writes 'gmtime'). Left out of the count exactly as tables are (test / excluded).
//
// THE PHONE PAGE AND THE HANDOFF (2026-10-24; client/phone.js, relay/linkmail.js "handoff"): not tied to a table.
//   {ev:'phone', at, pg, test, country, landing}      the phone page was shown (pg: the page's own random id)
//   {ev:'handoff', at, h, pg, test, country, landing} "email yourself the link" sent from it (no address here)
//   {ev:'handoff_open', at, h, device, test, country} that link opened (device: desktop | phone), once per h and device
// A table started from an opened handoff link carries `landing.handoff = h` on its 'campaign' line, so the report can
// say "phone ad → desktop" (the phone visit's utm_* and click id ride in the link).
//
// NOT COUNTED (the line still says so, `test`: why): our own testing must not move the number.
//   sandbox   the request carried X-TW-Test (every browser tests/tw_sandbox.py opens)
//   name      "TEST …", "… (throwaway)", the Ring lab / Label lab design tables, "promo …"
//   local     made on the build box itself (no Cloudflare country header and a loopback address): suites, promo captures,
//             the box-local door http://127.0.0.1:8180/
//   (by hand) funnel_report.mjs --exclude <cmp> "why"
//
// WHAT IS KEPT, AND NOT: no IP address, no name, no email. The country is Cloudflare's CF-IPCountry for the GM's request
// (two letters). `landing` is what the GM's browser arrived with (client/landing.js: utm_*, ref, the referring site's
// host, and an ad click id ONLY when the country may be used for ads, see adEligible). `sameNet` (the player joined from
// the GM's network: maybe the GM opening their own invite) is worked out from a keyed hash held in memory for a day and
// never written.
//
// THE CONVERSION HOOK (for a later ad pixel / CAPI; nothing is sent anywhere today): funnel.onPlayed(fn) is called with
// the played event. A hook must send nothing for an event whose adEligible is false (EEA + UK + CH + unknown/Tor, the
// geofence: docs/marketing/ads-rules-briefing-2026-10.md §2.9) or whose table is excluded (it is never called for those).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { newId } from '../core/ids.js';

// the geofence (Harry 2026-10-21): EEA (EU27 + IS, LI, NO) + UK + CH, and unknown / Tor (Cloudflare XX, T1). EU outermost
// regions with their own codes (GF GP MQ RE YT MF AX) are EU territory; the Crown dependencies and Gibraltar (JE GG IM GI)
// are left out too, to be safe (their own laws mirror GDPR).
const EU27 = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split(' ');
export const NO_ADS = new Set([...EU27, 'IS', 'LI', 'NO', 'GB', 'UK', 'CH', 'GF', 'GP', 'MQ', 'RE', 'YT', 'MF', 'AX', 'JE', 'GG', 'IM', 'GI', 'EU', 'XX', 'T1']);
// CF-IPCountry: two capital letters, or XX / T1. No header (a request that did not come through Cloudflare): null.
export function countryOf(req) {
  const v = String(req.headers['cf-ipcountry'] || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9]$/.test(v) ? v : (v ? 'XX' : null);
}
export const adEligibleCountry = (country) => !!country && /^[A-Z]{2}$/.test(country) && !NO_ADS.has(country);
const LOOPBACK = /^(127\.|::1$|::ffff:127\.|localhost$|\?$)/;
export function testReason(req, name) {
  const sb = String(req.headers['x-tw-test'] || '');
  if (sb) return 'sandbox';
  if (/\bTEST\b|\(throwaway\)|^ring lab\b|^label lab\b|^promo\b/i.test(String(name || ''))) return 'name';
  const ip = String(req.headers['x-real-ip'] || req.socket?.remoteAddress || '?');
  if (!req.headers['cf-ipcountry'] && LOOPBACK.test(ip)) return 'local';
  return null;
}

// what the client says the GM's browser landed with (client/landing.js): known keys only, short strings
export const LANDING_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'referrer', 'landed'];
// the ad click ids, and whose they are. Google: gclid, and gbraid / wbraid (iOS app / web measurement); Meta: fbclid;
// Reddit: rdt_cid (checked 2026-10-24: Google Campaign Manager 360's list of third-party click ids names Reddit's as
// rdt_cid, as do the CAPI vendors' guides; Reddit's own help pages would not load); Microsoft msclkid; TikTok ttclid;
// X twclid.
export const CLICK_SOURCE = { gclid: 'google', gbraid: 'google', wbraid: 'google', fbclid: 'meta', rdt_cid: 'reddit', msclkid: 'microsoft', ttclid: 'tiktok', twclid: 'x' };
export const CLICK_KEYS = Object.keys(CLICK_SOURCE);
const HANDOFF = /^hd_[0-9a-z]{6,24}$/;
// -> the known keys only, trimmed, control characters out, short. A click id itself is kept only with {clicks: true} (the
// country may be used for ads); WHICH platform's click it was (`click`: google | meta | reddit | …) is kept either way:
// it names an ad platform, as utm_source does, and identifies no one. `handoff`: the phone page's link (above).
export function cleanLanding(v, { clicks = false } = {}) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = {};
  const str = (x, n) => typeof x === 'string' && x.trim() ? x.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, n) : null;
  for (const k of LANDING_KEYS) {
    const x = v[k];
    if (k === 'landed') { const n = Number(x); if (Number.isFinite(n) && n > 1.6e12 && n < 4e12) out.landed = Math.round(n); continue; }
    const s = str(x, 100); if (s) out[k] = s;
  }
  for (const k of CLICK_KEYS) { const s = str(v[k], 200); if (!s) continue; out.click ??= CLICK_SOURCE[k]; if (clicks) out[k] = s; }
  if (!out.click && typeof v.click === 'string' && Object.values(CLICK_SOURCE).includes(v.click)) out.click = v.click;
  if (typeof v.handoff === 'string' && HANDOFF.test(v.handoff)) out.handoff = v.handoff;
  return Object.keys(out).length ? out : null;
}
export const clickSourceOf = (landing) => landing?.click || CLICK_KEYS.map(k => landing?.[k] && CLICK_SOURCE[k]).find(Boolean) || null;

// ENGAGED (see the top): what counts as the GM doing something real
export const ENGAGED_MS = 180e3;
const ACTS = {
  'token.create': 'placed', 'object.place': 'placed', 'template.place': 'placed', 'pawn.bring': 'placed',
  'token.move': 'moved', 'object.move': 'moved', 'room.move': 'moved', 'room.rotate': 'moved', 'transfer': 'moved', 'travel': 'moved',
  'room.spawn': 'built', 'area.create': 'built', 'edge.set': 'built', 'building.set': 'built', 'water.set': 'built', 'area.ground': 'built',
  'dice.roll': 'rolled',
};
// a committed record's real action, or null. rec: { camp?: {type, args}, fx: [{type, args}] } (relay/campaign.js commit)
export function realAction(rec) {
  if (rec?.camp?.type === 'seat.create') return rec.camp.args?.kind === 'human' ? 'invited' : null;
  if (rec?.camp && ACTS[rec.camp.type]) return ACTS[rec.camp.type];
  for (const f of rec?.fx || []) {
    if (ACTS[f.type]) return ACTS[f.type];
    if (f.type === 'batch') for (const op of f.args?.ops || []) if (ACTS[op?.type]) return ACTS[op.type];
  }
  return null;
}

export function makeFunnel({ dataDir, secret = crypto.randomBytes(16).toString('hex'), log = () => {}, now = Date.now, engagedMs = ENGAGED_MS, sweepMs = 15e3 }) {
  const dir = path.join(dataDir, 'funnel'), file = path.join(dir, 'events.jsonl');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tables = new Map(); // cid -> { test, country, landing, gmSeat, opened, joined:Set, played, together, invites, acted, gmMs, engaged }
  const nets = new Map();   // cid -> { h, at }  the GM's network, keyed hash, memory only (sameNet)
  const gmOn = new Map();   // cid -> ms the GM's seat came on (memory only: a connection is open now)
  const handoffs = new Map(); // h -> { at, opened: Set(device) }   the phone page's links (bounded below)
  const hooks = [];
  function fold(e) {
    if (e.ev === 'campaign') { tables.set(e.c, { at: e.at, test: e.test || null, country: e.country || null, landing: e.landing || null, gmSeat: e.gmSeat || null, opened: false, joined: new Set(), played: null, together: false, invites: 0, excluded: null, acted: null, gmMs: 0, engaged: null }); return; }
    if (e.ev === 'handoff') { handoffs.set(e.h, { at: e.at, opened: new Set() }); return; }
    if (e.ev === 'handoff_open') { handoffs.get(e.h)?.opened.add(e.device); return; }
    const t = tables.get(e.c); if (!t) return;
    if (e.ev === 'open') t.opened = true;
    else if (e.ev === 'invite') t.invites++;
    else if (e.ev === 'join') t.joined.add(e.seat);
    else if (e.ev === 'played') t.played = e;
    else if (e.ev === 'together') t.together = true;
    else if (e.ev === 'acted') t.acted ??= e.what || 'acted';
    else if (e.ev === 'gmtime') t.gmMs = Math.max(t.gmMs, Number(e.ms) || 0);
    else if (e.ev === 'engaged') t.engaged = e;
    else if (e.ev === 'exclude') t.excluded = e.why || 'by hand';
    else if (e.ev === 'include') t.excluded = null;
  }
  try { for (const line of fs.readFileSync(file, 'utf8').split('\n')) { if (!line.trim()) continue; try { fold(JSON.parse(line)); } catch { } } } catch { }
  function append(e) {
    const rec = { at: now(), ...e };
    try { fs.appendFileSync(file, JSON.stringify(rec) + '\n', { mode: 0o600 }); } catch (err) { log(`funnel: could not write (${err.message})`); }
    fold(rec); return rec;
  }
  const netHash = (req) => crypto.createHmac('sha256', secret).update('net:' + String(req.headers['x-real-ip'] || req.socket?.remoteAddress || '?')).digest('hex').slice(0, 16);
  const counted = (t) => t && !t.test && !t.excluded;

  // ---- the relay calls these ----
  function created(rt, { req, name, gmSeat, landing }) {
    const country = countryOf(req), ok = adEligibleCountry(country);
    const test = testReason(req, name);
    append({ ev: 'campaign', c: rt.id, test, country, gmSeat, landing: cleanLanding(landing, { clicks: ok }) });
    nets.set(rt.id, { h: netHash(req), at: now() });
    for (const [c, n] of nets) if (now() - n.at > 86400e3) nets.delete(c);
  }
  function seatMade(rt, args, by) { // a seat.create committed
    const t = tables.get(rt.id);
    if (!t || !by || args?.kind !== 'human') return;
    append({ ev: 'invite', c: rt.id, seat: args.id });
  }
  function attached(rt, seat, req) { // a connection said hello (an HTTP-upgrade or SSE request)
    const t = tables.get(rt.id), s = rt.state.seats[seat];
    if (!t || s?.kind !== 'human') return;
    const gmSide = seat === t.gmSeat;
    if (gmSide) { if (!t.opened) append({ ev: 'open', c: rt.id }); if (!gmOn.has(rt.id)) gmOn.set(rt.id, now()); }
    else if (!t.joined.has(seat)) append({ ev: 'join', c: rt.id, seat });
    // played: the GM has opened it and another person has joined, in either order (once per table, ever)
    if (!t.played && t.opened && t.joined.size) {
      const n = nets.get(rt.id), who = gmSide ? [...t.joined][0] : seat;
      const ev = append({ ev: 'played', c: rt.id, id: newId('pl', 12), seat: who, together: gmOnline(rt, t) && otherOnline(rt, t), sameNet: !gmSide && n && req ? n.h === netHash(req) : null, country: t.country, adEligible: adEligibleCountry(t.country), landing: t.landing });
      if (counted(t)) for (const fn of hooks) { try { fn(ev); } catch (err) { log(`funnel hook: ${err.message}`); } }
    }
    if (!t.together && t.played && !t.played.together && gmOnline(rt, t) && otherOnline(rt, t)) append({ ev: 'together', c: rt.id });
  }
  // a connection closed (after the runtime let go of it): the GM's time on the table
  function detached(rt, seat) {
    const t = tables.get(rt.id);
    if (!t || seat !== t.gmSeat || !gmOn.has(rt.id) || gmOnline(rt, t)) return;
    const ms = gmMsOf(rt.id, t); gmOn.delete(rt.id);
    if (!t.engaged) { check(rt.id, t, ms); if (!t.engaged) append({ ev: 'gmtime', c: rt.id, ms: Math.round(ms) }); }
  }
  // a command committed (relay/campaign.js afterCommit): the GM's first real action
  function committed(rt, rec, by) {
    const t = tables.get(rt.id);
    if (!t || t.engaged || by !== t.gmSeat || rt.state.seats[by]?.kind !== 'human') return;
    if (!t.acted) { const what = realAction(rec); if (!what) return; append({ ev: 'acted', c: rt.id, what }); }
    check(rt.id, t);
  }
  const gmMsOf = (c, t) => t.gmMs + (gmOn.has(c) ? now() - gmOn.get(c) : 0);
  function check(c, t, ms = gmMsOf(c, t)) {
    if (t.engaged || !t.acted || ms < engagedMs) return;
    append({ ev: 'engaged', c, secs: Math.round(ms / 1000), what: t.acted });
  }
  const sweep = setInterval(() => { for (const c of gmOn.keys()) { const t = tables.get(c); if (t) check(c, t); } }, sweepMs);
  sweep.unref?.();
  const humans = (rt) => [...rt.conns].map(c => c.seat).filter(s => rt.state.seats[s]?.kind === 'human');
  const gmOnline = (rt, t) => humans(rt).includes(t.gmSeat);
  const otherOnline = (rt, t) => humans(rt).some(s => s !== t.gmSeat);

  // ---- the phone page (client/phone.js) and its handoff link (relay/linkmail.js) ----
  const PG = /^pg_[0-9a-z]{8,24}$/;
  function phoneShown({ req, pg, landing }) {
    const country = countryOf(req);
    return append({ ev: 'phone', pg: PG.test(pg || '') ? pg : null, test: testReason(req, ''), country, landing: cleanLanding(landing, { clicks: adEligibleCountry(country) }) });
  }
  function handoffSent({ req, h, pg, landing }) {
    const country = countryOf(req);
    for (const [k, v] of handoffs) if (now() - v.at > 120 * 86400e3) handoffs.delete(k);
    return append({ ev: 'handoff', h, pg: PG.test(pg || '') ? pg : null, test: testReason(req, ''), country, landing: cleanLanding(landing, { clicks: adEligibleCountry(country) }) });
  }
  // -> true when this is the first open of that link on that kind of device (an unknown link: false, nothing written)
  function handoffOpened({ req, h, device }) {
    const d = device === 'phone' ? 'phone' : 'desktop', H = handoffs.get(h);
    if (!HANDOFF.test(h || '') || !H || H.opened.has(d)) return false;
    append({ ev: 'handoff_open', h, device: d, test: testReason(req, ''), country: countryOf(req) });
    return true;
  }

  return {
    file, created, seatMade, attached, detached, committed, phoneShown, handoffSent, handoffOpened,
    onPlayed: (fn) => { hooks.push(fn); },
    table: (cid) => { const t = tables.get(cid); return t ? { ...t, joined: [...t.joined], gmMs: gmMsOf(cid, t) } : null; },
    handoff: (h) => { const H = handoffs.get(h); return H ? { at: H.at, opened: [...H.opened] } : null; },
    sweep: () => { for (const c of gmOn.keys()) { const t = tables.get(c); if (t) check(c, t); } },
    // the relay is stopping: the GM's time so far is written now (the connections' own close events may come too late)
    close: () => { clearInterval(sweep); for (const c of [...gmOn.keys()]) { const t = tables.get(c); if (t && !t.engaged) { const ms = gmMsOf(c, t); check(c, t, ms); if (!t.engaged) append({ ev: 'gmtime', c, ms: Math.round(ms) }); } gmOn.delete(c); } },
    report: (opts = {}) => report(readEvents(file), opts),
  };
}

// ---- the report (engine/tools/funnel_report.mjs and GET /admin/funnel): from the file, so a hand edit shows at once ----
export function readEvents(file) {
  const out = [];
  try { for (const line of fs.readFileSync(file, 'utf8').split('\n')) { if (!line.trim()) continue; try { out.push(JSON.parse(line)); } catch { } } } catch { }
  return out;
}
const dayOf = (ms, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
export const DAY_COLS = ['started', 'invites', 'invited', 'joined', 'played', 'together', 'sameNet', 'engaged'];
export const PHONE_COLS = ['phone', 'handoff', 'opened', 'fromPhone'];
export const BY_KEYS = ['utm_content', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'ref', 'referrer'];
// -> { tz, days: [{day, started, invites, invited, joined, played, together, sameNet, engaged, phone, handoff, opened,
//      fromPhone}], totals, excluded: {why: n}, by?: [...], tables? }
//   started   tables started that day             invites   invites made that day (seats)
//   invited   tables whose FIRST invite was that day   joined   tables whose first other person arrived that day
//   played    tables that played that day (the counted event)   together   of those, the GM and the player were on at once
//   sameNet   of those, the player came from the GM's own network (maybe the GM opening their own invite)
//   engaged   tables that became engaged that day (the GM 180 s on it and a real action: see ENGAGED at the top)
//   phone     the phone page shown   handoff   its "email yourself the link" sent   opened   such a link opened on a
//             computer (first open per link)   fromPhone   tables started that day from an opened handoff link
// by: 'utm_content' (or another BY_KEYS key) adds rows per value of that key and the click id's platform (`click`:
//   google | meta | reddit | … | null), with the same counts; a handoff's opens and tables count under the phone visit's.
export function report(events, { days = 30, tz = 'America/Los_Angeles', tests = false, until = Date.now(), by = null } = {}) {
  const T = new Map(), H = new Map(), P = [], X = new Map(); // X: a phone page (pg_) or handoff (hd_) excluded by hand
  for (const e of events) if ((e.ev === 'exclude' || e.ev === 'include') && /^(pg|hd)_/.test(e.c || '')) { if (e.ev === 'exclude') X.set(e.c, e.why || 'by hand'); else X.delete(e.c); }
  for (const e of events) {
    if (e.ev === 'phone') { P.push(e); continue; }
    if (e.ev === 'handoff') { H.set(e.h, { ...e, opens: [] }); continue; }
    if (e.ev === 'handoff_open') { const h = H.get(e.h); if (h && !h.opens.some(o => o.device === e.device)) h.opens.push(e); continue; }
    if (e.ev === 'campaign') T.set(e.c, { c: e.c, at: e.at, test: e.test || null, excluded: null, country: e.country || null, landing: e.landing || null, invites: [], joins: [], played: null, together: null, engaged: null });
    const t = T.get(e.c); if (!t) continue;
    if (e.ev === 'invite') t.invites.push(e.at);
    else if (e.ev === 'join') t.joins.push(e.at);
    else if (e.ev === 'played') t.played = e;
    else if (e.ev === 'together') t.together = e.at;
    else if (e.ev === 'engaged') t.engaged ??= e;
    else if (e.ev === 'exclude') t.excluded = e.why || 'by hand';
    else if (e.ev === 'include') t.excluded = null;
  }
  const since = until - days * 86400e3;
  const zero = () => Object.fromEntries([...DAY_COLS, ...PHONE_COLS].map(k => [k, 0]));
  const rows = new Map(), row = (ms) => { const d = dayOf(ms, tz); if (!rows.has(d)) rows.set(d, { day: d, ...zero() }); return rows.get(d); };
  const groups = new Map(), byKey = BY_KEYS.includes(by) ? by : null;
  const group = (landing) => { const v = landing?.[byKey] ?? null, click = clickSourceOf(landing), k = `${v}\u0000${click}`; if (!groups.has(k)) groups.set(k, { [byKey]: v, click, ...zero() }); return groups.get(k); };
  const excluded = {}, totals = zero();
  const add = (k, ms, landing) => { if (ms < since || ms > until) return; row(ms)[k]++; totals[k]++; if (byKey) group(landing)[k]++; };
  for (const t of T.values()) {
    const why = t.test || t.excluded;
    if (why) { if (t.at >= since) excluded[why] = (excluded[why] || 0) + 1; continue; }
    const L = t.landing;
    add('started', t.at, L);
    if (L?.handoff && H.has(L.handoff)) add('fromPhone', t.at, H.get(L.handoff).landing || L);
    for (const at of t.invites) add('invites', at, L);
    if (t.invites.length) add('invited', Math.min(...t.invites), L);
    if (t.joins.length) add('joined', Math.min(...t.joins), L);
    if (t.played) { add('played', t.played.at, L); if (t.played.together || t.together) add('together', t.played.at, L); if (t.played.sameNet) add('sameNet', t.played.at, L); }
    if (t.engaged) add('engaged', t.engaged.at, L);
  }
  // the phone page: the same exclusions (sandbox, box-local), each line on its own
  const skip = (e, kind) => { const why = e.test || X.get(kind === 'phone' ? e.pg : e.h) || (kind === 'handoff' && X.get(e.pg)); if (!why) return false; if (e.at >= since && e.at <= until) excluded[`${kind} ${why}`] = (excluded[`${kind} ${why}`] || 0) + 1; return true; };
  for (const e of P) if (!skip(e, 'phone')) add('phone', e.at, e.landing);
  for (const h of H.values()) {
    if (skip(h, 'handoff')) continue;
    add('handoff', h.at, h.landing);
    const o = h.opens.find(x => x.device === 'desktop' && !x.test); if (o) add('opened', o.at, h.landing);
  }
  const out = { tz, since: new Date(since).toISOString(), until: new Date(until).toISOString(), days: [...rows.values()].sort((a, b) => a.day < b.day ? -1 : 1), totals, excluded };
  if (byKey) out.by = [...groups.values()].sort((a, b) => b.started + b.phone - (a.started + a.phone) || String(a[byKey]).localeCompare(String(b[byKey])));
  if (tests) out.tables = [...T.values()].filter(t => t.at >= since).map(t => ({ c: t.c, at: new Date(t.at).toISOString(), test: t.test, excluded: t.excluded, country: t.country, invites: t.invites.length, joins: t.joins.length, played: !!t.played, together: !!(t.played?.together || t.together), sameNet: t.played?.sameNet ?? null, engaged: !!t.engaged, click: clickSourceOf(t.landing), handoff: t.landing?.handoff || null, landing: t.landing }));
  return out;
}
