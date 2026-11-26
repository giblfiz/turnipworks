// UPLOADED MODELS AND SAFE HARBOUR (2026-11-06; relay/uploads.js, relay/upload-worker/, relay/dmca.js, core/uploads.js;
// docs/UPLOADS.md). A real relay on a throwaway data folder:
//   CONVERT   a textured GLB, a plain one (pewter), an animated one (animation and script-ish extras gone), an ASCII STL
//             standing on Z, an OBJ with a hostile mtllib, a dense one simplified to the tiers
//   HOSTILE   oversized, truncated, a lying length, not a model, HTML, external buffers (a URL, a path), an external
//             picture (left out), a decompression-bomb PNG and a huge picture (left out), a billion-element sparse
//             accessor, Draco, an unknown required extension, deep nesting, a prototype key, 500,001 triangles, a short
//             data URI, a buffer view outside its buffer, NaN corners; path tricks in names and in addresses
//   THE BOX   the converter's own command: it cannot read the data folder or write outside its job, cannot start a
//             process, has no network; a time limit and a memory limit kill it
//   SERVING   only this campaign's live seats; exact type, nosniff, attachment, sandbox CSP, ETag and 304
//   PLACING   object.place carries `upload`; a library swap drops it; delete takes the placed copies away (one undo
//             per area), and the store forgets the model; a share export never carries it
//   DMCA      the notice form (the six parts, substantial compliance, an incomplete notice kept, a honeypot kept and
//             marked, escaping), the admin's search and takedown (every campaign, blocked from re-upload, one strike each,
//             the same takedown twice adds none), the counter-notice (its parts; its window from receipt), forward, the
//             10/14 business-day window, the tick's restore OF THAT CAMPAIGN ONLY (its strike cleared, the other's not),
//             an unforwarded one flagged overdue and never restored, the lawsuit stop, a withdrawn notice lifted
//             everywhere, three strikes end a campaign's uploads for good (a withdrawal does not bring them back)
//   GATES     public sharing stays off without every safe-harbour fact; uploads on a prod relay need TW_UPLOADS=1 AND
//             the hosting record (a designated agent), and are on by default on dev
//   node engine/test/uploads.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFile } from 'node:child_process';
import { startRelay } from '../relay/server.js';
import { makeUploads, workerCommand, WORKER_DIR } from '../relay/uploads.js';
import { businessDaysAfter, restoreWindow, isBusinessDay, holidays, checkFields, NOTICE_FIELDS, REPEAT, makeDmca, OPERATOR } from '../relay/dmca.js';
import { ATTEST_VERSION, sizeOf, PUBLIC_FLAG } from '../core/uploads.js';
import { SANDBOX } from '../relay/upload-worker/limits.mjs';
import * as S from '../core/share.js';

if (!fs.existsSync(path.join(WORKER_DIR, 'node_modules', '@gltf-transform', 'core'))) { console.log('FAIL the converter is not installed: run npm ci in engine/relay/upload-worker'); process.exit(1); }
const { fixtures } = await import('../relay/upload-worker/test-fixtures.mjs');
const F = await fixtures();

let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra === undefined ? '' : typeof extra === 'string' ? extra : JSON.stringify(extra).slice(0, 500)); } else if (process.env.V) console.log('ok', m); };
const made = [];
process.on('exit', () => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-uploads-')); made.push(dataDir);
const relay = await startRelay({ port: 0, dataDir, log: process.env.LOG ? (m) => console.log('relay:', m) : () => {}, uploadOpts: { quota: { perSeatHour: 1000, perIpHour: 1000 }, limits: { perIpHour: 1000 } } });
const base = `http://127.0.0.1:${relay.port}`;
const adminKey = relay.adminKey;
const http = async (p, { method = 'GET', body, headers = {} } = {}) => {
  const r = await fetch(base + p, { method, headers, body: body == null ? undefined : typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body) });
  const ct = r.headers.get('content-type') || '', raw = Buffer.from(await r.arrayBuffer());
  return { status: r.status, headers: r.headers, type: ct, text: raw.toString('utf8'), raw, body: ct.includes('json') ? JSON.parse(raw.toString('utf8') || 'null') : null };
};
const bearer = (t) => ({ headers: { authorization: `Bearer ${t}` } });
const admin = (p, body) => http(p, { method: body === undefined ? 'GET' : 'POST', body, headers: { 'x-tw-admin': adminKey } });
async function campaign(name) {
  const c = (await http('/campaigns', { method: 'POST', body: { name, gm: 'Harry' } })).body;
  const rt = relay.campaigns.get(c.campaign);
  const pl = rt.dispatch(c.seat, { type: 'seat.create', args: { id: 'seat_pl' + Math.random().toString(36).slice(2, 9).padEnd(7, '0'), kind: 'human', role: 'player', name: 'Pip', color: '#6fc36f' } }, {});
  return { id: c.campaign, rt, gm: c.seat, tok: c.token, ptok: pl.token, pseat: pl.result?.seat || Object.keys(rt.state.seats).find(s => s !== c.seat), area: rt.state.areaOrder[0] };
}
const up = (C, file, { name = 'Model', height = 6, yaw = 0, attest = ATTEST_VERSION, tok = C.tok, ext = '', up: axis = '', ip = null } = {}) =>
  http(`/c/${C.id}/uploads?seat=${encodeURIComponent(tok)}&name=${encodeURIComponent(name)}&height=${height}&yaw=${yaw}&ext=${ext}&up=${axis}${attest ? `&attest=${encodeURIComponent(attest)}` : ''}`, { method: 'POST', body: new Uint8Array(file), headers: { 'content-type': 'application/octet-stream', ...(ip && { 'x-real-ip': ip }) } });
const list = async (C) => (await http(`/c/${C.id}/uploads?seat=${encodeURIComponent(C.tok)}`)).body;
const tmpEmpty = () => fs.readdirSync(path.join(dataDir, 'uploads', 'tmp')).length === 0;
const blobsN = () => fs.readdirSync(path.join(dataDir, 'uploads', 'blobs')).length;

