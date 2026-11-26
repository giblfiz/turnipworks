// SAFE HARBOUR MECHANICS (2026-11-06; docs/UPLOADS.md "Safe harbour"; the words are DRAFTS in docs/legal/). The US DMCA
// (17 U.S.C. §512(c)) protects a service from copyright damages over what its users store, IF it has a designated agent,
// takes material down promptly on a valid notice, handles counter-notices, and has (and follows) a repeat-infringer
// policy. This file is the machinery for those; it sends nothing outward (no mail: Fauna forwards by hand, and the
// admin view says what is waiting). Nothing here is legal advice, and none of it makes TW safe until the paperwork
// in docs/legal/DMCA_AGENT_REGISTRATION.md is done.
//
// WHERE: <DATA_DIR>/dmca/
//   notices/<id>.json     a takedown notice as received (the form at /dmca), its status and what was done about it
//   counters/<id>.json    a counter-notice (the GM's, from the game), its status and its restore window
//   strikes.json          { campaigns: { cid: [{at, notice, raws, reversed}] }, ips: { ipHash: [{…, campaign}] },
//                         ended: { cid: {at, notice} }, reinstated: { cid: [{at, why, by, ended}] } }
//   safe-harbour.json     the readiness record (written by hand / engine/tools/dmca_admin.mjs ready): what prod hosting
//                         and public sharing wait for. { agent: {name, org, address, phone, number, at}, policyUrl,
//                         termsUrl, mailbox, counsel }
//   log.jsonl             every step
//
// HTTP
//   GET  /dmca                         the copyright policy page and the notice form (no script)
//   POST /dmca/notice                  the form (application/x-www-form-urlencoded) -> a receipt page with the notice id
//   POST /c/<cid>/uploads/<id>/counter the GM's counter-notice, from the game (relay/uploads.js routes it here)
//   box-only (x-tw-admin), what engine/tools/dmca_admin.mjs calls:
//   GET  /admin/dmca                   notices, counters, restores due, strikes, readiness
//   GET  /admin/dmca/find?q=           uploaded models by name, id, file hash or campaign, across every campaign
//   POST /admin/dmca/takedown          {notice, raw | id, block?}   disable a file everywhere, strike its uploaders
//   POST /admin/dmca/notice/<id>/reject {why}                         a notice that is not valid (recorded)
//   POST /admin/dmca/counter/<id>/forward | lawsuit | reject | close  the counter-notice's next step (reject, close: any open state)
//   POST /admin/dmca/reinstate         {campaign, why}                 a GM's appeal upheld: the campaign's cut-off is lifted
//   POST /admin/dmca/restore           {raw, why}                     by hand (the tick does it when the window opens)
//   POST /admin/dmca/tick                                             run the restore check now
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PUBLIC_FLAG } from '../core/uploads.js';

