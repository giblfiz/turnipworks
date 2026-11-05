// the VTT comparison index (2026-10-29): filter, sort, a product's details, and "Claim yours / correct me".
// The table itself is in the page (engine/tools/site_vtt_index.py); the details come from the same JSON.
(() => {
  'use strict';
  const T = document.getElementById('vtt'); if (!T) return;
  const tb = T.tBodies[0], F = document.getElementById('filters'), count = document.getElementById('count');
  const rows = [...tb.rows], total = rows.length;
  const DATA_URL = '/engine/client/site/vtt-index.json';
  // corrections go to the relay's ticket box; a test may point the page at a relay on this machine only
  const qRelay = new URLSearchParams(location.search).get('relay');
  const RELAY = qRelay && /^http:\/\/127\.0\.0\.1:\d+$/.test(qRelay) ? qRelay : '/api/tw-relay';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => /^https?:\/\//i.test(String(u || '')) ? String(u) : null;
  const words = new Map(rows.map(r => [r, (r.textContent + ' ' + [...r.querySelectorAll('[title]')].map(e => e.title).join(' ')).toLowerCase()]));

  // ---- filters ----
  const state = () => {
    const s = {}; for (const el of F.querySelectorAll('[data-f]')) s[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value.trim().toLowerCase();
    return s;
  };
  function apply() {
    const s = state(); let n = 0;
    for (const r of rows) {
      const d = r.dataset;
      const show = (!s.d3 || d.d3 === '1') && (!s.free || d.free === '1') && (!s.browser || d.browser === '1') && (!s.os || d.os === '1')
        && (!s.alive || d.alive === 'alive') && (!s.group || d.group === s.group) && (!s.kind || d.kind === s.kind)
        && (!s.q || s.q.split(/\s+/).every(w => words.get(r).includes(w)));
      r.hidden = !show; if (show) n++;
    }
    count.textContent = n === total ? `Showing all ${total}` : `Showing ${n} of ${total}`;
  }
  F.addEventListener('input', apply); F.addEventListener('change', apply);
  // on a phone the filters fold away until asked for, so the table is near the top (they open again when wide)
  const fold = document.getElementById('ffold'), narrow = matchMedia('(max-width: 560px)');
  const setFold = () => { fold.open = !narrow.matches || [...F.querySelectorAll('.ffbody [data-f]')].some(el => el.type === 'checkbox' ? el.checked : el.value); };
  narrow.addEventListener?.('change', setFold); setFold();

  // ---- sorting: yes before partial before no before unknown; ties by name ----
  const RANK = { yes: 0, '3D': 0, partial: 1, roller: 1, no: 2, 'n/a': 8, '?': 9, released: 0, 'early access': 1, beta: 2, alpha: 3, 'pre-launch': 4, abandoned: 5,
    free: 0, 'free tier': 1, 'one-time': 2, subscription: 3, none: 0, gm: 1, everyone: 2, alive: 0, unknown: 1, dead: 2, '2D+3D': 1, '2D': 2 };
  const nameOf = (r) => r.cells[0].querySelector('a').textContent.toLowerCase().replace(/^\(unnamed\)\s*/, '￿');
  const keyOf = (r, c) => {
    if (c === 'name') return nameOf(r);
    const td = r.querySelector(`[data-c="${c}"]`); const v = td?.dataset.v ?? '?';
    if (v.startsWith('[')) { const a = JSON.parse(v); return a.includes('?') ? 9 : -a.length; }
    return RANK[v] ?? 5;
  };
  let sortBy = 'name', dir = 1;
  function sort(c) {
    if (sortBy === c) dir = -dir; else { sortBy = c; dir = 1; }
    const k = new Map(rows.map(r => [r, [keyOf(r, c), nameOf(r)]]));
    rows.sort((a, b) => { const x = k.get(a), y = k.get(b); return (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0) * dir || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0); });
    for (const r of rows) tb.appendChild(r);
    for (const th of T.tHead.rows[0].cells) { const b = th.querySelector('button'); if (b?.dataset.sort === c) th.setAttribute('aria-sort', dir > 0 ? 'ascending' : 'descending'); else th.removeAttribute('aria-sort'); }
  }
  T.tHead.addEventListener('click', (e) => { const b = e.target.closest('button[data-sort]'); if (b) sort(b.dataset.sort); });
  T.tHead.rows[0].cells[0].setAttribute('aria-sort', 'ascending');

  // ---- a product's details ----
  let data = null;
  const load = () => data ? Promise.resolve(data) : fetch(DATA_URL, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => (data = d));
  const dlg = document.getElementById('detail'), box = document.getElementById('dlg');
  const GROUP = { ours: 'Ours (we make Turnip Works)', established: 'Established', indie: 'New & indie' };
  const PLAT = { browser: 'web browser', windows: 'Windows', mac: 'Mac', linux: 'Linux', ios: 'iOS', android: 'Android', vr: 'VR headset', '?': '?' };
  const showV = (c) => (Array.isArray(c.v) ? c.v.map(x => PLAT[x] || x).join(', ') : c.v) + (c.verified === false && c.v !== '?' && !(Array.isArray(c.v) && c.v[0] === '?') ? ' (?)' : '');
  function render(p, d) {
    const crit = d.criteria, f = p.features, a = p.alive;
    const link = (u, t) => safeUrl(u) ? `<a href="${esc(u)}" rel="noopener nofollow" target="_blank">${esc(t || u)}</a>` : esc(t || u || '');
    const cells = crit.map(c => {
      const x = f[c.id]; if (!x) return '';
      const v = c.id === 'community' ? '' : esc(showV(x));
      return `<tr><th scope="row">${esc(c.label)}</th><td class="v">${v}</td><td class="n">${esc(x.note || '')}${x.src && safeUrl(x.src) ? `\u00a0<a class="srcl" href="${esc(x.src)}" rel="noopener nofollow" target="_blank">[source]</a>` : ''}</td></tr>`;
    }).join('');
    const li = (xs) => xs.length ? '<ul>' + xs.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '<p class="small">None found in the sources we read.</p>';
    const rd = p.reddit && p.reddit.post ? `<li>Maker's r/VTT post: ${link(p.reddit.post, p.reddit.date ? `${p.reddit.date}` : 'post')}${p.reddit.maker ? ` by ${esc(p.reddit.maker)}` : ''}</li>` : '';
    box.innerHTML = `<button class="x" type="button" data-close aria-label="Close">×</button><div class="dbody" id="dbody">
      <h2 id="dt-name">${esc(p.name)}</h2>
      <p class="sub">${esc(GROUP[p.group])} · ${esc(p.kind)}${p.maker ? ' · ' + esc(p.maker) : ''}</p>
      <p>${esc(p.summary)}</p>
      <ul class="meta">
        <li>Website: ${p.url ? link(p.url) : 'none found'}</li>
        ${p.licence ? `<li>Licence: ${esc(p.licence)}</li>` : ''}
        <li>Site check: <b>${esc({ alive: 'up', dead: 'gone', unknown: 'unknown' }[a.state])}</b> (${esc(a.how || '')}, ${esc(a.checked)}) · features last checked ${esc(p.last_checked)}</li>
        ${rd}
      </ul>
      <table class="cells"><tbody>${cells}</tbody></table>
      <div class="ud"><div><h3>Upsides</h3>${li(p.upsides)}</div><div><h3>Downsides</h3>${li(p.downsides)}</div></div>
      <h3>Sources</h3><ul class="srcs">${p.sources.map(s => `<li>${link(s.url, s.label || s.url)}</li>`).join('') || '<li>none</li>'}</ul>
      </div><div class="acts"><button class="act" type="button" data-fix="${esc(p.id)}">Correct this row</button><a href="#vtt=${esc(p.id)}">Link to this row</a><span class="hint" id="dlghint">scroll for more \u2193</span></div>`;
  }
  let opener = null;
  async function open(id, from) {
    let d; try { d = await load(); } catch { location.href = '/vtt-index.md'; return; }
    const p = d.products.find(x => x.id === id); if (!p) return;
    render(p, d); opener = from || null;
    if (!dlg.open) dlg.showModal();
    const body = document.getElementById('dbody'); body.scrollTop = 0;
    const hint = document.getElementById('dlghint'), fit = () => { if (hint) hint.hidden = body.scrollTop + body.clientHeight >= body.scrollHeight - 4; };
    body.onscroll = fit; fit();
    if (location.hash !== '#vtt=' + id) history.replaceState(null, '', '#vtt=' + id);
  }
  function close() { if (dlg.open) dlg.close(); }
  dlg.addEventListener('close', () => { if (location.hash.startsWith('#vtt=')) history.replaceState(null, '', location.pathname + location.search); opener?.focus?.(); });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) return close();
    const fx = e.target.closest('[data-fix]'); if (fx) { close(); prefill(fx.dataset.fix); }
  });
  tb.addEventListener('click', (e) => { const a = e.target.closest('a[data-open]'); if (!a) return; e.preventDefault(); open(a.dataset.open, a); });
  const fromHash = () => { const m = location.hash.match(/^#vtt=([a-z0-9-]+)$/); if (m) open(m[1]); };
  window.addEventListener('hashchange', fromHash); fromHash();

  // ---- Claim yours / correct me ----
  const fix = document.getElementById('fix'), msg = document.getElementById('fixmsg');
  function prefill(id) {
    fix.product.value = id; document.getElementById('correct').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => fix.text.focus({ preventScroll: true }), 350);
  }
  fix.addEventListener('submit', async (e) => {
    e.preventDefault();
    const product = fix.product.value, text = fix.text.value.trim();
    msg.className = 'msg bad';
    if (!product) { msg.textContent = 'Choose the product first (or "Not listed yet").'; fix.product.focus(); return; }
    if (!text) { msg.textContent = 'Write what should change.'; fix.text.focus(); return; }
    const btn = fix.querySelector('button'); btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Sending…';
    try {
      const r = await fetch(RELAY + '/tickets/site', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ page: 'vtt-index', product, field: fix.field.value || null, text, contact: fix.contact.value.trim() || null, maker: fix.maker.checked }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.why || `the server answered ${r.status}`);
      msg.textContent = `Thank you: it reached us (${j.id}). ` + (fix.contact.value.trim() ? 'We will answer at the contact you gave.' : 'We fix rows by hand, usually within a few days.');
      fix.text.value = ''; fix.maker.checked = false;
    } catch (err) {
      msg.className = 'msg bad'; msg.textContent = `It did not go through (${err.message}). Please try again, or email hello@turnipworks.net.`;
    } finally { btn.disabled = false; }
  });

  apply();
})();
