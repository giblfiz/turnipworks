// One-shot data migration, "table" → "area" (Harry 2026-10-03). For every campaign under the data dir that has not
// been migrated yet, rewrite snapshot.json and journal.jsonl in the new names (core/migrate.js), keeping the originals
// beside them as *.pre-areas, then mark the dir with format = DATA_FORMAT. Idempotent: a marked dir is skipped, and
// the relay reads unmigrated files through the same functions anyway (backward-compatible reads), so a dir this
// misses still loads. Run at relay start; also runnable by hand: node relay/migrate-areas.js <dataDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_FORMAT, migrateSnapshot, migrateRecord } from '../core/migrate.js';

export function migrateDataDir(dataDir, log = console.log) {
  let done = 0;
  for (const d of fs.existsSync(dataDir) ? fs.readdirSync(dataDir) : []) {
    if (!d.startsWith('cmp_')) continue;
    const dir = path.join(dataDir, d), mark = path.join(dir, 'format');
    if (fs.existsSync(mark) && +fs.readFileSync(mark, 'utf8') >= DATA_FORMAT) continue;
    const snapF = path.join(dir, 'snapshot.json'), jF = path.join(dir, 'journal.jsonl');
    if (fs.existsSync(snapF)) {
      const snap = JSON.parse(fs.readFileSync(snapF, 'utf8'));
      if (!fs.existsSync(snapF + '.pre-areas')) fs.copyFileSync(snapF, snapF + '.pre-areas');
      writeAtomic(snapF, JSON.stringify(migrateSnapshot(snap)));
    }
    if (fs.existsSync(jF)) {
      const lines = fs.readFileSync(jF, 'utf8').split('\n');
      const tail = lines.pop(); // '' after the last newline, or a torn line (left for the loader to cut)
      if (!fs.existsSync(jF + '.pre-areas')) fs.copyFileSync(jF, jF + '.pre-areas');
      const out = lines.map(l => { try { return JSON.stringify(migrateRecord(JSON.parse(l))); } catch { return l; } });
      writeAtomic(jF, out.join('\n') + (out.length ? '\n' : '') + tail);
    }
    writeAtomic(mark, String(DATA_FORMAT));
    done++;
  }
  if (done) log(`migrated ${done} campaign${done === 1 ? '' : 's'} to areas (format ${DATA_FORMAT}); originals kept as *.pre-areas`);
  return done;
}

function writeAtomic(file, text) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text);
  const fd = fs.openSync(tmp, 'r'); fs.fsyncSync(fd); fs.closeSync(fd);
  fs.renameSync(tmp, file);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) migrateDataDir(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data'));
