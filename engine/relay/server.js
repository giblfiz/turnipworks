// Turnip Works relay: per-area ordered command logs, presence, snapshots, seats and the LLM GET API.
// Node 20 + ws. Behind nginx at /api/tw-relay/ (prefix stripped), listening on 127.0.0.1:8097.
//
//   node relay/server.js                       (PORT, DATA_DIR, TUNER_DIR, TUNER_DATA, PUBLIC_BASE from env)
//
// HTTP
//   GET  /health
//   POST /campaigns {name, gm}            → { campaign, seat, token }      a new campaign with you as GM
//   GET  /help                            → how to get a rules card
//   GET  /c/:cid/card?seat=TOKEN          → your rules card (text)
//   GET  /c/:cid/state?seat=TOKEN         → roster + areas you can see
//   GET  /c/:cid/do?cmd=…&seat=…&nonce=…  → campaign command (transfer, seat.create, …)
//   GET  /c/:cid/token?seat=…&for=SEAT    → re-issue a seat's token (GM or its creator)
//   POST /c/:cid/delete?seat=TOKEN[&purge=1] → delete the campaign (its GM, a person); files moved to data/removed-<date>/
//   /c/:cid/tickets…, /tickets…           feedback tickets (relay/tickets.js: the testers' tickets and the triage)
//   GET  /c/:cid/a/:area/state|look|changes|do …   (see relay/llm.js; /t/ is the pre-rename alias)
//   POST /admin/notice {text, at, until}  → a banner on every connected seat (the release roll; docs/NETCODE.md
//                                          "Two servers"). Box-only: header x-tw-admin = DATA_DIR/admin-key, and
//                                          nginx answers 404 for /api/tw-relay/admin/ from outside.
// WebSocket /ws   protocol in core/client-sync.js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { CampaignRuntime } from './campaign.js';
import { migrateDataDir } from './migrate-areas.js';
import { migrateMessage } from '../core/migrate.js';
import { makeTokens } from './tokens.js';
import { isGmSide, canSee } from '../core/perms.js';
import { handleGet } from './llm.js';
import { loadFigures } from './figures.js';
import { newId } from '../core/ids.js';
import { liveSeat } from '../core/perms.js';
import { projectCampaign } from '../core/state.js';
import { makeRoomGen, engineVersionOf, TUNER_FILES, TUNER_DATA, applyRatings, ratingsDigest } from '../core/roomgen.js';
import { stableStringify } from '../core/hash.js';
import { campaignName } from '../core/campaign-names.js';
import { makeTickets } from './tickets.js';
import { fireTypeOf } from './things.js';
import { lightTable } from '../core/darkness.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// The room engine, from the tuner's own files (production: the DEPLOYED tuner, the same files the game imports; a tuner
// deploy restarts this service). Orientation = data/orient.json + Harry's corrections on the ratings server, merged by
// the tuner's shared js/orient.js; the corrections are part of the engine version, as in the client (client/tuner.js).
export async function loadRoomgen(dir, dataDir, { orientApi = process.env.ORIENT_API ?? 'http://127.0.0.1:8096' } = {}) {
  const imp = (f) => import(pathToFileURL(path.join(dir, f)).href);
  const [solver2, solver, walls, orientMod] = await Promise.all(['solver2.js', 'solver.js', 'walls.js', 'orient.js'].map(imp));
  const texts = [...TUNER_FILES.map(f => fs.readFileSync(path.join(dir, f), 'utf8')), ...TUNER_DATA.map(f => fs.readFileSync(path.join(dataDir, f), 'utf8'))];
  const [lib, types, orientFile] = TUNER_DATA.map(f => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')));
  let recs = {};
  if (orientApi) try { const r = await fetch(`${orientApi}/tuner/orient`); if (r.ok) recs = await r.json(); } catch { /* no corrections reachable: file only */ }
  const orientServer = orientMod.orientFromServer(lib, recs);
  // Harry's latest model ratings, live (as the browser applies them): at load, then every minute
  const fetchRatings = async () => { if (!orientApi) return null; try { const r = await fetch(`${orientApi}/ratings`); return r.ok ? await r.json() : null; } catch { return null; } };
  applyRatings(lib, await fetchRatings());
  const versionOf = () => engineVersionOf([...texts, stableStringify(orientServer), ratingsDigest(lib)]);
  const rg = makeRoomGen({ solver, solver2, walls, lib, types, orient: { ...orientFile, ...orientServer }, version: versionOf(), newId });
  rg.fireType = fireTypeOf(dir); // which things burn (candles, lanterns, hearths…), for the GET API's lights (relay/things.js)
  // each kind of light's reach in a dark area, as the game wears it: the house Fog of war look's (`reach`, `bright`,
  // `dark.scale`, `dark.dim`; core/darkness.js lightTable) over the core table; the table alone when the ratings server
  // is not reachable. Read at load and every minute, like the ratings (a "Use in game" shows within a minute).
  const fetchLook = async () => { if (!orientApi) return; try { const r = await fetch(`${orientApi}/tuner/house`); if (r.ok) rg.lightTable = lightTable((await r.json())?.fogwar); } catch { /* keep the last table */ } };
  rg.lightTable = lightTable(null); await fetchLook();
  if (orientApi) { const t = setInterval(async () => { if (applyRatings(lib, await fetchRatings())) rg.version = versionOf(); await fetchLook(); }, 60e3); t.unref?.(); }
  return rg;
}

export async function startRelay({
  port = Number(process.env.PORT || 8097), host = '127.0.0.1',
  dataDir = process.env.DATA_DIR || path.join(HERE, '..', 'data'),
  tunerDir = process.env.TUNER_DIR || path.join(HERE, '..', 'tuner'),
  tunerData = process.env.TUNER_DATA || path.join(HERE, '..', 'tuner-data'),
  publicBase = process.env.PUBLIC_BASE || null,
  log = (m) => console.log(new Date().toISOString(), m),
  maxCampaigns = 500,
} = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const secretFile = path.join(dataDir, 'secret');
  if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  const tokens = makeTokens(fs.readFileSync(secretFile, 'utf8').trim());
  // feedback tickets (Harry 2026-10-19): <dataDir>/tickets/, beside the campaigns and backed up with them (relay/tickets.js)
  const tickets = makeTickets({ dataDir, secret: fs.readFileSync(secretFile, 'utf8').trim(), log });
  // THE RELEASE (2026-10-19, docs/NETCODE.md "Two servers"): a prod relay runs from a release folder whose
  // release.json names it; a dev relay runs from the checkout and has none. /health says which.
  let release = null;
  try { release = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'release.json'), 'utf8')); } catch { }
  const channel = process.env.TW_CHANNEL || (release ? 'prod' : 'dev');
  // the admin key: what tools/release.sh shows to send a notice (it reads the file; nothing else knows it)
  const adminFile = path.join(dataDir, 'admin-key');
  if (!fs.existsSync(adminFile)) fs.writeFileSync(adminFile, crypto.randomBytes(24).toString('hex'), { mode: 0o600 });
  const adminKey = fs.readFileSync(adminFile, 'utf8').trim();
  let notice = null; // { id, text, at, until }: the banner every seat is shown until `until` (also to a seat that joins meanwhile)

  let roomgen = null;
  try { roomgen = await loadRoomgen(tunerDir, tunerData); log(`room engine ${roomgen.version} (${roomgen.types.size} types) from ${tunerDir}`); }
  catch (e) { log(`room engine unavailable: ${e.message}`); }
  const figs = loadFigures(tunerData); log(`figure list: ${figs.list.length} figures${figs.file ? '' : ' (no figures.json in ' + tunerData + ')'}`);

  const campaigns = new Map();
  try { migrateDataDir(dataDir, log); } catch (e) { log(`area migration failed (old files still load): ${e.stack}`); }
  for (const d of fs.readdirSync(dataDir)) {
    if (!d.startsWith('cmp_')) continue;
    try {
      const rt = new CampaignRuntime({ id: d, dir: path.join(dataDir, d), tokens, roomgen, log });
      const info = rt.load();
      campaigns.set(d, rt);
      log(`loaded ${d}: r=${rt.r}, ${info.fromSnapshot ? 'snapshot + ' : ''}${info.replayed} replayed`);
    } catch (e) { log(`FAILED to load ${d}: ${e.stack}`); }
  }

  // take a campaign off the relay and off the loader's path (see POST /c/<id>/delete). Also exported for tools.
  function deleteCampaign(id, { purge = false, by = null } = {}) {
    const rt = campaigns.get(id);
    if (!rt) return { ok: false, why: 'no such campaign' };
    const name = rt.state.name, dir = path.join(dataDir, id);
    campaigns.delete(id);
    for (const c of [...rt.conns]) { try { c.send({ t: 'denied', why: 'this campaign was deleted' }); c.close(); } catch { } }
    for (const [area, w] of rt.waiters) { rt.waiters.delete(area); for (const fn of w) { try { fn(); } catch { } } }
    try { if (!purge) rt.snapshot(); } catch (e) { log(`${id}: no last snapshot before delete (${e.message})`); }
    try { rt.journal.close(); } catch { }
    let kept = null;
    try {
      if (purge) fs.rmSync(dir, { recursive: true, force: true });
      else if (fs.existsSync(dir)) {
        const day = new Date(), bin = path.join(dataDir, `removed-${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`);
        fs.mkdirSync(bin, { recursive: true });
        kept = path.join(bin, id);
        if (fs.existsSync(kept)) kept += '-' + Date.now();
        fs.renameSync(dir, kept);
      }
    } catch (e) { log(`${id}: delete: ${e.message}`); return { ok: false, why: 'the campaign left the relay but its files could not be moved' }; }
    log(`deleted ${id} "${name}"${by ? ' by ' + by : ''}: ${purge ? 'files removed' : 'files moved to ' + kept}`);
    return { ok: true, campaign: id, name, purged: !!purge, ...(kept && { kept: path.relative(dataDir, kept) }) };
  }

  const creations = new Map(); // ip -> [ms]
  const ipOf = (req) => (req.headers['x-real-ip'] || req.socket.remoteAddress || '?').toString();
  // PUBLIC_BASE may contain {host}: rules cards then point at whichever domain the agent used
  const baseOf = (req) => publicBase ? publicBase.replace('{host}', String(req.headers.host || '').replace(/[^a-z0-9.:-]/gi, '')) : `http://${req.headers.host}`;

  function auth(req, q, cid, { short = false } = {}) {
    const token = q.get('seat') || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    // short: the GET API (rules cards, help pages, reads and commands) also takes the short form of a token (relay/tokens.js)
    const claims = tokens.verify(token) || (short ? tokens.verifyShort(token, cid, (c) => campaigns.get(c)?.state.seats) : null);
    if (!claims) return { err: [401, { ok: false, code: 'denied', why: 'missing or bad seat token: copy seat=... exactly as your rules card has it' }] };
    const rt = campaigns.get(claims.c);
    if (!rt || (cid && cid !== claims.c)) return { err: [404, { ok: false, why: 'no such campaign for this token' }] };
    const seat = rt.state.seats[claims.s];
    if (!tokens.matches(claims, rt.id, seat) || !liveSeat(rt.state, claims.s)) return { err: [403, { ok: false, code: 'denied', why: 'seat revoked' }] };
    return { rt, seat: claims.s, token };
  }

  const server = http.createServer(async (req, res) => {
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    };
    try {
      const url = new URL(req.url, 'http://x');
      const p = url.pathname.replace(/^\/api\/tw-relay/, '');
      const parts = p.split('/').filter(Boolean);
      if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, authorization, x-tw-test, x-tw-key', 'access-control-max-age': '600' }); return res.end(); }
      if (p === '/health' || p === '/') return send(200, { ok: true, campaigns: campaigns.size, engine: roomgen?.version || null, conns: [...campaigns.values()].reduce((n, rt) => n + rt.conns.size, 0), channel, release: release?.id || null });
      if (p === '/admin/notice' && req.method === 'POST') {
        const key = Buffer.from(String(req.headers['x-tw-admin'] || '')), want = Buffer.from(adminKey);
        if (key.length !== want.length || !crypto.timingSafeEqual(key, want)) return send(403, { ok: false, why: 'not from the box' });
        const b = await readJson(req);
        const now = Date.now(), at = Number(b.at) || now, until = Number(b.until) || at + 60e3;
        notice = b.clear ? null : { id: newId('ntc', 10), text: String(b.text || 'Server updating soon').slice(0, 200), at, until };
        let sent = 0;
        for (const rt of campaigns.values()) for (const c of rt.conns) { try { c.send(notice ? { t: 'notice', ...notice } : { t: 'notice', clear: true }); sent++; } catch { } }
        log(notice ? `notice "${notice.text}" to ${sent} connections (until ${new Date(until).toISOString()})` : `notice cleared (${sent} connections)`);
        return send(200, { ok: true, sent, notice });
      }
      if (p === '/help') return send(200, 'Turnip Works relay. Ask the human who runs your area for your rules card URL: .../c/<campaign>/card?seat=<token>\n', 'text/plain');
      if (p === '/rooms') return send(200, { engine: roomgen?.version || null, types: roomgen?.typeList || [] });
      if (parts[0] === 'sse' && parts[1] && parts[2] === 'events' && req.method === 'GET') return sseOpen(parts[1], req, res);
      if (parts[0] === 'sse' && parts[1] && parts[2] === 'send' && req.method === 'POST') return ssePost(parts[1], req, res);
      if (p === '/campaigns' && req.method === 'POST') {
        const ip = ipOf(req), now = Date.now();
        const recent = (creations.get(ip) || []).filter(t => now - t < 3600e3);
        if (recent.length >= 30 || campaigns.size >= maxCampaigns) return send(429, { ok: false, why: 'too many campaigns' });
        creations.set(ip, [...recent, now]);
        const body = await readJson(req);
        const id = newId('cmp');
        const name = (String(body.name || '').trim() || campaignName()).slice(0, 80), gm = String(body.gm || 'GM').slice(0, 40);
        const { rt, gmSeat, token } = CampaignRuntime.create({ id, dir: path.join(dataDir, id), name, gmName: gm, tokens, roomgen, log });
        campaigns.set(id, rt);
        log(`created ${id} "${name}"`);
        return send(200, { ok: true, campaign: id, seat: gmSeat, token, area: rt.state.areaOrder[0] });
      }
      // area thumbnails (Settings ▸ World navigation, Harry 2026-10-04): a 3/4-view picture of each area, rendered by a
      // client that has the area open (the GM's preferred) once edits settle, uploaded here; everyone fetches the latest.
      //   POST /c/<id>/a/<area>/thumb   image/webp body (<= 300 KB): a HUMAN seat that can see the area
      //   GET  /c/<id>/a/<area>/thumb   the picture, to seats that can see the area (others: 404, as for a missing area)
      //   GET  /c/<id>/thumbs           { area: { at, by, frame? } } for the areas this seat can see (frame: the shot's camera)
      if (parts[0] === 'c' && parts[1] && ((parts[2] === 'a' && parts[3] && parts[4] === 'thumb') || parts[2] === 'thumbs')) {
        const a = auth(req, url.searchParams, parts[1]);
        if (a.err) return send(...a.err);
        const dir = path.join(dataDir, a.rt.id, 'thumbs'), safe = (x) => /^[a-z]{1,6}_[0-9a-z]{4,24}$/.test(x);
        if (parts[2] === 'thumbs') {
          const out = {};
          for (const area of a.rt.state.areaOrder) if (canSee(a.rt.state, a.seat, area)) { try { out[area] = JSON.parse(fs.readFileSync(path.join(dir, area + '.json'), 'utf8')); } catch { } }
          return send(200, { ok: true, thumbs: out });
        }
        const area = parts[3];
        if (!safe(area) || !a.rt.state.areas[area] || !canSee(a.rt.state, a.seat, area)) return send(404, { ok: false, code: 'invisible', why: 'no such area visible to you' });
        if (req.method === 'GET') {
          try { const img = fs.readFileSync(path.join(dir, area + '.webp')); res.writeHead(200, { 'content-type': 'image/webp', 'cache-control': 'no-cache', 'access-control-allow-origin': '*' }); return res.end(img); }
          catch { return send(404, { ok: false, why: 'no thumbnail yet' }); }
        }
        if (req.method === 'POST') {
          if (a.rt.state.seats[a.seat]?.kind === 'llm') return send(403, { ok: false, code: 'denied', why: 'thumbnails come from a person\'s view' });
          let body; try { body = await readBody(req, 300 * 1024); } catch { return send(413, { ok: false, code: 'too_large', why: 'a thumbnail is at most 300 KB' }); }
          if (body.length < 16 || body.toString('ascii', 0, 4) !== 'RIFF' || body.toString('ascii', 8, 12) !== 'WEBP') return send(400, { ok: false, why: 'a thumbnail must be a WebP image' });
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, area + '.webp'), body);
          const meta = { at: Date.now(), by: a.seat, byName: a.rt.state.seats[a.seat]?.name || null, bytes: body.length };
          // ?frame=focusX,focusZ,dist,yaw,pitch,aspect: the camera the picture was shot from, so opening the area from
          // World navigation can start on exactly that view (Harry 2026-10-05)
          const fr = (url.searchParams.get('frame') || '').split(',').map(Number);
          if (fr.length === 6 && fr.every(Number.isFinite) && fr[2] > 0 && fr[2] < 1e5 && fr[5] > 0.1 && fr[5] < 10) meta.frame = { focus: [fr[0], 0, fr[1]], dist: fr[2], yaw: fr[3], pitch: fr[4], aspect: fr[5] };
          fs.writeFileSync(path.join(dir, area + '.json'), JSON.stringify(meta));
          return send(200, { ok: true, ...meta });
        }
        return send(405, { ok: false, why: 'GET or POST' });
      }
      // snapshots (Settings ▸ Campaign admin): kept on the relay per campaign, GM only, so they follow the GM between devices
      //   GET  /c/<id>/snapshots            the list (no contents)      GET /c/<id>/snapshots/<sid>   one, whole
      //   POST /c/<id>/snapshots            save {name, area, areaName, entities}      POST /c/<id>/snapshots/<sid>/delete
      if (parts[0] === 'c' && parts[1] && parts[2] === 'snapshots') {
        const a = auth(req, url.searchParams, parts[1]);
        if (a.err) return send(...a.err);
        if (!isGmSide(a.rt.state, a.seat)) return send(403, { ok: false, code: 'denied', why: 'snapshots are for the GM' });
        const dir = path.join(dataDir, a.rt.id, 'snapshots'), SID = /^snap_[0-9a-z]{6,24}$/;
        const list = () => { try { return fs.readdirSync(dir).filter(f => f.endsWith('.meta.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).sort((x, y) => x.at - y.at); } catch { return []; } };
        if (req.method === 'GET' && !parts[3]) return send(200, { ok: true, snapshots: list() });
        if (req.method === 'GET' && SID.test(parts[3] || '')) { try { return send(200, { ok: true, snapshot: JSON.parse(fs.readFileSync(path.join(dir, parts[3] + '.json'), 'utf8')) }); } catch { return send(404, { ok: false, why: 'no such snapshot' }); } }
        if (req.method === 'POST' && !parts[3]) {
          const body = await readJson(req, 8 * 1024 * 1024);
          if (!body || typeof body.entities !== 'object' || Array.isArray(body.entities)) return send(400, { ok: false, why: 'a snapshot needs entities' });
          if (list().length >= 50) return send(429, { ok: false, why: 'at most 50 snapshots per campaign: delete some first' });
          const sid = 'snap_' + crypto.randomBytes(8).toString('hex').slice(0, 12).replace(/[^0-9a-z]/g, '0');
          const meta = { id: sid, name: String(body.name || 'Snapshot').slice(0, 60), at: Date.now(), area: String(body.area || '').slice(0, 40), areaName: String(body.areaName || '').slice(0, 80), n: Object.keys(body.entities).length, by: a.seat };
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, sid + '.json'), JSON.stringify({ ...meta, entities: body.entities }));
          fs.writeFileSync(path.join(dir, sid + '.meta.json'), JSON.stringify(meta));
          log(`${a.rt.id}: snapshot ${sid} "${meta.name}" (${meta.n} things)`);
          return send(200, { ok: true, snapshot: meta });
        }
        if (req.method === 'POST' && SID.test(parts[3] || '') && parts[4] === 'delete') {
          for (const f of [parts[3] + '.json', parts[3] + '.meta.json']) { try { fs.unlinkSync(path.join(dir, f)); } catch { } }
          return send(200, { ok: true });
        }
        return send(404, { ok: false, why: 'not found' });
      }
      // DELETE A CAMPAIGN (2026-10-06).  POST /c/<id>/delete?seat=TOKEN   the campaign's own GM, a person (never an AI seat)
      //   The campaign leaves the relay at once (its connections are told and closed) and its folder is MOVED to
      //   data/removed-YYYY-MM-DD/<id> (the loader reads only cmp_*), where it stays until someone clears it: putting the
      //   folder back and restarting the relay brings it back. &purge=1 removes the folder outright (what tests ask for).
      if (parts[0] === 'c' && parts[1] && parts[2] === 'delete' && !parts[3]) {
        if (req.method !== 'POST') return send(405, { ok: false, why: 'POST' });
        const a = auth(req, url.searchParams, parts[1]);
        if (a.err) return send(...a.err);
        const s = a.rt.state.seats[a.seat];
        if (s?.kind !== 'human' || s.role !== 'gm') return send(403, { ok: false, code: 'denied', why: 'only the GM (a person) can delete a campaign' });
        return send(200, deleteCampaign(a.rt.id, { purge: url.searchParams.get('purge') === '1', by: a.seat }));
      }
      if (await tickets.handle(req, res, { url, parts, send, auth, readBody, canSee })) return;
      if (parts[0] === 'c' && parts[1] && req.method === 'GET') {
        const a = auth(req, url.searchParams, parts[1], { short: true });
        if (a.err) return send(...a.err);
        const [status, body, type] = await handleGet(a.rt, a.seat, a.token, parts.slice(2), url.searchParams, baseOf(req));
        return send(status, body, type);
      }
      return send(404, { ok: false, why: 'not found' });
    } catch (e) {
      log(`http error: ${e.stack}`);
      send(500, { ok: false, why: 'relay error' });
    }
  });

  // ---------------- connections: one message handler, two transports ----------------
  // A conn is { seat, rt, subs, send, sendLossy, close }. WebSocket where the path allows it; SSE down + ordered
  // POST up where it doesn't (our Cloudflare zone answers a websocket upgrade with a plain GET). Same protocol.
  function newConn(impl) {
    const conn = { seat: null, rt: null, subs: new Set(), presBudget: { t: Date.now(), n: 0 }, ...impl };
    conn.helloTimer = setTimeout(() => { if (!conn.seat) conn.close(); }, 10000);
    return conn;
  }
  function onConnMessage(conn, m0) {
    const m = migrateMessage(m0); // an old client's `table` reads as `area`
    if (!m || typeof m !== 'object') return;
    if (!conn.seat) {
      if (m.t !== 'hello') return;
      const claims = tokens.verify(m.token);
      const rt = claims && campaigns.get(claims.c);
      const seat = rt?.state.seats[claims.s];
      if (!rt || !tokens.matches(claims, rt.id, seat) || !liveSeat(rt.state, claims.s)) { conn.send({ t: 'denied', why: rt ? 'seat revoked' : 'bad token' }); conn.close(); return; }
      clearTimeout(conn.helloTimer);
      conn.seat = claims.s; conn.rt = rt;
      rt.attach(conn);
      conn.send({ t: 'welcome', seat: conn.seat, campaign: projectCampaign(rt.state, conn.seat, rt.online()), engine: roomgen?.version || null, transport: conn.kind });
      if (notice && Date.now() < notice.until) conn.send({ t: 'notice', ...notice });
      return;
    }
    const rt = conn.rt;
    switch (m.t) {
      case 'sub': if (typeof m.area === 'string') rt.subscribe(conn, m.area, Number.isInteger(m.since) ? m.since : null); break;
      case 'unsub': conn.subs.delete(m.area); rt.broadcastPresence(conn, { area: m.area, cursor: null, drag: null, gone: true }); break;
      case 'pres': {
        const b = conn.presBudget, now = Date.now();
        if (now - b.t > 1000) { b.t = now; b.n = 0; }
        if (++b.n <= 40) rt.presence(conn, m);
        break;
      }
      case 'cmd': {
        const res = rt.dispatch(conn.seat, { type: m.type, area: m.area, args: m.args }, { cid: typeof m.cid === 'string' ? m.cid.slice(0, 64) : null, conn });
        if (res.ok) conn.send({ t: 'ack', cid: m.cid, dup: !!res.duplicate, seqs: res.seqs, token: res.token, result: res.result, undid: res.undid });
        else conn.send({ t: 'nack', cid: m.cid, type: m.type, code: res.code, why: res.why });
        break;
      }
      case 'whisper': rt.whisper(conn, m); break;
      case 'ping': conn.send({ t: 'pong', ts: m.ts }); break;
    }
  }
  function onConnClose(conn) { clearTimeout(conn.helloTimer); conn.rt?.detach(conn); }

  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
  server.on('upgrade', (req, sock, head) => {
    const p = new URL(req.url, 'http://x').pathname.replace(/^\/api\/tw-relay/, '');
    if (p !== '/ws') { sock.destroy(); return; }
    wss.handleUpgrade(req, sock, head, (ws) => wss.emit('connection', ws, req));
  });
  wss.on('connection', (ws) => {
    const conn = newConn({
      kind: 'ws',
      send: (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); },
      sendLossy: (m) => { if (ws.readyState === 1 && ws.bufferedAmount < 128 * 1024) ws.send(JSON.stringify(m)); },
      close: () => { try { ws.close(); } catch {} },
    });
    ws.on('message', (raw) => { let m; try { m = JSON.parse(raw); } catch { return; } onConnMessage(conn, m); });
    ws.on('close', () => onConnClose(conn));
    ws.on('error', () => {});
  });

  // SSE + POST. GET /sse/<sid>/events opens the downstream; POST /sse/<sid>/send {n, msgs} carries the upstream in
  // order (the client keeps one POST in flight; `n` makes a retried POST harmless). A sid is a random secret
  // minted by the client; the session dies with its stream.
  const sse = new Map(); // sid -> { conn, res, lastN }
  const SID_RE = /^[0-9a-z_]{16,40}$/;
  function sseOpen(sid, req, res) {
    if (!SID_RE.test(sid) || sse.has(sid)) { res.writeHead(409).end(); return; }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', 'x-accel-buffering': 'no', connection: 'keep-alive', 'access-control-allow-origin': '*' });
    res.write(': open\n\n');
    const write = (m) => res.write(`data: ${JSON.stringify(m)}\n\n`);
    const conn = newConn({
      kind: 'sse',
      send: (m) => { if (!res.writableEnded) write(m); },
      sendLossy: (m) => { if (!res.writableEnded && res.writableLength < 128 * 1024) write(m); },
      close: () => { if (!res.writableEnded) res.end(); },
    });
    const s = { conn, res, lastN: 0 };
    sse.set(sid, s);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000); // Cloudflare drops streams idle for 100 s
    req.on('close', () => { clearInterval(ping); sse.delete(sid); onConnClose(conn); });
  }
  async function ssePost(sid, req, res) {
    const s = sse.get(sid);
    const body = await readJson(req, 1024 * 1024).catch(() => null);
    if (!s) { res.writeHead(410, { 'access-control-allow-origin': '*' }).end(); return; }
    if (body && Number.isInteger(body.n) && body.n > s.lastN && Array.isArray(body.msgs)) {
      s.lastN = body.n;
      for (const m of body.msgs.slice(0, 500)) onConnMessage(s.conn, m);
    }
    res.writeHead(204, { 'access-control-allow-origin': '*' }).end();
  }

  // ghosts glide at ~15 Hz
  let last = Date.now();
  const ghostTimer = setInterval(() => { const now = Date.now(), dt = (now - last) / 1000; last = now; for (const rt of campaigns.values()) rt.tickGhosts(dt); }, 66);

  await new Promise(r => server.listen(port, host, r));
  const actualPort = server.address().port;
  log(`relay listening on ${host}:${actualPort}, data ${dataDir}, ${campaigns.size} campaigns`);

  async function close() {
    clearInterval(ghostTimer);
    for (const c of wss.clients) c.terminate();
    for (const s of sse.values()) s.res.end();
    // one campaign that cannot be saved (its directory was deleted under the relay, a full disk) must not cost the
    // campaigns after it their shutdown snapshot: catch per campaign, say so, carry on  (2026-10-06)
    let failed = 0;
    for (const rt of campaigns.values()) { try { rt.close(); } catch (e) { failed++; log(`${rt.id}: could not save on shutdown (${e.message}); carrying on`); try { rt.journal.close(); } catch { } } }
    if (failed) log(`shutdown: ${failed} of ${campaigns.size} campaigns could not be saved`);
    await new Promise(r => server.close(r));
  }
  return { port: actualPort, campaigns, close, roomgen, tokens, deleteCampaign, adminKey, tickets };
}

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    // past the cap: stop keeping it, but read to the end so the client gets a clean 413 (not a reset connection)
    req.on('data', (c) => { n += c.length; if (n <= max) chunks.push(c); else chunks.length = 0; if (n > max * 4) req.destroy(); });
    req.on('end', () => n > max ? reject(new Error('body too large')) : resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function readJson(req, max = 16384) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > max) { reject(new Error('body too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { resolve({}); } });
  });
}

// (real paths on both sides: a prod relay is started through the release link /var/lib/tw-releases/current, 2026-10-19)
const realOf = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
if (process.argv[1] && realOf(fileURLToPath(import.meta.url)) === realOf(process.argv[1])) {
  const relay = await startRelay();
  const stop = async (sig) => { console.log(`${sig}: snapshotting and closing`); await relay.close(); process.exit(0); };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}
