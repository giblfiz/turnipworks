// Release checks and a headless test seat (2026-10-19; docs/NETCODE.md "Two servers"; tools/release.sh runs this).
//
//   node engine/tools/release_verify.mjs verify --release <dir> [--port 8097] [--host turnipworks.net]
//       Does prod serve this release? Through the box's own nginx (Host: turnipworks.net, no Cloudflare):
//       the page carries the release's client stamp and channel "prod", /release.json and /look/version.json name
//       the release, the relay's /health names it, and a headless seat can make a sandbox campaign, join it over the
//       websocket, see its first area, and delete it. Prints one JSON line; exit 0 = verified.
//       TW_RELEASE_FAIL_VERIFY=1 makes it fail on purpose (the rollback test).
//   node engine/tools/release_verify.mjs spawn --release <dir>
//       Before a release becomes the candidate: start ITS relay code on a free port with a throwaway data folder
//       and its own tuner files; a seat joins a new campaign there. Nothing live is touched.
//   node engine/tools/release_verify.mjs seat --relay <http base> [--host H] [--hold S] [--out file.jsonl]
//       A test seat: makes a sandbox campaign ("TEST release seat (throwaway)"), joins it, logs every message type,
//       every close and every reconnect to --out (one JSON line each), holds S seconds, then deletes the campaign.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k, d = null) => { const i = argv.indexOf('--' + k); return i > 0 ? argv[i + 1] : d; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// one HTTP request with an explicit Host header (fetch does not allow one)
function req(url, { method = 'GET', host = null, body = null, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const r = http.request({ hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, method,
      headers: { ...(host && { host }), ...(body && { 'content-type': 'application/json' }), ...headers }, timeout: 15000 }, (res) => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => { const text = Buffer.concat(chunks).toString(); let json = null; try { json = JSON.parse(text); } catch { } resolve({ status: res.statusCode, text, json }); });
    });
    r.on('timeout', () => r.destroy(new Error('timeout ' + url)));
    r.on('error', reject);
    if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

// make a sandbox campaign, join it with a raw websocket, see its first area, delete it
async function joinOnce(httpBase, wsUrl, host) {
  const made = await req(httpBase + '/campaigns', { method: 'POST', host, body: { name: 'TEST release verify (throwaway)', gm: 'Release check' } });
  if (!made.json?.ok) throw new Error(`campaign not made: HTTP ${made.status} ${made.text.slice(0, 120)}`);
  const { campaign, token, area } = made.json;
  try {
    const got = await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, host ? { headers: { host } } : {});
      const t = setTimeout(() => { ws.terminate(); reject(new Error('no welcome + snapshot in 15 s')); }, 15000);
      let welcome = null;
      ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', token, v: 1 })));
      ws.on('message', (raw) => {
        const m = JSON.parse(raw);
        if (m.t === 'denied') { clearTimeout(t); ws.close(); reject(new Error('denied: ' + m.why)); }
        if (m.t === 'welcome') { welcome = m; ws.send(JSON.stringify({ t: 'sub', area })); }
        if (m.t === 'snap' && m.area === area) { clearTimeout(t); ws.close(); resolve({ engine: welcome?.engine, transport: welcome?.transport, seq: m.state?.seq }); }
      });
      ws.on('error', (e) => { clearTimeout(t); reject(e); });
    });
    return { campaign, ...got };
  } finally {
    await req(`${httpBase}/c/${campaign}/delete?seat=${encodeURIComponent(token)}&purge=1`, { method: 'POST', host }).catch(() => null);
  }
}

async function verify() {
  const dir = opt('release'), port = Number(opt('port', 8097)), host = opt('host', 'turnipworks.net');
  const rel = JSON.parse(fs.readFileSync(path.join(dir, 'release.json'), 'utf8'));
  const checks = [], fail = (what) => checks.push({ ok: false, what }), pass = (what) => checks.push({ ok: true, what });
  const origin = 'http://127.0.0.1';
  try {
    const h = await req(`http://127.0.0.1:${port}/health`);
    // (rel.bootstrap: the first release, 2026-10-19, a copy of what prod served before releases existed: its relay
    // and page predate the release stamp and the channel meta)
    h.json?.ok && (h.json.release === rel.id || rel.bootstrap) ? pass(`relay /health ok (${h.json.release || 'bootstrap'})`) : fail(`relay /health: ${h.text.slice(0, 160)} (want release ${rel.id})`);
    const page = await req(origin + '/', { host });
    page.status === 200 && page.text.includes(`TW_V = '${rel.client}'`) ? pass(`page carries client ${rel.client}`) : fail(`page: HTTP ${page.status}, client stamp ${(page.text.match(/TW_V = '([^']*)'/) || [])[1]} (want ${rel.client})`);
    page.text.includes('<meta name="tw-channel" content="prod">') || (rel.bootstrap && !page.text.includes('tw-channel')) ? pass('page says channel prod') : fail('page does not say channel prod');
    const main = await req(`${origin}/engine/client/main.js?v=${rel.client}`, { host });
    main.status === 200 && main.text.includes('ClientSync') ? pass('client code served') : fail(`client main.js: HTTP ${main.status}`);
    const rj = await req(origin + '/release.json', { host });
    rj.json?.id === rel.id ? pass('/release.json names it') : fail(`/release.json: ${rj.text.slice(0, 120)}`);
    const tv = await req(origin + '/look/version.json', { host });
    tv.json?.v === rel.tuner ? pass(`/look/ tuner ${rel.tuner}`) : fail(`/look/version.json: ${tv.text.slice(0, 120)} (want ${rel.tuner})`);
    const j = await joinOnce(origin + '/api/tw-relay', 'ws://127.0.0.1/api/tw-relay/ws', host);
    pass(`a headless seat joined a sandbox campaign (${j.transport}, area seq ${j.seq}, engine ${j.engine}) and deleted it`);
  } catch (e) { fail('error: ' + e.message); }
  if (process.env.TW_RELEASE_FAIL_VERIFY === '1') fail('TW_RELEASE_FAIL_VERIFY=1 (a forced failure, for the rollback test)');
  const ok = checks.every(c => c.ok);
  console.log(JSON.stringify({ ok, release: rel.id, failed: checks.filter(c => !c.ok).map(c => c.what), passed: checks.filter(c => c.ok).map(c => c.what) }));
  process.exit(ok ? 0 : 1);
}

