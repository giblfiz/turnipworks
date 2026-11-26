// UPLOADED MODELS on the relay (2026-11-06; docs/UPLOADS.md; core/uploads.js is what the browser shares; the converter is
// relay/upload-worker/; the safe-harbour side, notices, counter-notices and strikes, is relay/dmca.js).
//
// A GM uploads a model file into a campaign; it becomes a thing that campaign's seats can place and see. The file is
// UNTRUSTED: the relay checks the cheap things itself (who, how big, how often, how much is stored), then a SANDBOXED
// child process rebuilds it into our three tiers (upload-worker/worker.mjs: no network, no access to the data folder,
// capped CPU, memory, file size and time). The original is never kept: only what the converter wrote is stored.
//
// WHERE (DATA_DIR, so dev and prod each have their own, backed up with the campaigns):
//   uploads/blobs/<id>/            one converted model. id = sha256 of (the file's bytes, the conversion options): the
//     meta.json                    same file uploaded twice is stored once. meta: { id, raw (sha256 of the file), at,
//     t0.glb t1.glb t2.glb         format, up, bounds, size, plain, notes, tiers, status 'ok' | 'disabled', disabled?,
//     thumb.webp                   orphanSince? }. disabled = a takedown (relay/dmca.js): the files stay, nobody is served
//   uploads/blocked.json           { <raw sha256>: { at, notice } }: files that may not be uploaded again (a takedown)
//   uploads/log.jsonl              every upload, delete, takedown, restore (no tokens, no addresses: an IP is a keyed hash)
//   uploads/tmp/<job>/             a conversion in progress (removed when it ends)
//   <campaign dir>/uploads.json    the campaign's own list: { items: [{ id, raw, name, height, yaw, at, by, attest,
//                                  status?: 'removed', removed?: { at, notice } }] }. It moves with the campaign when the
//                                  campaign is deleted, so a deleted campaign's models are orphans and go after a grace.
//
// HTTP (relay paths, behind /api/tw-relay/)
//   GET  /c/<cid>/uploads?seat=T                    the GM's list (and the quota, the attestation words, the flags)
//   POST /c/<cid>/uploads?seat=T&name=&height=&yaw=&up=&ext=&attest=<ATTEST_VERSION>    body: the file's bytes
//   GET  /c/<cid>/uploads/<id>/<t0|t1|t2>.glb       any live seat of the campaign (Authorization: Bearer ONLY: a token in
//                                                   the address leaks into logs; ?seat= is refused, 2026-11-23)
//   GET  /c/<cid>/uploads/<id>/thumb                any live seat (the same);  POST …/thumb (the GM: a WebP, at most 96 KB)
//   POST /c/<cid>/uploads/<id>/set {name, height, yaw}            the GM
//   POST /c/<cid>/uploads/<id>/delete[?placed=keep]  the GM: off the list, and (by default) off every area it stands in
//   POST /c/<cid>/uploads/<id>/publish               refused while public sharing is off (core/uploads.js PUBLIC_FLAG)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isGmSide, liveSeat } from '../core/perms.js';
import { ATTEST_VERSION, ATTEST_TEXT, UPLOAD_ID_RE, TIER_NAMES, heightProblem, cleanName, PUBLIC_FLAG } from '../core/uploads.js';
import { LIMITS, SANDBOX } from './upload-worker/limits.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const WORKER_DIR = path.join(HERE, 'upload-worker');
export const QUOTA = Object.freeze({
  perCampaign: 100,                    // models a campaign keeps
  bytesPerCampaign: 200 * 1024 * 1024, // what its models take on disk (all three tiers)
  totalBytes: 20 * 1024 * 1024 * 1024, // the relay's whole store
  perSeatHour: 20, perIpHour: 40,      // uploads started
  queue: 3,                            // conversions waiting (one runs at a time)
  thumbBytes: 96 * 1024,
  orphanGraceMs: 14 * 24 * 3600e3,     // a model no campaign lists any more (a deleted campaign can still be put back)
});
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const today = () => new Date().toISOString();
const PRLIMIT = ['/usr/bin/prlimit', '/bin/prlimit'].find(p => fs.existsSync(p)) || null, NICE = ['/usr/bin/nice', '/bin/nice'].find(p => fs.existsSync(p)) || null;
// THE BOX the converter runs in (exported for engine/test/uploads.test.mjs, which runs a probe in exactly this box):
// prlimit (CPU seconds, largest file it may write, no core dump, open files) -> nice -> node with the permission model
// (read only the worker's own folder and the job's, write only the job's; no child processes, no workers; addons only
// because sharp is one: libvips is told to decode only PNG, JPEG and WebP from memory) -> sandbox.mjs (no network).
export function workerCommand({ workerDir = WORKER_DIR, job, sandbox = SANDBOX, script = path.join(workerDir, 'worker.mjs') }) {
  const node = [process.execPath, '--permission', `--allow-fs-read=${workerDir}/`, `--allow-fs-read=${job}/`, `--allow-fs-write=${job}/`, '--allow-addons', `--max-old-space-size=${sandbox.heapMb}`, '--no-warnings',
    `--import=${pathToFileURL(path.join(workerDir, 'sandbox.mjs')).href}`, script, job];
  return [...(PRLIMIT ? [PRLIMIT, `--cpu=${sandbox.cpuSeconds}`, `--fsize=${sandbox.fileBytes}`, '--core=0', '--nofile=512', '--'] : []), ...(NICE ? [NICE, '-n', String(sandbox.nice)] : []), ...node];
}

