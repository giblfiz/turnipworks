// "What is waiting for Harry": live counts for every review queue (2026-10-12, tools/tool-sweep).
// queues.json (written by the sweep on every tuner deploy) says WHO is in each queue; the ratings and bench records say
// what he has already done. The difference is what is waiting. Read-only: this page never writes a record.
// Used twice: the landing page's "Waiting for you" block (compact) and queues/index.html (full, with the sweep's notes).
const BASE = new URL('../', import.meta.url).href;   // .../turnip-works/
const API = '/api/tw-ratings';
const get = (u) => fetch(u, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const touched = (r) => !!r && (Number.isInteger(r.stars) || (r.tags || []).length > 0 || !!(r.note || '').trim());

const CSS = `
#tw-queues{font-family:"DM Mono",ui-monospace,monospace;font-size:13px;line-height:1.5;margin:0 0 2.5rem;color:var(--ink,#2c2218)}
#tw-queues h2{font-family:Fraunces,Georgia,serif;font-weight:900;font-size:clamp(1.5rem,3vw,2.2rem);margin:0 0 .6rem}
#tw-queues .q{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:var(--rule,#d9cbb6);border:1px solid var(--rule,#d9cbb6)}
#tw-queues .q a{display:block;padding:1rem 1.1rem;background:var(--cream,#fffaf2);color:inherit;text-decoration:none}
#tw-queues .q a:hover,#tw-queues .q a:focus-visible{background:var(--leaf,#3f6b3a);color:var(--cream,#fffaf2)}
#tw-queues .n{display:block;font-family:Fraunces,Georgia,serif;font-weight:900;font-size:clamp(1.8rem,4vw,2.8rem);line-height:1.05;font-variant-numeric:tabular-nums}
#tw-queues .of{color:var(--muted,#7a6a58);font-size:.78rem}
#tw-queues .q a:hover .of,#tw-queues .q a:focus-visible .of{color:inherit}
#tw-queues .lab{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem}
#tw-queues .chips{margin:.7rem 0 0;display:flex;flex-wrap:wrap;gap:.35rem}
#tw-queues .chips a{border:1px solid var(--rule,#d9cbb6);border-radius:999px;padding:.12rem .6rem;color:inherit;text-decoration:none;font-size:.76rem;background:var(--cream,#fffaf2)}
#tw-queues .chips a:hover{border-color:var(--turnip,#8a3b2e);color:var(--turnip,#8a3b2e)}
#tw-queues .chips a.done{opacity:.5}
#tw-queues .more{margin:.6rem 0 0;font-size:.76rem;color:var(--muted,#7a6a58)}
#tw-queues .more a{color:inherit}
#tw-queues table{border-collapse:collapse;margin:.4rem 0 1.4rem;font-size:.8rem}
#tw-queues td,#tw-queues th{padding:.2rem .9rem .2rem 0;text-align:left;border-bottom:1px solid var(--rule,#d9cbb6)}
#tw-queues td.r,#tw-queues th.r{text-align:right;font-variant-numeric:tabular-nums}
#tw-queues h3{font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;margin:1.6rem 0 .3rem}
#tw-queues code{font:inherit;background:var(--rule,#d9cbb6);padding:0 .25em;border-radius:3px}
#tw-queues ul{margin:.2rem 0 0;padding-left:1.1rem}
@media (max-width:760px){#tw-queues .q{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;

export async function render(el) {
  if (!document.getElementById('tw-queues-css')) { const s = document.createElement('style'); s.id = 'tw-queues-css'; s.textContent = CSS; document.head.append(s); }
  const full = el.dataset.full === '1';
  el.innerHTML = '<h2>Waiting for you</h2><p class="more">counting…</p>';
  const [Q, ratings, fire, water, hinge, wallfits] = await Promise.all([get(`${BASE}queues/queues.json?t=${Date.now()}`), get(`${API}/ratings`),
    get(`${API}/tuner/fire_anchors`), get(`${API}/tuner/water_surfaces`), get(`${API}/tuner/hinges`), get(`${API}/tuner/wallfits`)]);
  if (!Q) { el.innerHTML = '<h2>Waiting for you</h2><p class="more">The queue lists are missing (queues/queues.json): run tools/spawn-tuner/deploy.sh.</p>'; return null; }
  const R = ratings || {};
  const done = (run, sku) => touched(R[`${run}/${sku}/model`]) || touched(R[`${run}/${sku}/plate`]);
  const rows = [];   // one per batch on a page
  for (const page of Q.rater) for (const [run, skus] of Object.entries(page.runs)) {
    const left = skus.filter(s => !done(run, s)).length;
    rows.push({ run, href: BASE + page.href + (page.batch_links ? `?batch=${encodeURIComponent(run)}` : ''), page: page.href, total: skus.length, left });
  }
  const aligned = (recs, mesh) => !!recs?.[mesh]?.data?.aligned;
  const bench = (mode, recs) => { const all = Q.bench[mode] || []; return { total: all.length, left: all.filter(m => !aligned(recs, m)).length }; };
  const B = { fire: bench('fire', fire), water: bench('water', water), open: bench('open', hinge) };
  // the Wall fit bench: a family is done when Harry approved it (record `family/<name>`); marked pieces are counted beside
  const wf = wallfits || {}, WF = Q.wall_families || [], wfLeft = WF.filter(f => !wf[`family/${f}`]?.data?.approved).length, wfMarks = Object.values(wf).filter(r => r?.data?.mark).length;
  const rate = { total: rows.reduce((s, r) => s + r.total, 0), left: rows.reduce((s, r) => s + r.left, 0) };
  const tile = (href, n, of, lab) => `<a href="${href}"><span class="lab">${lab}</span><span class="n">${n}</span><span class="of">of ${of}</span></a>`;
  const firstOpen = rows.filter(r => r.left).sort((a, b) => (a.page === 'review-lib/' ? 0 : 1) - (b.page === 'review-lib/' ? 0 : 1))[0];
  let html = `<h2>Waiting for you</h2><div class="q">
    ${tile(firstOpen ? firstOpen.href.replace(/\?batch=.*/, '') : `${BASE}review-lib/`, rate.left, rate.total, 'to rate')}
    ${tile(`${BASE}align/?mode=fire&filter=unaligned`, B.fire.left, B.fire.total, 'fire anchors to confirm')}
    ${tile(`${BASE}align/?mode=water&filter=unaligned`, B.water.left, B.water.total, 'water surfaces to confirm')}
    ${tile(`${BASE}align/?mode=open&filter=unaligned`, B.open.left, B.open.total, 'open / shut to confirm')}
    ${tile(`${BASE}tuner/wallbench.html`, wfLeft, WF.length, wfMarks ? `wall families to approve · ${wfMarks} marked` : 'wall families to approve')}</div>`;
  html += `<p class="chips">${rows.map(r => `<a class="${r.left ? '' : 'done'}" href="${r.href}" title="${r.total - r.left} of ${r.total} rated">${esc(r.run)} <b>${r.left}</b></a>`).join('')}</p>`;
  if (!full) html += `<p class="more">To rate, by batch (the number is what is left). <a href="${BASE}queues/">Everything waiting, and what the sweep could not decide →</a> · <a href="${BASE}openclose/pairs/">${Q.pairs} open / shut pairs side by side →</a></p>`;
  if (full) {
    html += `<h3>Asset rater, by batch</h3><table><tr><th>batch</th><th class="r">to rate</th><th class="r">of</th><th>page</th></tr>${rows.map(r => `<tr><td><a href="${r.href}">${esc(r.run)}</a></td><td class="r">${r.left}</td><td class="r">${r.total}</td><td>${esc(r.page)}</td></tr>`).join('')}</table>`;
    const bb = Q.bench_by_batch || {};
    const batches = [...new Set(Object.values(bb).flatMap(o => Object.keys(o)))].sort();
    html += `<h3>Alignment Bench, by batch (in the queue; the tiles above say how many are still unconfirmed)</h3><table><tr><th>batch</th><th class="r">fire</th><th class="r">water</th><th class="r">open / shut</th></tr>${batches.map(b => `<tr><td>${esc(b)}</td><td class="r">${bb.fire?.[b] || ''}</td><td class="r">${bb.water?.[b] || ''}</td><td class="r">${bb.open?.[b] || ''}</td></tr>`).join('')}</table>`;
    html += `<p class="more"><a href="${BASE}openclose/pairs/">${Q.pairs} open / shut pairs, closed beside open →</a> · figures in the game's library: ${Q.figures}</p>`;
    const N = Q.notes || {};
    const NAMES = {
      lit_but_no_flame: 'The catalog says it is a light (aff: lit) but the game gives it no flame, so it has no fire anchor to confirm',
      flame_but_not_lit: 'The game lights it by name but the catalog line does not say lit',
      benchmd_fire_not_lit_by_game: 'A batch BENCH.md lists it under fire, the game does not light it',
      manifest_light_not_lit_by_game: 'A run manifest flags it as a light, the game does not light it',
      water_declared_only_in_bench_md: 'In the water queue because a BENCH.md says so (no bench:water flag in its manifest)',
      open_declared_but_catalog_has_no_open: 'In the open / shut queue because its batch declared it; the catalog line has no aff: open',
      openable_in_no_bench_md: 'Opens by the catalog, on no batch BENCH.md (in the queue all the same)',
      open_twin_missing_closed: 'An open twin whose closed mesh is not in the queue',
      looks_like_water_undeclared: 'Named like something that holds water, declared by nobody (NOT in the water queue)',
      looks_openable_undeclared: 'Named like something that opens, no aff: open and no declaration (NOT in the open / shut queue)',
      bench_md_names_not_in_library: 'Named in a BENCH.md table, not in the library',
    };
    html += '<h3>Where the catalog, the game and the batch lists disagree</h3>';
    const any = Object.entries(N).filter(([, v]) => (Array.isArray(v) ? v.length : Object.keys(v || {}).length));
    html += any.length ? `<ul>${any.map(([k, v]) => `<li>${esc(NAMES[k] || k)}: ${(Array.isArray(v) ? v : Object.keys(v)).map(x => `<code>${esc(x)}</code>`).join(' ')}</li>`).join('')}</ul>` : '<p class="more">Nothing.</p>';
  }
  el.innerHTML = html;
  return { rate, bench: B, rows, walls: { left: wfLeft, total: WF.length, marks: wfMarks } };
}

const el = document.getElementById('tw-queues');
if (el) window.__twQueues = render(el);
