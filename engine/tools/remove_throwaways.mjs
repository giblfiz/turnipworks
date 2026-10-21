// Remove the test suites' leftover campaigns from a relay.   (2026-10-06)
//   node engine/tools/remove_throwaways.mjs                 list what would go (nothing is touched)
//   node engine/tools/remove_throwaways.mjs --go            delete them through the relay's own POST /c/<id>/delete
//     --relay http://127.0.0.1:8097   --data engine/data   --idle-hours 2   --purge (remove the files; default: moved to data/removed-<date>/)
//     --all    EVERY campaign, whatever its name (Harry 2026-10-06, of the live relay: "I have made *no* items in turnipworks that
//              need to be preserved, it can throw away anything from my testing use"). Never the default.
// In every mode a campaign is left alone when it was written to in the last --idle-hours, or when anyone is connected to it now.
//
// ONLY a campaign whose NAME marks it unmistakably as a test throwaway is ever listed:
//   "TEST <anything> (throwaway)"      what the browser suites name theirs
//   "ZZ <anything> throwaway <...>"    the fog checks of 2026-10-05
// and only when nothing has been written to it for --idle-hours (another agent may be in the middle of a run).
// Every other campaign, whatever it looks like ("My Campaign", "Dawnhaven", "The Otter Inn", "probe"),
// is left alone. Since 2026-10-06 the suites remove their own (tests/tw_sandbox.py remove_campaigns), so this is for
// what was already there, and for runs that were killed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTokens } from '../relay/tokens.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const GO = process.argv.includes('--go'), PURGE = process.argv.includes('--purge'), ALL = process.argv.includes('--all');
const DATA = fs.realpathSync(arg('data', path.join(HERE, '..', 'data'))), RELAY = arg('relay', 'http://127.0.0.1:8097').replace(/\/$/, ''), IDLE = Number(arg('idle-hours', 2)) * 3600e3;
export const THROWAWAY = (name) => /^TEST .+ \(throwaway\)$/.test(name) || /^ZZ .*\bthrowaway\b/.test(name);

const rows = [];
for (const d of fs.readdirSync(DATA).filter(x => x.startsWith('cmp_')).sort()) {
  let name = null, last = 0, gm = null;
  try {
    const lines = fs.readFileSync(path.join(DATA, d, 'journal.jsonl'), 'utf8').split('\n').filter(Boolean);
    name = JSON.parse(lines[0]).genesis?.name ?? null; last = JSON.parse(lines.at(-1)).at;
    for (const l of lines.slice(0, 12)) { const r = JSON.parse(l); const a = r.camp?.type === 'seat.create' && r.camp.args; if (a && a.kind === 'human' && a.role === 'gm') { gm = a; break; } }
  } catch { continue; }
  try { const s = JSON.parse(fs.readFileSync(path.join(DATA, d, 'snapshot.json'), 'utf8')).state; name = s.name; gm = Object.values(s.seats).find(x => x.kind === 'human' && x.role === 'gm' && !x.revoked) || gm; } catch { }
  rows.push({ d, name, last, gm });
}
const marked = rows.filter(r => ALL || (typeof r.name === 'string' && THROWAWAY(r.name)));
// is anyone connected to it right now? (the relay's own answer: the campaign view lists who is online)
const tokens = makeTokens(fs.readFileSync(path.join(DATA, 'secret'), 'utf8').trim());
for (const r of marked) {
  r.online = [];
  if (!r.gm) continue;
  try { const st = await fetch(`${RELAY}/c/${r.d}/state?seat=${tokens.mint(r.d, r.gm)}`).then(x => x.json()); r.online = (st.campaign?.seats || []).filter(s => s.online).map(s => s.name); r.onRelay = !!st.campaign; } catch { r.onRelay = false; }
}
const now = Date.now(), idle = (r) => now - r.last >= IDLE && r.gm && !r.online.length, ready = marked.filter(idle), busy = marked.filter(r => !idle(r));
const when = (t) => new Date(t).toLocaleString('sv').slice(0, 16);
console.log(ALL ? `${rows.length} campaigns in ${DATA}; --all: every one that is idle and has nobody connected` : `${rows.length} campaigns in ${DATA}; ${marked.length} are named as test throwaways; ${rows.length - marked.length} are not and are left alone`);
for (const r of ready) console.log(`  ${GO ? 'delete' : 'would delete'}  ${r.d}  ${JSON.stringify(r.name)}  last written ${when(r.last)}`);
for (const r of busy) console.log(`  leave (${!r.gm ? 'no GM seat found' : r.online.length ? `online now: ${r.online.join(', ')}; last written ${when(r.last)}` : `written ${when(r.last)}, less than ${IDLE / 3600e3} h ago`})  ${r.d}  ${JSON.stringify(r.name)}`);
if (!GO) { console.log(`${ready.length} would be deleted, ${busy.length} left for now. Add --go to do it.`); process.exit(0); }
let done = 0, failed = 0;
for (const r of ready) {
  const res = await fetch(`${RELAY}/c/${r.d}/delete?seat=${tokens.mint(r.d, r.gm)}${PURGE ? '&purge=1' : ''}`, { method: 'POST' }).then(x => x.json()).catch(e => ({ ok: false, why: e.message }));
  if (res.ok && res.name === r.name) done++; else { failed++; console.log(`  FAILED ${r.d}: ${res.why || JSON.stringify(res)}`); }
}
console.log(`deleted ${done} of ${ready.length}${failed ? `, ${failed} failed` : ''}; ${busy.length} left for now; relay now has ${(await fetch(RELAY + '/health').then(x => x.json()).catch(() => ({}))).campaigns} campaigns`);
process.exit(failed ? 1 : 0);
