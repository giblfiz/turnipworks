// Feedback tickets on the relay (relay/tickets.js; docs/NETCODE.md "Feedback tickets"): filing, the screenshot file,
// "My tickets", the triage key, status and reply, the test sandbox, the abuse limits, and a restart.
//   node engine/test/tickets.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startRelay } from '../relay/server.js';
import { TICKET_LIMITS } from '../relay/tickets.js';

let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra ?? ''); } else if (process.env.V) console.log('ok', m); };
const madeDirs = [];
process.on('exit', () => { for (const d of madeDirs) fs.rmSync(d, { recursive: true, force: true }); });
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-tickets-')); madeDirs.push(dataDir);
let relay = await startRelay({ port: 0, dataDir, log: () => {} });
let base = `http://127.0.0.1:${relay.port}`;
const J = { 'content-type': 'application/json' };
const req = async (p, { method = 'GET', body, headers = {} } = {}) => {
  const r = await fetch(base + p, { method, headers: { ...(body && !(body instanceof Uint8Array) ? J : {}), ...headers }, body: body instanceof Uint8Array ? body : body ? JSON.stringify(body) : undefined });
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, body: ct.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()), type: ct };
};

const made = await req('/campaigns', { method: 'POST', body: { name: 'TEST tickets (throwaway)', gm: 'Harry' } });
const cid = made.body.campaign, gmTok = made.body.token, rt = relay.campaigns.get(cid);
const seatRes = rt.dispatch(made.body.seat, { type: 'seat.create', args: { id: 'seat_mira00001', kind: 'human', role: 'player', name: 'Mira', color: '#6fc36f' } }, {});
const plTok = seatRes.token, area = rt.state.areaOrder[0];
ok(plTok, 'a player seat for the test');
const key = fs.readFileSync(path.join(dataDir, 'tickets', 'triage.key'), 'utf8').trim();
ok(key.length >= 32 && (fs.statSync(path.join(dataDir, 'tickets', 'triage.key')).mode & 0o077) === 0, 'the triage key is made on first start, readable by its owner only');
const K = { authorization: `Bearer ${key}` };

// 1. filing every kind, as the player
const ids = {};
for (const kind of ['bug', 'idea', 'asset', 'question', 'other']) {
  const r = await req(`/c/${cid}/tickets?seat=${plTok}`, { method: 'POST', body: { kind, text: `a ${kind} ticket`, ctx: { area, client: '20261019', camera: { focus: [1, 0, 2], dist: 40 } }, commands: [{ dir: 'sent', type: 'token.move', ids: ['tok_x'] }], errors: [], ...(kind === 'asset' && { asset: { kind: 'object', entity: 'obj_1', cat: 'barrel', sku: 'barrel-oak', name: 'oak barrel' } }), shot: true } });
  ok(r.status === 200 && /^tkt_/.test(r.body.id) && r.body.receipt, `a player files a ${kind} ticket`, r.body);
  ids[kind] = r.body;
}
const empty = await req(`/c/${cid}/tickets?seat=${plTok}`, { method: 'POST', body: { kind: 'bug', text: '   ' } });
ok(empty.status === 400, 'a ticket with no words is refused (except an automatic one)', empty.body);
const badKind = await req(`/c/${cid}/tickets?seat=${plTok}`, { method: 'POST', body: { kind: 'rant', text: 'x' } });
ok(badKind.status === 400, 'an unknown kind is refused');
const noTok = await req(`/c/${cid}/tickets`, { method: 'POST', body: { kind: 'bug', text: 'x' } });
ok(noTok.status === 401, 'filing needs a seat token');

// 2. the screenshot is a file beside the record, once, by its own seat
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(500).fill(7)]);
const shot = await req(`/c/${cid}/tickets/${ids.bug.id}/shot?seat=${plTok}`, { method: 'POST', body: jpeg, headers: { 'content-type': 'image/jpeg' } });
ok(shot.status === 200 && fs.existsSync(path.join(dataDir, 'tickets', 'shots', `${ids.bug.id}.jpg`)), 'the screenshot is stored as tickets/shots/<id>.jpg', shot.body);
const shot2 = await req(`/c/${cid}/tickets/${ids.bug.id}/shot?seat=${plTok}`, { method: 'POST', body: jpeg });
ok(shot2.status === 409, 'a second screenshot for the same ticket is refused');
const shotGm = await req(`/c/${cid}/tickets/${ids.idea.id}/shot?seat=${gmTok}`, { method: 'POST', body: jpeg });
ok(shotGm.status === 404, 'another seat cannot attach a screenshot to my ticket');
const notImg = await req(`/c/${cid}/tickets/${ids.idea.id}/shot?seat=${plTok}`, { method: 'POST', body: new Uint8Array(64).fill(65) });
ok(notImg.status === 400, 'a screenshot must be an image');
const huge = await req(`/c/${cid}/tickets/${ids.idea.id}/shot?seat=${plTok}`, { method: 'POST', body: new Uint8Array(TICKET_LIMITS.shot + 10).fill(0xff) });
ok(huge.status === 413, 'a screenshot over the cap is refused (413)');
const lines = fs.readFileSync(path.join(dataDir, 'tickets', 'tickets.jsonl'), 'utf8').trim().split('\n');
ok(lines.every(l => l.length < 8000), 'no record carries an image inline', Math.max(...lines.map(l => l.length)));

