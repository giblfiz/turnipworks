// Copy ONE prod campaign into dev, to try something on real data (2026-10-19; docs/NETCODE.md "Two servers").
//
//   node engine/tools/dev_copy_campaign.mjs <cmp_id> [--force]
//
// Read-only on prod: the campaign's folder in prod's data (engine/data of the main checkout) is copied, never
// written. The copy goes to the dev relay's data (/var/lib/tw-relay-dev/data/<cmp_id>; --force replaces an earlier
// copy), the dev relay restarts to load it (free: it is dev), and a GM link for the copy is printed. The dev relay
// signs seats with its own key, so prod's links do not open the copy and the copy's links do not open prod.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeTokens } from '../relay/tokens.js';

const PROD_DATA = process.env.TW_PROD_DATA || 'engine/data';
const DEV_DATA = process.env.TW_DEV_DATA || '/var/lib/tw-relay-dev/data';
const id = process.argv[2], force = process.argv.includes('--force');
if (!/^cmp_[0-9a-z]{4,24}$/.test(id || '')) { console.error('usage: node engine/tools/dev_copy_campaign.mjs <cmp_id> [--force]   (ids: ls ' + PROD_DATA + ')'); process.exit(2); }
const src = path.join(PROD_DATA, id), dst = path.join(DEV_DATA, id);
if (!fs.existsSync(path.join(src, 'journal.jsonl'))) { console.error(`no campaign ${id} in prod (${src})`); process.exit(1); }
if (fs.existsSync(dst) && !force) { console.error(`dev already has ${id} (${dst}); --force replaces it`); process.exit(1); }

const tmp = path.join(DEV_DATA, `.copy-${id}-${process.pid}`);
fs.cpSync(src, tmp, { recursive: true, filter: (f) => !f.endsWith('.pre-areas') });
if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
fs.renameSync(tmp, dst);

// the GM seat (a person) of the copy, minted with the DEV relay's key
const snap = fs.existsSync(path.join(dst, 'snapshot.json')) ? JSON.parse(fs.readFileSync(path.join(dst, 'snapshot.json'), 'utf8')) : null;
let seats = snap?.state?.seats || {};
if (!Object.keys(seats).length) for (const line of fs.readFileSync(path.join(dst, 'journal.jsonl'), 'utf8').split('\n')) {
  try { const e = JSON.parse(line); if (e.camp?.type === 'seat.create') seats[e.camp.args.id] = { creator: null, scope: null, ...e.camp.args }; } catch { }
}
const gm = Object.values(seats).find(s => s.kind === 'human' && s.role === 'gm' && !s.revoked);
if (!gm) { console.error('the copy has no GM seat that is a person'); process.exit(1); }

execFileSync('sudo', ['systemctl', 'restart', 'tw-relay-dev'], { stdio: 'inherit' });
const secret = fs.readFileSync(path.join(DEV_DATA, 'secret'), 'utf8').trim();
const token = makeTokens(secret).mint(id, gm);
let ok = false;
for (let i = 0; i < 100 && !ok; i++) {
  await new Promise(r => setTimeout(r, 200));
  try { const r = await fetch(`http://127.0.0.1:8098/c/${id}/state?seat=${encodeURIComponent(token)}`); ok = r.ok; } catch { }
}
if (!ok) { console.error('the dev relay did not open the copy (journalctl -u tw-relay-dev)'); process.exit(1); }
console.log(`copied ${id} "${snap?.state?.name || ''}" into dev (${dst}); GM "${gm.name}":`);
console.log(`  https://dev.turnipworks.net/#s=${token}`);
console.log(`  http://127.0.0.1:8180/#s=${token}      (from the build box)`);
