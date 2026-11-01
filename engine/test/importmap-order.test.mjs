// The page's import map comes before any module load or preload (Firefox refuses a late import map, and then every bare
// 'three' import fails: "The game did not finish downloading", dev 2026-10-24).   node engine/test/importmap-order.test.mjs
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
const map = html.indexOf('<script type="importmap">');
const firstModule = Math.min(...[/modulepreload/, /type\s*=\s*["']?module/].map((re) => { const m = re.exec(html); return m ? m.index : Infinity; }));
const ok = map >= 0 && map < firstModule;
console.log(ok ? 'import map order: 1/1 passed' : `import map order: FAILED (import map at ${map}, first module load/preload at ${firstModule})`);
process.exit(ok ? 0 : 1);
