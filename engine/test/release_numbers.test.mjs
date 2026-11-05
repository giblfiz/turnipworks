// Version numbers (Harry, 2026-11-02; docs/NETCODE.md "Version numbers"): tools/release.sh numbers a release only once it has
// gone live. This runs the real script end to end against a throwaway state folder, git repo and stubs, and never near prod:
// no sudo, no curl, no relay, no nginx, no mirror. It also runs the real `release_verify.mjs number` against a small server.
//   node engine/test/release_numbers.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra ?? ''); } else if (process.env.V) console.log('ok', m); };

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-versions-'));
process.on('exit', () => fs.rmSync(T, { recursive: true, force: true }));
const STATE = path.join(T, 'state'), MAIN = path.join(T, 'main'), BIN = path.join(T, 'bin'), ORIGIN = path.join(T, 'origin.git');
const LEDGER = path.join(STATE, 'versions.log');
fs.mkdirSync(path.join(STATE, 'releases'), { recursive: true }); fs.mkdirSync(BIN); fs.mkdirSync(path.join(T, 'data'));
const write = (file, text, mode = 0o644) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text, { mode }); };
const git = (...a) => spawnSync('git', ['-C', MAIN, ...a], { encoding: 'utf8' }).stdout.trim();

// the stubs: a sudo that only says yes, a curl that is a healthy relay with nobody on it, a release check told what to say
write(path.join(BIN, 'sudo'), '#!/bin/sh\nexit 0\n', 0o755);
write(path.join(BIN, 'curl'), '#!/bin/sh\necho \'{"ok":true,"conns":0}\'\n', 0o755);
write(path.join(T, 'verify.mjs'), `import fs from 'node:fs';
const a = process.argv.slice(2); fs.appendFileSync(${JSON.stringify(path.join(T, 'verify.log'))}, a.join(' ') + '\\n');
const said = (f) => { try { return fs.readFileSync(${JSON.stringify(T)} + '/' + f, 'utf8').trim(); } catch { return ''; } };
if (a[0] === 'number') { if (said('number-fails')) { console.log('{"ok":false,"what":"stub says no"}'); process.exit(1); } console.log('{"ok":true}'); process.exit(0); }
const bad = said('verify-fails'); if (bad && a.join(' ').includes(bad)) { console.log('{"ok":false,"failed":["stub says no"]}'); process.exit(1); }
console.log('{"ok":true}');\n`);

// the main checkout: one commit per release, its origin a bare folder; the campaign copy and the public export are stubs
spawnSync('git', ['init', '-q', '--bare', ORIGIN]); spawnSync('git', ['init', '-q', '-b', 'main', MAIN]);
git('config', 'user.email', 'nobody'); git('config', 'user.name', 'test'); git('remote', 'add', 'origin', ORIGIN);
write(path.join(MAIN, 'engine/tools/backup_data.sh'), `#!/bin/sh\n[ ! -e ${JSON.stringify(path.join(T, 'backup-fails'))} ]\n`, 0o755);
write(path.join(MAIN, 'tools/public-export/export.py'), 'import sys; sys.exit(1)\n');
git('add', '-A'); git('commit', '-qm', 'start');

let n = 0;
function release({ slot = true } = {}) {
  n++; write(path.join(MAIN, 'file'), String(n)); git('add', '-A'); git('commit', '-qm', `release ${n}`);
  const sha = git('rev-parse', 'HEAD'), id = `20261102-00000${n}-${sha.slice(0, 8)}`, dir = path.join(STATE, 'releases', id);
  write(path.join(dir, 'release.json'), JSON.stringify({ id, git: sha, client: String(1000 + n), tuner: '1' }, null, 1));
  write(path.join(dir, 'engine/client/index.turnipworks.html'), slot ? '<div class="twl-ver" id="twl-ver"></div>' : '<div>no number here</div>');
  const r = { id, sha, dir }; live(r, 'candidate');   // (a release that is neither live nor the candidate is pruned)
  return r;
}
function live(r, link = 'current') { fs.rmSync(path.join(STATE, link), { force: true }); fs.symlinkSync(`releases/${r.id}`, path.join(STATE, link)); }
const env = { ...process.env, PATH: `${BIN}:${process.env.PATH}`, TW_RELEASES: STATE, TW_MAIN: MAIN, TW_DEV_WEB: path.join(T, 'dev'), TW_PROD_PORT: '1', TW_PROD_UNIT: 'tw-sandbox', TW_PROD_DATA: path.join(T, 'data'),
  TW_RELEASE_VERIFY: path.join(T, 'verify.mjs'), TW_RELEASE_LOCK: path.join(T, 'roll.lock'), TW_PUBLIC_REMOTE: path.join(T, 'nowhere.git'), TW_PUBLISH_WAIT: '20', TW_RELEASE_KEEP: '50' };