// 3. size cap on the record itself
const big = await req(`/c/${cid}/tickets?seat=${plTok}`, { method: 'POST', body: { kind: 'bug', text: 'x', ctx: { junk: 'y'.repeat(TICKET_LIMITS.body + 100) } } });
ok(big.status === 413, 'a ticket over the size cap is refused (413)');
const long = await req(`/c/${cid}/tickets?seat=${plTok}`, { method: 'POST', body: { kind: 'other', text: 'z'.repeat(9000) } });
ok(long.status === 200, 'a long text is accepted …');

// 4. triage: the key, the list and its filters, one ticket, its picture, status and reply
const nokey = await req('/tickets');
ok(nokey.status === 401, 'the triage list needs the key');
const wrong = await req('/tickets', { headers: { authorization: 'Bearer ' + 'x'.repeat(key.length) } });
ok(wrong.status === 401, 'a wrong key is refused');
const all = await req('/tickets', { headers: K });
ok(all.status === 200 && all.body.total === 6 && all.body.tickets[0].at >= all.body.tickets.at(-1).at, 'the list has every ticket, newest first', all.body.total);
const longT = all.body.tickets.find(t => t.kind === 'other' && t.text.startsWith('zzz'));
ok(longT && (await req(`/tickets/${longT.id}`, { headers: K })).body.ticket.text.length === TICKET_LIMITS.text, '… and cut to the text cap');
const f1 = await req('/tickets?kind=asset', { headers: K });
ok(f1.body.matched === 1 && f1.body.tickets[0].asset?.sku === 'barrel-oak' && f1.body.tickets[0].asset?.name === 'oak barrel', 'filter by kind; an asset comment names its asset', f1.body.tickets[0]?.asset);
const f2 = await req(`/tickets?campaign=${cid}&status=new`, { headers: K });
ok(f2.body.matched === 6 && f2.body.facets.campaigns[cid]?.name === 'TEST tickets (throwaway)', 'filter by campaign and status; the facets name the campaign');
const today = new Date().toISOString().slice(0, 10);
const f3 = await req(`/tickets?since=${today}&until=${today}`, { headers: K }), f4 = await req('/tickets?until=2001-01-01', { headers: K });
ok(f3.body.matched === 6 && f4.body.matched === 0, 'filter by date');
const one = await req(`/tickets/${ids.bug.id}`, { headers: K });
const T1 = one.body.ticket;
ok(T1.seat.name === 'Mira' && T1.seat.role === 'player' && T1.campaign.id === cid && T1.area?.id === area && T1.area?.name && T1.ctx.camera?.dist === 40 && T1.commands[0].type === 'token.move' && T1.shot === `${ids.bug.id}.jpg`,
  'one ticket: seat, role, campaign, area (named by the relay), camera, commands, screenshot', T1);
const pic = await req(`/tickets/${ids.bug.id}/shot?key=${key}`);
ok(pic.status === 200 && pic.type === 'image/jpeg' && pic.body.length === jpeg.length, 'the triage reads the screenshot (?key= for an <img>)');
const setR = await req(`/tickets/${ids.bug.id}/set`, { method: 'POST', headers: K, body: { status: 'looking', reply: 'Seen it: the barrel floats. Looking now.', by: 'fauna' } });
ok(setR.status === 200 && setR.body.ticket.status === 'looking', 'the triage sets a status and a reply', setR.body);
const badSt = await req(`/tickets/${ids.bug.id}/set`, { method: 'POST', headers: K, body: { status: 'maybe' } });
ok(badSt.status === 400, 'an unknown status is refused');
const noKeySet = await req(`/tickets/${ids.bug.id}/set`, { method: 'POST', body: { status: 'fixed' } });
ok(noKeySet.status === 401, 'setting a status needs the key');

// 5. My tickets: mine only, with status and reply; another seat's are not shown
const mine = await req(`/c/${cid}/tickets?seat=${plTok}`);
const mb = mine.body.tickets.find(t => t.id === ids.bug.id);
ok(mine.body.tickets.length === 6 && mb.status === 'looking' && mb.reply.startsWith('Seen it') && mb.shot, "My tickets: the tester's own, with status and reply", mine.body.tickets.map(t => t.status));
const gmMine = await req(`/c/${cid}/tickets?seat=${gmTok}`);
ok(gmMine.body.tickets.length === 0, "the GM's My tickets does not show the player's");
const viaReceipt = await req(`/c/${cid}/tickets?seat=${gmTok}&also=${ids.idea.id}.${ids.idea.receipt},${ids.bug.id}.badreceipt0000000000`);
ok(viaReceipt.body.tickets.length === 1 && viaReceipt.body.tickets[0].id === ids.idea.id, "a ticket this browser filed elsewhere comes back by its receipt (a wrong receipt does not)");