async function spawnCheck() {
  const dir = path.resolve(opt('release'));
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-release-spawn-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  // started the way tw-relay.service starts prod: through a link to the release (like /var/lib/tw-releases/current),
  // cwd <link>/app, `node relay/server.js` (2026-10-19: an absolute path through the link once kept the relay from starting)
  const link = path.join(data, 'current');
  fs.symlinkSync(dir, link);
  const child = spawn(process.execPath, ['relay/server.js'], {
    cwd: path.join(link, 'app'), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), DATA_DIR: path.join(data, 'data'), TUNER_DIR: path.join(link, 'tuner/js'), TUNER_DATA: path.join(link, 'tuner/data'), TW_CHANNEL: 'spawn-check' },
  });
  child.on('exit', (code) => { out += `\n(relay exited ${code})`; });
  let out = ''; child.stdout.on('data', d => out += d); child.stderr.on('data', d => out += d);
  let res = { ok: false, why: 'relay did not answer in 30 s' };
  try {
    for (let i = 0; i < 150; i++) {
      await sleep(200);
      const h = await req(`http://127.0.0.1:${port}/health`).catch(() => null);
      if (h?.json?.ok) {
        if (!h.json.engine) { res = { ok: false, why: 'the room engine did not load: ' + (out.match(/room engine unavailable[^\n]*/) || [''])[0] }; break; }
        const j = await joinOnce(`http://127.0.0.1:${port}`, `ws://127.0.0.1:${port}/ws`, null);
        res = { ok: true, engine: h.json.engine, release: h.json.release, joined: j.seq !== undefined };
        break;
      }
    }
  } catch (e) { res = { ok: false, why: e.message }; }
  child.kill('SIGTERM');
  await sleep(300);
  fs.rmSync(data, { recursive: true, force: true });
  if (!res.ok) res.log = out.slice(-800);
  console.log(JSON.stringify(res));
  process.exit(res.ok ? 0 : 1);
}

async function seat() {
  const base = opt('relay', 'http://127.0.0.1:8097').replace(/\/$/, ''), host = opt('host'), hold = Number(opt('hold', 60)) * 1000;
  const outFile = opt('out');
  const logLine = (o) => { const line = JSON.stringify({ at: new Date().toISOString(), ...o }); if (outFile) fs.appendFileSync(outFile, line + '\n'); else console.log(line); };
  const made = await req(base + '/campaigns', { method: 'POST', host, body: { name: 'TEST release seat (throwaway)', gm: 'Test seat' } });
  if (!made.json?.ok) { logLine({ ev: 'error', why: made.text.slice(0, 200) }); process.exit(1); }
  const { campaign, token } = made.json;
  logLine({ ev: 'made', campaign });
  const wsUrl = base.replace(/^http/, 'ws') + '/ws';
  let stop = false, ws = null, opens = 0;
  const connect = () => {
    ws = new WebSocket(wsUrl, host ? { headers: { host } } : {});
    ws.on('open', () => { opens++; ws.send(JSON.stringify({ t: 'hello', token, v: 1 })); });
    ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.t === 'welcome') logLine({ ev: 'welcome', n: opens }); else if (m.t === 'notice') logLine({ ev: 'notice', text: m.text, swapAt: m.at && new Date(m.at).toISOString(), until: m.until && new Date(m.until).toISOString(), clear: !!m.clear }); else if (m.t === 'denied') logLine({ ev: 'denied', why: m.why }); });
    ws.on('close', () => { logLine({ ev: 'closed' }); if (!stop) setTimeout(connect, 500); });
    ws.on('error', () => { });
  };
  connect();
  const ping = setInterval(() => { try { ws.send(JSON.stringify({ t: 'ping', ts: Date.now() })); } catch { } }, 2000);
  await sleep(hold);
  stop = true; clearInterval(ping); try { ws.close(); } catch { }
  const d = await req(`${base}/c/${campaign}/delete?seat=${encodeURIComponent(token)}&purge=1`, { method: 'POST', host }).catch(e => ({ text: e.message }));
  logLine({ ev: 'deleted', ok: !!d.json?.ok });
  process.exit(0);
}

if (cmd === 'verify') await verify();
else if (cmd === 'spawn') await spawnCheck();
else if (cmd === 'seat') await seat();
else { console.error('usage: release_verify.mjs verify|spawn|seat … (see the header)'); process.exit(2); }
