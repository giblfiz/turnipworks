// The operator's banner (2026-10-19; docs/NETCODE.md "Two servers"): POST /admin/notice reaches every connected seat,
// a seat that joins while it stands, and nobody without the admin key. /health says the channel and the release.
//   node engine/test/notice.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { startRelay } from '../relay/server.js';
import { ClientSync } from '../core/client-sync.js';
import { wsTransport } from '../core/transport.js';

let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra ?? ''); } else if (process.env.V) console.log('ok', m); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 4000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(20); } return false; }
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-notice-'));
process.on('exit', () => fs.rmSync(dataDir, { recursive: true, force: true }));
const relay = await startRelay({ port: 0, dataDir, log: () => {} });
const base = `http://127.0.0.1:${relay.port}`;
const key = fs.readFileSync(path.join(dataDir, 'admin-key'), 'utf8').trim();
ok(key.length >= 32 && (fs.statSync(path.join(dataDir, 'admin-key')).mode & 0o077) === 0, 'admin key made, readable by the relay user only');
const health = await fetch(base + '/health').then(r => r.json());
ok(health.channel === 'dev' && health.release === null, 'a relay run from the checkout says channel dev, no release', health);

const C = await fetch(base + '/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Notice test', gm: 'GM' }) }).then(r => r.json());
const seen = [];
const client = (bucket) => { const c = new ClientSync({ token: C.token, transport: wsTransport(`ws://127.0.0.1:${relay.port}/ws`, WebSocket), onNotice: (m) => bucket.push(m) }); c.connect(); return c; };
const a = client(seen);
await waitFor(() => a.status === 'live');
ok(a.status === 'live', 'a seat is connected');

const post = (body, k) => fetch(base + '/admin/notice', { method: 'POST', headers: k ? { 'x-tw-admin': k } : {}, body: JSON.stringify(body) });
ok((await post({ text: 'nope' })).status === 403, 'no key: refused');
ok((await post({ text: 'nope' }, key.replace(/.$/, c => c === 'a' ? 'b' : 'a'))).status === 403, 'a wrong key: refused');
await sleep(100);
ok(seen.length === 0, 'a refused notice reaches nobody');

const at = Date.now() + 2000, until = at + 120000;
const r = await post({ text: 'Server updating at 3:30, back in a minute', at, until }, key).then(r => r.json());
ok(r.ok && r.sent === 1 && r.notice.text.startsWith('Server updating'), 'the notice is sent to the one connection', r);
await waitFor(() => seen.length === 1);
ok(seen[0]?.t === 'notice' && seen[0].text === 'Server updating at 3:30, back in a minute' && seen[0].at === at && seen[0].until === until, 'the seat gets text, at and until', seen[0]);

const late = [];
const b = client(late);
await waitFor(() => late.length === 1);
ok(late[0]?.text === seen[0].text && late[0].id === seen[0].id, 'a seat that joins while it stands gets it after its welcome');

await post({ clear: true }, key);
await waitFor(() => seen.length === 2 && late.length === 2);
ok(seen[1]?.clear && late[1]?.clear, 'clear reaches both');
const late2 = [];
const c3 = client(late2);
await waitFor(() => c3.status === 'live'); await sleep(150);
ok(late2.length === 0, 'after clear a new seat gets no notice');

// an expired notice is not replayed to a joiner
await post({ text: 'old', at: Date.now() - 5000, until: Date.now() - 1000 }, key);
const late3 = [];
const c4 = client(late3);
await waitFor(() => c4.status === 'live'); await sleep(150);
ok(late3.length === 0, 'a notice past its until is not given to a joiner');

for (const c of [a, b, c3, c4]) c.close?.();
await relay.close();
console.log(`notice: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