export function makeUploads({ dataDir, campaigns, secret, log = () => {}, channel = 'dev', env = process.env, now = () => Date.now(), workerDir = WORKER_DIR, sandbox = SANDBOX, dmca = null, quota = {} }) {
  const Q = { ...QUOTA, ...quota }; // (tests raise the hourly limits: one test sends more uploads than a person would)
  const root = path.join(dataDir, 'uploads'), blobs = path.join(root, 'blobs'), tmp = path.join(root, 'tmp');
  for (const d of [root, blobs, tmp]) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  for (const d of fs.readdirSync(tmp)) fs.rmSync(path.join(tmp, d), { recursive: true, force: true }); // (a conversion the last run never finished)
  // ON: a dev relay (a test bench), unless TW_UPLOADS=0. A prod relay only with TW_UPLOADS=1 AND the safe-harbour record complete
  // (relay/dmca.js hostingReady: the harbour does not cover what was stored before the designated agent existed)
  const enabled = () => channel === 'dev' ? env.TW_UPLOADS !== '0' : env.TW_UPLOADS === '1' && !!dmca?.hostingReady?.().on;
  const workerReady = () => fs.existsSync(path.join(workerDir, 'node_modules', '@gltf-transform', 'core'));
  const ipHash = (ip) => crypto.createHmac('sha256', secret).update('upload-ip|' + String(ip)).digest('hex').slice(0, 20);
  const event = (e) => { try { fs.appendFileSync(path.join(root, 'log.jsonl'), JSON.stringify({ at: now(), ...e }) + '\n', { mode: 0o600 }); } catch (err) { log(`uploads log: ${err.message}`); } };

  // ---------------------------------------------------------------- the store
  const blobDir = (id) => path.join(blobs, id);
  const metaOf = (id) => { if (!UPLOAD_ID_RE.test(id || '')) return null; try { return JSON.parse(fs.readFileSync(path.join(blobDir(id), 'meta.json'), 'utf8')); } catch { return null; } };
  const writeMeta = (m) => fs.writeFileSync(path.join(blobDir(m.id), 'meta.json'), JSON.stringify(m), { mode: 0o600 });
  const allBlobs = () => { try { return fs.readdirSync(blobs).filter(d => UPLOAD_ID_RE.test(d)).map(metaOf).filter(Boolean); } catch { return []; } };
  const blobBytes = (m) => (m.tiers || []).reduce((n, t) => n + (t.bytes || 0), 0) + (m.thumb || 0);
  const readJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
  const blockedFile = path.join(root, 'blocked.json');
  const blocked = () => readJ(blockedFile, {});
  const listFile = (rt) => path.join(rt.dir || rt.journal.dir, 'uploads.json'); // (a campaign's folder: its journal's)
  const listOf = (rt) => { const j = readJ(listFile(rt), null); return Array.isArray(j?.items) ? j.items : []; };
  const saveList = (rt, items) => fs.writeFileSync(listFile(rt), JSON.stringify({ items }), { mode: 0o600 });
  const refOf = (rt, id) => listOf(rt).find(x => x.id === id) || null;
  const usage = (rt) => { const items = listOf(rt); return { n: items.length, bytes: items.reduce((n, x) => n + blobBytes(metaOf(x.id) || {}), 0) }; };
  const totalBytes = () => allBlobs().reduce((n, m) => n + blobBytes(m), 0);
  // which campaigns list a model (by its id, or every model of one file: `raw`)
  function holders({ id = null, raw = null } = {}) {
    const out = [];
    for (const rt of campaigns.values()) for (const x of listOf(rt)) if ((id && x.id === id) || (raw && x.raw === raw)) out.push({ rt, ref: x });
    return out;
  }

  // ---------------------------------------------------------------- the converter, in its box
  let running = Promise.resolve(), waiting = 0;
  function runWorker(job, opts) {
    return new Promise((resolve) => {
      fs.writeFileSync(path.join(job, 'opts.json'), JSON.stringify(opts), { mode: 0o600 });
      const cmd = workerCommand({ workerDir, job, sandbox });
      // a clean environment: none of the relay's (no keys, no paths of ours); the job folder is its working directory
      const child = spawn(cmd[0], cmd.slice(1), { cwd: job, env: { PATH: '/usr/bin:/bin', HOME: job, LANG: 'C.UTF-8' }, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '', err = '', done = false, peak = 0;
      const finish = (r) => { if (done) return; done = true; clearTimeout(timer); clearInterval(watch); try { child.kill('SIGKILL'); } catch { } resolve(r); };
      child.stdout.on('data', (c) => { if (out.length < 65536) out += c; });
      child.stderr.on('data', (c) => { if (err.length < 8192) err += c; });
      const timer = setTimeout(() => finish({ ok: false, why: 'it took too long to convert', killed: 'time' }), sandbox.wallMs);
      const watch = setInterval(() => { // the memory watch: resident memory over the cap, killed
        try { const m = /VmRSS:\s+(\d+) kB/.exec(fs.readFileSync(`/proc/${child.pid}/status`, 'utf8')); const rss = m ? +m[1] * 1024 : 0; peak = Math.max(peak, rss); if (rss > sandbox.rssBytes) finish({ ok: false, why: 'it needed too much memory to convert', killed: 'memory' }); } catch { }
      }, 150);
      child.on('error', (e) => finish({ ok: false, why: `the converter could not start (${e.code || e.message})` }));
      child.on('exit', (code, sig) => {
        const line = out.trim().split('\n').pop() || '';
        let r = null; try { r = JSON.parse(line); } catch { }
        if (!r) r = { ok: false, why: sig === 'SIGXCPU' || sig === 'SIGKILL' ? 'it took too long to convert' : sig === 'SIGXFSZ' ? 'its converted copy came out too large' : `the converter stopped (${sig || 'exit ' + code})`, stderr: err.slice(0, 400) };
        finish({ ...r, peakRss: peak });
      });
    });
  }
  // EVERY REFUSAL SAYS WHAT A PERSON CAN DO (2026-11-23): the converter's own words name the problem; one that does not
  // already say what to try gets the advice for its kind
  const ADVICE = [
    [/too long|too much memory|too large|too many|over \d|at most|the most we take|unpacks/, 'try a smaller file: fewer triangles or smaller pictures (the Import Lab can reduce a big model in your browser first)'],
    [/did not validate|could not be read|could not be converted|converter stopped|converter could not start|gave (no|a bad)|not a GLB|tier is missing/, 'try exporting it again as a single .glb (glTF Binary); if it still fails, send it to us through Settings ▸ Feedback'],
  ];
  const advise = (why) => /\b(try|export it|delete some|tick the box|send|reduces)\b/i.test(why) ? why : `${why}: ${(ADVICE.find(([re]) => re.test(why)) || [, 'try exporting it again as a single .glb (glTF Binary)'])[1]}`;
  // what the worker said is checked too: it handled hostile bytes
  function checkResult(r, job) {
    if (!r?.ok) return r?.why ? String(r.why).slice(0, 300) : 'it could not be converted';
    if (!Array.isArray(r.tiers) || r.tiers.length !== TIER_NAMES.length) return 'the converter gave no tiers';
    if (!(Array.isArray(r.bounds) && r.bounds.length === 3 && r.bounds.every(x => Number.isFinite(x) && x >= 0 && x <= 1.0001) && Math.max(...r.bounds) > 0.999)) return 'the converter gave a bad size';
    for (const [i, t] of r.tiers.entries()) {
      if (t.name !== TIER_NAMES[i]) return 'the converter gave a bad tier';
      let b; try { b = fs.readFileSync(path.join(job, 'out', `${t.name}.glb`)); } catch { return 'a tier is missing'; }
      if (b.length < 20 || b.toString('ascii', 0, 4) !== 'glTF' || b.readUInt32LE(8) !== b.length || b.length > 8 * 1024 * 1024) return 'a tier is not a GLB';
      t.bytes = b.length; t.sha = sha(b).slice(0, 16);
    }
    return null;
  }
  async function convert(raw, opts) {
    if (waiting >= Q.queue) return { ok: false, status: 503, why: 'the server is converting other models: try again in a minute' };
    waiting++;
    const turn = running.then(async () => {
      const job = fs.mkdtempSync(path.join(tmp, 'job-'));
      try {
        fs.writeFileSync(path.join(job, 'in.bin'), raw, { mode: 0o600 });
        const t0 = now(), r = await runWorker(job, opts), why = checkResult(r, job);
        if (why) { fs.rmSync(job, { recursive: true, force: true }); return { ok: false, status: 422, why: advise(why), killed: r?.killed, ms: now() - t0 }; }
        return { ok: true, result: r, job, ms: now() - t0 };
      } catch (e) { fs.rmSync(job, { recursive: true, force: true }); return { ok: false, status: 500, why: `it could not be converted (${e.message})` }; }
    });
    running = turn.then(() => { }, () => { }).finally(() => { waiting--; });
    const out = await turn;
    if (!out.ok && out.job) fs.rmSync(out.job, { recursive: true, force: true });
    return out;
  }
  function store(id, raw, res) {
    const dir = blobDir(id); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    for (const t of res.result.tiers) fs.renameSync(path.join(res.job, 'out', `${t.name}.glb`), path.join(dir, `${t.name}.glb`));
    const R = res.result;
    const meta = { id, raw, at: now(), format: R.format, up: R.up, bounds: R.bounds, size: R.size, plain: !!R.plain, notes: (R.notes || []).map(s => String(s).slice(0, 120)).slice(0, 12), trianglesIn: R.trianglesIn, input: R.input || null, tiers: R.tiers.map(t => ({ name: t.name, tris: t.tris, how: String(t.how || '').slice(0, 40), bytes: t.bytes, sha: t.sha, textures: t.textures })), status: 'ok', ms: res.ms };
    writeMeta(meta);
    fs.rmSync(res.job, { recursive: true, force: true });
    return meta;
  }

  // (2026-11-23: a refusal says what a person can do)
  const BLOCKED_WHY = () => `this file was removed from Turnip Works after a copyright notice, and cannot be uploaded again while that stands. If it was removed by mistake, send a counter-notice from the removed model's row in Your models (or, if it was not this campaign's, write to ${dmca?.mailbox?.() || 'hello@turnipworks.net'})`;
  // ---------------------------------------------------------------- limits
  const hits = new Map();
  const limited = (k, max, ms) => { const t = now(), l = (hits.get(k) || []).filter(x => t - x < ms); if (l.length >= max) { hits.set(k, l); return true; } l.push(t); hits.set(k, l); if (hits.size > 20000) hits.clear(); return false; };

  // ---------------------------------------------------------------- what a GM sees of one model
  // A model is REMOVED for one campaign when its entry there says so (a takedown, the repeat-infringer policy): that is
  // what serving checks, so a counter-notice restores exactly the campaign that sent it (2026-11-06, the adversarial
  // review: a global restore let one campaign's counter-notice override another's takedown or lawsuit).
  const isRemoved = (rt, x) => x.status === 'removed' || !!dmca?.ended?.(rt.id);
  // (2026-11-23, F3) a model a notice holds names that notice, terminated campaign or not (the row keeps its Counter-
  // notice button); `ended` says the campaign's uploading has ended too; the cut-off is the reason only when no notice is.
  const pub = (x, rt = null) => {
    const m = metaOf(x.id) || {};
    const removed = rt ? isRemoved(rt, x) : x.status === 'removed';
    const notices = x.status === 'removed' ? x.removed?.notices || [] : [], ended = !!(rt && dmca?.ended?.(rt.id));
    const why = notices.length ? 'a copyright notice' : 'the repeat-infringer policy';
    return { id: x.id, name: x.name, height: x.height, yaw: x.yaw || 0, at: x.at, bounds: m.bounds || null, format: m.format || null, plain: !!m.plain, notes: m.notes || [], tris: (m.tiers || []).map(t => t.tris), bytes: blobBytes(m), thumb: fs.existsSync(path.join(blobDir(x.id), 'thumb.webp')),
      status: removed ? 'removed' : 'ok', ...(removed && { removed: { at: x.removed?.at || null, notice: notices.slice(-1)[0] || null, notices, why, ended, counter: rt ? dmca?.counterStateFor?.(x.id, rt.id, notices) || null : null } }) };
  };

  // ---------------------------------------------------------------- takedown and restore: the primitives relay/dmca.js runs
  // A takedown removes every model made from one file (its raw hash) from every campaign that lists it, under that notice:
  // nobody is served it, things placed from it draw as a marked box, and (block) the file cannot be uploaded again while
  // any of those removals stands. The files are kept, so a counter-notice can restore them exactly. Returns who held it.
  const saveBlocked = (B) => fs.writeFileSync(blockedFile, JSON.stringify(B), { mode: 0o600 });
  function disable(raw, { notice = null, block = true } = {}) {
    const ms = allBlobs().filter(m => m.raw === raw), at = now();
    for (const m of ms) { m.disabled = { at: m.disabled?.at || at, notices: [...new Set([...(m.disabled?.notices || []), notice])] }; writeMeta(m); }
    const held = holders({ raw });
    for (const { rt } of new Map(held.map(h => [h.rt.id, h])).values()) saveList(rt, listOf(rt).map(x => x.raw !== raw ? x : { ...x, status: 'removed', removed: { ...(x.removed || {}), at: x.removed?.at || at, notices: [...new Set([...(x.removed?.notices || []), notice])] } }));
    if (block) { const B = blocked(); B[raw] = { at: B[raw]?.at || at, notices: [...new Set([...(B[raw]?.notices || []), notice])] }; saveBlocked(B); }
    event({ e: 'disable', raw, notice, blobs: ms.map(m => m.id), campaigns: held.map(h => h.rt.id), block });
    log(`uploads: file ${raw.slice(0, 12)}… DISABLED (${ms.length} model${ms.length === 1 ? '' : 's'}, ${held.length} campaign list${held.length === 1 ? '' : 's'})${notice ? ' for notice ' + notice : ''}`);
    return { blobs: ms.map(m => m.id), holders: held.map(({ rt, ref }) => ({ campaign: rt.id, id: ref.id, by: ref.by, name: ref.name, ipHash: ref.attest?.ipHash || null })) };
  }
  // lift ONE notice's removal: for one campaign (a counter-notice) or for all (a notice withdrawn or found invalid). A
  // model comes back only when no notice still holds it there and the repeat-infringer policy has not ended its campaign.
  function restore(raw, { notice, campaign = null, why = 'counter-notice' } = {}) {
    const back = [];
    for (const rt of campaigns.values()) {
      if (campaign && rt.id !== campaign) continue;
      let changed = false;
      const items = listOf(rt).map(x => {
        if (x.raw !== raw || x.status !== 'removed' || !(x.removed?.notices || []).includes(notice)) return x;
        changed = true;
        const left = x.removed.notices.filter(n => n !== notice);
        if (left.length || x.removed.terminated) return { ...x, removed: { ...x.removed, notices: left } };
        const { status, removed, ...rest } = x; back.push({ campaign: rt.id, id: x.id }); return { ...rest, restored: { at: now(), why, notice } };
      });
      if (changed) saveList(rt, items);
    }
    // the notice no longer holds anything anywhere: off the block list and the models' records
    const still = holders({ raw }).some(h => h.ref.status === 'removed' && (h.ref.removed?.notices || []).includes(notice));
    if (!still) {
      const B = blocked(); if (B[raw]) { B[raw].notices = (B[raw].notices || []).filter(n => n !== notice); if (!B[raw].notices.length) delete B[raw]; saveBlocked(B); }
      for (const m of allBlobs().filter(m => m.raw === raw)) { if (m.disabled) { m.disabled.notices = (m.disabled.notices || []).filter(n => n !== notice); if (!m.disabled.notices.length) delete m.disabled; } writeMeta(m); }
    }
    event({ e: 'restore', raw, notice, campaign, why, back });
    log(`uploads: file ${raw.slice(0, 12)}… notice ${notice} lifted${campaign ? ' for ' + campaign : ''} (${why}): ${back.length} model${back.length === 1 ? '' : 's'} back`);
    return { back };
  }
  // the repeat-infringer policy's last step (relay/dmca.js): every model of the campaign stops being served to it, for good
  function endCampaign(cid, { notice = null } = {}) {
    const rt = campaigns.get(cid); if (!rt) return 0;
    const at = now(), items = listOf(rt).map(x => ({ ...x, status: 'removed', removed: { ...(x.removed || {}), at: x.removed?.at || at, notices: x.removed?.notices || [], terminated: { at, notice } } }));
    saveList(rt, items); event({ e: 'campaign-ended', campaign: cid, notice, n: items.length });
    return items.length;
  }
  // the cut-off lifted (relay/dmca.js reconcile or reinstate): a model removed ONLY by it comes back; one a notice still
  // holds stays removed under that notice
  function reinstateCampaign(cid, { why = 'reinstated' } = {}) {
    const rt = campaigns.get(cid); if (!rt) return { back: [], held: [], missing: true };
    const back = [], held = [];
    const items = listOf(rt).map(x => {
      if (x.status !== 'removed' || !x.removed?.terminated) return x;
      const { terminated, ...rem } = x.removed;
      if ((rem.notices || []).length) { held.push(x.id); return { ...x, removed: rem }; }
      const { status, removed, ...rest } = x; back.push(x.id); return { ...rest, restored: { at: now(), why } };
    });
    saveList(rt, items); event({ e: 'campaign-reinstated', campaign: cid, why, back, held });
    return { back, held };
  }
  // the admin's search (relay/dmca.js, box-only): a notice names a model by what it looks like, not by our ids
  const find = (q) => { const s = String(q || '').toLowerCase(), out = []; for (const rt of campaigns.values()) for (const x of listOf(rt)) if (!s || x.name.toLowerCase().includes(s) || x.id.startsWith(s) || x.raw.startsWith(s) || rt.id === q) out.push({ campaign: rt.id, campaignName: rt.state.name, ...pub(x, rt), raw: x.raw, by: x.by, attest: x.attest }); return out; };

  // ---------------------------------------------------------------- deleting a model from a campaign
  // placed copies: one batch per area, as the GM (so it is in the journal, and one undo per area brings the things back, as
  // marked boxes: the model itself is gone)
  function removePlaced(rt, seat, id) {
    let n = 0;
    for (const [area, A] of Object.entries(rt.state.areas || {})) {
      const ids = Object.values(A.entities || {}).filter(e => e.kind === 'object' && e.upload === id).map(e => e.id);
      for (let i = 0; i < ids.length; i += 500) {
        const r = rt.dispatch(seat, { type: 'batch', area, args: { ops: ids.slice(i, i + 500).map(x => ({ type: 'object.delete', args: { id: x } })) } }, {});
        if (r.ok) n += Math.min(500, ids.length - i); else log(`${rt.id}: removing placed ${id.slice(0, 8)}… in ${area}: ${r.why}`);
      }
    }
    return n;
  }
  function dropBlobIfOrphan(id) {
    const m = metaOf(id); if (!m) return;
    if (holders({ id }).length) return;
    if (m.disabled) { m.orphanSince ||= now(); writeMeta(m); return; } // (kept for a restore; the sweep clears it later)
    fs.rmSync(blobDir(id), { recursive: true, force: true });
    event({ e: 'blob-gone', id });
  }
  // the sweep: models no campaign lists any more (a deleted campaign) go after a grace; disabled ones after a year
  // and a model removed from every campaign that holds it for over a year (the upload terms' promise, UPLOAD_TERMS.md N.9)
  // loses its files, unless a counter-notice or a lawsuit is still open on it (dmca.hold)
  function sweep() {
    for (const m of allBlobs()) {
      const H = holders({ id: m.id });
      if (H.length && H.every(h => h.ref.status === 'removed') && m.disabled && now() - m.disabled.at > 365 * 24 * 3600e3 && !dmca?.hold?.(m.raw) && !m.purged) {
        for (const t of TIER_NAMES) fs.rmSync(path.join(blobDir(m.id), `${t}.glb`), { force: true });
        m.purged = now(); writeMeta(m); event({ e: 'blob-purged', id: m.id }); continue;
      }
      if (H.length) { if (m.orphanSince) { delete m.orphanSince; writeMeta(m); } continue; }
      if (!m.orphanSince) { m.orphanSince = now(); writeMeta(m); continue; }
      const grace = m.disabled ? 365 * 24 * 3600e3 : Q.orphanGraceMs;
      if (now() - m.orphanSince > grace) { fs.rmSync(blobDir(m.id), { recursive: true, force: true }); event({ e: 'blob-swept', id: m.id }); }
    }
  }
  const sweepTimer = setInterval(() => { try { sweep(); } catch (e) { log(`uploads sweep: ${e.message}`); } }, 6 * 3600e3); sweepTimer.unref?.();

  // ---------------------------------------------------------------- HTTP
  const SERVE_HEADERS = (etag) => ({ 'content-type': 'model/gltf-binary', 'x-content-type-options': 'nosniff', 'content-disposition': 'attachment; filename="model.glb"', 'content-security-policy': "default-src 'none'; sandbox", 'cross-origin-resource-policy': 'cross-origin', 'cache-control': 'private, no-cache', etag: `"${etag}"`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'etag', 'x-robots-tag': 'noindex' });
  async function handle(req, res, { url, parts, send, auth, readBody, ipOf }) {
    if (!(parts[0] === 'c' && parts[1] && parts[2] === 'uploads')) return false;
    if (!enabled()) { send(404, { ok: false, code: 'off', why: 'uploads are not on for this server' }); return true; }
    // a model's files (its tiers, its picture) take the seat in the Authorization header only: a token in an address ends
    // up in logs and histories (docs/UPLOADS.md "Private to the campaign"; the game never asks that way)
    if (parts[4] && req.method === 'GET' && url.searchParams.has('seat')) { send(400, { ok: false, code: 'seat_in_address', why: 'send the seat token in the Authorization header (Bearer), not in the address' }); return true; }
    const a = auth(req, url.searchParams, parts[1]); if (a.err) { send(...a.err); return true; }
    const rt = a.rt, st = rt.state, seat = st.seats[a.seat], gm = isGmSide(st, a.seat) && seat?.kind === 'human';
    const id = parts[3] || null, sub = parts[4] || null;
    if (id && !UPLOAD_ID_RE.test(id)) { send(404, { ok: false, why: 'no such model' }); return true; }

    // ---- the list
    if (!id && req.method === 'GET') {
      if (!gm) { send(403, { ok: false, code: 'denied', why: 'the list of uploaded models is the GM\'s' }); return true; }
      const u = usage(rt);
      send(200, { ok: true, uploads: listOf(rt).map(x => pub(x, rt)), quota: { n: u.n, bytes: u.bytes, maxN: Q.perCampaign, maxBytes: Q.bytesPerCampaign, fileBytes: LIMITS.bytes, triangles: LIMITS.trianglesIn }, attest: { version: ATTEST_VERSION, text: ATTEST_TEXT }, publicSharing: dmca?.publicSharing?.() || { on: false, flag: PUBLIC_FLAG }, converter: workerReady(), blockedUploads: dmca?.uploadBlocked?.(rt, ipHash(ipOf(req))) || null });
      return true;
    }
    // ---- an upload
    if (!id && req.method === 'POST') {
      const q = url.searchParams;
      if (!gm) { send(403, { ok: false, code: 'denied', why: 'only the GM (a person) uploads models' }); return true; }
      if (!workerReady()) { send(503, { ok: false, code: 'no_converter', why: 'this server cannot convert models yet (the converter is not installed)' }); return true; }
      if (q.get('attest') !== ATTEST_VERSION) { send(400, { ok: false, code: 'attest', why: 'tick the box that says you have the right to upload this model' }); return true; }
      const ih = ipHash(ipOf(req)), stop = dmca?.uploadBlocked?.(rt, ih);
      if (stop) { send(403, { ok: false, code: 'repeat_infringer', why: stop.why }); return true; }
      const name = cleanName(q.get('name')) || 'Model', height = Number(q.get('height') || 5), yaw = ((Math.round(Number(q.get('yaw') || 0) / 90) % 4 + 4) % 4) * 90;
      const up = ['y', 'z'].includes(q.get('up')) ? q.get('up') : 'auto', ext = String(q.get('ext') || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 5);
      if (heightProblem(height)) { send(400, { ok: false, why: `height: ${heightProblem(height)}` }); return true; }
      if (limited(`s|${rt.id}|${a.seat}`, Q.perSeatHour, 3600e3) || limited(`i|${ih}`, Q.perIpHour, 3600e3)) { send(429, { ok: false, why: 'too many uploads in an hour: try again later' }); return true; }
      const u = usage(rt);
      if (u.n >= Q.perCampaign) { send(429, { ok: false, code: 'quota', why: `a campaign keeps at most ${Q.perCampaign} models: delete some first` }); return true; }
      let body; try { body = await readBody(req, LIMITS.bytes); } catch { send(413, { ok: false, code: 'too_large', why: `a model file is at most ${LIMITS.bytes / 1048576} MB` }); return true; }
      if (body.length < 16) { send(400, { ok: false, why: 'that file is empty' }); return true; }
      const raw = sha(body);
      if (blocked()[raw]) { event({ e: 'refused-blocked', raw, campaign: rt.id, seat: a.seat }); send(451, { ok: false, code: 'blocked', why: BLOCKED_WHY() }); return true; }
      const opts = { up, ext }, bid = sha(Buffer.concat([Buffer.from(raw), Buffer.from('|' + JSON.stringify(opts))]));
      if (refOf(rt, bid)) { send(409, { ok: false, code: 'have', why: 'this campaign already has that model', upload: pub(refOf(rt, bid), rt) }); return true; }
      let meta = metaOf(bid);
      if (!meta || meta.purged) {
        if (totalBytes() > Q.totalBytes) { send(507, { ok: false, why: 'the server\'s model store is full' }); return true; }
        const c = await convert(body, opts);
        body = null; // (the original is never kept)
        if (!c.ok) { event({ e: 'refused', campaign: rt.id, seat: a.seat, raw, why: c.why, killed: c.killed || null }); log(`${rt.id}: upload refused: ${c.why}`); send(c.status || 422, { ok: false, code: 'refused', why: `Not uploaded: ${c.why}` }); return true; }
        meta = store(bid, raw, c);
      }
      // checked again now the conversion is done: a takedown or the repeat-infringer policy may have landed meanwhile
      if (blocked()[raw]) { dropBlobIfOrphan(bid); send(451, { ok: false, code: 'blocked', why: BLOCKED_WHY() }); return true; }
      const stop2 = dmca?.uploadBlocked?.(rt, ih); if (stop2) { dropBlobIfOrphan(bid); send(403, { ok: false, code: 'repeat_infringer', why: stop2.why }); return true; }
      if (u.bytes + blobBytes(meta) > Q.bytesPerCampaign) { dropBlobIfOrphan(bid); send(429, { ok: false, code: 'quota', why: `this campaign's models would take more than ${Q.bytesPerCampaign / 1048576} MB: delete some first` }); return true; }
      const ref = { id: bid, raw, name, height, yaw, at: now(), by: a.seat, attest: { version: ATTEST_VERSION, words: sha(ATTEST_TEXT).slice(0, 16), seat: a.seat, seatName: String(seat.name || '').slice(0, 40), at: today(), ipHash: ih } };
      saveList(rt, [...listOf(rt), ref]);
      event({ e: 'upload', campaign: rt.id, seat: a.seat, id: bid, raw, name, bytes: blobBytes(meta), format: meta.format, attest: ref.attest.version, ipHash: ih });
      log(`${rt.id}: model "${name}" uploaded by ${a.seat} (${meta.format}, ${meta.tiers.map(t => t.tris).join('/')} triangles, ${Math.round(blobBytes(meta) / 1024)} KB)`);
      send(200, { ok: true, upload: pub(ref, rt) });
      return true;
    }
    // ---- one model
    const ref = refOf(rt, id);
    if (!ref) { send(404, { ok: false, why: 'no such model in this campaign' }); return true; }
    const meta = metaOf(id);
    const removed = isRemoved(rt, ref) || !!meta?.purged;
    if (TIER_NAMES.includes((sub || '').replace(/\.glb$/, '')) && /\.glb$/.test(sub) && req.method === 'GET') {
      if (!liveSeat(st, a.seat)) { send(403, { ok: false, why: 'seat revoked' }); return true; }
      if (removed) { send(451, { ok: false, code: 'removed', why: 'this model was removed after a copyright notice' }); return true; }
      if (!meta) { send(404, { ok: false, why: 'no such model' }); return true; }
      const t = meta.tiers.find(x => x.name === sub.slice(0, 2));
      if (req.headers['if-none-match'] === `"${t.sha}"`) { res.writeHead(304, SERVE_HEADERS(t.sha)); res.end(); return true; }
      let bytes; try { bytes = fs.readFileSync(path.join(blobDir(id), sub)); } catch { send(404, { ok: false, why: 'no such model' }); return true; }
      res.writeHead(200, { ...SERVE_HEADERS(t.sha), 'content-length': bytes.length }); res.end(bytes); return true;
    }
    if (sub === 'thumb' && req.method === 'GET') {
      if (removed) { send(451, { ok: false, code: 'removed', why: 'removed after a copyright notice' }); return true; }
      let img; try { img = fs.readFileSync(path.join(blobDir(id), 'thumb.webp')); } catch { send(404, { ok: false, why: 'no picture yet' }); return true; }
      res.writeHead(200, { 'content-type': 'image/webp', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox", 'cache-control': 'private, no-cache', 'access-control-allow-origin': '*', 'cross-origin-resource-policy': 'cross-origin' }); res.end(img); return true;
    }
    if (req.method !== 'POST') { send(405, { ok: false, why: 'GET a tier or the thumb; POST set, thumb, delete' }); return true; }
    if (!gm) { send(403, { ok: false, code: 'denied', why: 'that is the GM\'s' }); return true; }
    if (sub === 'thumb') {
      let body; try { body = await readBody(req, Q.thumbBytes); } catch { send(413, { ok: false, why: `a model's picture is at most ${Q.thumbBytes / 1024} KB` }); return true; }
      if (body.length < 16 || body.toString('ascii', 0, 4) !== 'RIFF' || body.toString('ascii', 8, 12) !== 'WEBP') { send(400, { ok: false, why: 'a model\'s picture must be a WebP image' }); return true; }
      if (!meta || removed) { send(409, { ok: false, why: 'that model is not available' }); return true; }
      fs.writeFileSync(path.join(blobDir(id), 'thumb.webp'), body, { mode: 0o600 }); meta.thumb = body.length; writeMeta(meta);
      send(200, { ok: true }); return true;
    }
    if (sub === 'set') {
      let b = {}; try { b = JSON.parse((await readBody(req, 4096)).toString('utf8') || '{}'); } catch { }
      const next = { ...ref };
      if (b.name != null) next.name = cleanName(b.name) || ref.name;
      if (b.height != null) { const h = Number(b.height); if (heightProblem(h)) { send(400, { ok: false, why: `height: ${heightProblem(h)}` }); return true; } next.height = h; }
      if (b.yaw != null) next.yaw = ((Math.round(Number(b.yaw) / 90) % 4 + 4) % 4) * 90;
      saveList(rt, listOf(rt).map(x => x.id === id ? next : x));
      send(200, { ok: true, upload: pub(next, rt) }); return true;
    }
    if (sub === 'delete') {
      const placed = url.searchParams.get('placed') === 'keep' ? 0 : removePlaced(rt, a.seat, id);
      saveList(rt, listOf(rt).filter(x => x.id !== id));
      dropBlobIfOrphan(id);
      event({ e: 'delete', campaign: rt.id, seat: a.seat, id, raw: ref.raw, placed });
      log(`${rt.id}: model "${ref.name}" deleted by ${a.seat} (${placed} placed cop${placed === 1 ? 'y' : 'ies'} removed)`);
      send(200, { ok: true, placed }); return true;
    }
    if (sub === 'publish') {
      const P = dmca?.publicSharing?.() || { on: false, flag: PUBLIC_FLAG, missing: ['relay/dmca.js is not loaded'] };
      if (!P.on) { send(403, { ok: false, code: 'public_off', why: 'sharing uploaded models outside this campaign is not on yet', missing: P.missing }); return true; }
      send(501, { ok: false, code: 'not_built', why: 'the public library is not built yet' }); return true;
    }
    if (sub === 'counter' && dmca) return dmca.handleCounter(req, res, { rt, seat: a.seat, ref, meta, send, readBody, removed: ref.status === 'removed' });
    send(404, { ok: false, why: 'not found' }); return true;
  }
  const close = () => clearInterval(sweepTimer);
  return { quota: Q, handle, enabled, workerReady, metaOf, listOf, refOf, holders, disable, restore, endCampaign, reinstateCampaign, find, sweep, blocked, convert, close, ipHash, root, allBlobs };
}
