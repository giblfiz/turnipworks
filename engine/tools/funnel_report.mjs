#!/usr/bin/env node
// The funnel's daily counts: "a table that played" and what leads to it (relay/funnel.js; docs/NETCODE.md "The funnel").
// Read-only on the relay's file (except --exclude / --include, which append one line). Nothing here is public.
//
//   node engine/tools/funnel_report.mjs                 prod (engine/data), the last 30 days, Pacific days
//   node engine/tools/funnel_report.mjs --dev           the dev relay's (/var/lib/tw-relay-dev/data)
//     --days N   --tz Area/City   --json   --tables (every table, the excluded ones too, with why)   --data DIR
//     --by utm_content                 rows per utm_content (or utm_source, utm_campaign, …) and the ad click id's platform
//                                      (google | meta | reddit | …), with the same counts and the phone page's
//     --emails                         the address book's counts (no addresses)
//     --exclude <cmp_id> "why"         take a table out of the count by hand (our own test); --include <cmp_id> puts it back
//                                      (also a phone page's pg_… or a handoff's hd_…)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEvents, report, DAY_COLS, PHONE_COLS, BY_KEYS } from '../relay/funnel.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), flag = (k) => a.includes(k), val = (k, d) => { const i = a.indexOf(k); return i >= 0 && a[i + 1] ? a[i + 1] : d; };
const data = val('--data', flag('--dev') ? '/var/lib/tw-relay-dev/data' : path.join(HERE, '..', 'data'));
const file = path.join(data, 'funnel', 'events.jsonl');
for (const [k, ev] of [['--exclude', 'exclude'], ['--include', 'include']]) if (flag(k)) {
  const c = val(k); if (!/^(cmp|pg|hd)_[0-9a-z]{4,24}$/.test(c || '')) { console.error(`${k} needs a campaign id (cmp_…), a phone page's (pg_…) or a handoff's (hd_…)`); process.exit(2); }
  const why = ev === 'exclude' ? (a[a.indexOf(k) + 2] && !a[a.indexOf(k) + 2].startsWith('--') ? a[a.indexOf(k) + 2] : 'by hand') : undefined;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify({ at: Date.now(), ev, c, ...(why && { why }) }) + '\n');
  console.log(`${ev}d ${c}${why ? ` (${why})` : ''}`); process.exit(0);
}
if (flag('--emails')) {
  let addrs = {}; try { addrs = JSON.parse(fs.readFileSync(path.join(data, 'linkmail', 'addresses.json'), 'utf8')).addrs || {}; } catch { }
  const A = Object.values(addrs);
  const out = { addresses: A.length, ad_matching_eligible: A.filter(x => x.ad_matching_eligible).length, news: A.filter(x => x.news).length, gm: A.filter(x => x.links.some(l => l.role === 'gm')).length, player: A.filter(x => x.links.some(l => l.role === 'player')).length, byCountry: A.reduce((m, x) => (m[x.country] = (m[x.country] || 0) + 1, m), {}) };
  console.log(JSON.stringify(out, null, 1)); process.exit(0);
}
const by = val('--by', null);
if (by && !BY_KEYS.includes(by)) { console.error(`--by takes one of ${BY_KEYS.join(', ')}`); process.exit(2); }
const R = report(readEvents(file), { days: Number(val('--days', 30)), tz: val('--tz', 'America/Los_Angeles'), tests: flag('--tables') || flag('--tests'), by });
if (flag('--json')) { console.log(JSON.stringify(R, null, 1)); process.exit(0); }
const cols = DAY_COLS, pcols = PHONE_COLS;
console.log(`Turnip Works funnel, ${data}: ${R.since.slice(0, 10)} .. ${R.until.slice(0, 10)} (${R.tz} days)`);
console.log(['day       ', ...cols.map(c => c.padStart(8)), ' |', ...pcols.map(c => c.padStart(9))].join(' '));
for (const d of R.days) console.log([d.day, ...cols.map(c => String(d[c]).padStart(8)), ' |', ...pcols.map(c => String(d[c]).padStart(9))].join(' '));
console.log(['total     ', ...cols.map(c => String(R.totals[c]).padStart(8)), ' |', ...pcols.map(c => String(R.totals[c]).padStart(9))].join(' '));
console.log(`played = a GM opened the table and another person joined it.  together = both on at once.  sameNet = the player came from the GM's network.`);
console.log(`engaged = the GM was on the table 180 s and placed, moved or built something, rolled or invited.`);
console.log(`phone = the phone page shown.  handoff = its link emailed.  opened = that link opened on a computer.  fromPhone = tables started from it (phone ad -> desktop).`);
if (R.by) {
  const w = Math.max(12, ...R.by.map(g => String(g[by] ?? '(none)').length)) + 1;
  console.log(`\nby ${by} and ad click platform:`);
  console.log([by.padEnd(w), 'click'.padEnd(10), ...['started', 'played', 'together', 'engaged', ...pcols].map(c => c.padStart(9))].join(' '));
  for (const g of R.by) console.log([String(g[by] ?? '(none)').padEnd(w), String(g.click || '-').padEnd(10), ...['started', 'played', 'together', 'engaged', ...pcols].map(c => String(g[c]).padStart(9))].join(' '));
}
const ex = Object.entries(R.excluded); console.log(`left out: ${ex.length ? ex.map(([k, n]) => `${n} ${k}`).join(', ') : 'none'}`);
if (R.tables) for (const t of R.tables) console.log(`  ${t.c} ${t.at.slice(0, 16)} ${t.country || '--'} ${t.test || t.excluded ? `[${t.test || t.excluded}] ` : ''}invites ${t.invites} joins ${t.joins}${t.played ? ' PLAYED' : ''}${t.together ? ' together' : ''}${t.engaged ? ' ENGAGED' : ''}${t.landing?.utm_source ? ` utm_source=${t.landing.utm_source}` : ''}${t.landing?.utm_content ? ` utm_content=${t.landing.utm_content}` : ''}${t.click ? ` click=${t.click}` : ''}${t.handoff ? ' from-phone' : ''}`);
