// TAKE A SHARE LINK DOWN (2026-10-29; relay/shares.js, docs/NETCODE.md "Shared builds"). A takedown is a delete by id,
// logged in <DATA_DIR>/shares/takedowns.jsonl. From the build box only: it reads the relay's admin key and never prints it.
//   node engine/tools/share_takedown.mjs <id or link> [--prod] [--reason "why"]       (default: the dev relay)
//   node engine/tools/share_takedown.mjs --info <id or link> [--prod]                 (what it is: name, kind, when, which campaign)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2), flag = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const prod = args.includes('--prod'); if (prod) args.splice(args.indexOf('--prod'), 1);
const info = args.includes('--info'); if (info) args.splice(args.indexOf('--info'), 1);
const reason = flag('--reason') || '';
const m = String(args[0] || '').match(/(?:^|\/s\/)([A-Za-z0-9_-]{22})(?=$|[/?#])/);
if (!m) { console.error('usage: share_takedown.mjs <id or link> [--prod] [--reason "why"] | --info <id or link> [--prod]'); process.exit(2); }
const id = m[1];
const HERE = path.dirname(fileURLToPath(import.meta.url));
const dataDir = prod ? path.join(HERE, '..', 'data') : '/var/lib/tw-relay-dev/data', port = prod ? 8097 : 8098;
if (info) {
  try { const meta = JSON.parse(fs.readFileSync(path.join(dataDir, 'shares', `${id}.meta.json`), 'utf8')); const { del, ...rest } = meta; console.log(JSON.stringify({ ...rest, at: new Date(meta.at).toISOString() }, null, 1)); }
  catch { console.log(`no share ${id} on ${prod ? 'prod' : 'dev'}`); process.exit(1); }
  process.exit(0);
}
const key = fs.readFileSync(path.join(dataDir, 'admin-key'), 'utf8').trim();
const r = await fetch(`http://127.0.0.1:${port}/admin/shares/${id}/takedown`, { method: 'POST', headers: { 'x-tw-admin': key, 'content-type': 'text/plain' }, body: JSON.stringify({ reason }) });
const body = await r.json().catch(() => ({}));
console.log(r.ok ? `taken down on ${prod ? 'prod' : 'dev'}: ${id} "${body.name}" (logged in shares/takedowns.jsonl)` : `not taken down (${r.status}): ${body.why || 'no answer'}`);
process.exit(r.ok ? 0 : 1);