// ---------------------------------------------------------------- converting, and who may
const A = await campaign('TEST uploads A (throwaway)'), B = await campaign('TEST uploads B (throwaway)');
ok((await up(A, F.good, { attest: '' })).status === 400, 'no attestation: refused (400)');
ok((await up(A, F.good, { attest: 'some-old-version' })).status === 400, 'an attestation of other words: refused');
ok((await up(A, F.good, { tok: A.ptok })).status === 403, 'a player cannot upload');
ok((await http(`/c/${A.id}/uploads`, { method: 'POST', body: new Uint8Array(F.good) })).status === 401, 'nor anyone without a seat');
const g = await up(A, F.good, { name: '../../etc/passwd <script>alert(1)</script>', height: 6, yaw: 90 });
ok(g.status === 200 && g.body.ok, 'the GM uploads a textured GLB', g.body);
const gid = g.body.upload?.id;
ok(/^[0-9a-f]{64}$/.test(gid || ''), 'its id is 64 hex digits (content-addressed)');
ok(g.body.upload.name === '../../etc/passwd scriptalert(1)/script', 'a name with path tricks and markup is cleaned (no <, >, kept as words; only ever escaped)', g.body.upload.name);
ok(g.body.upload.tris.length === 3 && g.body.upload.bounds.length === 3 && Math.max(...g.body.upload.bounds) > 0.999, 'three tiers, and its box with the longest side 1');
const blobDir = path.join(dataDir, 'uploads', 'blobs', gid);
ok(['t0.glb', 't1.glb', 't2.glb', 'meta.json'].every(f => fs.existsSync(path.join(blobDir, f))) && !fs.readdirSync(blobDir).some(f => /in\.bin|orig/.test(f)), 'stored: three tiers and their record, never the original file');
ok(tmpEmpty(), 'the job folder is cleaned up');
const L = await list(A);
ok(L.ok && L.uploads.length === 1 && L.attest.version === ATTEST_VERSION && L.publicSharing.on === false, 'the GM\'s list: the model, the attestation words, public sharing off');
ok((await http(`/c/${A.id}/uploads?seat=${encodeURIComponent(A.ptok)}`)).status === 403, 'a player does not get the list');
const ref = JSON.parse(fs.readFileSync(path.join(A.rt.journal.dir, 'uploads.json'), 'utf8')).items[0];
ok(ref.attest?.version === ATTEST_VERSION && ref.attest.seat === A.gm && /^[0-9a-f]{20}$/.test(ref.attest.ipHash) && ref.attest.words, 'the attestation is recorded with the upload (version, words hash, seat, time, a keyed hash of the address)');
ok(!JSON.stringify(ref).includes('127.0.0.1'), 'no plain address is stored');
ok((await up(A, F.good)).status === 409, 'the same file again in the same campaign: 409 (it has it)');
const gB = await up(B, F.good, { name: 'Same dragon' });
ok(gB.status === 200 && gB.body.upload.id === gid && blobsN() === 1, 'the same file in another campaign: stored once (one blob, two lists)');

