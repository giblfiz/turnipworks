// THE CORPUS OF REAL SAVED CAMPAIGNS the migration checks replay (migrate.test.mjs, areas.test.mjs): "this change
// changes nobody's saved campaign" is only worth saying against campaigns real people and real test runs made.
// It used to be the live relay's own engine/data; the live campaigns were cleared on 2026-10-06 (Harry: nothing on
// live needed preserving), so the 264 that were there are frozen as a fixture, outside the repo (150 MB):
//   TW_CORPUS=<dir>                                              if set
//   /mnt/usb/turnip-works/test-corpus/campaigns-2026-10-06       the frozen fixture (README.txt there)
//   engine/data                                                  when the USB disk is away: whatever is live now
// The suites print which one they used and how many campaigns it holds: a count that drops is the corpus, not the code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE = '/mnt/usb/turnip-works/test-corpus/campaigns-2026-10-06';
export function corpusDir() {
  const has = (d) => { try { return fs.readdirSync(d).some(x => x.startsWith('cmp_')); } catch { return false; } };
  const dir = process.env.TW_CORPUS || (has(FIXTURE) ? FIXTURE : path.join(HERE, '..', 'data'));
  const n = has(dir) ? fs.readdirSync(dir).filter(x => x.startsWith('cmp_')).length : 0;
  console.log(`  (corpus of saved campaigns: ${n} in ${dir}${dir === FIXTURE ? '' : process.env.TW_CORPUS ? ' (TW_CORPUS)' : ' (the frozen fixture is not there: /mnt/usb away?)'})`);
  return dir;
}