delete env.TW_RELEASE_FAIL_VERIFY;
const run = (...args) => { const r = spawnSync(path.join(REPO, 'tools/release.sh'), args, { env, encoding: 'utf8' }); return { code: r.status, out: r.stdout + r.stderr }; };
const ledger = () => fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean).map(l => l.split('\t')) : [];
const stamped = (r) => JSON.parse(fs.readFileSync(path.join(r.dir, 'release.json'), 'utf8')).version;
const current = () => path.basename(fs.readlinkSync(path.join(STATE, 'current')));
const tagged = (t) => git('rev-parse', '-q', '--verify', `refs/tags/${t}^{commit}`);
const pushed = (t) => spawnSync('git', ['--git-dir', ORIGIN, 'rev-parse', '-q', '--verify', `refs/tags/${t}^{commit}`], { encoding: 'utf8' }).stdout.trim();
const lines = () => ledger().length;

// ---------- where prod stands today: 0.3.4 is in the ledger by hand, its release from before the page had a place for a number
const r0 = release({ slot: false });
live(r0);
write(LEDGER, `0.3.4\t${r0.id}\t${r0.sha}\t2026-11-02T06:30:27-08:00\n`); write(path.join(STATE, 'promoted.list'), r0.id + '\n');
const r0bytes = fs.readFileSync(path.join(r0.dir, 'release.json')), r0mtime = fs.statSync(path.join(r0.dir, 'release.json')).mtimeMs;

let o = run('promote-now'); ok(o.code === 1 && /REFUSED/.test(o.out) && current() === r0.id, 'no --harry: refused, as before', o.out);