// what each kind becomes
const P = await up(A, F.plain, { name: 'Plain' }), An = await up(A, F.animated, { name: 'Animated' }), St = await up(A, F.stl, { name: 'Pyramid', ext: 'stl' }), Ob = await up(A, F.obj, { name: 'Cube', ext: 'obj' }), De = await up(A, F.dense, { name: 'Dense' });
ok(P.body?.upload?.plain === true, 'an uncoloured model gets the pewter look', P.body);
ok(An.status === 200 && An.body.upload.notes.some(n => /animation/.test(n)), 'an animated one: the animation is left out and said so', An.body);
const animMeta = JSON.parse(fs.readFileSync(path.join(dataDir, 'uploads', 'blobs', An.body.upload.id, 'meta.json'), 'utf8'));
const animGlb = fs.readFileSync(path.join(dataDir, 'uploads', 'blobs', An.body.upload.id, 't0.glb')).toString('latin1');
ok(!/alert|<script|onload|"animations"/.test(animGlb) && animMeta.status === 'ok', 'its stored copy has no animation and none of the script-ish extras');
ok(St.status === 200 && St.body.upload.format === 'stl-ascii' && Math.abs(St.body.upload.bounds[1] - 1) < 0.01, 'an ASCII STL standing on Z stands up (its height is its Z)', St.body);
ok(Ob.status === 200 && Ob.body.upload.format === 'obj', 'an OBJ (its mtllib ../../etc/passwd never read)', Ob.body);
ok(De.status === 200 && De.body.upload.tris[0] <= 20000 * 1.15 && De.body.upload.tris[2] <= 1500 * 1.15, 'a dense model is simplified to the tiers', De.body?.upload?.tris);
// OUR OWN FIGURES (2026-11-23, F1: the tester's 9 of 9 20,000-triangle textured figures were refused, "it could not be
// simplified to 1,500 triangles": UV seams lock the plain simplifier). Real ones from the library, not a box: the assets
// are not in git, so a worktree reads them from the main checkout (TW_MAIN, default the house's), and a missing one FAILS.
{
  const FIGS = ['hero-bard-human-f--20k1024-f9a47b5c.glb', 'cul-chn-elf-rogue--20k1024-7c6c6b84.glb', 'cul-chn-bannerman--20k1024-58261527.glb'];
  const roots = [path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..'), process.env.TW_MAIN || '<repo>'];
  const figFile = (f) => roots.map(r => path.join(r, 'tools', 'spawn-tuner', 'assets', 'figures', f)).find(p => fs.existsSync(p));
  for (const f of FIGS) {
    const p = figFile(f); if (!p) { ok(false, `our figure ${f} is on this box (tools/spawn-tuner/assets/figures)`); continue; }
    const t = Date.now(), r = await up(A, fs.readFileSync(p), { name: `Figure ${f.slice(0, 12)}`, height: 6 }), ms = Date.now() - t;
    const U = r.body?.upload;
    ok(r.status === 200 && U?.tris?.length === 3, `our textured 20k figure ${f.split('--')[0]} uploads (${ms} ms)`, r.body);
    if (!U) continue;
    ok(U.tris[0] <= 20000 && U.tris[1] <= 5000 * 1.15 && U.tris[2] < U.tris[1] && U.tris[2] <= 1500 * 3, `  its tiers step down: ${U.tris.join(' / ')} (the low one best-effort, under 3x its 1,500 aim: measured on all 431 of ours, at most 2.4x)`, U.tris);
    const m = relay.uploads.metaOf(U.id);
    ok(m.tiers.every(x => x.textures >= 1), '  every tier keeps its picture', m.tiers.map(x => x.textures));
    ok(!m.tiers.some(x => /sloppy/.test(x.how || '')), '  never through the topology-blind simplifier (it scrambles a picture)', m.tiers.map(x => x.how));
    if (process.env.V) console.log(`   ${f}: ${ms} ms, ${U.tris.join('/')} ${m.tiers.map(x => x.how).join(' ')}`);
  }
}

// ---------------------------------------------------------------- hostile files
const before = blobsN();
const hostile = [
  ['truncated', 422, /cut short|length/], ['lengthLie', 422, /length/], ['notModel', 422, /not a model/], ['html', 422, /not a model/],
  ['externalBuffer', 422, /outside itself/], ['externalFile', 422, /outside itself/], ['sparseBomb', 422, /too large/], ['draco', 422, /Draco/],
  ['unknownRequired', 422, /EVIL_run_code/], ['deep', 422, /nested/], ['proto', 422, /forbidden key/], ['tooManyTris', 422, /500,000/],
  ['shortData', 422, /outside its buffer/], ['viewOutside', 422, /outside its buffer/], ['nanVerts', 422, /size|impossible/],
];
for (const [k, status, why] of hostile) { const r = await up(A, F[k], { name: k }); ok(r.status === status && why.test(r.body?.why || ''), `hostile: ${k} is refused (${status}) with a reason`, { status: r.status, why: r.body?.why }); }
for (const k of ['externalImage', 'bomb', 'hugeTexture']) { const r = await up(B, F[k], { name: k }); ok(r.status === 200 && r.body.upload.notes.some(n => /picture/.test(n)), `hostile: ${k}: its picture is left out (never fetched, never decoded), the model comes in`, r.body); }
ok(blobsN() === before + 3, 'no refused file left anything in the store');
ok(tmpEmpty(), 'and no job folder is left behind');
ok((await up(A, Buffer.alloc(32 * 1024 * 1024 + 10, 1))).status === 413, 'oversized (over 32 MB): 413');
for (const p of [`/c/${A.id}/uploads/..%2F..%2Fsecret/t0.glb`, `/c/${A.id}/uploads/${'g'.repeat(64)}/t0.glb`, `/c/${A.id}/uploads/${gid}/..%2F..%2F..%2Fsecret`, `/c/${A.id}/uploads/${gid}/t9.glb`, `/c/${A.id}/uploads/${gid}/meta.json`])
  { const r = await http(`${p}${p.includes('?') ? '&' : '?'}seat=${encodeURIComponent(A.tok)}`); ok(r.status >= 400 && !r.text.includes(fs.readFileSync(path.join(dataDir, 'secret'), 'utf8').trim()) && !r.text.includes('"raw"'), `a path trick in the address gets nothing: ${p.split('/uploads/')[1]}`, r.status); }

// ---------------------------------------------------------------- the box
const job = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-box-')); made.push(job);
fs.writeFileSync(path.join(job, 'probe.mjs'), `import fs from 'node:fs'; import cp from 'node:child_process'; const out = {};
try { fs.readFileSync(${JSON.stringify(path.join(dataDir, 'secret'))}); out.readData = true; } catch (e) { out.readData = e.code; }
try { fs.readFileSync('/etc/passwd'); out.readEtc = true; } catch (e) { out.readEtc = e.code; }
try { fs.writeFileSync(${JSON.stringify(path.join(os.tmpdir(), 'tw-box-escape'))}, 'x'); out.writeOut = true; } catch (e) { out.writeOut = e.code; }
try { fs.writeFileSync(${JSON.stringify(path.join(job, 'inside.txt'))}, 'x'); out.writeJob = true; } catch (e) { out.writeJob = e.code; }
try { cp.execSync('id'); out.child = true; } catch (e) { out.child = e.code; }
try { await fetch('http://127.0.0.1:${relay.port}/health'); out.fetch = true; } catch (e) { out.fetch = String(e.message); }
try { const net = await import('node:net'); net.connect(${relay.port}, '127.0.0.1'); out.net = true; } catch (e) { out.net = String(e.message); }
out.env = Object.keys(process.env).sort().join(',');
console.log(JSON.stringify(out));`);
const cmd = workerCommand({ job, script: path.join(job, 'probe.mjs') });
const pr = spawnSync(cmd[0], cmd.slice(1), { cwd: job, env: { PATH: '/usr/bin:/bin', HOME: job }, encoding: 'utf8', timeout: 20000 });
let box = {}; try { box = JSON.parse(pr.stdout.trim().split('\n').pop()); } catch { }
ok(box.readData === 'ERR_ACCESS_DENIED' && box.readEtc === 'ERR_ACCESS_DENIED', 'the box: the converter cannot read the data folder (or anything outside its own)', box);
ok(box.writeOut === 'ERR_ACCESS_DENIED' && box.writeJob === true, 'the box: it writes only in its job folder', box);
ok(box.child === 'ERR_ACCESS_DENIED', 'the box: it cannot start a process', box);
ok(/no network/.test(box.fetch || '') && /no network/.test(box.net || ''), 'the box: it has no network', box);
ok(!/SECRET|KEY|TOKEN/i.test(box.env || 'x'), 'the box: none of the relay\'s environment', box.env);
ok(!fs.existsSync(path.join(os.tmpdir(), 'tw-box-escape')), 'and nothing was written outside');
// the limits kill it (a store of its own, so the relay's queue is not held)
{
  const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-uploads-box-')); made.push(d2);
  const U1 = makeUploads({ dataDir: d2, campaigns: new Map(), secret: 'x', sandbox: { ...SANDBOX, wallMs: 50 } });
  const t = await U1.convert(F.dense, { up: 'auto', ext: '' }); U1.close();
  ok(!t.ok && /too long/.test(t.why) && t.killed === 'time', 'a conversion past its time is killed', t);
  const U2 = makeUploads({ dataDir: d2, campaigns: new Map(), secret: 'x', sandbox: { ...SANDBOX, rssBytes: 20 * 1024 * 1024 } });
  const m = await U2.convert(F.dense, { up: 'auto', ext: '' }); U2.close();
  ok(!m.ok && /memory/.test(m.why) && m.killed === 'memory', 'a conversion over its memory is killed', m);
  ok(fs.readdirSync(path.join(d2, 'uploads', 'tmp')).length === 0, 'killed jobs leave nothing behind');
}

// ---------------------------------------------------------------- serving
const t0 = await http(`/c/${A.id}/uploads/${gid}/t0.glb`, { headers: { authorization: `Bearer ${A.ptok}` } });
ok(t0.status === 200 && t0.raw.toString('ascii', 0, 4) === 'glTF', 'a player of the campaign fetches the mesh (Bearer)');
ok(t0.headers.get('content-type') === 'model/gltf-binary' && t0.headers.get('x-content-type-options') === 'nosniff' && /^attachment/.test(t0.headers.get('content-disposition') || '') && /sandbox/.test(t0.headers.get('content-security-policy') || '') && /private/.test(t0.headers.get('cache-control') || ''), 'served with the exact type, nosniff, as an attachment, under a sandbox CSP, private', Object.fromEntries(t0.headers));
const etag = t0.headers.get('etag');
ok((await http(`/c/${A.id}/uploads/${gid}/t0.glb`, { headers: { authorization: `Bearer ${A.ptok}`, 'if-none-match': etag } })).status === 304, 'and its ETag answers 304');
ok((await http(`/c/${A.id}/uploads/${gid}/t0.glb`)).status === 401, 'no seat: no mesh');
// (2026-11-23, the tester: model files took ?seat=<token> in the address, though the docs say the header only; a token in an
// address leaks into logs. The game never asks that way, so it is refused)
ok((await http(`/c/${A.id}/uploads/${gid}/t0.glb?seat=${encodeURIComponent(A.ptok)}`)).status === 400 && (await http(`/c/${A.id}/uploads/${gid}/thumb?seat=${encodeURIComponent(A.ptok)}`)).status === 400, 'a model file asked for with the seat token in the address: refused (400), tier and picture');
const C2 = await campaign('TEST uploads C (throwaway)');
ok((await http(`/c/${C2.id}/uploads/${gid}/t0.glb`, bearer(C2.tok))).status === 404, 'another campaign\'s GM, knowing the id: nothing (it is not in his list)');
ok((await http(`/c/${A.id}/uploads/${gid}/t0.glb`, bearer(C2.tok))).status === 404, 'nor with his token on this campaign\'s address');

// ---------------------------------------------------------------- placing
const sz = sizeOf(g.body.upload.bounds, 6, 90);
ok(Math.abs(sz.dims[1] - 6) < 0.01 && Math.abs(sz.dims[0] - g.body.upload.bounds[2] * sz.s[0]) < 0.01, 'its size: 6 ft tall, a quarter turn swaps width and depth');
const place = (id, x) => A.rt.dispatch(A.gm, { type: 'object.place', area: A.area, args: { id, name: 'Dragon', upload: gid, x, z: 2, yaw: 90, s: sz.s, dims: sz.dims } }, {});
ok(place('obj_up00000001', 2).ok && place('obj_up00000002', 6).ok, 'object.place carries the upload');
const E = () => A.rt.state.areas[A.area].entities;
ok(E().obj_up00000001.upload === gid && E().obj_up00000001.cat === null, 'the thing has the upload and no library piece');
ok(!A.rt.dispatch(A.gm, { type: 'object.place', area: A.area, args: { id: 'obj_up00000009', x: 0, z: 0, upload: '../../x' } }, {}).ok, 'a bad upload id is refused by the command core');
ok(A.rt.dispatch(A.gm, { type: 'object.replace', area: A.area, args: { id: 'obj_up00000002', cat: 'chair', sku: 'chair', dims: [2, 3, 2] } }, {}).ok && !E().obj_up00000002.upload, 'swapped for a library piece, it is that piece (no upload left)');
const exp = S.exportShare(E(), { kind: 'area', name: 'x' });
ok(!JSON.stringify(exp.doc).includes(gid) && !JSON.stringify(exp.doc).includes('"upload"'), 'a shared build never carries an uploaded model (public sharing is off)');
ok((await http(`/c/${A.id}/uploads/${gid}/publish?seat=${encodeURIComponent(A.tok)}`, { method: 'POST' })).status === 403, 'publishing an upload: refused while public sharing is off');

// ---------------------------------------------------------------- the notice form
const page = await http('/dmca');
ok(page.text.includes(`run by ${OPERATOR}`) && OPERATOR === 'Implausible Enterprises LLC' && /designated agent is not registered/.test(page.text), 'the copyright page names the operator, and says no agent is registered yet');
ok(!/docs\//.test(page.text), 'the copyright page prints no internal path (docs/…)');
{ const h = await fetch(base + '/dmca', { method: 'HEAD' }); ok(h.status === 200 && (await h.text()) === '' && /text\/html/.test(h.headers.get('content-type') || ''), 'HEAD /dmca answers 200 like GET, with no body', h.status); }
ok(page.status === 200 && /DRAFT/.test(page.text) && /<form/.test(page.text) && !/<script/i.test(page.text) && /default-src 'none'/.test(page.headers.get('content-security-policy') || ''), 'the copyright page: DRAFT, a form, no script, a strict CSP');
const form = (o) => http('/dmca/notice', { method: 'POST', body: new URLSearchParams(o).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
const good = { name: 'Ann Sculptor', role: 'owner', email: 'fixture@example.invalid', address: '1 Main St, Springfield', phone: '555-0100', work: 'My red dragon sculpt sold on my store', material: 'A red dragon called Same dragon in a campaign, seen on a stream', goodfaith: 'on', accurate: 'on', signature: 'Ann Sculptor' };
const noticeFiles = () => fs.readdirSync(path.join(dataDir, 'dmca', 'notices')).map(f => JSON.parse(fs.readFileSync(path.join(dataDir, 'dmca', 'notices', f), 'utf8')));
const bad1 = await form({ ...good, accurate: '', work: '<script>alert(1)</script>' });
ok(bad1.status === 400 && /class="err"/.test(bad1.text) && !bad1.text.includes('<script>alert(1)</script>') && bad1.text.includes('&lt;script&gt;'), 'a notice missing the perjury statement: sent back to finish, the text escaped');
ok(noticeFiles().some(n => n.status === 'incomplete' && n.missing.includes('accurate')) && /ntc_[0-9a-z]{12}/.test(bad1.text), 'and KEPT, since it names the work, the material and the sender (we must help complete it: 512(c)(3)(B)(ii))');
const bad2 = await form({ name: 'X', role: 'owner', work: 'w', material: 'm' });
ok(bad2.status === 400 && !noticeFiles().some(n => n.fields?.name === 'X'), 'one that names nothing to act on is only sent back');
const hp = await form({ ...good, website: 'http://spam' });
ok(hp.status === 200 && noticeFiles().filter(n => n.status === 'honeypot').length === 1 && noticeFiles().filter(n => n.status === 'received').length === 0, 'the honeypot field: kept, marked, never acted on');
const agentSigned = checkFields(NOTICE_FIELDS, { ...good, signature: 'Bob Agent for Ann' });
ok(!agentSigned.bad.length && agentSigned.flags.includes('signature-differs-from-name'), 'a signature unlike the name (an agent signing): accepted, flagged for review');
ok(!checkFields(NOTICE_FIELDS, { ...good, email: '' }).bad.length && checkFields(NOTICE_FIELDS, { ...good, email: '', phone: '' }).bad.includes('email'), 'an email OR a phone, with the postal address');
const n1 = await form(good);
const nid = (/ntc_[0-9a-z]{12}/.exec(n1.text) || [])[0];
ok(n1.status === 200 && nid, 'a complete notice: received, with its number', n1.text.slice(0, 200));
ok(checkFields(NOTICE_FIELDS, { ...good, goodfaith: '' }).bad.includes('goodfaith') && checkFields(NOTICE_FIELDS, { ...good, email: 'not-an-email' }).bad.includes('email'), 'every required part is checked (good faith, a real email)');

// ---------------------------------------------------------------- takedown
const found = (await admin(`/admin/dmca/find?q=same%20dragon`)).body;
ok(found.ok && found.found.length === 1 && found.found[0].campaign === B.id, 'the admin finds the model by what the notice says (its name), across campaigns', found);
ok((await http('/admin/dmca')).status === 403, 'the admin view is box-only');
const td = (await admin('/admin/dmca/takedown', { notice: nid, id: gid, reason: 'valid notice' })).body;
ok(td.ok && td.holders.length === 2 && td.blobs.length === 1, 'takedown by file: both campaigns that hold it', td);
ok((await http(`/c/${A.id}/uploads/${gid}/t0.glb`, bearer(A.ptok))).status === 451 && (await http(`/c/${B.id}/uploads/${gid}/t0.glb`, bearer(B.tok))).status === 451, 'it is served to nobody now (451) in either campaign');
const LA = await list(A);
ok(LA.uploads.find(u => u.id === gid)?.status === 'removed' && LA.uploads.find(u => u.id === gid).removed.notice === nid, 'the GM sees it removed, with the notice number');
ok(fs.existsSync(path.join(blobDir, 't0.glb')), 'its files are kept (a counter-notice can restore them)');
const again = await up(C2, F.good);
ok(again.status === 451, 'the same file uploaded again anywhere: refused (451)');
let SK = relay.dmca.strikes();
ok(SK.campaigns[A.id]?.length === 1 && SK.campaigns[B.id]?.length === 1, 'a strike for each campaign that uploaded it');
ok((await admin('/admin/dmca/takedown', { notice: nid, id: gid })).body.ok && relay.dmca.strikes().campaigns[A.id].length === 1, 'the same takedown again adds no strike');

// ---------------------------------------------------------------- counter-notice and restore
const counter = (C, body) => http(`/c/${C.id}/uploads/${gid}/counter?seat=${encodeURIComponent(C.tok)}`, { method: 'POST', body });
const cgood = { name: 'Harry Gm', address: '2 Elm St, Shelbyville', phone: '555-0101', email: 'fixture@example.invalid', mistake: true, jurisdiction: true, service: true, signature: 'Harry Gm' };
ok((await counter(A, { ...cgood, jurisdiction: false })).status === 400, 'a counter-notice without consent to jurisdiction: refused');
ok((await http(`/c/${A.id}/uploads/${gid}/counter?seat=${encodeURIComponent(A.ptok)}`, { method: 'POST', body: cgood })).status === 403, 'a player cannot send one');
const ct = await counter(A, cgood);
ok(ct.status === 200 && ct.body.counter.status === 'received', 'the GM\'s counter-notice: received', ct.body);
ok((await counter(A, cgood)).status === 409, 'a second one while the first is open: 409');
const cid = ct.body.counter.id;
const fw = (await admin(`/admin/dmca/counter/${cid}/forward`, {})).body;
ok(fw.ok && fw.counter.window?.afterDay && fw.counter.window.byDay > fw.counter.window.afterDay, 'forwarded to the claimant: the restore window is set', fw);
ok((await admin('/admin/dmca/tick', {})).body.restored.length === 0, 'the tick does not restore before the window opens');
// open the window (the clock is the relay's: move the record's window back instead of waiting ten business days)
const cf = path.join(dataDir, 'dmca', 'counters', cid + '.json'), CR = JSON.parse(fs.readFileSync(cf, 'utf8'));
CR.window.after = Date.now() - 1000; fs.writeFileSync(cf, JSON.stringify(CR));
const tk = (await admin('/admin/dmca/tick', {})).body;
ok(tk.restored.includes(cid), 'once the window opens, with no lawsuit on record, the tick restores it', tk);
ok((await http(`/c/${A.id}/uploads/${gid}/t0.glb`, bearer(A.ptok))).status === 200, 'restored for the campaign whose counter-notice stood');
ok((await http(`/c/${B.id}/uploads/${gid}/t0.glb`, bearer(B.tok))).status === 451, 'but NOT for the other campaign, which sent none (its takedown stands)');
SK = relay.dmca.strikes();
ok(SK.campaigns[A.id].every(s => s.cleared) && SK.campaigns[B.id].every(s => !s.cleared), 'A\'s strike for it is cleared; B\'s is not');
{ const sb = await up(C2, F.good, { name: 'still blocked' }); ok(sb.status === 451 && /counter-notice/.test(sb.body.why) && /write to/.test(sb.body.why), 'the file stays blocked while any campaign\'s takedown of it stands (and the refusal says what to do)', sb.body); }
const wd = (await admin(`/admin/dmca/notice/${nid}/withdraw`, { why: 'the sender withdrew it' })).body;
ok(wd.ok && (await http(`/c/${B.id}/uploads/${gid}/t0.glb`, bearer(B.tok))).status === 200 && relay.dmca.strikes().campaigns[B.id].every(s => s.cleared), 'a withdrawn notice: lifted everywhere, its strikes cleared');
ok((await up(C2, F.good, { name: 'ok now' })).status === 200, 'and then the file may be uploaded again');
// a counter-notice nobody forwarded: flagged overdue when its window opens, never restored without being forwarded
const n3 = (/ntc_[0-9a-z]{12}/.exec((await form({ ...good, work: 'my cube sculpt', material: 'the model called Cube' })).text) || [])[0];
const V3 = await up(A, Buffer.concat([F.stl, Buffer.from('\n'.repeat(9))]), { name: 'Cube' }); // (a file only this campaign holds)
ok((await admin('/admin/dmca/takedown', { notice: n3, id: V3.body.upload.id })).body.ok, 'a third takedown');
const ct3 = await http(`/c/${A.id}/uploads/${V3.body.upload.id}/counter?seat=${encodeURIComponent(A.tok)}`, { method: 'POST', body: cgood });
ok(ct3.body?.counter?.restoreAfterDay, 'its counter-notice\'s window is set at receipt', ct3.body);
const cf3 = path.join(dataDir, 'dmca', 'counters', ct3.body.counter.id + '.json'), CR3 = JSON.parse(fs.readFileSync(cf3, 'utf8')); CR3.window.after = Date.now() - 1000; CR3.at = Date.now() - 20 * 86400e3; fs.writeFileSync(cf3, JSON.stringify(CR3));
const t3 = (await admin('/admin/dmca/tick', {})).body;
ok(t3.overdue.includes(ct3.body.counter.id) && t3.notForwarded.includes(ct3.body.counter.id) && !t3.restored.includes(ct3.body.counter.id), 'not forwarded and its window open: flagged overdue (and late), not restored', t3);
// a lawsuit stops the restore
const n2 = (/ntc_[0-9a-z]{12}/.exec((await form({ ...good, work: 'The plain sculpt of mine', material: 'The model called Plain' })).text) || [])[0];
ok((await admin('/admin/dmca/takedown', { notice: n2, id: P.body.upload.id })).body.ok, 'a second takedown');
const pid = P.body.upload.id;
const ct2 = await http(`/c/${A.id}/uploads/${pid}/counter?seat=${encodeURIComponent(A.tok)}`, { method: 'POST', body: cgood });
const cid2 = ct2.body.counter.id; await admin(`/admin/dmca/counter/${cid2}/forward`, {});
ok((await admin(`/admin/dmca/counter/${cid2}/lawsuit`, { note: 'claimant filed in N.D. Cal.' })).body.ok, 'the claimant says it has sued');
const cf2 = path.join(dataDir, 'dmca', 'counters', cid2 + '.json'), CR2 = JSON.parse(fs.readFileSync(cf2, 'utf8')); CR2.window.after = Date.now() - 1000; fs.writeFileSync(cf2, JSON.stringify(CR2));
ok(!(await admin('/admin/dmca/tick', {})).body.restored.includes(cid2) && (await http(`/c/${A.id}/uploads/${pid}/t0.glb`, bearer(A.tok))).status === 451, 'then it stays down whatever the window says');

// ---------------------------------------------------------------- the hourly limits
relay.uploads.quota.perSeatHour = 2;
const RL = await campaign('TEST uploads rate (throwaway)');
const variant = (i) => Buffer.concat([F.stl, Buffer.from(' '.repeat(i + 1))]); // (a file of its own: another hash)
const rl = [await up(RL, variant(1), { name: 'a' }), await up(RL, variant(2), { name: 'b' }), await up(RL, variant(3), { name: 'c' })];
ok(rl[2].status === 429 && rl[0].status === 200, 'a seat that uploads too often in an hour: 429', rl.map(r => r.status));
relay.uploads.quota.perSeatHour = 1000;

// ---------------------------------------------------------------- the repeat-infringer policy
const R = await campaign('TEST uploads repeat (throwaway)');
const files = [F.coloured, F.obj, F.stl, F.animated];
const ids = [];
for (const [i, f] of files.entries()) { const r = await up(R, f, { name: `R${i}` }); ids.push(r.body?.upload?.id); }
ok(ids.every(Boolean), 'a campaign with four uploads');
for (let i = 0; i < REPEAT.strikes; i++) { const nt = await form({ ...good, work: `work ${i} of mine`, material: `the model called R${i}` }), n = (/ntc_[0-9a-z]{12}/.exec(nt.text) || [])[0]; const t = await admin('/admin/dmca/takedown', { notice: n, id: ids[i] }); ok(t.body?.ok, `repeat: takedown ${i + 1}`, { notice: nt.status, t: t.body }); }
const LR = await list(R);
ok(LR.uploads.every(u => u.status === 'removed'), `${REPEAT.strikes} takedowns: every model of that campaign stops being served (even the one never noticed)`, LR.uploads.map(u => u.status));
ok((await http(`/c/${R.id}/uploads/${ids[3]}/t0.glb`, bearer(R.tok))).status === 451, 'its fourth model is not served either');
const rr = await up(R, F.dense, { name: 'one more' });
ok(rr.status === 403 && rr.body.code === 'repeat_infringer', 'and it cannot upload again', rr.body);
const firstR = (await admin('/admin/dmca')).body.notices.find(n => (n.actions || []).some(a => a.campaigns.includes(R.id)));
await admin(`/admin/dmca/notice/${firstR.id}/withdraw`, { why: 'test' });
// (2026-11-23, F2: the cut-off follows the LIVE strikes. Before, a withdrawn notice left the campaign cut off for good.)
const LR2 = await list(R), st = (i) => LR2.uploads.find(u => u.id === ids[i])?.status;
ok(st(0) === 'ok' && st(3) === 'ok' && st(1) === 'removed' && st(2) === 'removed', 'a withdrawn notice brings it below the line: reinstated; the withdrawn model and the one only the cut-off held come back, the two still under a notice stay removed', LR2.uploads.map(u => u.status));
const sum = (await admin('/admin/dmca')).body;
ok(sum.ok && !sum.strikes.ended[R.id] && sum.strikes.reinstated[R.id]?.length === 1 && sum.strikes.campaigns[R.id] === REPEAT.strikes - 1, 'the admin view: no longer ended, the reinstatement on the record, its live strikes', sum.strikes);
// the address: one strike per (notice, campaign). R's files were also A's, so a notice on one is a strike for each
const ipsNow = () => Object.values(relay.dmca.strikes().ips).flat();
const nR1 = LR2.uploads.find(u => u.id === ids[1]).removed.notice, rawR1 = relay.uploads.metaOf(ids[1]).raw;
const ipOf = (nid, cmp) => ipsNow().find(x => x.notice === nid && x.campaign === cmp);
ok(ipOf(nR1, R.id) && ipOf(nR1, A.id) && !ipOf(nR1, R.id).cleared && !ipOf(nR1, A.id).cleared, 'one notice on a file two campaigns from one address hold: an address strike for each (notice, campaign)');
relay.dmca.restoreFile({ raw: rawR1, notice: nR1, campaign: R.id, why: 'TEST: R\'s counter-notice stood' });
ok(ipOf(nR1, R.id).cleared && !ipOf(nR1, A.id).cleared, 'reversing it for R clears R\'s address strike, not A\'s (F4)');
await admin(`/admin/dmca/notice/${LR2.uploads.find(u => u.id === ids[2]).removed.notice}/withdraw`, { why: 'TEST' }); // (this address is under the line again)
ok((await up(R, Buffer.concat([F.stl, Buffer.from(' \n \n ')]), { name: 'one more' })).status === 200, 'and it can upload again');
const ipLive = Object.values(relay.dmca.strikes().ips).map(L => L.filter(x => !x.cleared).length);
ok(ipLive.length === 1 && ipLive[0] < REPEAT.ipStrikes, `strikes are counted per network address too (here ${ipLive[0]}: blocked at ${REPEAT.ipStrikes})`, ipLive);
const fresh = await campaign('TEST uploads fresh (throwaway)');
ok((await up(fresh, Buffer.concat([F.stl, Buffer.from('    ')]), { name: 'fine' })).status === 200, 'another campaign from the same address can still upload below that');

// ---------------------------------------------------------------- the cut-off, notice by notice (2026-11-23, F2-F4)
{
  const T = await campaign('TEST uploads cutoff (throwaway)');
  const vf = (i) => Buffer.concat([F.stl, Buffer.from('\n'.repeat(40 + i))]), TIP = '<pod-ip>'; // (its own address: this test's others are under strikes) // (files no other campaign holds)
  const tid = []; for (let i = 0; i < 6; i++) tid.push((await up(T, vf(i), { name: `T${i}`, ip: TIP })).body?.upload?.id);
  ok(tid.every(Boolean), 'cut-off: a campaign with six models of its own');
  const notice = async (w) => (/ntc_[0-9a-z]{12}/.exec((await form({ ...good, work: `cutoff work ${w}`, material: `the model T${w}` })).text) || [])[0];
  const td = async (n, i) => (await admin('/admin/dmca/takedown', { notice: n, id: tid[i] })).body;
  const live = () => (relay.dmca.strikes().campaigns[T.id] || []).filter(x => !x.cleared && !x.forgiven);
  const N1 = await notice('1+2'); await td(N1, 0); await td(N1, 1);
  ok(live().length === 1 && live()[0].raws.length === 2, 'one notice naming two of a campaign\'s files: ONE strike, both files on it (F4)', live());
  const N2 = await notice(3), N3 = await notice(4); await td(N2, 2); const t3 = await td(N3, 3);
  ok(t3.ended?.includes(T.id) && relay.dmca.ended(T.id), `three notices: uploading ends`);
  const blocked = await up(T, vf(90), { name: 'no', ip: TIP });
  ok(blocked.status === 403 && /counter-notice/.test(blocked.body.why) && /write to/.test(blocked.body.why) && !/docs/.test(blocked.body.why), 'the refusal says what a person can do, and names no internal path', blocked.body.why);
  let LT = (await list(T)).uploads, row = (i) => LT.find(u => u.id === tid[i]);
  ok(row(0).removed.why === 'a copyright notice' && row(0).removed.notice === N1 && row(0).removed.ended === true, 'a model a notice holds keeps its notice as the reason while the campaign is cut off (F3)', row(0).removed);
  ok(row(4).status === 'removed' && row(4).removed.why === 'the repeat-infringer policy' && !row(4).removed.notices.length, 'one no notice holds: the cut-off is its reason');
  // a counter-notice while cut off, on the notice whose strike ended it: restored, the strike cleared, the campaign back
  const c3 = await http(`/c/${T.id}/uploads/${tid[3]}/counter?seat=${encodeURIComponent(T.tok)}`, { method: 'POST', body: cgood });
  ok(c3.status === 200, 'a counter-notice is taken while the campaign is cut off', c3.body);
  await admin(`/admin/dmca/counter/${c3.body.counter.id}/forward`, {});
  LT = (await list(T)).uploads; ok(row(3).removed.counter?.status === 'forwarded' && row(3).removed.ended, 'its row knows the counter-notice is forwarded AND the campaign cut off (the game words it so it does not promise "back after")');
  const cf = path.join(dataDir, 'dmca', 'counters', c3.body.counter.id + '.json'), CR = JSON.parse(fs.readFileSync(cf, 'utf8')); CR.window.after = Date.now() - 1000; fs.writeFileSync(cf, JSON.stringify(CR));
  const tk = (await admin('/admin/dmca/tick', {})).body;
  ok(tk.restored.includes(c3.body.counter.id), 'the window opens: the tick restores it');
  ok(!relay.dmca.ended(T.id) && (await http(`/c/${T.id}/uploads/${tid[3]}/t0.glb`, bearer(T.ptok))).status === 200, 'the restore brings the model back even though its notice\'s strike had ended the campaign (F2)');
  ok((await http(`/c/${T.id}/uploads/${tid[4]}/t0.glb`, bearer(T.ptok))).status === 200 && (await http(`/c/${T.id}/uploads/${tid[0]}/t0.glb`, bearer(T.ptok))).status === 451, 'reinstated: the model only the cut-off held comes back; one a standing notice holds stays removed');
  ok((await up(T, vf(91), { name: 'back', ip: TIP })).status === 200, 'and uploading works again');
  ok((await admin('/admin/dmca/tick', {})).body.restored.length === 0, 'the next tick restores nothing again');
  // a restore by hand closes the counter-notice (F4): no second restore on the tick
  const c2 = await http(`/c/${T.id}/uploads/${tid[2]}/counter?seat=${encodeURIComponent(T.tok)}`, { method: 'POST', body: cgood });
  await admin(`/admin/dmca/counter/${c2.body.counter.id}/forward`, {});
  const raw2 = relay.uploads.metaOf(tid[2]).raw, mr = (await admin('/admin/dmca/restore', { raw: raw2, notice: N2, campaign: T.id, why: 'TEST by hand' })).body;
  ok(mr.ok && mr.countersClosed.includes(c2.body.counter.id) && relay.dmca.counters().find(c => c.id === c2.body.counter.id).status === 'restored', 'a restore by hand closes the counter-notice as restored', mr);
  const cf2 = path.join(dataDir, 'dmca', 'counters', c2.body.counter.id + '.json'), C2R = JSON.parse(fs.readFileSync(cf2, 'utf8')); C2R.window.after = Date.now() - 1000; fs.writeFileSync(cf2, JSON.stringify(C2R));
  ok(!(await admin('/admin/dmca/tick', {})).body.restored.includes(c2.body.counter.id), 'and the tick does not restore it a second time');
  // reject from forwarded, close from lawsuit (F4: any open state)
  const c0 = await http(`/c/${T.id}/uploads/${tid[0]}/counter?seat=${encodeURIComponent(T.tok)}`, { method: 'POST', body: cgood });
  await admin(`/admin/dmca/counter/${c0.body.counter.id}/forward`, {});
  ok((await admin(`/admin/dmca/counter/${c0.body.counter.id}/reject`, { why: 'TEST' })).body.ok, 'reject-counter closes a FORWARDED counter-notice');
  const c1 = await http(`/c/${T.id}/uploads/${tid[1]}/counter?seat=${encodeURIComponent(T.tok)}`, { method: 'POST', body: cgood });
  await admin(`/admin/dmca/counter/${c1.body.counter.id}/forward`, {}); await admin(`/admin/dmca/counter/${c1.body.counter.id}/lawsuit`, { note: 'TEST' });
  const cl = (await admin(`/admin/dmca/counter/${c1.body.counter.id}/close`, { why: 'TEST: handled by mail' })).body;
  ok(cl.ok && cl.was === 'lawsuit' && relay.dmca.counters().find(c => c.id === c1.body.counter.id).status === 'closed', 'close ends a counter-notice under a lawsuit', cl);
  ok(!(await admin(`/admin/dmca/counter/${c1.body.counter.id}/close`, { why: 'again' })).body.ok, 'a closed one cannot be closed again');
  // the GM's appeal: reinstate <campaign> with a reason
  const N4 = await notice(5), N5 = await notice('4b'); await td(N4, 5); const t5 = await td(N5, 4);
  ok(t5.ended?.includes(T.id), 'cut off again by three standing notices');
  ok((await admin('/admin/dmca/reinstate', { campaign: T.id })).status === 400, 'reinstate wants a reason');
  const ri = (await admin('/admin/dmca/reinstate', { campaign: T.id, why: 'TEST: the GM\'s appeal upheld' })).body;
  ok(ri.ok && !relay.dmca.ended(T.id) && live().length === 0 && (relay.dmca.strikes().campaigns[T.id] || []).some(x => x.forgiven), 'reinstate: the cut-off lifted, its strikes forgiven (kept on the record)', ri);
  LT = (await list(T)).uploads;
  ok(row(4).status === 'removed' && row(5).status === 'removed' && row(3).status === 'ok', 'models still under a notice stay removed; the rest are served');
  ok((await up(T, vf(92), { name: 'after appeal', ip: TIP })).status === 200, 'after the appeal it uploads again');
  ok((await admin('/admin/dmca/reinstate', { campaign: T.id, why: 'again' })).status === 400, 'reinstating a campaign that is not cut off: refused');
}
// records of the older shape (one {raw} per file, the same notice twice) read as one strike per notice
{
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-dmca-old-')); made.push(d);
  const dm = makeDmca({ dataDir: d, uploads: null, secret: 'x' }); dm.close();
  fs.writeFileSync(path.join(d, 'dmca', 'strikes.json'), JSON.stringify({ campaigns: { cmp_old: [{ at: Date.now(), notice: 'ntc_a', raw: 'r1' }, { at: Date.now(), notice: 'ntc_a', raw: 'r2', cleared: Date.now() }, { at: Date.now(), notice: 'ntc_b', raw: 'r3', cleared: Date.now(), clearedWhy: 'x' }] }, ips: {}, ended: {} }));
  const S = dm.strikes().campaigns.cmp_old;
  ok(S.length === 2 && S[0].raws.length === 2 && !S[0].cleared && S[0].reversed.r2 && S[1].cleared, 'old strike records: merged per notice; a file reversed stays reversed; one all reversed is cleared', S);
}

// ---------------------------------------------------------------- deleting
const hid = De.body.upload.id; // (a model only this campaign holds)
A.rt.dispatch(A.gm, { type: 'object.place', area: A.area, args: { id: 'obj_up00000003', name: 'Anim', upload: hid, x: 9, z: 9, s: [1, 1, 1], dims: [1, 2, 0.5] } }, {});
const del = await http(`/c/${A.id}/uploads/${hid}/delete?seat=${encodeURIComponent(A.tok)}`, { method: 'POST' });
ok(del.status === 200 && del.body.placed === 1 && !E().obj_up00000003, 'the GM deletes a model: its placed copy goes too', del.body);
ok(!fs.existsSync(path.join(dataDir, 'uploads', 'blobs', hid)), 'and nothing else holds it, so the store forgets it');
ok((await http(`/c/${A.id}/uploads/${hid}/t0.glb`, bearer(A.tok))).status === 404, 'it is not served any more');
ok(A.rt.dispatch(A.gm, { type: 'undo', area: A.area, args: {} }, {}).ok && E().obj_up00000003?.upload === hid, 'undo brings the thing back (as a marked box: the model is gone)');

relay.dmca.limits.perIpHour = 1;
ok((await form({ ...good, work: 'one more work', material: 'one more model here' })).status === 429, 'notices from one address are rate-limited too');

// ---------------------------------------------------------------- the clock and the gates
ok(isBusinessDay('2026-11-06') && !isBusinessDay('2026-11-07') && !isBusinessDay('2026-11-11') && !isBusinessDay('2026-11-26') && holidays(2026).has('2026-07-03'), 'business days: no weekends, no federal holidays (observed: 2026-07-04 is a Saturday, so 07-03)');
const fri = Date.parse('2026-11-06T20:00:00Z'); // a Friday, noon in California
const W = restoreWindow(fri);
ok(W.afterDay === '2026-11-23' && W.byDay === '2026-11-30', 'a counter-notice on Fri 2026-11-06: restore from the end of Mon 11-23 (10 business days, Veterans Day skipped) and by Mon 11-30 (14, Thanksgiving skipped)', W);
ok(businessDaysAfter(Date.parse('2026-12-31T20:00:00Z'), 1).day === '2027-01-04', 'across New Year (observed Fri 2027-01-01) and a weekend');
const env0 = {};
const U3 = makeUploads({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'tw-uploads-prod-')), campaigns: new Map(), secret: 'x', channel: 'prod', env: env0 }); U3.close();
ok(!U3.enabled(), 'uploads are off on a prod relay by default');
const prodWith = (env, ready) => { const U = makeUploads({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'tw-uploads-prod2-')), campaigns: new Map(), secret: 'x', channel: 'prod', env, dmca: { hostingReady: () => ({ on: ready }) } }); U.close(); return U.enabled(); };
ok(!prodWith({ TW_UPLOADS: '1' }, false), 'TW_UPLOADS=1 on prod is not enough without the hosting record (a registered designated agent, the policy, the terms, the mailbox)');
ok(prodWith({ TW_UPLOADS: '1' }, true) && !prodWith({}, true), 'with both, uploads are on; with the record alone, still off');
ok(!makeUploads({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'tw-uploads-dev0-')), campaigns: new Map(), secret: 'x', channel: 'dev', env: { TW_UPLOADS: '0' } }).enabled(), 'a dev relay can turn them off (TW_UPLOADS=0)');
// (2026-11-07) the hosting record also carries the agent's name, address and phone, which the policy page must print
// (§512(c)(2)); and it asks NOTHING of uploaders: no verified email, no account (Harry: email confirmation is built when the
// first real takedown notice arrives; docs/legal/FIRST_TAKEDOWN_RUNBOOK.md)
const dm = makeDmca({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'tw-dmca-ready-')), uploads: null, secret: 'x', channel: 'prod', env: {} });
const hrFile = path.join(dm.root, 'safe-harbour.json');
fs.writeFileSync(hrFile, JSON.stringify({ agent: { number: 'DMCA-1' }, policyUrl: 'x', termsUrl: 'x', mailbox: 'x' }));
const hr0 = dm.hostingReady();
ok(!hr0.on && hr0.missing.length === 3 && hr0.missing.every(m => /designated agent's (name or title|mailing address|phone)/.test(m)), "hosting waits for the agent's name, address and phone (printed on the page), not only the registration number", hr0);
const FULL = { agent: { number: 'DMCA-1', name: 'Copyright Agent', org: OPERATOR, address: 'PO Box 1\nTown', phone: 'TEL-ONE' }, policyUrl: 'x', termsUrl: 'x', mailbox: 'fixture@example.invalid' };
fs.writeFileSync(hrFile, '{}');
const hrE = dm.hostingReady();
fs.writeFileSync(hrFile, JSON.stringify(FULL));
const hr1 = dm.hostingReady();
ok(hr1.on && hr1.missing.length === 0 && hrE.missing.length === 7 && !hrE.missing.some(m => /verif|confirm|account|identity|uploader/i.test(m)), 'the full record makes hosting ready; nothing asks for an uploader email confirmation or account (Harry, 2026-11-07)', hr1);
const Ureal = makeUploads({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'tw-uploads-prod3-')), campaigns: new Map(), secret: 'x', channel: 'prod', env: { TW_UPLOADS: '1' }, dmca: dm }); Ureal.close();
ok(Ureal.enabled(), 'a prod relay with TW_UPLOADS=1 and that record takes uploads (the real gate, no email step)');
dm.close();
const ps = relay.dmca.publicSharing();
ok(!ps.on && ps.missing.length >= 5 && ps.flag === PUBLIC_FLAG, `public sharing is off, and says what it waits for (${ps.missing.length} things)`, ps);
fs.writeFileSync(path.join(dataDir, 'dmca', 'safe-harbour.json'), JSON.stringify({ agent: { number: 'DMCA-1234567', name: 'Copyright Agent', address: 'PO Box 1', phone: '1' }, policyUrl: 'x', termsUrl: 'x', mailbox: 'x', counsel: 'x' }));
ok(!relay.dmca.publicSharing().on && relay.dmca.publicSharing().missing.length === 1, `with every record but not ${PUBLIC_FLAG}=1 in the environment: still off`);

