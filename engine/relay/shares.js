// SHARE LINKS (2026-10-29; docs/NETCODE.md "Shared builds"; core/share.js is the format). "Copy share link" stores a
// shared build on the relay under an unguessable id and hands back an UNLISTED link anyone can import from. No accounts,
// no moderation (step 1 of docs/PRODUCT_DIRECTIONS.md "Sharing builds"); Fauna takes a link down by its id.
//
// WHERE: <DATA_DIR>/shares/ beside the campaigns (dev and prod each have their own DATA_DIR, so a dev link never exists on
// prod and the other way round), copied by engine/tools/backup_data.sh with the rest of the data folder.
//   <id>.json        the build as validateShare rebuilt it (a broken piece is not stored: the maker is told), no picture
//   <id>.<webp|jpg|png>   its preview picture, when it has one
//   <id>.meta.json   { id, at, c, s, name, kind, bytes, del: sha256(delete token), summary, thumb }
//   takedowns.jsonl  one line per admin takedown (id, at, reason, name, campaign, seat)
// THE ID is 128 random bits (22 base64url characters); nothing lists them (no index route, noindex everywhere,
// robots.txt shuts /s/ out). Knowing an id is the only way to a build.
//
// HTTP (relay paths; nginx serves the public ones at https://<site>/s/<id> too)
//   POST /c/<cid>/shares?seat=TOKEN            a person with build permission (class `room`) shares a build (the body:
//                                              the .turnip.json text) -> { ok, id, path, del, summary }   (400 bad, 413, 429)
//   GET  /c/<cid>/shares?seat=TOKEN            this seat's own links (never anyone else's)
//   POST /c/<cid>/shares/<id>/delete?seat=TOKEN   the creating seat (or that campaign's GM) deletes it
//   GET  /s/<id>                               a small preview page: the picture, what is in it, "Use in my campaign"
//   GET  /s/<id>/json                          the build itself (what "import <link>" reads)
//   GET  /s/<id>/thumb                         the picture
//   POST /s/<id>/delete   {token}              anyone holding the delete token deletes it
//   POST /admin/shares/<id>/takedown {reason}  box-only (x-tw-admin): a takedown is a delete by id, logged
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseShare, summaryOf, SHARE_LIMITS } from '../core/share.js';
import { can, isGmSide } from '../core/perms.js';

export const LINK_LIMITS = Object.freeze({
  body: SHARE_LIMITS.bytes + 64 * 1024,
  perSeatHour: 30,      // links a seat makes in an hour
  perIpHour: 60,        // links one address makes in an hour
  readsPerIpMinute: 240,
  perCampaign: 500,     // links one campaign keeps
  total: 20000,         // links the relay keeps
});
export const SHARE_ID_RE = /^[A-Za-z0-9_-]{22}$/;
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const EXT = { webp: 'webp', jpeg: 'jpg', png: 'png' }, TYPE = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' };

