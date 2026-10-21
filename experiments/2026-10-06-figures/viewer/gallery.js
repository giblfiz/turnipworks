// Figure set gallery (2026-10-06). The game's default pawn set, about 450 generated figures arriving in batches.
// The GRID is plain pictures (thumbs/<id>.webp, made by thumbs.py): no 3D until a figure is opened. The INSPECTOR has
// ONE WebGL canvas, made the first time a figure is opened and reused for every figure after; it is the figures
// pilot's scaffolding (viewer/main.js): the game's lighting module, drawing only while something changes, pixel
// ratio capped at 1.5, the base built here and never in the mesh. Data: ./manifest.json (written by the pipeline).
// Nothing on this page is in the game.
// URL: ?shot=<id>&ui=0  the figure alone for a thumbnail (thumbs.py); window.__shot(id) re-aims the same page
//      #<id>            opens that figure      ?api=  another write-back address      ?pr=2  pixel-ratio cap
const V = '__V__';
const qs = new URLSearchParams(location.search);
const $ = (s, el = document) => el.querySelector(s);
const API = qs.get('api') || '/api/tw-ratings';
const SHOT = qs.get('shot');
// The write-back server has no route that reads figures_pilot records back (server/ratings_server.py, 2026-10-06), so
// verdicts shown on this page are the ones remembered in THIS browser. If the server grows a route that answers
// {figure id: latest record}, put its path here (for example 'tuner/figures_pilot_latest') and the page will merge it.
const VERDICT_ROUTE = qs.get('verdicts') || '';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window: nothing is remembered */ } } };