// 6. automatic reports: one per error per seat, counted; silent (not in My tickets)
const auto = (sig) => req(`/c/${cid}/tickets?seat=${plTok}`, { method: 'POST', body: { kind: 'auto', text: 'TypeError: x is undefined', sig, errors: [{ message: 'TypeError: x is undefined', stack: 'at f (main.js:1:2)' }] } });
const a1 = await auto('sig-aaaa'), a2 = await auto('sig-aaaa'), a3 = await auto('sig-bbbb');
ok(a1.body.ok && a2.body.again && a2.body.id === a1.body.id && a3.body.id !== a1.body.id, 'the same automatic error is one ticket (counted), a different one is new');
ok((await req(`/tickets/${a1.body.id}`, { headers: K })).body.ticket.count === 2, 'its count is 2');
ok(!(await req(`/c/${cid}/tickets?seat=${plTok}`)).body.tickets.some(t => t.kind === 'auto'), 'automatic reports are not in My tickets');

// 7. the test sandbox: X-TW-Test writes never show without the header
const SB = { 'x-tw-test': 'tickets-test-1' };
ok((await req('/tickets/sandbox', { headers: SB })).body.sandbox === 'tickets-test-1' && (await req('/tickets/sandbox')).body.sandbox === null, 'GET /tickets/sandbox echoes the session');
const sb = await req(`/c/${cid}/tickets?seat=${plTok}`, { method: 'POST', headers: SB, body: { kind: 'idea', text: 'a sandboxed idea' } });
ok(sb.status === 200 && fs.existsSync(path.join(dataDir, 'tickets', 'test-sandbox', 'tickets-test-1', 'tickets.jsonl')), 'a sandboxed ticket goes to tickets/test-sandbox/<session>/');
const liveList = await req('/tickets', { headers: K }), sbList = await req('/tickets', { headers: { ...K, ...SB } });
ok(!liveList.body.tickets.some(t => t.id === sb.body.id) && sbList.body.tickets.some(t => t.id === sb.body.id), 'the live list never shows it; the same session sees it laid over the live ones');
const sbShot = await req(`/c/${cid}/tickets/${sb.body.id}/shot?seat=${plTok}`, { method: 'POST', headers: SB, body: jpeg });
ok(sbShot.status === 200 && fs.existsSync(path.join(dataDir, 'tickets', 'test-sandbox', 'tickets-test-1', 'shots', `${sb.body.id}.jpg`)) && !fs.existsSync(path.join(dataDir, 'tickets', 'shots', `${sb.body.id}.jpg`)), 'its screenshot stays in the sandbox too');
const sbSet = await req(`/tickets/${sb.body.id}/set`, { method: 'POST', headers: { ...K, ...SB }, body: { status: 'fixed', reply: 'sandboxed reply' } });
ok(sbSet.status === 200 && (await req(`/c/${cid}/tickets?seat=${plTok}`, { headers: SB })).body.tickets.find(t => t.id === sb.body.id)?.reply === 'sandboxed reply', 'status and reply on a sandboxed ticket reach that session\'s My tickets');
ok((await req('/tickets/sandbox', { headers: { 'x-tw-test': 'bad header!' } })).status === 400, 'a malformed sandbox header is refused, never treated as live');

// 8. the per-seat rate limit (by hand: 20 an hour)
let n429 = 0, n200 = 0;
for (let i = 0; i < TICKET_LIMITS.perSeatHour + 3; i++) { const r = await req(`/c/${cid}/tickets?seat=${gmTok}`, { method: 'POST', body: { kind: 'other', text: `gm ${i}` } }); r.status === 429 ? n429++ : r.status === 200 && n200++; }
ok(n200 === TICKET_LIMITS.perSeatHour && n429 === 3, `a seat files at most ${TICKET_LIMITS.perSeatHour} an hour, then 429`, { n200, n429 });

// 9. a restart keeps every ticket, status and reply
await relay.close();
relay = await startRelay({ port: 0, dataDir, log: () => {} }); base = `http://127.0.0.1:${relay.port}`;
const after = await req(`/tickets/${ids.bug.id}`, { headers: K });
ok(after.body.ticket?.status === 'looking' && after.body.ticket.reply.startsWith('Seen it') && after.body.ticket.history.length === 1 && (await req('/tickets', { headers: K })).body.total === 6 + 2 + TICKET_LIMITS.perSeatHour, 'after a restart: every ticket, its status, reply and history', after.body.ticket?.status);
const cors = await fetch(base + `/c/${cid}/tickets`, { method: 'OPTIONS' });
ok(/authorization/.test(cors.headers.get('access-control-allow-headers')) && /x-tw-test/.test(cors.headers.get('access-control-allow-headers')), 'a preflight allows the key and sandbox headers');
await relay.close();
console.log(`tickets: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