export function makeShares({ dataDir, log = () => {}, now = () => Date.now() }) {
  const dir = path.join(dataDir, 'shares');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = (id, ext) => path.join(dir, `${id}.${ext}`);
  const metaOf = (id) => { if (!SHARE_ID_RE.test(id)) return null; try { return JSON.parse(fs.readFileSync(file(id, 'meta.json'), 'utf8')); } catch { return null; } };
  const all = () => { try { return fs.readdirSync(dir).filter(f => f.endsWith('.meta.json')).map(f => metaOf(f.slice(0, -10))).filter(Boolean); } catch { return []; } };
  let count = all().length;
  const hits = new Map(); // `${kind}|${key}` -> [ms]
  const limited = (kind, key, max, ms) => { const k = `${kind}|${key}`, t = now(), list = (hits.get(k) || []).filter(x => t - x < ms); if (list.length >= max) { hits.set(k, list); return true; } list.push(t); hits.set(k, list); if (hits.size > 50000) hits.clear(); return false; };
  function remove(id) {
    const m = metaOf(id); if (!m) return null;
    for (const f of [file(id, 'json'), file(id, 'meta.json'), ...(m.thumb ? [file(id, m.thumb)] : [])]) { try { fs.unlinkSync(f); } catch { } }
    count = Math.max(0, count - 1);
    return m;
  }
  function create({ text, c, s }) {
    const { doc, left, error } = parseShare(text);
    if (error) return { status: 400, body: { ok: false, why: error } };
    const id = crypto.randomBytes(16).toString('base64url'), del = crypto.randomBytes(24).toString('base64url');
    let thumb = null;
    if (doc.thumb) { const m = doc.thumb.match(/^data:image\/(webp|jpeg|png);base64,(.+)$/); thumb = EXT[m[1]]; fs.writeFileSync(file(id, thumb), Buffer.from(m[2], 'base64'), { mode: 0o600 }); }
    const { thumb: _, ...rest } = doc;
    const json = JSON.stringify(rest);
    fs.writeFileSync(file(id, 'json'), json, { mode: 0o600 });
    const meta = { id, at: now(), c, s, name: doc.name, kind: doc.kind, bytes: json.length, del: sha(del), summary: summaryOf(doc), thumb };
    fs.writeFileSync(file(id, 'meta.json'), JSON.stringify(meta), { mode: 0o600 });
    count++;
    log(`share ${id.slice(0, 6)}… "${doc.name}" (${doc.kind}, ${json.length} B) by ${s} of ${c}`); // (never the whole id, never the delete token)
    return { status: 200, body: { ok: true, id, path: `/s/${id}`, del, summary: meta.summary, ...((left.pieces || left.details) && { left }) } };
  }
  const pub = (m) => ({ id: m.id, name: m.name, kind: m.kind, at: m.at, path: `/s/${m.id}`, summary: m.summary, thumb: !!m.thumb });

  // the preview page: no script at all; the house style of the site pages (engine/tools/build_site.py)
  function page(m, link) {
    const S = m.summary || {}, bits = [S.buildings && `${S.buildings} building${S.buildings === 1 ? '' : 's'}`, S.rooms && `${S.rooms} room${S.rooms === 1 ? '' : 's'}`, S.levels > 1 && `${S.levels} levels`, S.hills && `${S.hills} hill${S.hills === 1 ? '' : 's'}`, S.things && `${S.things} thing${S.things === 1 ? '' : 's'}`, S.pawns && `${S.pawns} creature${S.pawns === 1 ? '' : 's'}`].filter(Boolean);
    const kind = { area: 'An area', building: 'A building', room: 'A room', group: 'A set of things' }[m.kind] || 'A build';
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer">
<title>${esc(m.name)} · Turnip Works</title>
<link rel="icon" href="/engine/client/mark.svg" type="image/svg+xml">
<style>@font-face { font-family: Inter; src: url('/engine/client/vendor/inter/inter-latin-wght-normal.woff2') format('woff2'); font-weight: 100 900; font-display: swap; }
:root { --bg: #e9e6df; --paper: #fcfbf8; --raised: #f0ede6; --line: rgba(20,20,20,.14); --ink: #1a1917; --ink-2: #3d3b36; --mute: #5f5c55; --accent: #a8770f; color-scheme: light; }
* { box-sizing: border-box; } body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 Inter, system-ui, -apple-system, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
a { color: var(--accent); text-underline-offset: 2px; } a:hover { color: var(--ink); }
.top { max-width: 46rem; margin: 0 auto; padding: 18px 20px 0; display: flex; align-items: center; gap: 10px; }
.brand { display: flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; font-weight: 650; font-size: 17px; letter-spacing: -.01em; } .brand img { width: 36px; height: 36px; }
main { max-width: 46rem; margin: 16px auto 32px; padding: 28px 20px 32px; background: var(--paper); border: 1px solid var(--line); border-radius: 14px; }
@media (min-width: 760px) { main { padding: 40px 48px 44px; } }
.kind { margin: 0; color: var(--mute); font-size: 14px; } h1 { margin: 2px 0 14px; font-size: 30px; line-height: 1.2; font-weight: 700; letter-spacing: -.02em; overflow-wrap: anywhere; }
.pic { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; border-radius: 10px; border: 1px solid var(--line); background: var(--raised); }
.none { display: flex; align-items: center; justify-content: center; color: var(--mute); }
.what { margin: 14px 0 22px; color: var(--ink-2); }
.use { display: inline-block; padding: 11px 20px; border-radius: 10px; background: var(--ink); color: var(--paper); text-decoration: none; font-weight: 650; } .use:hover { color: var(--paper); background: #000; }
.or { margin: 20px 0 6px; color: var(--mute); font-size: 14px; } code { display: block; padding: 10px 12px; background: var(--raised); border: 1px solid var(--line); border-radius: 8px; font: 13px/1.5 ui-monospace, Menlo, monospace; overflow-wrap: anywhere; user-select: all; }
.fine { margin-top: 26px; color: var(--mute); font-size: 13px; }</style></head>
<body><div class="top"><a class="brand" href="/"><img src="/engine/client/mark.svg" alt="">Turnip Works</a></div>
<main><p class="kind">${kind}, shared from Turnip Works</p><h1>${esc(m.name)}</h1>
${m.thumb ? `<img class="pic" src="${esc(m.id)}/thumb" alt="${esc(m.name)}, seen from above at three-quarters">` : '<div class="pic none">No picture</div>'}
<p class="what">${esc(bits.join(' · ') || 'A shared build')}. Built from the Turnip Works library: rooms, walls and furniture come from your own copy of it.</p>
<a class="use" href="/?share=${esc(m.id)}">Use in my campaign</a>
<p class="or">Or, in a Turnip Works game you run, type this in the command bar:</p><code>import ${esc(link)}</code>
<p class="fine">Shared ${esc(new Date(m.at).toISOString().slice(0, 10))}. This page is unlisted: only people with the link can find it.</p></main></body></html>`;
  }
  const PAGE_HEADERS = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', 'x-robots-tag': 'noindex, nofollow, noarchive', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY',
    'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" };

  async function handle(req, res, { url, parts, send, auth, readBody, isAdmin, ipOf }) {
    const ip = ipOf(req);
    // ---- the campaign side: make, list, delete ----
    if (parts[0] === 'c' && parts[1] && parts[2] === 'shares') {
      const a = auth(req, url.searchParams, parts[1]); if (a.err) { send(...a.err); return true; }
      const st = a.rt.state, seat = st.seats[a.seat];
      if (req.method === 'POST' && !parts[3]) {
        if (seat?.kind !== 'human') { send(403, { ok: false, code: 'denied', why: 'a share link comes from a person (an AI seat can read and import builds)' }); return true; }
        if (!can(st, a.seat, 'room', null).ok) { send(403, { ok: false, code: 'denied', why: 'sharing a build needs build permission' }); return true; }
        if (limited('seat', `${a.rt.id}|${a.seat}`, LINK_LIMITS.perSeatHour, 3600e3) || limited('ip', ip, LINK_LIMITS.perIpHour, 3600e3)) { send(429, { ok: false, why: 'too many share links in an hour: try again later' }); return true; }
        if (count >= LINK_LIMITS.total || all().filter(m => m.c === a.rt.id).length >= LINK_LIMITS.perCampaign) { send(429, { ok: false, why: 'too many share links kept: delete some first' }); return true; }
        let body; try { body = await readBody(req, LINK_LIMITS.body); } catch { send(413, { ok: false, code: 'too_large', why: `a shared build is at most ${Math.round(SHARE_LIMITS.bytes / 1048576)} MB` }); return true; }
        const r = create({ text: body.toString('utf8'), c: a.rt.id, s: a.seat });
        send(r.status, r.body); return true;
      }
      if (req.method === 'GET' && !parts[3]) { send(200, { ok: true, shares: all().filter(m => m.c === a.rt.id && m.s === a.seat).sort((x, y) => y.at - x.at).map(pub) }); return true; }
      if (req.method === 'POST' && parts[3] && parts[4] === 'delete') {
        const m = metaOf(parts[3]);
        if (!m || m.c !== a.rt.id || !(m.s === a.seat || (isGmSide(st, a.seat) && seat?.kind === 'human'))) { send(404, { ok: false, why: 'no such share link of yours' }); return true; }
        remove(m.id); log(`share ${m.id.slice(0, 6)}… deleted by its seat`); send(200, { ok: true }); return true;
      }
      send(404, { ok: false, why: 'not found' }); return true;
    }
    // ---- the admin's takedown ----
    if (parts[0] === 'admin' && parts[1] === 'shares' && parts[3] === 'takedown' && req.method === 'POST') {
      if (!isAdmin()) { send(403, { ok: false, why: 'not from the box' }); return true; }
      let reason = ''; try { reason = String(JSON.parse((await readBody(req, 8192)).toString('utf8') || '{}').reason || '').slice(0, 500); } catch { }
      const m = remove(parts[2]);
      if (!m) { send(404, { ok: false, why: 'no such share link' }); return true; }
      fs.appendFileSync(path.join(dir, 'takedowns.jsonl'), JSON.stringify({ id: m.id, at: now(), reason, name: m.name, campaign: m.c, seat: m.s }) + '\n', { mode: 0o600 });
      log(`share ${m.id} TAKEN DOWN: ${reason || '(no reason given)'}`);
      send(200, { ok: true, id: m.id, name: m.name }); return true;
    }
    // ---- the public side: /s/<id>, /s/<id>/json, /s/<id>/thumb, /s/<id>/delete ----
    if (parts[0] !== 's') return false;
    if (!parts[1] || parts.length > 3) { send(404, { ok: false, why: 'not found' }); return true; } // (no index of links, ever)
    if (limited('read', ip, LINK_LIMITS.readsPerIpMinute, 60e3)) { send(429, { ok: false, why: 'slow down' }); return true; }
    const m = metaOf(parts[1]);
    const gone = () => { if (!parts[2] && req.method === 'GET') { res.writeHead(404, PAGE_HEADERS); res.end(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not found · Turnip Works</title><p style="font:16px system-ui;margin:40px">This shared build is not here: it was deleted, or the link is not complete. <a href="/">Turnip Works</a></p>`); } else send(404, { ok: false, why: 'no such shared build (deleted, or the link is not complete)' }); return true; };
    if (!m) return gone();
    if (!parts[2] && req.method === 'GET') {
      const host = String(req.headers.host || '').replace(/[^a-z0-9.:-]/gi, '');
      const proto = /^(127\.|localhost|\[::1\])/.test(host) ? 'http' : 'https';
      res.writeHead(200, PAGE_HEADERS); res.end(page(m, `${proto}://${host}/s/${m.id}`)); return true;
    }
    if (parts[2] === 'json' && req.method === 'GET') {
      let text; try { text = fs.readFileSync(file(m.id, 'json'), 'utf8'); } catch { return gone(); }
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache', 'access-control-allow-origin': '*', 'x-robots-tag': 'noindex', 'x-content-type-options': 'nosniff' }); res.end(text); return true;
    }
    if (parts[2] === 'thumb' && req.method === 'GET') {
      if (!m.thumb) return gone();
      let img; try { img = fs.readFileSync(file(m.id, m.thumb)); } catch { return gone(); }
      res.writeHead(200, { 'content-type': TYPE[m.thumb], 'cache-control': 'public, max-age=86400', 'x-robots-tag': 'noindex', 'x-content-type-options': 'nosniff', 'access-control-allow-origin': '*' }); res.end(img); return true;
    }
    if (parts[2] === 'delete' && req.method === 'POST') {
      let token = ''; try { token = String(JSON.parse((await readBody(req, 4096)).toString('utf8') || '{}').token || ''); } catch { }
      const a = Buffer.from(sha(token)), b = Buffer.from(m.del || '');
      if (!token || a.length !== b.length || !crypto.timingSafeEqual(a, b)) { send(403, { ok: false, why: 'that is not this link\'s delete key' }); return true; }
      remove(m.id); log(`share ${m.id.slice(0, 6)}… deleted with its key`); send(200, { ok: true }); return true;
    }
    send(405, { ok: false, why: 'GET, or POST …/delete' }); return true;
  }
  const read = (id) => { if (!metaOf(id)) return null; try { return fs.readFileSync(file(id, 'json'), 'utf8'); } catch { return null; } };
  return { handle, create, remove, metaOf, all, read, dir };
}
