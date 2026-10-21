// Durable storage for one campaign: an append-only JSONL journal plus periodic snapshots.
//
// ONE journal per campaign (not one file per area) on purpose: a cross-area transfer is a single line that
// carries both areas' effects, so it is atomic on disk. Per-area ordering lives inside the records (each effect
// carries its area and that area's seq). A torn last line (crash mid-write) is detected and cut off on load,
// so a record either happened completely or not at all. Every append is fdatasync'd before the relay applies or
// broadcasts it: nothing a client has seen can be lost by a crash or a restart.
//
// data/<campaign>/journal.jsonl   one record per line: { r, at, by, cid, camp?, fx: [{area, seq, type, args, ...}] }
// data/<campaign>/snapshot.json   { r, state, undo, nonces, tails }  (written to .tmp then renamed)
import fs from 'node:fs';
import path from 'node:path';

export class Journal {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'journal.jsonl');
    this.snapFile = path.join(dir, 'snapshot.json');
    this.fd = null;
  }

  // -> { snap, records } where records are those after the snapshot, in order
  load() {
    let snap = null;
    if (fs.existsSync(this.snapFile)) snap = JSON.parse(fs.readFileSync(this.snapFile, 'utf8'));
    const records = [];
    if (fs.existsSync(this.file)) {
      const buf = fs.readFileSync(this.file, 'utf8');
      let good = 0, pos = 0;
      while (pos < buf.length) {
        const nl = buf.indexOf('\n', pos);
        if (nl < 0) break; // torn tail: no newline
        const line = buf.slice(pos, nl);
        let rec;
        try { rec = JSON.parse(line); } catch { break; } // torn or corrupt: stop here
        good = Buffer.byteLength(buf.slice(0, nl + 1));
        if (!snap || rec.r > snap.r) records.push(rec);
        pos = nl + 1;
      }
      const size = fs.statSync(this.file).size;
      if (good < size) { fs.truncateSync(this.file, good); this.truncated = size - good; }
    }
    this.fd = fs.openSync(this.file, 'a');
    return { snap, records };
  }

  append(rec) {
    fs.writeSync(this.fd, JSON.stringify(rec) + '\n');
    fs.fdatasyncSync(this.fd);
  }

  snapshot(obj) {
    const tmp = this.snapFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj));
    const fd = fs.openSync(tmp, 'r'); fs.fsyncSync(fd); fs.closeSync(fd);
    fs.renameSync(tmp, this.snapFile);
  }

  close() { if (this.fd != null) { fs.closeSync(this.fd); this.fd = null; } }
}