// docs/legal/REPEAT_INFRINGER_POLICY.md. strikes: a campaign's (its GM is the account holder). ipStrikes: one network address's
// across campaigns (a GM who starts a new campaign to start again), set higher because an address can be a whole school or café.
export const REPEAT = Object.freeze({ strikes: 3, ipStrikes: 5, windowMs: 365 * 24 * 3600e3 });
export const RESTORE_DAYS = Object.freeze({ min: 10, max: 14 }); // §512(g)(2)(C): business days after the counter-notice
export const DMCA_ADDRESS = 'dmca@<your-domain>'; // PROPOSED; no mail routing exists for it yet (docs/legal/)
// the service provider (Harry, 2026-11-07: "We can do it thru implausible"; docs/legal/DMCA_AGENT_REGISTRATION.md)
export const OPERATOR = 'Implausible Enterprises LLC';
const TZ = 'America/Los_Angeles'; // business days are counted where the service is run
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------------------------------------------------------------- business days (US federal holidays, observed)
const nth = (y, m, wd, n) => { const d = new Date(Date.UTC(y, m, 1)); const off = (wd - d.getUTCDay() + 7) % 7; return 1 + off + (n - 1) * 7; };
const last = (y, m, wd) => { const d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - ((d.getUTCDay() - wd + 7) % 7); };
const observed = (y, m, d) => { const w = new Date(Date.UTC(y, m, d)).getUTCDay(); const t = new Date(Date.UTC(y, m, d + (w === 6 ? -1 : w === 0 ? 1 : 0))); return t.toISOString().slice(0, 10); };
export function holidays(y) {
  return new Set([observed(y, 0, 1), `${y}-01-${String(nth(y, 0, 1, 3)).padStart(2, '0')}`, `${y}-02-${String(nth(y, 1, 1, 3)).padStart(2, '0')}`, `${y}-05-${String(last(y, 4, 1)).padStart(2, '0')}`,
    observed(y, 5, 19), observed(y, 6, 4), `${y}-09-${String(nth(y, 8, 1, 1)).padStart(2, '0')}`, `${y}-10-${String(nth(y, 9, 1, 2)).padStart(2, '0')}`, observed(y, 10, 11),
    `${y}-11-${String(nth(y, 10, 4, 4)).padStart(2, '0')}`, observed(y, 11, 25), observed(y + 1, 0, 1)]);
}
const localDay = (ms) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms)).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; };
const offsetMin = (ms) => { const s = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' }).formatToParts(new Date(ms)).find(x => x.type === 'timeZoneName').value; const m = /GMT([+-]\d+)(?::(\d+))?/.exec(s); return m ? (+m[1]) * 60 + Math.sign(+m[1]) * (+(m[2] || 0)) : 0; };
const midnightOf = (day) => { const [y, m, d] = day.split('-').map(Number), guess = Date.UTC(y, m - 1, d, 8); return Date.UTC(y, m - 1, d) - offsetMin(guess) * 60e3; };
export const isBusinessDay = (day) => { const w = new Date(day + 'T12:00:00Z').getUTCDay(); return w !== 0 && w !== 6 && !holidays(+day.slice(0, 4)).has(day); };
const nextDay = (day) => new Date(Date.parse(day + 'T12:00:00Z') + 86400e3).toISOString().slice(0, 10);
// the end of the n-th business day after the day `ms` falls on (local time): the receipt day itself never counts
export function businessDaysAfter(ms, n) { let day = localDay(ms), k = 0; while (k < n) { day = nextDay(day); if (isBusinessDay(day)) k++; } return { day, end: midnightOf(nextDay(day)) }; }
// the window a counter-notice opens: restore not before the end of the 10th business day, and by the end of the 14th
export const restoreWindow = (receivedMs) => ({ after: businessDaysAfter(receivedMs, RESTORE_DAYS.min).end, by: businessDaysAfter(receivedMs, RESTORE_DAYS.max).end, afterDay: businessDaysAfter(receivedMs, RESTORE_DAYS.min).day, byDay: businessDaysAfter(receivedMs, RESTORE_DAYS.max).day });

// ---------------------------------------------------------------- the notice: what §512(c)(3)(A) asks of one
export const NOTICE_FIELDS = Object.freeze({
  name: { max: 120, req: true, label: 'Your full name' }, org: { max: 120, label: 'Company or organisation (if any)' },
  role: { enum: ['owner', 'agent'], req: true, label: 'You are' }, email: { max: 200, email: true, label: 'Email' },
  address: { max: 400, req: true, label: 'Postal address' }, phone: { max: 40, label: 'Phone' },
  work: { max: 4000, req: true, min: 3, label: 'The copyrighted work' }, material: { max: 4000, req: true, min: 3, label: 'The material on Turnip Works' },
  goodfaith: { check: true, label: 'Good-faith statement' }, accurate: { check: true, label: 'Accuracy and authority statement' }, signature: { max: 120, req: true, label: 'Signature' },
});
export const COUNTER_FIELDS = Object.freeze({
  name: { max: 120, req: true }, address: { max: 400, req: true }, phone: { max: 40, req: true }, email: { max: 200, email: true },
  mistake: { check: true }, jurisdiction: { check: true }, service: { check: true }, signature: { max: 120, req: true }, explain: { max: 2000 },
});
export function checkFields(spec, body) {
  const out = {}, bad = [];
  for (const [k, f] of Object.entries(spec)) {
    let v = body[k];
    if (f.check) { const on = v === true || v === 'on' || v === '1' || v === 'yes'; if (!on) bad.push(k); out[k] = on; continue; }
    v = typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim() : '';
    if (v.length > f.max) v = v.slice(0, f.max);
    if (f.req && !v) { bad.push(k); continue; }
    if (f.min && v.length < f.min) { bad.push(k); continue; }
    if (f.email && v && !/^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,}$/i.test(v)) { bad.push(k); continue; }
    if (f.enum && v && !f.enum.includes(v)) { bad.push(k); continue; }
    out[k] = v;
  }
  // (2026-11-06, the adversarial review: the statute asks for SUBSTANTIAL compliance, so the form's conveniences are not
  // grounds to refuse. A signature unlike the name is kept and flagged, since an agent may sign for an owner; a way to
  // reach the sender is email OR phone, beside the postal address.)
  if (spec === NOTICE_FIELDS && !out.email && !out.phone) bad.push('email');
  const flags = out.signature && out.name && out.signature.toLowerCase().replace(/\s+/g, ' ') !== out.name.toLowerCase().replace(/\s+/g, ' ') ? ['signature-differs-from-name'] : [];
  return { fields: out, bad: [...new Set(bad)], flags };
}