// ---------- the small number, the default
const r1 = release();
ok(stamped(r1) === undefined, 'a candidate has no number');
ok(/candidate.*no number/.test(run('status').out), 'status says the candidate has no number');
o = run('promote-now', '--harry');
ok(o.code === 0 && current() === r1.id, 'promote: the candidate is live', o.out);
ok(/becomes v0\.3\.5 once its checks pass/.test(o.out), 'promote says what number is coming', o.out);
ok(lines() === 2 && ledger()[1][0] === '0.3.5' && ledger()[1][1] === r1.id && ledger()[1][2] === r1.sha && /^\d{4}-\d\d-\d\dT/.test(ledger()[1][3]), 'the next promote is 0.3.5: version, release, git, time in the ledger', ledger());
ok(stamped(r1) === '0.3.5', 'its release.json says 0.3.5');
ok(fs.statSync(path.join(r1.dir, 'release.json')).mode % 0o1000 === 0o644, 'release.json stays readable by nginx');
ok(tagged('v0.3.5') === r1.sha && pushed('v0.3.5') === r1.sha, 'tag v0.3.5 on its commit, pushed');
ok(tagged(`live-${r1.id}`) === r1.sha && pushed(`live-${r1.id}`) === r1.sha, 'the live-<id> tag still made and pushed');
const log = fs.readFileSync(path.join(STATE, 'rolls.log'), 'utf8');
ok(log.includes(`version: ${r1.id} is v0.3.5`), 'one line in rolls.log says so');
ok(!/WARNING: VERSION/.test(log), 'no version warning');
o = run('status');
ok(/live version: v0\.3\.5 \(next promote v0\.3\.6, --feature v0\.4\.0/.test(o.out), 'status prints the live version and what comes next', o.out);
ok(new RegExp(`current\\s+${r1.id}\\s+\\(v0\\.3\\.5,`).test(o.out) && new RegExp(`previous\\s+${r0.id}\\s+\\(v0\\.3\\.4,`).test(o.out), 'status numbers current and previous', o.out);
ok(run('list').out.includes(`${r1.id}  v0.3.5`), 'list shows the number');
fs.writeFileSync(path.join(T, 'verify.log'), '');
ok(run('verify').code === 0 && fs.readFileSync(path.join(T, 'verify.log'), 'utf8').includes('--number 0.3.5'), 'tools/release.sh verify checks the ledger\'s number');

// ---------- the mid number: the operator's choice
const r2 = release();
o = run('promote-now', '--harry', '--feature', r2.id);
ok(o.code === 0 && ledger().at(-1)[0] === '0.4.0' && stamped(r2) === '0.4.0' && pushed('v0.4.0') === r2.sha, '--feature: 0.3.5 -> 0.4.0', o.out);
const r3 = release();
o = run('promote-now', '--harry', r3.id);
ok(o.code === 0 && ledger().at(-1)[0] === '0.4.1', 'the next plain promote is 0.4.1: the mid bump is not sticky', o.out);

// ---------- the full number cannot happen by accident
const rf = release(), before = lines();
for (const [why, args] of [['no value', ['--full-version-event', '']], ['the wrong number', ['--full-version-event', '2.0.0']], ['"yes"', ['--full-version-event', 'yes']], ['with --feature', ['--feature', '--full-version-event', '1.0.0']]]) {
  o = run('promote-now', '--harry', ...args, rf.id);
  ok(o.code === 1 && /REFUSED/.test(o.out) && current() === r3.id && lines() === before, `--full-version-event refused: ${why}`, o.out);
}
ok(run('promote-now', '--harry', '--full-version-event', '2.0.0', rf.id).out.includes('--full-version-event 1.0.0'), 'the refusal names the exact argument');
o = run('promote-now', '--harry', '--full-version-event', '1.0.0', rf.id);
ok(o.code === 0 && ledger().at(-1)[0] === '1.0.0' && stamped(rf) === '1.0.0' && pushed('v1.0.0') === rf.sha, 'the exact number: 1.0.0', o.out);
const r4 = release();
o = run('promote-now', '--harry', r4.id);
ok(o.code === 0 && ledger().at(-1)[0] === '1.0.1' && current() === r4.id, 'then 1.0.1', o.out);

// ---------- rollback shows the earlier number again and uses none up
const back = lines(), tagsBefore = git('tag').split('\n').length;
o = run('rollback');
ok(o.code === 0 && current() === rf.id && lines() === back, 'rollback: no ledger line', o.out);
ok(stamped(rf) === '1.0.0' && /live version: v1\.0\.0 /.test(run('status').out), 'rollback: the earlier release\'s own number is the live one');
ok(git('tag').split('\n').length === tagsBefore, 'rollback: no new tag');
const r5 = release();
o = run('promote-now', '--harry', r5.id);
ok(o.code === 0 && ledger().at(-1)[0] === '1.0.2' && ledger().at(-1)[1] === r5.id, 'after a rollback the next new number follows the highest ever given: 1.0.1 is not handed out again', o.out);

// ---------- re-promoting keeps the number
const back2 = lines();
o = run('promote-now', '--harry', r2.id);
ok(o.code === 0 && current() === r2.id && lines() === back2 && stamped(r2) === '0.4.0' && /keeps v0\.4\.0/.test(o.out), 're-promote of a numbered release: same number, no line', o.out);
o = run('promote-now', '--harry', '--feature', r3.id);
ok(o.code === 1 && /keeps its number/.test(o.out) && current() === r2.id, '--feature on a numbered release is refused before anything moves', o.out);
o = run('promote-now', '--harry', r4.id);
ok(o.code === 0 && current() === r4.id && lines() === back2 && /keeps v1\.0\.1/.test(o.out), 'a re-promote works from any older number', o.out);

// ---------- a failed promote leaves no trace
const r6 = release(), r6before = fs.readFileSync(path.join(r6.dir, 'release.json'));
write(path.join(T, 'verify-fails'), r6.id);
o = run('promote-now', '--harry', r6.id);
ok(o.code === 1 && current() === r4.id, 'a failed check rolls back by itself', o.out);
ok(lines() === back2 && stamped(r6) === undefined && fs.readFileSync(path.join(r6.dir, 'release.json')).equals(r6before), 'the failed promote: no ledger line, its release.json untouched');
ok(tagged('v1.0.3') === '', 'the failed promote: no tag');
fs.rmSync(path.join(T, 'verify-fails'));
write(path.join(T, 'backup-fails'), '');
const r7 = release();
o = run('promote-now', '--harry', r7.id);
ok(o.code !== 0 && lines() === back2 && stamped(r7) === undefined && current() === r4.id, 'no copy of the campaigns, no swap, no number', o.out);
fs.rmSync(path.join(T, 'backup-fails'));
o = run('promote-now', '--harry', r7.id);
ok(o.code === 0 && ledger().at(-1)[0] === '1.0.3' && ledger().at(-1)[1] === r7.id && stamped(r7) === '1.0.3', 'the next promote that works gets the number the failures did not use', o.out);

// ---------- a number that cannot be read back is a warning, never a verdict
const r8 = release();
write(path.join(T, 'number-fails'), 'yes');
o = run('promote-now', '--harry', r8.id);
ok(o.code === 0 && current() === r8.id && ledger().at(-1)[0] === '1.0.4', 'the page not confirming the number does not fail or roll back the promote', o.out);
ok(/WARNING: VERSION NOT CONFIRMED/.test(fs.readFileSync(path.join(STATE, 'rolls.log'), 'utf8')), 'it is a WARNING in rolls.log');
fs.rmSync(path.join(T, 'number-fails'));

// ---------- the release from before the numbers keeps its files, whatever comes back to it
const r9 = release(); live(r0, 'previous');
o = run('rollback');
ok(o.code === 0 && current() === r0.id && lines() === back2 + 2, 'rollback to 0.3.4', o.out);
ok(/live version: v0\.3\.4 /.test(run('status').out), 'status says 0.3.4 from the ledger');
ok(fs.readFileSync(path.join(r0.dir, 'release.json')).equals(r0bytes) && fs.statSync(path.join(r0.dir, 'release.json')).mtimeMs === r0mtime, 'its release.json was never touched, byte for byte');
const r10 = release(); live(r9, 'previous');
o = run('rollback');
ok(o.code === 0 && current() === r9.id && stamped(r9) === undefined && /live version: no number/.test(run('status').out), 'a rollback onto a release that was never numbered numbers nothing', o.out);

// ---------- a ledger line whose stamp went missing is put right by the next swap to it
fs.writeFileSync(path.join(r2.dir, 'release.json'), JSON.stringify({ id: r2.id, git: r2.sha, client: '1', tuner: '1' }));
o = run('promote-now', '--harry', r2.id);
ok(o.code === 0 && stamped(r2) === '0.4.0', 'the stamp is repaired from the ledger', o.out);

// ---------- with no ledger nothing is guessed
fs.writeFileSync(LEDGER, '');
o = run('promote-now', '--harry', r10.id);
ok(o.code === 1 && /REFUSED/.test(o.out) && current() === r2.id, 'an empty ledger: a promote refuses before anything moves', o.out);
ok(/WARNING: live version unknown/.test(run('status').out), 'and status says so');

// ---------- the real check against a page: `release_verify.mjs number`
let page = '<div class="twl-ver" id="twl-ver"></div>', served = { version: '0.3.5' }, blips = 0;
const web = http.createServer((q, s) => {
  if (blips > 0) { blips--; s.writeHead(502); return s.end('bad gateway'); }
  if (q.url === '/release.json') { s.writeHead(200, { 'content-type': 'application/json' }); return s.end(JSON.stringify(served)); }
  s.writeHead(200, { 'content-type': 'text/html' }); s.end(page);
});
await new Promise(r => web.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${web.address().port}`, exec = promisify(execFile);
const number = async (want) => { try { return { code: 0, out: (await exec(process.execPath, [path.join(REPO, 'engine/tools/release_verify.mjs'), 'number', '--want', want, '--origin', origin, '--host', 'example.test'])).stdout }; } catch (e) { return { code: e.code, out: e.stdout }; } };
ok((await number('0.3.5')).code === 0, 'number: the page is served what the ledger says');
ok((await number('0.3.6')).code === 1, 'number: a stale number is caught');
served = {}; ok((await number('0.3.5')).code === 1, 'number: a page with a version line and no number served, the ledger has one: caught');
ok((await number('')).code === 0, 'number: no number in the ledger, none served: fine');
served = { version: '0.3.5' }; blips = 2; ok((await number('0.3.5')).code === 0, 'number: a blip is tried again');
blips = 99; o = await number('0.3.5'); ok(o.code === 1 && /502/.test(o.out), 'number: a page that stays down is reported', o.out); blips = 0;
page = '<div>no number here</div>'; served = {}; ok((await number('0.3.4')).code === 0, 'number: a release from before the version line has nothing to compare');
web.close();

console.log(`release_numbers: ${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
