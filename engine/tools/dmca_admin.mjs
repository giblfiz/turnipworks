// THE DMCA DESK (2026-11-06; relay/dmca.js, relay/uploads.js; docs/UPLOADS.md "Running a takedown"). Fauna runs takedowns
// with this, from the build box only: it reads the relay's admin key and never prints it. Default: the dev relay.
//   node engine/tools/dmca_admin.mjs status [--prod]                      notices, counter-notices, what is due or OVERDUE, strikes
//   node engine/tools/dmca_admin.mjs find <words | id | hash | campaign>  uploaded models across every campaign (the notice's words)
//   node engine/tools/dmca_admin.mjs takedown <notice> <model id | raw hash> [--reason "why"] [--no-block]
//   node engine/tools/dmca_admin.mjs forward <counter>                    you have sent the counter-notice to the claimant
//   node engine/tools/dmca_admin.mjs lawsuit <counter> [--note "court, case"]   the claimant says it has sued: no restore
//   node engine/tools/dmca_admin.mjs reject-counter <counter> [--why "…"] | close <counter> --why "…"   (either: any open state)
//   node engine/tools/dmca_admin.mjs reject <notice> [--why "…"] | withdraw <notice>   (its takedowns lift, its strikes go)
//   node engine/tools/dmca_admin.mjs reinstate <campaign> --why "…"       a GM's appeal upheld: the cut-off is lifted, its
//                                                                         live strikes forgiven (kept on the record)
//   node engine/tools/dmca_admin.mjs restore <raw hash> <notice> [--campaign cmp_…] [--why "…"]   by hand (the tick does it in time)
//   node engine/tools/dmca_admin.mjs tick                                 run the restore check now
//   node engine/tools/dmca_admin.mjs letter <counter>                     the text to send the claimant with the counter-notice
//   node engine/tools/dmca_admin.mjs ready --agent "Name or title" --agent-address "street or PO box" --phone "+1 …" --number DMCA-…
//                                          --policy URL --terms URL --mailbox ADDR [--org "Implausible Enterprises LLC"] [--counsel "who, date"]
//                                                                         record the safe-harbour facts (the gates read them)
// Nothing here sends mail: it prints what to send, and Fauna sends it from her own mailbox.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const take = (k, d = null) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const has = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const prod = has('--prod'), noBlock = has('--no-block');
const reason = take('--reason', ''), why = take('--why', ''), note = take('--note', ''), campaign = take('--campaign', null);
const ready = { agent: take('--agent'), agentAddress: take('--agent-address'), phone: take('--phone'), org: take('--org'), number: take('--number'), policyUrl: take('--policy'), termsUrl: take('--terms'), mailbox: take('--mailbox'), counsel: take('--counsel') };
const [cmd, a1, a2] = args;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || (prod ? path.join(HERE, '..', 'data') : '/var/lib/tw-relay-dev/data'), port = Number(process.env.PORT) || (prod ? 8097 : 8098);
const key = () => fs.readFileSync(path.join(dataDir, 'admin-key'), 'utf8').trim();
const call = async (p, body) => { const r = await fetch(`http://127.0.0.1:${port}${p}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'x-tw-admin': key(), 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); const j = await r.json().catch(() => ({ ok: false, why: `answered ${r.status}` })); return j; };
const out = (j) => { console.log(JSON.stringify(j, null, 1)); process.exit(j.ok === false ? 1 : 0); };
const day = (ms) => ms ? new Date(ms).toISOString().slice(0, 16).replace('T', ' ') : '-';

if (cmd === 'status') {
  const j = await call('/admin/dmca');
  if (!j.ok) out(j);
  console.log(`relay ${prod ? 'prod' : 'dev'}: hosting ${j.hosting.on ? 'READY' : 'not ready'}; public sharing ${j.publicSharing.on ? 'ON' : 'off'}; ${j.blocked} file(s) blocked`);
  for (const m of j.publicSharing.missing) console.log(`  waits for: ${m}`);
  console.log(`notices (${j.notices.length}):`); for (const n of j.notices) console.log(`  ${n.id} ${day(n.at)} ${n.status}${n.missing ? ` (missing ${n.missing.join(', ')})` : ''} ${n.fields?.name || ''} <${n.fields?.email || n.fields?.phone || ''}>: ${String(n.fields?.work || '').slice(0, 50)}`);
  console.log(`counter-notices (${j.counters.length}):`); for (const c of j.counters) console.log(`  ${c.id} ${day(c.at)} ${c.status} notice ${c.notice} campaign ${c.campaign} "${c.model?.name}"${c.window ? ` window ${c.window.afterDay}..${c.window.byDay}` : ''}`);
  if (j.incomplete.length) console.log(`INCOMPLETE notices to help complete (write to the sender): ${j.incomplete.join(', ')}`);
  if (j.notForwarded.length) console.log(`LATE: counter-notices not yet forwarded to the claimant: ${j.notForwarded.join(', ')} (letter <id>, then forward <id>)`);
  if (j.overdue.length) console.log(`OVERDUE: windows open and not forwarded: ${j.overdue.join(', ')}`);
  if (j.restoredNow.length) console.log(`restored just now: ${j.restoredNow.join(', ')}`);
  if (j.reinstatedNow?.length) console.log(`reinstated just now (live strikes below the line): ${j.reinstatedNow.join(', ')}`);
  console.log(`strikes (live, per campaign): ${JSON.stringify(j.strikes.campaigns)}; uploading ended: ${Object.keys(j.strikes.ended).join(', ') || 'none'}`);
  process.exit(0);
}
if (cmd === 'find') { const j = await call(`/admin/dmca/find?q=${encodeURIComponent(a1 || '')}`); for (const f of j.found || []) console.log(`${f.campaign} "${f.campaignName}"  model ${f.id}  file ${f.raw}  "${f.name}" ${f.status}  uploaded ${day(f.at)} by ${f.by}  attest ${f.attest?.version}`); process.exit(j.ok ? 0 : 1); }
if (cmd === 'takedown') out(await call('/admin/dmca/takedown', { notice: a1, ...(/^[0-9a-f]{64}$/.test(a2 || '') ? { id: a2, raw: null } : {}), reason, block: !noBlock }).then(async (j) => j.ok || !/^[0-9a-f]{64}$/.test(a2 || '') ? j : call('/admin/dmca/takedown', { notice: a1, raw: a2, reason, block: !noBlock })));
if (cmd === 'forward') out(await call(`/admin/dmca/counter/${a1}/forward`, {}));
if (cmd === 'lawsuit') out(await call(`/admin/dmca/counter/${a1}/lawsuit`, { note }));
if (cmd === 'reject-counter') out(await call(`/admin/dmca/counter/${a1}/reject`, { why }));
if (cmd === 'close') { if (!why) out({ ok: false, why: 'give the reason: --why "…"' }); out(await call(`/admin/dmca/counter/${a1}/close`, { why })); }
if (cmd === 'reinstate') { if (!why) out({ ok: false, why: 'give the reason: --why "…"' }); out(await call('/admin/dmca/reinstate', { campaign: a1, why })); }
if (cmd === 'reject' || cmd === 'withdraw') out(await call(`/admin/dmca/notice/${a1}/${cmd}`, { why }));
if (cmd === 'restore') out(await call('/admin/dmca/restore', { raw: a1, notice: a2, campaign, why: why || 'by hand' }));
if (cmd === 'tick') out(await call('/admin/dmca/tick', {}));
if (cmd === 'letter') {
  const j = await call('/admin/dmca'); const c = (j.counters || []).find(x => x.id === a1), n = c && (j.notices || []).find(x => x.id === c.notice);
  if (!c) out({ ok: false, why: 'no such counter-notice' });
  const F = c.fields;
  console.log(`To: ${n?.fields?.email || '(the claimant: ' + (n?.fields?.address || '?') + ')'}
Subject: Counter-notice for your notice ${c.notice} (Turnip Works)

We received the counter-notice below on ${day(c.at)} (UTC) about the material you identified in notice ${c.notice}.
As 17 U.S.C. §512(g)(2)(B) requires, we are sending you a copy. We will restore the material no sooner than the end of
${c.window?.afterDay} and no later than ${c.window?.byDay} (10 to 14 business days after we received the counter-notice),
unless our designated agent first receives notice from you that you have filed an action seeking a court order to
restrain the subscriber from engaging in infringing activity relating to the material.

--- counter-notice ${c.id} ---
Material: "${c.model?.name}" (removed under notice ${c.notice})
Name: ${F.name}
Address: ${F.address}
Phone: ${F.phone}${F.email ? `\nEmail: ${F.email}` : ''}
Statement under penalty of perjury that the material was removed as a result of mistake or misidentification: given
Consent to the jurisdiction of the federal district court for the subscriber's address (or, outside the US, any district where the service provider may be found): given
Will accept service of process from the claimant or its agent: given
Signature: /${F.signature}/${F.explain ? `\nThe subscriber adds: ${F.explain}` : ''}
---

Copyright Agent
Implausible Enterprises LLC`);
  console.error('(for you, not the letter: send it from the designated agent\'s mailbox; the wording is a draft, docs/legal/DMCA_POLICY.md)');
  process.exit(0);
}
if (cmd === 'ready') {
  const f = path.join(dataDir, 'dmca', 'safe-harbour.json'); let R = {}; try { R = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { }
  // the agent's details are printed on the policy page (§512(c)(2): the site must carry what the directory carries); each
  // flag updates its own field, so an amendment can change one without retyping the rest
  const A = { ...(R.agent || {}) };
  if (ready.agent) A.name = ready.agent;
  if (ready.org) A.org = ready.org;
  if (ready.agentAddress) A.address = ready.agentAddress;
  if (ready.phone) A.phone = ready.phone;
  if (ready.number) { A.number = ready.number; A.at = new Date().toISOString(); }
  if (Object.keys(A).length) R.agent = { org: 'Implausible Enterprises LLC', ...A };
  for (const k of ['policyUrl', 'termsUrl', 'mailbox']) if (ready[k]) R[k] = ready[k];
  if (ready.counsel) R.counsel = { by: ready.counsel, at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(R, null, 1), { mode: 0o600 });
  out({ ok: true, record: R, note: 'the relay reads this on every check: no restart needed' });
}
console.error('usage: see the top of engine/tools/dmca_admin.mjs'); process.exit(2);
