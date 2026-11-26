// THE CORPUS OF REAL SAVED CAMPAIGNS the migration checks replay (migrate.test.mjs, areas.test.mjs): "this change
// changes nobody's saved campaign" is only worth saying against campaigns real people and real test runs made.
// It used to be the live relay's own engine/data; the live campaigns were cleared on 2026-10-06 (Harry: nothing on
// live needed preserving), so the 264 that were there are frozen as a fixture, outside the repo (150 MB):
//   TW_CORPUS=<dir>                                              if set
//   /mnt/usb/turnip-works/test-corpus/campaigns-2026-10-06       the frozen fixture (README.txt there)
//   an empty folder                                              when the USB disk is away: the corpus checks run on nothing
// NEVER engine/data (2026-11-06): since launch that holds strangers' campaigns, and the tests do not read players' maps.
// The suites print which one they used and how many campaigns it holds: a count that drops is the corpus, not the code.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
export const FIXTURE = '/mnt/usb/turnip-works/test-corpus/campaigns-2026-10-06';
export function corpusDir() {
  const has = (d) => { try { return fs.readdirSync(d).some(x => x.startsWith('cmp_')); } catch { return false; } };
  const dir = process.env.TW_CORPUS || (has(FIXTURE) ? FIXTURE : fs.mkdtempSync(path.join(os.tmpdir(), 'tw-no-corpus-')));
  const n = has(dir) ? fs.readdirSync(dir).filter(x => x.startsWith('cmp_')).length : 0;
  console.log(`  (corpus of saved campaigns: ${n} in ${dir}${dir === FIXTURE ? '' : process.env.TW_CORPUS ? ' (TW_CORPUS)' : ' (the frozen fixture is not there: /mnt/usb away? running on none)'})`);
  return dir;
}