export const NOTICE_LIMITS = Object.freeze({ perIpHour: 5, perDay: 200 });
export function makeDmca({ dataDir, uploads, secret, log = () => {}, channel = 'dev', env = process.env, now = () => Date.now(), limits = {} }) {
  const LIM = { ...NOTICE_LIMITS, ...limits };
  const root = path.join(dataDir, 'dmca'), nDir = path.join(root, 'notices'), cDir = path.join(root, 'counters');
  for (const d of [root, nDir, cDir]) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  const readJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
  const writeJ = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 1), { mode: 0o600 });
  const event = (e) => { try { fs.appendFileSync(path.join(root, 'log.jsonl'), JSON.stringify({ at: now(), ...e }) + '\n', { mode: 0o600 }); } catch { } };
  const ID = /^(ntc|ctr)_[0-9a-z]{12}$/;
  const OPEN = ['received', 'forwarded', 'lawsuit']; // a counter-notice being handled
  const newRid = (p) => `${p}_${crypto.randomBytes(9).toString('base64url').toLowerCase().replace(/[^0-9a-z]/g, '0').slice(0, 12)}`;
  const notice = (id) => ID.test(id || '') ? readJ(path.join(nDir, id + '.json'), null) : null;
  const counter = (id) => ID.test(id || '') ? readJ(path.join(cDir, id + '.json'), null) : null;
  const notices = () => fs.readdirSync(nDir).filter(f => f.endsWith('.json')).map(f => readJ(path.join(nDir, f), null)).filter(Boolean).sort((a, b) => a.at - b.at);
  const counters = () => fs.readdirSync(cDir).filter(f => f.endsWith('.json')).map(f => readJ(path.join(cDir, f), null)).filter(Boolean).sort((a, b) => a.at - b.at);
  const ipHash = (ip) => crypto.createHmac('sha256', secret).update('dmca-ip|' + String(ip)).digest('hex').slice(0, 20);
  const strikesFile = path.join(root, 'strikes.json');
  // A STRIKE (2026-11-23, the tester's findings F2/F4) is one per (notice, campaign) however many of the campaign's files
  // that notice named ("one strike per takedown, however many copies"), and for an address one per (notice, campaign), so
  // clearing campaign A's does not clear B's. It lists its files (raws) and which of them were REVERSED for that campaign
  // (a counter-notice that stood, the notice withdrawn or found invalid): it is LIVE while any of its takedowns stands,
  // within 12 months, unless an admin's reinstate FORGAVE it. Records of the older shape ({raw}, one per file) read as this.
  function normList(L, keyOf) {
    const out = new Map(), standing = new Map();
    for (const x0 of Array.isArray(L) ? L : []) {
      const raws = [...new Set(x0.raws || (x0.raw ? [x0.raw] : []))], reversed = { ...(x0.reversed || {}) };
      if (x0.cleared && !x0.raws) for (const r of raws) reversed[r] ||= { at: x0.cleared, why: x0.clearedWhy || '' };
      const { raw, ...x } = { ...x0, raws, reversed }, k = keyOf(x);
      for (const r of raws) if (!reversed[r]) (standing.get(k) || standing.set(k, new Set()).get(k)).add(r);
      const y = out.get(k);
      if (!y) { out.set(k, x); continue; }
      y.at = Math.min(y.at, x.at); y.raws = [...new Set([...y.raws, ...x.raws])]; Object.assign(y.reversed, x.reversed);
      if (x.forgiven && !y.forgiven) y.forgiven = x.forgiven;
    }
    for (const [k, y] of out) {
      for (const r of standing.get(k) || []) delete y.reversed[r];
      const all = y.raws.length && y.raws.every(r => y.reversed[r]);
      if (all) { y.cleared ||= Math.max(...y.raws.map(r => y.reversed[r].at || 0)); y.clearedWhy ||= y.reversed[y.raws[0]].why; } else { delete y.cleared; delete y.clearedWhy; }
    }
    return [...out.values()];
  }
  const strikes = () => {
    const S = { campaigns: {}, ips: {}, ended: {}, reinstated: {}, ...readJ(strikesFile, {}) };
    for (const k of Object.keys(S.campaigns)) S.campaigns[k] = normList(S.campaigns[k], x => x.notice);
    for (const k of Object.keys(S.ips)) S.ips[k] = normList(S.ips[k], x => `${x.notice}|${x.campaign}`);
    S.reinstated ||= {};
    return S;
  };
  const live = (list) => (list || []).filter(s => now() - s.at < REPEAT.windowMs && !s.cleared && !s.forgiven);
  // what keeps a campaign cut off: its live strikes, except that the 12 months stop running once it is cut off (a cut-off
  // does not lapse by itself; a reversal, a withdrawal or an admin's reinstate lifts it)
  const standing = (S, cid) => { const E = S.ended[cid]; return (S.campaigns[cid] || []).filter(s => !s.cleared && !s.forgiven && (now() - s.at < REPEAT.windowMs || (E && E.at - s.at < REPEAT.windowMs))); };

  // ---------------------------------------------------------------- the readiness gates
  // HOSTING (private uploads on a PROD relay): the harbour does not cover material stored before a designated agent exists
  // (17 U.S.C. §512(c)(2); the adversarial review put this at 99%), so a prod relay takes uploads only once the record
  // says the agent is registered, the policy and terms are published and the notice address works. A dev relay is a test
  // bench and takes them without (docs/UPLOADS.md "Where it is on"). PUBLIC SHARING needs all that, counsel's review, and
  // TW_UPLOAD_PUBLIC=1.
  // (2026-11-07) §512(c)(2) wants the agent's name, address, phone and email on the website as well as in the Office's
  // directory, so the record carries them and the policy page prints them; hosting waits for all four. What hosting does
  // NOT wait for: a verified email or any account for uploaders. Harry, 2026-11-07: email confirmation is built and
  // switched on when the first real takedown notice arrives, not before (docs/legal/FIRST_TAKEDOWN_RUNBOOK.md).
  const record = () => readJ(path.join(root, 'safe-harbour.json'), {});
  function hostingReady() {
    const R = record(), missing = [];
    if (!R.agent?.number) missing.push('no DMCA designated agent registration on record (copyright.gov; docs/legal/DMCA_AGENT_REGISTRATION.md)');
    if (!R.agent?.name) missing.push("the designated agent's name or title is not on record (it is printed on the policy page)");
    if (!R.agent?.address) missing.push("the designated agent's mailing address is not on record (it is printed on the policy page)");
    if (!R.agent?.phone) missing.push("the designated agent's phone is not on record (it is printed on the policy page)");
    if (!R.policyUrl) missing.push('the copyright policy is not published (docs/legal/DMCA_POLICY.md)');
    if (!R.termsUrl) missing.push('the upload terms are not in the published terms of use (docs/legal/UPLOAD_TERMS.md)');
    if (!R.mailbox) missing.push(`no working notice address (${DMCA_ADDRESS} or another) on record`);
    return { on: missing.length === 0, missing };
  }
  function publicSharing() {
    const missing = [...(env[PUBLIC_FLAG] !== '1' ? [`the relay's environment does not say ${PUBLIC_FLAG}=1`] : []), ...hostingReady().missing, ...(!record().counsel ? ['no counsel review on record'] : [])];
    return { on: missing.length === 0, flag: PUBLIC_FLAG, missing };
  }
  const mailbox = () => record().mailbox || null;
  // ---------------------------------------------------------------- strikes and the repeat-infringer policy
  // (2026-11-23: every refusal says what a person can do; no internal paths)
  const contact = () => mailbox() || 'hello@turnipworks.net';
  function uploadBlocked(rt, ih) {
    const S = strikes();
    if (S.ended[rt.id]) { const n = standing(S, rt.id).length; return { why: `uploading has ended for this campaign under our repeat-infringer policy (the Copyright policy, /dmca#repeat-infringers): ${n} copyright takedown${n === 1 ? '' : 's'} of its models stand. If a takedown was a mistake, send a counter-notice from that model's row in Your models: a reversed takedown stops counting, and uploading comes back when fewer than ${REPEAT.strikes} stand. To appeal, write to ${contact()}.` }; }
    if (ih && live(S.ips[ih]).length >= REPEAT.ipStrikes) return { why: `uploading is not available from this network address under our repeat-infringer policy (the Copyright policy, /dmca#repeat-infringers). If a takedown was a mistake, send a counter-notice from that model's row in Your models; to appeal, write to ${contact()}.` };
    return null;
  }
  // one strike per (notice, campaign) and per (address, notice, campaign); the same takedown again adds none, another file
  // of the same notice joins the strike it already made
  function strike(holders, { notice: nid, raw }) {
    const S = strikes(), at = now(), ips = new Set(), cs = new Set();
    const add = (L, match, base) => { let x = L.find(match); if (!x) L.push(x = { ...base, raws: [], reversed: {} }); if (!x.raws.includes(raw)) { x.raws.push(raw); delete x.forgiven; } delete x.reversed[raw]; delete x.cleared; delete x.clearedWhy; };
    for (const h of holders) {
      if (!cs.has(h.campaign)) { cs.add(h.campaign); add(S.campaigns[h.campaign] ||= [], x => x.notice === nid, { at, notice: nid }); }
      const ik = `${h.ipHash}|${h.campaign}`;
      if (h.ipHash && !ips.has(ik)) { ips.add(ik); add(S.ips[h.ipHash] ||= [], x => x.notice === nid && x.campaign === h.campaign, { at, notice: nid, campaign: h.campaign }); }
    }
    writeJ(strikesFile, S);
    return [...cs].filter(cid => reconcile(cid) === 'ended');
  }
  // THE CUT-OFF FOLLOWS THE LIVE STRIKES (2026-11-23, F2): at REPEAT.strikes the campaign may not upload and its models stop
  // being served; when reversals bring it below, it is reinstated: uploading works again, and the models removed only by
  // the cut-off come back (one a notice still holds stays removed). Run after every strike and every clearing, and by the tick.
  function reconcile(cid, S = strikes()) {
    const L = standing(S, cid);
    if (!S.ended[cid] && L.length >= REPEAT.strikes) {
      const nid = L.slice().sort((a, b) => a.at - b.at).pop().notice;
      S.ended[cid] = { at: now(), notice: nid }; writeJ(strikesFile, S);
      uploads.endCampaign(cid, { notice: nid });
      event({ e: 'terminated', campaign: cid, notice: nid, strikes: L.length });
      log(`dmca: campaign ${cid} reached ${L.length} live strikes: uploading ended (repeat-infringer policy)`);
      return 'ended';
    }
    if (S.ended[cid] && L.length < REPEAT.strikes) { liftEnd(S, cid, { why: `its live strikes fell to ${L.length} (below ${REPEAT.strikes})`, by: 'strikes' }); return 'reinstated'; }
    return null;
  }
  function liftEnd(S, cid, { why, by }) {
    (S.reinstated[cid] ||= []).push({ at: now(), why, by, ended: S.ended[cid] });
    delete S.ended[cid]; writeJ(strikesFile, S);
    const r = uploads.reinstateCampaign(cid, { why });
    event({ e: 'reinstated', campaign: cid, why, by, back: r.back, held: r.held, missing: !!r.missing });
    log(`dmca: campaign ${cid} REINSTATED (${why}): uploading on again, ${r.back.length} model(s) back${r.held.length ? `, ${r.held.length} still under a notice` : ''}${r.missing ? ' (the campaign is not on this relay: deleted)' : ''}`);
    return r;
  }
  // the admin's reinstate (a GM's appeal upheld): the campaign's live strikes are FORGIVEN (kept on the record, no longer
  // counted; a new takedown counts afresh), the cut-off lifted. A deleted campaign's record is lifted the same way.
  function reinstate(cid, why) {
    if (!/^cmp_[0-9a-z]+$/i.test(cid || '')) return { ok: false, why: 'name the campaign: cmp_…' };
    if (!String(why || '').trim()) return { ok: false, why: 'give the reason (--why "…")' };
    const S = strikes(); if (!S.ended[cid]) return { ok: false, why: 'uploading has not ended for that campaign' };
    const f = { at: now(), why: String(why).slice(0, 300) };
    for (const x of S.campaigns[cid] || []) if (!x.cleared && !x.forgiven) x.forgiven = f;
    for (const L of Object.values(S.ips)) for (const x of L) if (x.campaign === cid && !x.cleared && !x.forgiven) x.forgiven = f;
    const r = liftEnd(S, cid, { why: f.why, by: 'admin' });
    return { ok: true, campaign: cid, ...r };
  }
  // a strike's file is reversed for one campaign (its counter-notice stood) or for everyone (the notice withdrawn or invalid)
  function clearStrikes({ raw, notice: nid, campaign = null, why }) {
    const S = strikes(), at = now(), touched = new Set(); let n = 0;
    const rev = (x) => { if (x.notice !== nid || !x.raws.includes(raw) || x.reversed[raw]) return false; x.reversed[raw] = { at, why }; if (x.raws.every(r => x.reversed[r])) { x.cleared = at; x.clearedWhy = why; return true; } return false; };
    for (const [cid, L] of Object.entries(S.campaigns)) if (!campaign || cid === campaign) for (const x of L) if (rev(x)) { n++; touched.add(cid); }
    for (const L of Object.values(S.ips)) for (const x of L) if (!campaign || x.campaign === campaign) rev(x);
    writeJ(strikesFile, S);
    const reinstated = [...touched].filter(cid => reconcile(cid) === 'reinstated');
    return { n, reinstated };
  }
  const ended = (cid) => !!(readJ(strikesFile, {}).ended || {})[cid];

  // ---------------------------------------------------------------- takedown, counter-notice, restore
  function takedown({ notice: nid, raw = null, id = null, block = true, reason = '' }) {
    const N = notice(nid); if (!N) return { ok: false, why: 'no such notice' };
    if (!raw && id) raw = uploads.metaOf(id)?.raw || null;
    if (!/^[0-9a-f]{64}$/.test(raw || '')) return { ok: false, why: 'name the file: its raw hash, or one model id made from it' };
    const r = uploads.disable(raw, { notice: nid, block, why: 'copyright notice' });
    const ended = strike(r.holders, { notice: nid, raw });
    N.status = 'actioned'; (N.actions ||= []).push({ at: now(), raw, blobs: r.blobs, campaigns: r.holders.map(h => h.campaign), reason: String(reason).slice(0, 300), ended });
    writeJ(path.join(nDir, nid + '.json'), N);
    event({ e: 'takedown', notice: nid, raw, holders: r.holders.length, ended });
    return { ok: true, raw, blobs: r.blobs, holders: r.holders, ended, tellUploaders: r.holders.map(h => ({ campaign: h.campaign, seat: h.by, model: h.name })) };
  }
  // the GM's counter-notice, from the game (POST /c/<cid>/uploads/<id>/counter; relay/uploads.js passes it on)
  async function handleCounter(req, res, { rt, seat, ref, meta, send, readBody }) {
    if (ref.status !== 'removed' || !(ref.removed?.notices || []).length) { send(409, { ok: false, why: 'that model was not taken down after a notice' }); return true; }
    let b = {}; try { b = JSON.parse((await readBody(req, 16384)).toString('utf8') || '{}'); } catch { }
    const { fields, bad } = checkFields(COUNTER_FIELDS, b);
    if (bad.length) { send(400, { ok: false, code: 'fields', bad, why: `a counter-notice needs: ${bad.join(', ')}` }); return true; }
    const open = counters().find(c => c.raw === ref.raw && c.campaign === rt.id && OPEN.includes(c.status));
    if (open) { send(409, { ok: false, why: 'a counter-notice for this model is already being handled', counter: pubCounter(open) }); return true; }
    const nid = (ref.removed?.notices || []).slice(-1)[0] || null;
    // the window runs from RECEIPT (§512(g)(2)(C)), whether or not it has been forwarded yet: the tick says when forwarding is late
    const C = { id: newRid('ctr'), at: now(), status: 'received', notice: nid, raw: ref.raw, model: { id: ref.id, name: ref.name }, campaign: rt.id, seat, fields, window: restoreWindow(now()) };
    writeJ(path.join(cDir, C.id + '.json'), C);
    event({ e: 'counter', counter: C.id, notice: nid, raw: ref.raw, campaign: rt.id });
    log(`dmca: counter-notice ${C.id} for notice ${nid} (campaign ${rt.id}): waiting to be forwarded to the claimant`);
    send(200, { ok: true, counter: pubCounter(C) }); return true;
  }
  const pubCounter = (c) => ({ id: c.id, at: c.at, status: c.status, notice: c.notice, ...(c.window && { restoreAfterDay: c.window.afterDay, restoreByDay: c.window.byDay }) });
  // the counter-notice a model's row speaks of: the latest for a notice that still holds it (else the latest of all)
  const counterStateFor = (id, campaign, notices = null) => {
    const raw = uploads.metaOf(id)?.raw; if (!raw) return null;
    const all = counters().filter(x => x.raw === raw && x.campaign === campaign), mine = notices?.length ? all.filter(x => notices.includes(x.notice)) : all;
    const c = (notices?.length ? mine : all).pop(); return c ? pubCounter(c) : null;
  };
  // a hold on a file's stored copies (no purge): a counter-notice still open, or a lawsuit on record
  const hold = (raw) => counters().some(c => c.raw === raw && OPEN.includes(c.status));
  // forwarded to the claimant (by Fauna, by hand): the restore window starts from the counter-notice's receipt
  function forward(cid) {
    const C = counter(cid); if (!C || C.status !== 'received') return { ok: false, why: 'no such counter-notice waiting to be forwarded' };
    C.status = 'forwarded'; C.forwardedAt = now(); C.window ||= restoreWindow(C.at);
    writeJ(path.join(cDir, cid + '.json'), C); event({ e: 'forwarded', counter: cid, window: C.window });
    return { ok: true, counter: C };
  }
  function lawsuit(cid, note = '') { const C = counter(cid); if (!C || !['received', 'forwarded'].includes(C.status)) return { ok: false, why: 'no open counter-notice' }; C.status = 'lawsuit'; C.lawsuit = { at: now(), note: String(note).slice(0, 300) }; writeJ(path.join(cDir, cid + '.json'), C); event({ e: 'lawsuit', counter: cid }); return { ok: true, counter: C }; }
  // reject (not a valid counter-notice) or close (handled another way): from ANY open state, received, forwarded or lawsuit
  // (2026-11-23, F4: one forwarded or under a lawsuit could not be closed, and sat open for ever)
  function endCounter(cid, status, why = '') {
    const C = counter(cid); if (!C || !OPEN.includes(C.status)) return { ok: false, why: C ? `that counter-notice is already ${C.status}` : 'no such counter-notice' };
    const was = C.status; C.status = status; C[status] = { at: now(), why: String(why).slice(0, 300), was };
    writeJ(path.join(cDir, cid + '.json'), C); event({ e: `counter-${status}`, counter: cid, was }); return { ok: true, counter: pubCounter(C), was };
  }
  const rejectCounter = (cid, why = '') => endCounter(cid, 'rejected', why);
  const closeCounter = (cid, why = '') => endCounter(cid, 'closed', why);
  // lift one notice's removal: for the campaign whose counter-notice stood, or (campaign null) everywhere. Every counter-
  // notice still open on that removal is closed as restored (F4: a restore by hand left it open, and the tick restored again).
  function restoreFile({ raw, notice: nid, campaign = null, why }) {
    const r = uploads.restore(raw, { notice: nid, campaign, why });
    const closed = [];
    for (const C of counters()) if (C.raw === raw && C.notice === nid && (!campaign || C.campaign === campaign) && OPEN.includes(C.status)) { C.was = C.status; C.status = 'restored'; C.restoredAt = now(); C.restoredWhy = String(why || '').slice(0, 200); writeJ(path.join(cDir, C.id + '.json'), C); closed.push(C.id); }
    const { n: cleared, reinstated } = clearStrikes({ raw, notice: nid, campaign, why }); // (which may lift a cut-off: reinstated)
    event({ e: 'restored', raw, notice: nid, campaign, why, cleared, counters: closed, reinstated });
    return { ok: true, ...r, strikesCleared: cleared, countersClosed: closed, reinstated };
  }
  // THE TICK: every forwarded counter-notice whose window has opened, with no lawsuit on record, is restored
  function tick() {
    const done = [], late = [], overdue = [];
    for (const C of counters()) {
      if (C.status === 'received' && C.at && businessDaysAfter(C.at, 1).end < now()) late.push(C.id); // (not forwarded within a business day: the admin view says so)
      if (C.status === 'received' && C.window && now() >= C.window.after) { overdue.push(C.id); log(`dmca: OVERDUE counter-notice ${C.id}: its restore window opened ${C.window.afterDay} and it has not been forwarded to the claimant (forward it now; restore by ${C.window.byDay})`); }
      if (C.status !== 'forwarded' || !C.window || now() < C.window.after) continue;
      restoreFile({ raw: C.raw, notice: C.notice, campaign: C.campaign, why: `counter-notice ${C.id}` }); done.push(C.id);
      log(`dmca: counter-notice ${C.id}: the window opened (${C.window.afterDay}) with no lawsuit on record: restored`);
    }
    // a cut-off whose strikes have fallen below the line (one reversed before 2026-11-23, when nothing re-checked) is lifted
    const S = strikes(), reinstated = []; for (const cid of Object.keys(S.ended)) if (reconcile(cid) === 'reinstated') reinstated.push(cid);
    return { restored: done, notForwarded: late, overdue, reinstated };
  }
  const tickTimer = setInterval(() => { try { tick(); } catch (e) { log(`dmca tick: ${e.message}`); } }, 3600e3); tickTimer.unref?.();

  // ---------------------------------------------------------------- the public page and the form
  const PAGE = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" };
  const shell = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)} · Turnip Works</title><style>