// ---------------------------------------------------------------- the desk (engine/tools/dmca_admin.mjs)
// (asynchronously: the relay answering it runs in this same process, so a synchronous spawn would wait on itself)
const desk = (...a) => new Promise((res) => execFile(process.execPath, [path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'tools', 'dmca_admin.mjs'), ...a], { env: { ...process.env, DATA_DIR: dataDir, PORT: String(relay.port) }, encoding: 'utf8', timeout: 20000 }, (err, stdout, stderr) => res({ status: err ? (err.code ?? 1) : 0, stdout, stderr })));
const ds = await desk('status');
ok(ds.status === 0 && /hosting READY/.test(ds.stdout) && /waits for: the relay's environment/.test(ds.stdout) && /OVERDUE/.test(ds.stdout) && !ds.stdout.includes(adminKey), 'the desk: status says what is ready, what public sharing waits for, the overdue counter-notice, never the key', ds.stdout.slice(0, 300) + ds.stderr.slice(0, 200));
const df = await desk('find', 'gnome'), dfg = await desk('find', 'Pyramid');
ok(df.status === 0 && dfg.status === 0 && /Pyramid/.test(dfg.stdout), 'the desk: find by the notice\'s words', dfg.stdout.slice(0, 200));
const dl = await desk('letter', cid);
ok(!/docs\//.test(dl.stdout), 'the letter to the claimant prints no internal path', dl.stdout.slice(-300));
ok(dl.status === 0 && /§512\(g\)\(2\)\(B\)/.test(dl.stdout) && dl.stdout.includes('Harry Gm') && dl.stdout.includes(fw.counter.window.afterDay), 'the desk: the letter to the claimant, with the counter-notice and the window', dl.stdout.slice(0, 200));
fs.writeFileSync(path.join(dataDir, 'dmca', 'safe-harbour.json'), '{}');
const dr = await desk('ready', '--agent', 'Copyright Agent', '--agent-address', 'PO Box 1, Town', '--phone', 'TEL-ONE', '--number', 'DMCA-1', '--policy', 'https://x/dmca', '--terms', 'https://x/terms', '--mailbox', 'fixture@example.invalid');
ok(dr.status === 0 && relay.dmca.hostingReady().on && !relay.dmca.publicSharing().on, 'the desk: "ready" records the facts (agent name, address, phone, number, policy, terms, mailbox); hosting is then ready, public sharing still waits (counsel, the flag)', [dr.stdout.slice(0, 300), relay.dmca.hostingReady().missing]);
const dr2 = await desk('ready', '--phone', 'TEL-TWO');
const pg2 = await http('/dmca');
ok(dr2.status === 0 && pg2.text.includes(`<b>Copyright Agent</b><br>${OPERATOR}`) && pg2.text.includes('PO Box 1, Town') && pg2.text.includes('TEL-TWO') && pg2.text.includes('fixture@example.invalid') && !/not registered yet/.test(pg2.text), "the policy page prints the agent's name, address, phone and email from the record; an amendment changes one field and keeps the rest", pg2.text.slice(0, 200));

await relay.close();
console.log(`uploads: ${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