const GROUPS = { hero: 'Heroes', townsfolk: 'Townsfolk', foe: 'Foes', beast: 'Beasts', large: 'Large' };
const GROUP_ONE = { hero: 'Hero', townsfolk: 'Townsfolk', foe: 'Foe', beast: 'Beast', large: 'Large creature' };
const RACES = { human: 'Human', elf: 'Elf', dwarf: 'Dwarf', small: 'Small folk', orc: 'Orc', tiefling: 'Tiefling', dragonborn: 'Dragonborn' };
const GENDERS = { m: 'Men', f: 'Women' };
const SEATS = ['#d9654f', '#6fa8dc', '#e8d46a', '#c58be0', '#6fd0c0', '#f0a04b'];   // the game's six seat colours (the pilot's)
const BASES = { dark: 'Dark disc', rim: 'Coloured rim', ring: 'Ring on the floor', none: 'No base' };
const VIEWS = { table: 'Table distance', lean: 'Leaning in', close: 'Close-up', front: 'Front', side: 'Side', top: 'Top' };
const VERDICTS = { good_miniature: 'Good miniature', not_good_enough: 'Not good enough' };
const FLOOR = ['floor-planks-worn.webp', 'floor-planks-worn--v2.webp', 'floor-planks-worn--v3.webp', 'floor-planks-worn--v4.webp'];   // the inn floor (deploy_set.sh copies them)
const cap = (s) => s ? String(s)[0].toUpperCase() + String(s).slice(1) : '';
const label = (map, k) => map[k] || cap(k);
const when = (iso) => { const d = new Date(iso); if (!iso || isNaN(d)) return ''; const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); return d.toDateString() === new Date().toDateString() ? t : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${t}`; };
const kb = (n) => n == null ? '' : n > 999 ? `${(n / 1024).toFixed(1)} MB` : `${n} KB`;
const ktris = (n) => n == null ? '' : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;

// ---------------------------------------------------------------- what is remembered in this browser
const ui = { view: 'close', base: 'rim', color: 0, night: true, aids: true, auto: true, size: innerWidth < 820 ? 's' : 'm', sort: 'group', ...store.get('tw-figure-set-ui', {}) };
if (!VIEWS[ui.view]) ui.view = 'close'; if (!BASES[ui.base]) ui.base = 'rim'; ui.color = Math.min(5, Math.max(0, ui.color | 0)); ui.spin = false;
const saveUI = () => store.set('tw-figure-set-ui', { view: ui.view, base: ui.base, color: ui.color, night: ui.night, aids: ui.aids, auto: ui.auto, size: ui.size, sort: ui.sort });
let verdicts = store.get('tw-figure-set-verdicts', {});   // id -> { v: good_miniature | not_good_enough, at, note }
if (!verdicts || typeof verdicts !== 'object') verdicts = {};

// ---------------------------------------------------------------- the list of figures
let M = null, FIGS = [], byId = new Map(), latestBatch = null, order = [], pending = null;
const F = { group: '', race: '', gender: '', cls: '', fresh: false, unjudged: false, q: '' };
const tiles = new Map();
const assetV = (f) => encodeURIComponent(f.published_at || M?.updated || V);   // Cloudflare keeps files about four hours: every address carries a stamp
const url = (f, path) => `./${path}?v=${assetV(f)}`;

async function fetchManifest() {
  const r = await fetch(`./manifest.json?v=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(r.status === 404 ? 'there is no list of figures here yet (manifest.json is missing)' : `the server answered ${r.status} for the list of figures`);
  const m = await r.json();
  if (!m || !Array.isArray(m.figures)) throw new Error('the list of figures (manifest.json) is not in the expected form');
  return m;
}
function ingest(m) {
  M = m; FIGS = m.figures.filter(f => f && typeof f.id === 'string' && f.id); byId = new Map(FIGS.map(f => [f.id, f]));
  const nums = FIGS.map(f => f.batch).filter(b => typeof b === 'number');
  latestBatch = m.batch ?? (nums.length ? Math.max(...nums) : null);
  for (const f of FIGS) {
    f.name = f.name || f.id; f.files = f.files || {}; f.tris = f.tris || {}; f.kb = f.kb || {};
    f._new = latestBatch != null && f.batch === latestBatch;
    f._hay = [f.id, f.name, ...(f.tags || []), ...(f.srd || []), f.cls, f.race, RACES[f.race], f.group, GROUPS[f.group], GROUP_ONE[f.group], f.gender === 'm' ? 'man' : f.gender === 'f' ? 'woman' : ''].filter(Boolean).join(' ').toLowerCase();
    f._words = [...new Set(f._hay.split(/[^a-z0-9]+/).filter(Boolean))];
  }
}
// a search word matches the START of any word of a figure ("orc" does not find "sorcerer"); from four letters on it
// may also sit inside a word ("bear" finds "bugbear" and "owlbear")
function matches(f, skip) {
  if (skip !== 'group' && F.group && f.group !== F.group) return false;
  if (skip !== 'race' && F.race && f.race !== F.race) return false;
  if (skip !== 'gender' && F.gender && f.gender !== F.gender) return false;
  if (skip !== 'cls' && F.cls && f.cls !== F.cls) return false;
  if (F.fresh && !f._new) return false;
  if (F.unjudged && verdicts[f.id]) return false;
  for (const w of F._q || []) if (!(f._words.some(x => x.startsWith(w)) || (w.length >= 4 && f._hay.includes(w)))) return false;
  return true;
}
const groupRank = (g) => { const i = Object.keys(GROUPS).indexOf(g); return i < 0 ? 99 : i; };
const sorters = {
  group: (a, b) => groupRank(a.group) - groupRank(b.group) || String(a.group).localeCompare(String(b.group)) || a.name.localeCompare(b.name, undefined, { numeric: true }) || a.id.localeCompare(b.id),
  new: (a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')) || (b.batch ?? 0) - (a.batch ?? 0) || a.name.localeCompare(b.name, undefined, { numeric: true }) || a.id.localeCompare(b.id),
};

// ---------------------------------------------------------------- the grid
const grid = $('#grid');
function makeTile(f) {
  const b = document.createElement('button'); b.className = 'tile'; b.dataset.id = f.id; b.title = f.name;
  b.innerHTML = `<span class="pic${f.thumb ? '' : ' none'}">${f.thumb ? `<img loading="lazy" decoding="async" width="320" height="320" alt="" src="${esc(url(f, f.thumb))}">` : ''}</span><span class="nm">${esc(f.name)}</span>${f._new ? '<span class="new">NEW</span>' : ''}<span class="vd"></span>`;
  const img = b.querySelector('img'); if (img) img.onerror = () => { img.remove(); b.querySelector('.pic').classList.add('none'); };   // a missing picture: the neutral tile, and it still opens
  return b;
}
function markTile(id) {
  const t = tiles.get(id), v = verdicts[id]?.v; if (!t) return;
  t.classList.toggle('good', v === 'good_miniature'); t.classList.toggle('bad', v === 'not_good_enough');
  t.querySelector('.vd').textContent = v === 'good_miniature' ? '✓ Good' : v === 'not_good_enough' ? '✕ Not good' : '';
}
let builtFor = null, sortedFor = '';
function buildTiles() {   // one tile per figure, made once; filters only hide and show them
  for (const [id, t] of tiles) if (!byId.has(id) || t._stamp !== assetV(byId.get(id)) + '|' + byId.get(id).thumb + '|' + byId.get(id).name + '|' + byId.get(id)._new) { t.remove(); tiles.delete(id); }
  for (const f of FIGS) if (!tiles.has(f.id)) { const t = makeTile(f); t._stamp = assetV(f) + '|' + f.thumb + '|' + f.name + '|' + f._new; tiles.set(f.id, t); markTile(f.id); }
  builtFor = M; sortedFor = '';
}
function option(sel, value, text) { const o = document.createElement('option'); o.value = value; o.textContent = text; sel.append(o); return o; }
const btn = (text, on, data = {}) => { const b = document.createElement('button'); b.innerHTML = text; Object.assign(b.dataset, data); b.onclick = on; return b; };
function facetButtons(el, key, map, allLabel) {   // "All 450 · Heroes 185 · …": the number is what you would see with the other filters as they are
  const count = {}; let all = 0; for (const f of FIGS) if (matches(f, key)) { all++; if (f[key] != null) count[f[key]] = (count[f[key]] || 0) + 1; }
  const keys = [...new Set([...Object.keys(map), ...FIGS.map(f => f[key]).filter(v => v != null)])].filter(k => FIGS.some(f => f[key] === k));
  el.innerHTML = '';
  const add = (k, text, n) => { const b = btn(`${esc(text)}<span class="n">${n}</span>`, () => { F[key] = k; if (key === 'group') F.cls = ''; apply(); }); b.classList.toggle('on', F[key] === k); b.classList.toggle('zero', !n); b.dataset[key] = k; el.append(b); };
  add('', allLabel, all); for (const k of keys) add(k, label(map, k), count[k] || 0);
}
function apply() {
  if (!M) return;
  if (builtFor !== M) buildTiles();
  F._q = F.q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const sorted = [...FIGS].sort(sorters[ui.sort] || sorters.group), key = ui.sort + '|' + FIGS.length;
  if (sortedFor !== key) { grid.append(...sorted.map(f => tiles.get(f.id))); sortedFor = key; }
  order = [];
  for (const f of sorted) { const ok = matches(f); tiles.get(f.id).hidden = !ok; if (ok) order.push(f.id); }
  // the filter controls, with counts
  facetButtons($('#groups'), 'group', GROUPS, 'All'); facetButtons($('#races'), 'race', RACES, 'Any'); facetButtons($('#genders'), 'gender', GENDERS, 'Either');
  const sel = $('#cls'), cc = {}; for (const f of FIGS) if (f.cls && matches(f, 'cls')) cc[f.cls] = (cc[f.cls] || 0) + 1;
  sel.innerHTML = ''; option(sel, '', 'Any class or role');
  const gs = [...new Set(FIGS.map(f => f.group))].sort((a, b) => groupRank(a) - groupRank(b)).filter(g => !F.group || g === F.group);
  for (const g of gs) { const names = [...new Set(FIGS.filter(f => f.group === g && f.cls).map(f => f.cls))].sort(); if (!names.length) continue; const og = document.createElement('optgroup'); og.label = label(GROUPS, g); for (const c of names) option(og, c, `${cap(c)} (${cc[c] || 0})`); sel.append(og); }
  sel.value = F.cls; if (sel.value !== F.cls) { option(sel, F.cls, cap(F.cls)); sel.value = F.cls; }
  $('#l-fresh').classList.toggle('on', F.fresh); $('#l-unjudged').classList.toggle('on', F.unjudged); $('#fresh').checked = F.fresh; $('#unjudged').checked = F.unjudged;
  $('#sort').value = ui.sort;
  const filtered = !!(F.group || F.race || F.gender || F.cls || F.fresh || F.unjudged || F._q.length);
  $('#clear').style.display = filtered ? '' : 'none';
  $('#shown').textContent = !FIGS.length ? '' : filtered ? `Showing ${order.length} of ${FIGS.length}` : `Showing all ${FIGS.length}`;
  const empty = $('#empty'); empty.className = '';
  if (!FIGS.length) { empty.style.display = 'block'; empty.textContent = 'No figures have been published yet. They arrive in batches through the day; this page looks again every two minutes.'; }
  else if (!order.length) { empty.style.display = 'block'; empty.innerHTML = 'No figure matches these filters.<br><button id="clear2">Clear filters</button>'; $('#clear2').onclick = clearFilters; }
  else empty.style.display = 'none';
  header();
  window.__gal.shown = order;
}
function header() {
  const n = FIGS.length, exp = M.expected_total, fresh = FIGS.filter(f => f._new), since = fresh.map(f => f.published_at).filter(Boolean).sort()[0] || M.updated;
  const judged = FIGS.filter(f => verdicts[f.id]), good = judged.filter(f => verdicts[f.id].v === 'good_miniature').length;
  $('#counts').innerHTML = `<span><b>${n}</b> ${exp ? `of about ${esc(exp)} figures` : n === 1 ? 'figure' : 'figures'}</span>`
    + (M.updated ? `<span>updated ${esc(when(M.updated))}</span>` : '')
    + (fresh.length ? `<span><b>${fresh.length}</b> NEW since ${esc(when(since))}</span>` : '')
    + `<span id="judged">${judged.length ? `<b>${judged.length}</b> judged: ${good} good, ${judged.length - good} not` : 'none judged yet'}</span>`
    + (M.fixture ? '<span class="warn">TEST DATA: six pilot figures repeated under made-up names</span>' : '');
}
function clearFilters() { Object.assign(F, { group: '', race: '', gender: '', cls: '', fresh: false, unjudged: false, q: '' }); $('#q').value = ''; apply(); }
function setSize(s) { ui.size = s; document.documentElement.style.setProperty('--tile', { s: '124px', m: '168px', l: '236px' }[s] || '168px'); document.documentElement.style.setProperty('--cols', { s: 3, m: 2, l: 1 }[s] || 2); document.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('on', b.dataset.size === s)); saveUI(); }
function wireGrid() {
  for (const [k, text] of [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']]) $('#sizes').append(btn(text, () => setSize(k), { size: k }));
  setSize(ui.size);
  let t = 0; $('#q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { F.q = e.target.value; apply(); }, 60); });
  $('#cls').onchange = (e) => { F.cls = e.target.value; apply(); };
  $('#fresh').onchange = (e) => { F.fresh = e.target.checked; apply(); }; $('#unjudged').onchange = (e) => { F.unjudged = e.target.checked; apply(); };
  $('#sort').onchange = (e) => { ui.sort = e.target.value; saveUI(); apply(); };
  $('#clear').onclick = clearFilters;
  $('#more-btn').onclick = () => { const on = $('#top').classList.toggle('more'); $('#more-btn').textContent = on ? 'Fewer filters' : 'More filters'; };
  grid.addEventListener('click', (e) => { const t = e.target.closest('.tile'); if (t) openFigure(t.dataset.id); });
  $('#arrived-go').onclick = () => { if (pending) { ingest(pending); pending = null; } $('#arrived').style.display = 'none'; apply(); };
}
// the set grows through the day: look again every two minutes and offer the new ones (the grid never jumps by itself)
async function lookAgain() {
  if (document.hidden || SHOT) return;
  try {
    const m = await fetchManifest(); if (m.updated === M.updated && m.figures.length === M.figures.length) return;
    if (!FIGS.length && !document.body.classList.contains('open')) { ingest(m); apply(); return; }
    pending = m; const more = m.figures.filter(f => f && !byId.has(f.id)).length;
    $('#arrived-text').textContent = more ? `${more} more ${more === 1 ? 'figure has' : 'figures have'} arrived (${when(m.updated)}).` : `The set was updated at ${when(m.updated)}.`; $('#arrived').style.display = 'block';
  } catch { /* a missed look is not worth a message: the next one is in two minutes */ }
}

// ---------------------------------------------------------------- the inspector (panel side; the 3D is in engine())
let cur = null, navList = [], sending = false;
const typing = (el) => el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(el.type)));
const recTier = (f) => f.files[f.recommended] ? f.recommended : f.files.hero ? 'hero' : f.files.horde ? 'horde' : f.files.full ? 'full' : null;
function tierOptions(f) {   // the game's file first, then the other light file, then the original
  const rec = recTier(f), out = [];
  if (rec) out.push([rec, rec === 'full' ? 'Original' : 'Game file']);
  for (const t of ['hero', 'horde']) if (t !== rec && f.files[t]) out.push([t, (f.tris[t] ?? 0) > (f.tris[rec] ?? 0) ? 'Finer file' : 'Lighter file']);
  if (rec !== 'full' && f.files.full) out.push(['full', 'Original']);
  return out;
}
function busy(text, err = false) { const b = $('#busy'); b.textContent = text || ''; b.className = err ? 'err' : ''; b.style.display = text ? 'block' : 'none'; }
function fillPanel(f) {
  $('#f-name').textContent = f.name; $('#f-new').style.display = f._new ? '' : 'none'; $('#f-id').textContent = f.id;
  $('#f-what').textContent = [label(GROUP_ONE, f.group), f.race && label(RACES, f.race), f.gender === 'm' ? 'man' : f.gender === 'f' ? 'woman' : null, f.cls && cap(f.cls)].filter(Boolean).join(' · ');
  const i = navList.indexOf(f.id); $('#pos').textContent = i >= 0 ? `${i + 1} of ${navList.length}` : ''; $('#prev').disabled = i <= 0; $('#next').disabled = i < 0 || i >= navList.length - 1;
  const q = f.qa, rows = [], row = (k, v) => { if (v) rows.push(`<dt>${k}</dt><dd>${v}</dd>`); }, pct = (v) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
  row('Stands in for', (f.srd || []).length ? f.srd.map(s => `<span class="tag">${esc(s)}</span>`).join('') : '');
  row('Tags', (f.tags || []).length ? f.tags.map(s => `<span class="tag">${esc(s)}</span>`).join('') : '');
  row('Height', f.height_ft != null ? `${esc(f.height_ft)} ft stated${f.overall_ft != null ? `, ${esc(f.overall_ft)} ft to its highest point` : ''}` : f.overall_ft != null ? `${esc(f.overall_ft)} ft to its highest point` : '');
  row('Base', f.base_ft != null ? `${esc(f.base_ft)}-ft square (${f.base_ft > 5 ? `${Math.round(f.base_ft / 5) ** 2} squares of the grid` : 'one square of the grid'}); the disc is drawn ${(f.base_ft * 0.9).toFixed(1)} ft wide` : '');
  row('Files', tierOptions(f).map(([t, name]) => `${name}${t === recTier(f) && t !== 'full' ? ' (used in the game)' : ''}: ${[f.tris[t] != null && `${Number(f.tris[t]).toLocaleString()} triangles`, kb(f.kb[t])].filter(Boolean).join(', ') || 'size not recorded'}`).join('<br>'));
  if (q) {
    const bits = [q.verdict && `result: ${esc(q.verdict)}`, q.unpainted_seen != null && `unpainted ${pct(q.unpainted_seen)} of what you can see`, q.floating != null && `<span class="${q.floating ? 'warn' : ''}">${esc(q.floating)} loose ${q.floating === 1 ? 'bit' : 'bits'}</span>`, q.contacts != null && `${esc(q.contacts)} ${q.contacts === 1 ? 'point' : 'points'} touching the ground`, q.reach_ft != null && `reaches ${esc(q.reach_ft)} ft from the middle of its base`].filter(Boolean);
    row('Automatic checks', `<ul class="notes">${[...bits, ...(q.notes || []).map(n => `<span class="warn">${esc(n)}</span>`)].map(x => `<li>${x}</li>`).join('')}</ul>`);
  }
  row('Gemini, shown it blind', f.gemini?.blind ? `"${esc(f.gemini.blind)}"` : '');
  row('Arrived', [f.batch != null && `batch ${esc(f.batch)}`, when(f.published_at)].filter(Boolean).join(', '));
  $('#facts').innerHTML = rows.join('') || '<dt>Facts</dt><dd>None recorded for this figure.</dd>';
  const el = $('#tiers'); el.querySelectorAll('button').forEach(b => b.remove());
  for (const [t, name] of tierOptions(f)) el.append(btn(`${esc(name)}<span class="n">${[ktris(f.tris[t]), kb(f.kb[t])].filter(Boolean).join(' · ')}</span>`, () => showFigure(f, t), { tier: t }));
  syncPanel(); showVerdict(f);
}
function showVerdict(f, text, err) {
  const v = verdicts[f.id];
  $('#v-good').classList.toggle('on', v?.v === 'good_miniature'); $('#v-bad').classList.toggle('on', v?.v === 'not_good_enough');
  const s = $('#sent'); s.className = err ? 'err' : '';
  s.textContent = text ?? (v ? `Your verdict: "${VERDICTS[v.v]}" (${when(v.at)})${v.note ? `, with the note "${v.note}"` : ''}. Press the other button to change it.` : '');
}
function syncPanel() {
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === ui.view));
  document.querySelectorAll('[data-base]').forEach(b => b.classList.toggle('on', b.dataset.base === ui.base));
  document.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('on', +b.dataset.color === ui.color));
  document.querySelectorAll('[data-tier]').forEach(b => b.classList.toggle('on', b.dataset.tier === cur?.tier));
  $('#look-night').classList.toggle('on', ui.night); $('#look-day').classList.toggle('on', !ui.night);
  $('#spin').checked = ui.spin; $('#l-spin').classList.toggle('on', ui.spin); $('#aids').checked = ui.aids; $('#l-aids').classList.toggle('on', ui.aids); $('#auto').checked = ui.auto;
}
function openFigure(id) {
  const f = byId.get(id); if (!f) return;
  if (!document.body.classList.contains('open')) { navList = order.includes(id) ? [...order] : [...order, id]; document.body.classList.add('open'); $('#insp').setAttribute('aria-hidden', 'false'); document.activeElement?.blur?.(); }
  history.replaceState(null, '', '#' + encodeURIComponent(id));
  showFigure(f, recTier(f));
}
async function showFigure(f, tier) {
  cur = { f, tier, loaded: false }; window.__gal.cur = { id: f.id, tier, loaded: false };
  fillPanel(f);
  if (!tier) { busy('This figure has no 3D file listed yet.', true); engine().then(e => e.clear()).catch(() => {}); return; }
  let e; try { e = await engine(); } catch { return; }   // the reason is already on the page
  if (!cur || cur.f !== f || cur.tier !== tier) return;
  await e.show(f, tier);
  if (cur && cur.f === f && cur.tier === tier && !SHOT) { const i = navList.indexOf(f.id), nx = byId.get(navList[i + 1]); if (nx && recTier(nx)) e.preload(nx, recTier(nx)); }   // the next figure's game file, quietly
}
function step(d) { if (!cur) return; const i = navList.indexOf(cur.f.id), id = navList[i + d]; if (id) openFigure(id); }
function closeFigure() {
  if (!document.body.classList.contains('open')) return;
  document.body.classList.remove('open'); $('#insp').setAttribute('aria-hidden', 'true'); history.replaceState(null, '', location.pathname + location.search);
  const id = cur?.f.id; cur = null; window.__gal.cur = null; ui.spin = false; busy('');
  enginePromise?.then(e => e.sleep()).catch(() => {});
  apply();   // "not judged yet" catches up with what was judged while the inspector was open
  const t = tiles.get(id); if (t && !t.hidden) { t.scrollIntoView({ block: 'nearest' }); t.focus({ preventScroll: true }); }
}
async function sendVerdict(verdict) {
  if (!cur || sending) return; const f = cur.f, box = $('#note'), note = box.value.trim(); sending = true;
  showVerdict(f, 'Sending…');
  try {
    const cam = (await enginePromise?.catch(() => null))?.cameraNow() ?? null;
    const r = await fetch(`${API}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'figures_pilot', name: f.id, note,
      data: { verdict, figure: f.id, page: 'gallery', base: ui.base, seat_colour: SEATS[ui.color], tier: cur?.f === f ? cur.tier : recTier(f), night: ui.night, camera: cam, v: V, screen: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio }, ua: navigator.userAgent } }) });
    let j = {}; try { j = await r.json(); } catch { /* not JSON: the status says enough */ }
    if (!r.ok || !j.ok) throw new Error(j.err || `the server answered ${r.status}`);
    verdicts[f.id] = { v: verdict, at: new Date().toISOString(), note }; store.set('tw-figure-set-verdicts', verdicts); markTile(f.id); header(); box.value = '';
    const said = `Sent ${new Date().toLocaleTimeString()}: "${VERDICTS[verdict]}" for ${f.name}.`;
    window.__gal.lastSent = { id: f.id, verdict, answer: j };
    const i = navList.indexOf(f.id);
    if (ui.auto && cur?.f === f && navList[i + 1]) { openFigure(navList[i + 1]); showVerdict(cur.f, `${said} Now: ${cur.f.name}.${verdicts[cur.f.id] ? ` (Already judged: "${VERDICTS[verdicts[cur.f.id].v]}".)` : ''}`); }
    else if (cur?.f === f) showVerdict(f, said + (ui.auto ? ' That was the last one in this list.' : ''));
  } catch (err) { if (cur?.f === f) showVerdict(f, `Could not send the verdict, so it is not recorded: ${err.message}. Try again.`, true); }
  sending = false;
}
function wireInspector() {
  for (const [k, text] of Object.entries(VIEWS)) $('#views').append(btn(text, () => { ui.view = k; saveUI(); syncPanel(); enginePromise?.then(e => e.setView(k)); }, { view: k }));
  for (const [k, text] of Object.entries(BASES)) $('#bases').append(btn(text, () => { ui.base = k; saveUI(); syncPanel(); enginePromise?.then(e => e.refreshBase()); }, { base: k }));
  SEATS.forEach((c, i) => { const b = btn('', () => { ui.color = i; saveUI(); syncPanel(); enginePromise?.then(e => e.refreshBase()); }, { color: i }); b.className = 'sw'; b.style.background = c; b.title = `Seat colour ${i + 1}`; $('#colors').append(b); });
  const look = (night) => { ui.night = night; saveUI(); syncPanel(); enginePromise?.then(e => e.applyLook()); };
  $('#look-night').onclick = () => look(true); $('#look-day').onclick = () => look(false);
  $('#spin').onchange = (e) => { ui.spin = e.target.checked; syncPanel(); enginePromise?.then(en => en.spin()); };
  $('#aids').onchange = (e) => { ui.aids = e.target.checked; saveUI(); syncPanel(); enginePromise?.then(en => en.aids()); };
  $('#auto').onchange = (e) => { ui.auto = e.target.checked; saveUI(); };
  $('#close').onclick = closeFigure; $('#prev').onclick = () => step(-1); $('#next').onclick = () => step(1);
  $('#v-good').onclick = () => sendVerdict('good_miniature'); $('#v-bad').onclick = () => sendVerdict('not_good_enough');
  $('#copy').onclick = async () => { const b = $('#copy'); try { await navigator.clipboard.writeText($('#f-id').textContent); b.textContent = 'Copied'; } catch { const r = document.createRange(); r.selectNodeContents($('#f-id')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Selected: press Ctrl or Cmd + C'; } setTimeout(() => { b.textContent = 'Copy id'; }, 1800); };
  addEventListener('keydown', (e) => {
    if (!document.body.classList.contains('open') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { if (typing(e.target)) e.target.blur(); else closeFigure(); e.preventDefault(); return; }
    if (typing(e.target)) return;
    const k = e.key.toLowerCase();
    if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); else if (k === 'g') sendVerdict('good_miniature'); else if (k === 'b') sendVerdict('not_good_enough'); else return;
    e.preventDefault();
  });
}

// ---------------------------------------------------------------- the 3D: made on first use, one canvas for every figure
let enginePromise = null;
function engine() { return enginePromise ??= buildEngine(); }
async function buildEngine() {
  const stage = $('#stage'), canvas = $('#c'), num = (k, d) => qs.has(k) && isFinite(+qs.get(k)) ? +qs.get(k) : d;
  let THREE, GLTFLoader, OrbitControls, MeshoptDecoder;
  busy('Starting the 3D view…');
  try { [THREE, { GLTFLoader }, { OrbitControls }, { MeshoptDecoder }] = await Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js'), import('three/addons/controls/OrbitControls.js'), import('three/addons/libs/meshopt_decoder.module.js')]); }
  catch (e) { busy('The 3D drawing code could not be fetched (it comes from cdn.jsdelivr.net). Check the connection and reload the page. The pictures in the grid do not need it.', true); throw e; }
  let renderer, dead = false;
  let wakeUntil = performance.now() + 1500, wakeMin = 3, drawn = 0, last = performance.now(), running = false, lighting = null, LB = null;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); dead = true; busy('The browser dropped the 3D picture (WebGL context lost). Reload the page; if it happens again, tell Fauna which browser this is and read out the line at the bottom right.', true); });
  canvas.addEventListener('webglcontextrestored', () => { dead = false; busy(''); lighting?.markDirty?.(); poke(120); });
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!SHOT || qs.has('capture') }); }
  catch (e) { busy(`This browser would not start WebGL, so a figure cannot be shown in 3D (${e.message}). The pictures in the grid still work.`, true); throw e; }
  // Pixel ratio capped at 1.5, as the pilot: the lighting stack costs per pixel.
  renderer.setPixelRatio(Math.min(num('pr', 1.5), devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SHOT ? '#0b0a09' : '#070605');
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2000);          // the game's camera
  const hemi = new THREE.HemisphereLight('#fff4e0', '#3a3428', 1.7);      // the tuner's light rig, same numbers as the pilot
  const sun = new THREE.DirectionalLight('#fff1dc', 1.9); sun.position.set(-120, 120, 100); sun.target.position.set(0, 0, 0);
  scene.add(hemi, sun, sun.target);
  const controls = new OrbitControls(camera, canvas); controls.maxPolarAngle = Math.PI / 2 - 0.02; controls.minDistance = 3; controls.maxDistance = 400;
  if (!qs.has('nofx')) {
    try { const m = await import(`./lib/lighting.js?v=${V}`); lighting = m.createLighting({ renderer, scene, camera, hemi, sun, focus: () => controls.target }); LB = m.LIGHT_BUILTINS; }
    catch (e) { console.warn('house lighting not loaded, plain render', e); }
  }
  const night = () => SHOT ? false : ui.night;   // a thumbnail is taken in the day look so colours read
  function applyLook() { if (!lighting) { hemi.intensity = night() ? 0.6 : 1.7; sun.intensity = night() ? 0.5 : 1.9; } else { lighting.set(night() ? LB.night() : LB.day()); lighting.markDirty(); } poke(90); }

  // ---- the stand: plank floor, grid, footprint, pole, one warm lamp (the pilot's "alone" scene)
  const CELL = 5, DISC_H = 0.3, rad = THREE.MathUtils.degToRad;
  const world = new THREE.Group(), standG = new THREE.Group(), aidsG = new THREE.Group(), pawn = new THREE.Group(); scene.add(world); world.add(standG, aidsG, pawn);
  const texLoader = new THREE.TextureLoader();
  const floorMats = SHOT ? [] : FLOOR.map(f => { const t = texLoader.load(`./tex/${f}?v=${V}`, () => { lighting?.markDirty?.(); poke(); }); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }); });
  const tileGeo = new THREE.PlaneGeometry(CELL, CELL).rotateX(-Math.PI / 2), poleGeo = new THREE.BoxGeometry(0.12, 1, 0.12);
  const poleMats = ['#7a3b2e', '#d8d2c0'].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  const lineMat = new THREE.LineBasicMaterial({ color: '#f0e2b8', transparent: true, opacity: 0.4, depthWrite: false }), footMat = new THREE.LineBasicMaterial({ color: '#f0e2b8', transparent: true, opacity: 0.95, depthWrite: false });
  const lamp = new THREE.PointLight('#ffa040', 14, 42, 1.4); lamp.position.set(6, 8, 8); lamp.userData = { priority: 3, fx: true };
  if (!SHOT) { const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.2, 1.1) })); ball.userData.fx = true; lamp.add(ball);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0e0c0a', roughness: 1 })); far.position.y = -0.05; world.add(far); }
  world.add(lamp); lighting?.setFireLights([lamp]);
  let standCells = 0, lineGeos = [];
  function buildStand(f) {   // a 5-ft figure stands in the middle of one square; a 10-ft one covers four, centred where they meet
    const cells = Math.max(1, Math.round((f.base_ft || 5) / CELL)), n = cells + 4, half = n * CELL / 2;
    if (!SHOT && cells !== standCells) {
      standCells = cells; standG.clear(); for (const g of lineGeos) g.dispose(); lineGeos = []; for (const c of [...aidsG.children]) if (c.userData.lines) aidsG.remove(c);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const m = new THREE.Mesh(tileGeo, floorMats[(i * 7 + j * 3) % floorMats.length]); m.position.set(i * CELL + 2.5 - half, 0, j * CELL + 2.5 - half); m.receiveShadow = true; standG.add(m); }
      const p = []; for (let i = 0; i <= n; i++) { const v = i * CELL - half; p.push(v, 0.04, -half, v, 0.04, half, -half, 0.04, v, half, 0.04, v); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); const l = new THREE.LineSegments(g, lineMat); l.userData = { fx: true, lines: true };
      const s = cells * CELL / 2, g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute([-s, 0.05, -s, s, 0.05, -s, s, 0.05, -s, s, 0.05, s, s, 0.05, s, -s, 0.05, s, -s, 0.05, s, -s, 0.05, -s], 3));
      const sq = new THREE.LineSegments(g2, footMat); sq.userData = { fx: true, lines: true }; lineGeos.push(g, g2); aidsG.add(l, sq);   // the brighter square: the space this figure takes on the grid
    }
    for (const c of [...aidsG.children]) if (c.userData.pole) aidsG.remove(c);
    if (!SHOT) { const pole = new THREE.Group(); pole.userData.pole = true; const h = Math.max(1, Math.ceil(f.overall_ft || f.height_ft || 6));
      for (let i = 0; i < h; i++) { const m = new THREE.Mesh(poleGeo, poleMats[i % 2]); m.position.y = i + 0.5; m.castShadow = m.receiveShadow = true; pole.add(m); }
      pole.position.set(-(baseRadius(f) + 0.95), 0, -1.5); aidsG.add(pole); }
    standG.visible = !SHOT; aidsG.visible = !SHOT && ui.aids;
  }

  // ---- the base, built here and never in the mesh (the pilot's makeBase; the disc is 90 % of the square wide)
  const baseRadius = (f) => (f.base_ft || 5) / 2 * 0.9;
  let baseG = null;
  const freeBase = () => { baseG?.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); if (baseG) pawn.remove(baseG); baseG = null; };
  function arrow(r, y, color, flat) {   // the facing mark: a small arrowhead at the front edge (+Z)
    const s = new THREE.Shape(), w = 0.6, l = 0.8; s.moveTo(-w, 0); s.lineTo(w, 0); s.lineTo(0, l); s.closePath();
    const geo = flat ? new THREE.ShapeGeometry(s) : new THREE.ExtrudeGeometry(s, { depth: y, bevelEnabled: false }); geo.rotateX(Math.PI / 2); geo.translate(0, y, 0);
    const m = new THREE.Mesh(geo, flat ? new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }) : new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide }));
    m.position.z = r - 0.04; if (!flat) m.castShadow = m.receiveShadow = true; m.userData.fx = flat; return m;
  }
  function makeBase(f) {
    const kind = SHOT ? 'rim' : ui.base, g = new THREE.Group(), r = baseRadius(f), col = SEATS[SHOT ? num('color', 0) : ui.color]; let top = 0;
    if (kind === 'dark' || kind === 'rim') {
      top = DISC_H; const k = kind === 'rim' ? 0.9 : 1;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * k, r * k, DISC_H, 48), new THREE.MeshStandardMaterial({ color: '#1d1b19', roughness: 0.7 })); disc.position.y = DISC_H / 2; g.add(disc);
      if (kind === 'rim') { const pts = [new THREE.Vector2(r * 0.9, DISC_H), new THREE.Vector2(r * 0.97, DISC_H - 0.02), new THREE.Vector2(r, DISC_H * 0.6), new THREE.Vector2(r, 0)];
        g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 64), new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, emissive: col, emissiveIntensity: 0.25, side: THREE.DoubleSide }))); }
      g.add(arrow(r, DISC_H * 0.6, kind === 'rim' ? col : '#d8d2c0', false));
      g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    } else if (kind === 'ring') {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.88, r, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.045; ring.userData.fx = true; g.add(ring, arrow(r, 0.045, col, true));
    }
    g.userData.top = top; return g;
  }
  function refreshBase() { if (!shown) return; freeBase(); baseG = makeBase(shown.f); pawn.add(baseG); shown.prep.root.position.y = baseG.userData.top; lighting?.markDirty?.(); poke(60); }

  // ---- figure files: a few kept parsed (the one on show, the next, the last two), their GPU memory given back the moment they leave the stand
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const cache = new Map(); let shown = null, showNo = 0, wanted = '';
  const KEEP = 4;
  function prepare(gltf, f, tier) {   // identical to makeFigure() in the pilot's main.js
    const src = gltf.scene, geos = new Set(), texs = new Set(), mats = [];
    src.traverse(o => { if (!o.isMesh) return; const old = o.material, map = old.map || null, normalMap = old.normalMap || null;
      for (const k of ['metalnessMap', 'roughnessMap', 'aoMap', 'emissiveMap', 'alphaMap']) { const t = old[k]; if (t && t !== map && t !== normalMap) { t.dispose(); t.image?.close?.(); } }
      o.material = new THREE.MeshStandardMaterial({ map, normalMap, color: map ? '#ffffff' : old.color, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });   // the game's treatment: colour map only, matte
      old.dispose(); o.castShadow = o.receiveShadow = true; geos.add(o.geometry); mats.push(o.material); if (map) texs.add(map); if (normalMap) texs.add(normalMap); });
    const nb = f.native_bounds;
    if (tier !== 'full' && Array.isArray(nb)) {   // a lighter copy may be in other units: fit its box to the original's
      const b = new THREE.Box3().setFromObject(src), [lo, hi] = nb, k = (hi[1] - lo[1]) / (b.max.y - b.min.y);
      src.scale.setScalar(k); src.position.set((lo[0] + hi[0]) / 2 - (b.min.x + b.max.x) / 2 * k, lo[1] - b.min.y * k, (lo[2] + hi[2]) / 2 - (b.min.z + b.max.z) / 2 * k);
    }
    const turn = new THREE.Group(), root = new THREE.Group(); turn.add(src); root.add(turn); turn.rotation.y = rad(f.facing_deg || 0);
    if (f.scale != null && f.y0 != null) { turn.scale.setScalar(f.scale); turn.position.set(-(f.centre?.[0] || 0), -f.y0, -(f.centre?.[1] || 0)); }
    else {   // no measurements for this one yet: stand it on the floor at its stated height, centred
      const b0 = new THREE.Box3().setFromObject(turn), k = (f.overall_ft || f.height_ft || 6) / Math.max(1e-6, b0.max.y - b0.min.y);
      turn.scale.setScalar(k); turn.position.set(-(b0.min.x + b0.max.x) / 2 * k, -b0.min.y * k, -(b0.min.z + b0.max.z) / 2 * k);
    }
    return { root, geos, texs, mats };
  }
  const release = (p) => { for (const g of p.geos) g.dispose(); for (const t of p.texs) t.dispose(); };                                   // GPU memory back; the parsed file stays
  const destroy = (p) => { release(p); for (const m of p.mats) m.dispose(); for (const t of p.texs) t.image?.close?.(); };
  function load(f, tier) {
    const key = url(f, f.files[tier]); let e = cache.get(key);
    if (!e) { e = { key, dead: false, prep: null }; cache.set(key, e);
      e.promise = loader.loadAsync(key).then(g => { e.prep = prepare(g, f, tier); if (e.dead) destroy(e.prep); return e.prep; }, err => { cache.delete(key); throw err; }); }
    cache.delete(key); cache.set(key, e);   // most recently wanted last
    for (const [k, old] of cache) { if (cache.size <= KEEP) break; if (k === key || k === wanted || old === shown?.entry) continue; cache.delete(k); old.dead = true; if (old.prep) destroy(old.prep); }
    return e;
  }
  function clear() { if (shown) { pawn.remove(shown.prep.root); release(shown.prep); shown = null; } freeBase(); pawn.rotation.y = 0; lighting?.markDirty?.(); poke(30); }
  async function show(f, tier) {
    const my = ++showNo; wanted = url(f, f.files[tier]); wake(); clear(); buildStand(f);
    const t0 = performance.now(), entry = load(f, tier), slow = setTimeout(() => { if (my === showNo) busy(`Fetching ${f.name}${f.kb?.[tier] ? ` (${kb(f.kb[tier])})` : ''}…`); }, 180);
    if (!dead) busy('');
    let prep; try { prep = await entry.promise; } catch (err) { clearTimeout(slow); if (my === showNo) busy(`The 3D file for ${f.name} could not be fetched (${/404/.test(err?.message || '') ? 'the server says it is not there' : 'the download failed'}: ${f.files[tier]}). The other detail buttons may still work.`, true); return false; }
    clearTimeout(slow); if (my !== showNo) return false;
    if (!dead) busy('');
    baseG = makeBase(f); prep.root.position.y = baseG.userData.top; pawn.add(baseG, prep.root); shown = { f, tier, prep, entry };
    pawn.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(prep.root);
    shown.h = Math.max(1, box.max.y); shown.w = Math.max(baseRadius(f) * 2, box.max.x - box.min.x, box.max.z - box.min.z);
    if (SHOT) frameShot(); else setView(ui.view);
    lighting?.markDirty?.(); poke(120);
    if (cur && cur.f === f && cur.tier === tier) { cur.loaded = true; window.__gal.cur = { id: f.id, tier, loaded: true, ms: Math.round(performance.now() - t0) }; }
    syncPanel(); return true;
  }
  const preload = (f, tier) => { load(f, tier).promise.catch(() => {}); };

  // ---- cameras. Table distance and Leaning in are the game's own (52 degrees down from 78 ft; 38 degrees from 45 ft)
  function setView(name) {
    if (!shown) return; const h = shown.h, m = Math.max(h, shown.w * 0.85), narrow = Math.min(2.4, Math.max(1, 1.15 / camera.aspect));
    const v = { table: { yaw: -20, pitch: 52, dist: 78, c: 2 }, lean: { yaw: -14, pitch: 38, dist: 45, c: 2 }, close: { yaw: 18, pitch: 14, dist: (5 + m * 2.1) * narrow, c: h * 0.5 },
      front: { yaw: 0, pitch: 4, dist: (5 + m * 2.2) * narrow, c: h * 0.5 }, side: { yaw: 90, pitch: 4, dist: (5 + m * 2.2) * narrow, c: h * 0.5 }, top: { yaw: 0, pitch: 89, dist: (9 + m * 1.6) * narrow, c: h * 0.5 } }[name] || {};
    place(v.yaw, v.pitch, v.dist, [0, v.c, 0]);
  }
  function place(yawDeg, pitchDeg, dist, c) {
    const yaw = rad(yawDeg), pitch = rad(pitchDeg); controls.target.set(c[0], c[1], c[2]);
    camera.position.set(c[0] + Math.sin(yaw) * Math.cos(pitch) * dist, c[1] + Math.sin(pitch) * dist, c[2] + Math.cos(yaw) * Math.cos(pitch) * dist);
    controls.update(); camera.updateMatrixWorld(true); lighting?.markDirty?.(); poke(60);
  }
  function frameShot() {   // thumbnail: from a little above and to one side, as close as keeps the whole figure and its base in the picture
    pawn.updateMatrixWorld(true); const pts = [], v = new THREE.Vector3(), r = baseRadius(shown.f);
    shown.prep.root.traverse(o => { if (!o.isMesh) return; const a = o.geometry.attributes.position, step = Math.max(1, Math.floor(a.count / 8000)); for (let i = 0; i < a.count; i += step) pts.push(new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld)); });
    for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), new THREE.Vector3(Math.cos(a) * r, DISC_H, Math.sin(a) * r)); }
    pts.push(new THREE.Vector3(0, 0, r + 0.78));   // the tip of the facing arrow
    const c = new THREE.Box3().setFromPoints(pts).getCenter(new THREE.Vector3());
    const span = (d) => { place(num('yaw', 25), num('pitch', 30), d, c.toArray()); let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (const p of pts) { v.copy(p).project(camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); } return [x0, x1, y0, y1]; };
    const fit = () => { let lo = 1.5, hi = 400; for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (Math.max(...span(mid).map(Math.abs)) <= 0.9) hi = mid; else lo = mid; } return hi; };
    for (let pass = 0; pass < 3; pass++) {   // centre what the camera actually sees, then close in again
      const d = fit(), [x0, x1, y0, y1] = span(d), t = Math.tan(rad(camera.fov / 2)) * d;
      c.addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), (x0 + x1) / 2 * t * camera.aspect).addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1), (y0 + y1) / 2 * t);
    }
    span(fit());
  }
  const cameraNow = () => ({ pos: camera.position.toArray().map(v => +v.toFixed(1)), target: controls.target.toArray().map(v => +v.toFixed(1)), view: ui.view });

  // ---- size and drawing. CSS pixels to the lighting module, never multiplied by the pixel ratio (the 16x bug).
  function resize() {
    const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); lighting?.setSize(w, h); poke();
  }
  new ResizeObserver(resize).observe(stage); resize();
  // Draw on demand: a frame only while something changes and for a short tail after. An idle page costs nothing,
  // and when the inspector is closed the loop is stopped altogether.
  // n is in frames at 60 a second, but kept as TIME: on a slow machine the tail after a change must not last ten times longer
  function poke(n = 45) { wakeUntil = Math.max(wakeUntil, performance.now() + n * 17); wakeMin = Math.max(wakeMin, 3); }
  controls.addEventListener('change', () => poke());
  for (const ev of ['pointerdown', 'keydown', 'click', 'input']) $('#insp').addEventListener(ev, () => poke(60));
  document.addEventListener('visibilitychange', () => poke());
  const fpsEl = $('#fps'); let fN = 0, fT = performance.now();
  const draw = (now, dt) => { if (lighting) { lighting.frame(now); lighting.render(dt); } else renderer.render(scene, camera); drawn++; };
  function tick(now) {
    const real = now - last, dt = Math.min(100, real); last = now;
    if (ui.spin && shown) { pawn.rotation.y += Math.min(1000, real) / 1000 * (6 * 2 * Math.PI / 60); lighting?.markDirty?.(); poke(2); }   // 6 turns a minute
    controls.update();
    if ((wakeMin > 0 || performance.now() < wakeUntil) && !dead) { wakeMin--; draw(now, dt); fN++; }
    if (now - fT >= 1000) {
      const pr = renderer.getPixelRatio();
      fpsEl.textContent = (fN ? `${Math.round(fN * 1000 / (now - fT))} fps` : 'idle (draws when something moves)') + ` · ${canvas.width}×${canvas.height} px (ratio ${pr}${devicePixelRatio > pr ? ` of ${devicePixelRatio}` : ''})`;
      window.__gal.fps = fN * 1000 / (now - fT); fN = 0; fT = now;
    }
  }
  function wake() { if (!running && !SHOT) { running = true; last = performance.now(); renderer.setAnimationLoop(tick); } poke(90); }
  function sleep() { showNo++; wanted = ''; clear(); running = false; renderer.setAnimationLoop(null); fpsEl.textContent = ''; }   // closed: nothing drawn, the figure's GPU memory given back
  function spin() { if (!ui.spin) pawn.rotation.y = 0; lighting?.markDirty?.(); poke(60); }
  function aids() { aidsG.visible = !SHOT && ui.aids; lighting?.markDirty?.(); poke(60); }
  applyLook();
  Object.assign(window.__gal, { fx: !!lighting, mem: () => ({ ...renderer.info.memory, kept: cache.size }), spinNow: () => pawn.rotation.y, drawCount: () => drawn, running: () => running,
    buffer: () => ({ w: canvas.width, h: canvas.height, cssW: stage.clientWidth, cssH: stage.clientHeight, ratio: renderer.getPixelRatio(), dpr: devicePixelRatio }),
    feet: () => { if (!shown) return null; pawn.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(shown.prep.root); return { above_base_ft: +(b.min.y - (baseG?.userData.top || 0)).toFixed(3), height_ft: +(b.max.y - b.min.y).toFixed(2), base_width_ft: +(baseRadius(shown.f) * 2).toFixed(2) }; } });
  // thumbs.py: draw a few frames back to back so shadows settle, then let the browser put the picture on screen
  const settle = async () => { for (let i = 0; i < 6; i++) draw(performance.now() + i * 16, 16); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); };
  return { show, clear, preload, setView, refreshBase, applyLook, spin, aids, sleep, cameraNow, settle };
}

// ---------------------------------------------------------------- start
window.__gal = { v: V, shown: [], cur: null, verdicts: () => verdicts, figures: () => FIGS.length };
// thumbs.py calls this for each figure on one open page: -> { ok, ms } once the picture is on screen
window.__shot = async (id, tier = 'horde') => {
  const f = byId.get(id), t0 = performance.now(); if (!f) return { ok: false, err: 'no such figure in manifest.json' };
  const t = f.files[tier] ? tier : recTier(f); if (!t) return { ok: false, err: 'no 3D file listed' };
  try { const e = await engine(); cur = { f, tier: t }; const ok = await e.show(f, t); if (!ok) return { ok: false, err: $('#busy').textContent || 'the file did not load' }; await e.settle(); return { ok: true, tier: t, ms: Math.round(performance.now() - t0) }; }
  catch (err) { return { ok: false, err: String(err?.message || err) }; }
};
async function start() {
  if (SHOT) document.body.classList.add('shot'); else { wireGrid(); wireInspector(); }
  try { ingest(await fetchManifest()); }
  catch (err) { $('#counts').textContent = 'The list of figures could not be loaded.'; const e = $('#empty'); e.style.display = 'block'; e.className = 'err'; e.textContent = `Nothing to show: ${err.message}. Reload the page in a minute; if it stays like this, tell Fauna.`; window.__ready = true; window.__error = err.message; return; }
  if (SHOT) { window.__firstShot = await window.__shot(SHOT, qs.get('tier') || 'horde'); window.__ready = true; return; }
  if (VERDICT_ROUTE) { try { const r = await fetch(`${API}/${VERDICT_ROUTE}`); if (r.ok) { for (const [id, rec] of Object.entries(await r.json())) { const v = rec?.data?.verdict; if (VERDICTS[v] && (!verdicts[id] || String(rec.at) > String(verdicts[id].at))) verdicts[id] = { v, at: rec.at, note: rec.note || '' }; } store.set('tw-figure-set-verdicts', verdicts); } } catch { /* this browser's own record is used */ } }
  apply(); window.__ready = true; window.__tilesAt = performance.now();
  const id = decodeURIComponent(location.hash.slice(1)); if (byId.has(id)) openFigure(id);
  setInterval(lookAgain, 120000);
}
start();