:root { --bg: #e9e6df; --paper: #fcfbf8; --line: rgba(20,20,20,.14); --ink: #1a1917; --mute: #5f5c55; --accent: #a8770f; --bad: #b4232a; color-scheme: light; }
* { box-sizing: border-box; } body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', sans-serif; }
main { max-width: 44rem; margin: 20px auto 40px; padding: 26px 20px 32px; background: var(--paper); border: 1px solid var(--line); border-radius: 14px; }
@media (min-width: 760px) { main { padding: 36px 44px 40px; } } h1 { margin: 0 0 10px; font-size: 28px; line-height: 1.2; } h2 { font-size: 19px; margin: 26px 0 6px; }
.draft { padding: 10px 14px; border: 1px dashed var(--bad); color: var(--bad); border-radius: 8px; font-size: 14px; } label { display: block; margin: 12px 0 4px; font-weight: 600; font-size: 15px; }
input[type=text], input[type=email], textarea, select { width: 100%; max-width: 100%; padding: 9px 10px; border: 1px solid var(--line); border-radius: 8px; font: inherit; background: #fff; }
textarea { min-height: 7em; } .chk { display: flex; gap: 10px; align-items: flex-start; font-weight: 400; } .chk input { margin-top: 5px; flex: none; }
button { margin-top: 18px; padding: 11px 22px; border: 0; border-radius: 10px; background: var(--ink); color: var(--paper); font: inherit; font-weight: 650; cursor: pointer; }
.fine { color: var(--mute); font-size: 14px; } .hp { position: absolute; left: -9999px; } .err { color: var(--bad); } code { overflow-wrap: anywhere; }
</style></head><body><main>${body}</main></body></html>`;
  // the DRAFT banner: always on a dev relay (a test bench); on prod only until the hosting record is complete
  const draftNote = () => channel !== 'dev' && hostingReady().on ? '' : `<p class="draft">DRAFT (2026-11-07), on the ${esc(channel)} server${channel === 'dev' ? ' only' : ''}. This policy and form are drafts for review by the operator and counsel.${record().agent?.number ? '' : ' No designated agent is registered yet, and the address below does not receive mail yet.'}</p>`;
  // §512(c)(2): the designated agent's name, address, phone and email, on the site as in the Copyright Office's directory
  const agentBlock = () => { const A = record().agent || {}; if (!A.number) return `<p class="fine">Our designated agent is not registered with the US Copyright Office yet; until it is, use the form below.</p>`;
    return `<p class="agent"><b>${esc(A.name || 'Copyright Agent')}</b><br>${esc(A.org || OPERATOR)}${A.address ? `<br>${esc(A.address).replace(/\n/g, '<br>')}` : ''}${A.phone ? `<br>Phone: ${esc(A.phone)}` : ''}${mailbox() ? `<br>Email: ${esc(mailbox())}` : ''}</p>`; };
  function policyPage(bad = [], prior = {}, keptId = null) {
    const f = (k, type = 'text') => { const F = NOTICE_FIELDS[k]; return `<label for="f-${k}">${esc(F.label)}${F.req ? '' : ' (optional)'}${bad.includes(k) ? ' <span class="err">: please fill this in</span>' : ''}</label>${type === 'area' ? `<textarea id="f-${k}" name="${k}" maxlength="${F.max}">${esc(prior[k] || '')}</textarea>` : `<input id="f-${k}" type="${type}" name="${k}" maxlength="${F.max}" value="${esc(prior[k] || '')}">`}`; };
    return shell('Copyright policy', `${draftNote()}${bad.length ? `<p class="err">Some parts of the notice are missing; they are marked below.${keptId ? ` We kept what you sent as <code>${esc(keptId)}</code> and may write to you to help complete it.` : ''}</p>` : ''}<h1>Copyright policy and takedown notices</h1>
<p>Turnip Works (turnipworks.net) is run by ${esc(OPERATOR)}. It lets game masters upload their own 3D models into their own campaigns. We respect copyright, and we respond to notices of claimed infringement under the US Digital Millennium Copyright Act (17 U.S.C. §512).</p>
<h2>Our designated agent</h2>${agentBlock()}
<h2>How to send a notice</h2><p>Use the form below${mailbox() ? `, or write to our designated agent at <b>${esc(mailbox())}</b>` : ` (the designated agent's address, proposed as <b>${esc(DMCA_ADDRESS)}</b>, does not receive mail yet)`}. A notice must include each item the form asks for. Knowingly false statements in a notice can make you liable for damages (§512(f)).</p>
<p>Uploaded models are private to the campaign that uploaded them, so you may not be able to give us a link. Describe the model, where you saw it (a stream, a screenshot, a campaign or share link if you have one) and anything else that helps us find it.</p>
<h2>What happens next</h2><p>We remove or disable access to the material promptly, everywhere it is stored on Turnip Works, and tell the game master who uploaded it. They may send a counter-notice; if they do, we forward it to you and restore the material 10 to 14 business days after we received the counter-notice, unless you tell us first that you have filed a court action. Game masters who are repeat infringers lose the ability to upload.</p>
<h2>Notice of claimed infringement</h2>
<form method="post" action="dmca/notice"><input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
${f('name')}${f('org')}<label for="f-role">You are${bad.includes('role') ? ' <span class="err">: please choose</span>' : ''}</label><select id="f-role" name="role"><option value="owner"${prior.role === 'owner' ? ' selected' : ''}>the copyright owner</option><option value="agent"${prior.role === 'agent' ? ' selected' : ''}>authorised to act for the copyright owner</option></select>
${f('email', 'email')}${f('address', 'area')}${f('phone')}<p class="fine">An email address or a phone number, and a postal address.</p>
<label for="f-work">The copyrighted work you say is infringed${bad.includes('work') ? ' <span class="err">: please describe it</span>' : ''}</label><textarea id="f-work" name="work" maxlength="4000" placeholder="What the work is, and where an authorised copy can be seen (a store page, a portfolio)">${esc(prior.work || '')}</textarea>
<label for="f-material">The material on Turnip Works you say infringes it${bad.includes('material') ? ' <span class="err">: please describe it</span>' : ''}</label><textarea id="f-material" name="material" maxlength="4000" placeholder="What the model looks like and is called, where you saw it, any link or screenshot address">${esc(prior.material || '')}</textarea>
<label class="chk"><input type="checkbox" name="goodfaith"${prior.goodfaith ? ' checked' : ''}> I have a good-faith belief that use of the material in the manner complained of is not authorised by the copyright owner, its agent, or the law.${bad.includes('goodfaith') ? ' <span class="err">(required)</span>' : ''}</label>
<label class="chk"><input type="checkbox" name="accurate"${prior.accurate ? ' checked' : ''}> The information in this notice is accurate, and under penalty of perjury, I am the owner, or authorised to act on behalf of the owner, of an exclusive right that is allegedly infringed.${bad.includes('accurate') ? ' <span class="err">(required)</span>' : ''}</label>
<label for="f-signature">Signature: type your full name${bad.includes('signature') ? ' <span class="err">: please sign</span>' : ''}</label><input id="f-signature" type="text" name="signature" maxlength="120" value="${esc(prior.signature || '')}">
<button type="submit">Send notice</button></form>
<h2>Counter-notices</h2><p>A game master whose model was removed can send a counter-notice from inside the game (Settings, Uploaded models, the removed model). It must include their name, address and phone, a statement under penalty of perjury that they believe the model was removed by mistake or misidentification, their consent to the jurisdiction of the US federal district court for their address (or, outside the US, any district where we may be found), and that they will accept service of process from the person who sent the notice.</p>
<h2 id="repeat-infringers">Repeat infringers</h2><p>Turnip Works has no user accounts: a campaign is the account, and its game master the account holder. A campaign that receives ${REPEAT.strikes} valid takedowns within 12 months loses the ability to upload, and its uploaded models stop being shown. Uploads from a network address behind ${REPEAT.ipStrikes} such takedowns, across campaigns, are stopped too. A takedown reversed by a counter-notice does not count, and notices we find invalid or that are withdrawn make no strike. When reversals bring a campaign below ${REPEAT.strikes}, it can upload again and its models come back (except any still under a notice).</p>
<p class="fine">Not legal advice.</p>`);
  }
  const hits = new Map();
  const limited = (k, max, ms) => { const t = now(), l = (hits.get(k) || []).filter(x => t - x < ms); if (l.length >= max) { hits.set(k, l); return true; } l.push(t); hits.set(k, l); return false; };

  async function handle(req, res, { url, parts, send, readBody, isAdmin, ipOf }) {
    // (a prod relay shows the DRAFT page and takes notices only once a designated agent is on record: before that the page
    // would name an agent who does not exist. A dev relay always does, as the test bench.)
    if (parts[0] === 'dmca' && channel !== 'dev' && !record().agent?.number) { send(404, { ok: false, why: 'not found' }); return true; }
    if (parts[0] === 'dmca' && !parts[1] && (req.method === 'GET' || req.method === 'HEAD')) { res.writeHead(200, PAGE); res.end(req.method === 'HEAD' ? undefined : policyPage()); return true; } // (HEAD as GET: link checkers)
    if (parts[0] === 'dmca' && parts[1] === 'notice' && !parts[2] && req.method === 'POST') {
      const ih = ipHash(ipOf(req));
      if (limited('ip|' + ih, LIM.perIpHour, 3600e3) || limited('all', LIM.perDay, 86400e3)) { res.writeHead(429, PAGE); res.end(shell('Too many notices', `<h1>Too many notices from here</h1><p>Please try again in an hour${mailbox() ? `, or write to <b>${esc(mailbox())}</b>` : ''}.</p>`)); return true; }
      let body; try { body = (await readBody(req, 32 * 1024)).toString('utf8'); } catch { res.writeHead(413, PAGE); res.end(shell('Too long', '<h1>That notice is too long</h1><p>Please shorten it, or write to us.</p>')); return true; }
      const form = Object.fromEntries(new URLSearchParams(body));
      const from = { ipHash: ih, ua: String(req.headers['user-agent'] || '').slice(0, 160) };
      const keep = (status, extra) => { const N = { id: newRid('ntc'), at: now(), status, ...extra, from, channel }; writeJ(path.join(nDir, N.id + '.json'), N); event({ e: `notice-${status}`, notice: N.id }); return N; };
      // the bots' field: kept (marked) rather than thrown away, and the page says only that it arrived
      if (form.website) { const N = keep('honeypot', { fields: Object.fromEntries(Object.entries(form).map(([k, v]) => [k, String(v).slice(0, 400)])) }); res.writeHead(200, PAGE); res.end(shell('Received', `<h1>Received</h1><p>Reference <code>${esc(N.id)}</code>.</p>`)); return true; }
      const { fields, bad, flags } = checkFields(NOTICE_FIELDS, form);
      if (bad.length) {
        // INCOMPLETE: sent back to finish, AND kept when it already names the work, the material and a way to reach the
        // sender (§512(c)(3)(B)(ii): then we must try to help complete it, so it must not be lost)
        const helpable = ['work', 'material', 'address'].every(k => !bad.includes(k)) && (fields.email || fields.phone);
        const N = helpable ? keep('incomplete', { fields, missing: bad }) : null;
        if (N) log(`dmca: INCOMPLETE notice ${N.id} kept (missing ${bad.join(', ')}): write to the sender to help complete it`);
        res.writeHead(400, PAGE); res.end(policyPage(bad, form, N?.id)); return true;
      }
      const N = { id: newRid('ntc'), at: now(), status: 'received', fields, flags, from, channel };
      writeJ(path.join(nDir, N.id + '.json'), N);
      event({ e: 'notice', notice: N.id });
      log(`dmca: NOTICE ${N.id} received (${fields.role}, ${fields.work.slice(0, 60).replace(/\s+/g, ' ')}…): waiting for review`);
      res.writeHead(200, PAGE);
      res.end(shell('Notice received', `${draftNote()}<h1>Notice received</h1><p>Your notice number is <code>${esc(N.id)}</code>, received ${esc(new Date(N.at).toISOString())}. Keep it: it is how we and you refer to this notice.</p><p>We will review it and act promptly. If we need more to find the material, we will contact you at ${esc(fields.email || fields.phone)}.</p>`));
      return true;
    }
    if (parts[0] !== 'admin' || parts[1] !== 'dmca') return false;
    if (!isAdmin()) { send(403, { ok: false, why: 'not from the box' }); return true; }
    const json = async () => { try { return JSON.parse((await readBody(req, 16384)).toString('utf8') || '{}'); } catch { return {}; } };
    if (!parts[2] && req.method === 'GET') {
      const T = tick(), S = strikes();
      send(200, { ok: true, notices: notices(), counters: counters(), due: counters().filter(c => c.status === 'forwarded').map(c => ({ id: c.id, after: c.window?.afterDay, by: c.window?.byDay })), notForwarded: T.notForwarded, overdue: T.overdue, restoredNow: T.restored, reinstatedNow: T.reinstated, incomplete: notices().filter(n => n.status === 'incomplete').map(n => n.id), hosting: hostingReady(),
        strikes: { campaigns: Object.fromEntries(Object.entries(S.campaigns).map(([k, v]) => [k, live(v).length])), ended: S.ended, reinstated: S.reinstated }, publicSharing: publicSharing(), blocked: Object.keys(uploads.blocked()).length });
      return true;
    }
    if (parts[2] === 'find' && req.method === 'GET') { send(200, { ok: true, found: uploads.find(url.searchParams.get('q') || '').slice(0, 200) }); return true; }
    if (req.method !== 'POST') { send(405, { ok: false, why: 'POST' }); return true; }
    const B = await json();
    if (parts[2] === 'takedown') { const r = takedown(B); send(r.ok ? 200 : 400, r); return true; }
    if (parts[2] === 'restore') { if (!/^[0-9a-f]{64}$/.test(B.raw || '') || !notice(B.notice)) { send(400, { ok: false, why: 'raw: the file hash, and notice: the notice whose removal to lift (campaign: only there)' }); return true; } send(200, restoreFile({ raw: B.raw, notice: B.notice, campaign: B.campaign || null, why: String(B.why || 'by hand').slice(0, 200) })); return true; }
    if (parts[2] === 'tick') { send(200, { ok: true, ...tick() }); return true; }
    if (parts[2] === 'notice' && ['reject', 'withdraw'].includes(parts[4])) { // invalid, or withdrawn by its sender: whatever it took down comes back, and its strikes go
      const N = notice(parts[3]); if (!N) { send(404, { ok: false, why: 'no such notice' }); return true; }
      const lifted = [...new Set((N.actions || []).map(a => a.raw))].map(raw => restoreFile({ raw, notice: N.id, campaign: null, why: `notice ${parts[4] === 'reject' ? 'rejected' : 'withdrawn'}` }));
      N.status = parts[4] === 'reject' ? 'rejected' : 'withdrawn'; N[N.status] = { at: now(), why: String(B.why || '').slice(0, 500) }; writeJ(path.join(nDir, N.id + '.json'), N); event({ e: `notice-${N.status}`, notice: N.id }); send(200, { ok: true, lifted }); return true; }
    if (parts[2] === 'counter' && parts[3]) { const r = parts[4] === 'forward' ? forward(parts[3]) : parts[4] === 'lawsuit' ? lawsuit(parts[3], B.note) : parts[4] === 'reject' ? rejectCounter(parts[3], B.why) : parts[4] === 'close' ? closeCounter(parts[3], B.why) : { ok: false, why: 'forward, lawsuit, reject or close' }; send(r.ok ? 200 : 400, r); return true; }
    if (parts[2] === 'reinstate') { const r = reinstate(B.campaign, B.why); send(r.ok ? 200 : 400, r); return true; }
    send(404, { ok: false, why: 'not found' }); return true;
  }
  const close = () => clearInterval(tickTimer);
  return { limits: LIM, hostingReady, ended, hold, mailbox, handle, handleCounter, publicSharing, uploadBlocked, counterStateFor, takedown, forward, lawsuit, rejectCounter, closeCounter, reinstate, reconcile, tick, restoreFile, notices, counters, strikes, close, root };
}
