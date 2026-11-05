// THE ASSETS PAGE'S SCRIPT (2026-11-04; engine/tools/site_assets.py says what it is). The overview is in the HTML; this
// fetches /assets.json once and draws, from the address's fragment:
//   #pack/<pack>  #pack/<pack>/<room>  #thing/<id>  #figure/<id>  #find/<words>   (and nothing: the overview)
// Pictures load lazily; a missing one leaves its card's dark ground. Nothing here is sent anywhere.
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var E = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var CFG = window.TW_ASSETS || { heroes: {}, blurbs: {} };
  var view = $('#view'), packsEl = $('#packs'), q = $('#q'), count = $('#count'), dlg = $('#asset'), dlgBody = $('#dlg');
  var D = null, where = {}, opened = false, beforeDialog = '';
  // /assets.json at /assets (nginx); the file beside the page where the page is opened as a file (a local test server)
  var JSON_URL = /\.html$/.test(location.pathname) ? location.pathname.replace(/[^/]*$/, 'assets.json') : '/assets.json';
  var data = fetch(JSON_URL, { credentials: 'omit' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
    D = d;
    d.packs.forEach(function (p) { p.rooms.forEach(function (r) { r.sections.forEach(function (s) { s[2].forEach(function (e) {
      var id = p.kind === 'figures' ? 'fig:' + e : e.split('|')[0]; var w = where[id] || (where[id] = []);
      if (!w.some(function (x) { return x[0] === p && x[1] === r; })) w.push([p, r]);
    }); }); }); });
    return d;
  });
  data.catch(function () { count.textContent = 'The catalogue could not be loaded; try again in a moment.'; });

  // ---- addresses of files and pictures ----
  var lookPic = function (sku, h) { return D.media + 't/' + sku + '.' + h + '.webp'; };
  var figPic = function (id) { var f = D.figures[id]; return D.media + 'f/' + id + '-' + f.x.split('-').pop() + '.webp'; };
  var lookFile = function (t, sku) { return D.files + (t.f ? 'assets/flat/' + sku + '.webp' : 'assets/m/' + sku + '.glb'); };
  var figFile = function (id) { return D.files + 'assets/figures/' + id + '--' + D.figures[id].x + '.glb'; };
  var packBy = function (slug) { return D.packs.filter(function (p) { return p.slug === slug; })[0]; };
  var heroSrc = function (p, w) { var h = CFG.heroes[p.slug]; return h ? D.media + 'h/' + h + '-' + w + '.webp' : null; };

  // ---- sizes, in feet (the catalog is in inches) ----
  var ft = function (inch) { var f = inch / 12; return f < 1 ? Math.round(inch) + ' in' : (Math.round(f * 10) / 10) + ' ft'; };
  var sizeText = function (s) { return s ? ft(s[0]) + ' × ' + ft(s[1]) + ', ' + ft(s[2]) + ' tall' : null; };
  var PLACE = { floor: 'stands on the floor', wall: 'hangs on a wall', ceiling: 'hangs from the ceiling', surface: 'sits on a table or shelf', kit: 'set along a 5-ft grid line', tile: 'a 5-ft floor tile', ground: 'stands on open ground', stair: 'a stair' };
  var GROUP = { hero: 'Hero', townsfolk: 'Townsfolk', foe: 'Foe', large: 'Large creature', beast: 'Beast or mount' };

  // ---- cards ----
  function thingCard(e) {
    var parts = e.split('|'), id = parts[0], t = D.things[id]; if (!t) return '';
    var look = t.l[+parts[1] || 0], label = look[2] || '';
    return '<li><a class="card" href="#thing/' + E(id) + (parts[1] ? '~' + parts[1] : '') + '"><img src="' + E(lookPic(look[0], look[1])) + '" width="256" height="256" loading="lazy" decoding="async" alt="">' +
      '<span>' + E(t.n) + '</span>' + (label ? '<small>' + E(label) + '</small>' : '') + '</a></li>';
  }
  function figCard(id) {
    var f = D.figures[id]; if (!f) return '';
    return '<li><a class="card" href="#figure/' + E(id) + '"><img src="' + E(figPic(id)) + '" width="256" height="256" loading="lazy" decoding="async" alt="">' +
      '<span>' + E(f.n) + '</span><small>' + E(GROUP[f.g] || f.g) + ', ' + E(ft(f.h * 12)) + '</small></a></li>';
  }
  var cards = function (p, list) { return '<ul class="cards">' + list.map(p && p.kind === 'figures' ? figCard : thingCard).join('') + '</ul>'; };

  // ---- the views ----
  function crumbs(p, r) {
    return '<nav class="crumbs" aria-label="Where you are"><a href="#">All packs</a>' + (p ? ' › ' + (r ? '<a href="#pack/' + E(p.slug) + '">' + E(p.label) + '</a> › ' + E(r.label) : E(p.label)) : '') + '</nav>';
  }
  function useLink(p, r) {
    if (p.kind) return '';
    var v = p.code + (r ? '/' + r.key : '');
    return '<a class="btn primary" href="/?pack=' + encodeURIComponent(v) + '">Use it in Turnip Works</a>';
  }
  function packView(p, r) {
    var hero = heroSrc(p, 1200), n = p.things.length;
    var h = crumbs(p, r) + '<div class="phead' + (hero && !r ? ' has-hero' : '') + '">' +
      (hero && !r ? '<div class="phero"><img src="' + E(heroSrc(p, 600)) + '" srcset="' + E(heroSrc(p, 600)) + ' 600w, ' + E(hero) + ' 1200w" sizes="(max-width: 900px) 92vw, 560px" width="1200" height="675" alt="A furnished room from the ' + E(p.label) + ' pack, in Turnip Works"></div>' : '') +
      '<div><h2 id="pack/' + E(p.slug) + (r ? '/' + E(r.key) : '') + '-h">' + E(r ? r.label : p.label) + '</h2>' +
      '<p>' + (r ? E(p.label) + (r.cells ? ' · drawn ' + r.cells[0] * 5 + ' × ' + r.cells[1] * 5 + ' ft to start' : '') : E(CFG.blurbs[p.slug] || '')) + '</p>' +
      '<p class="small">' + (r ? '' : E(p.kind === 'figures' ? n + ' figures' : p.rooms.length + ' ' + (p.kind ? 'groups' : 'rooms') + ', ' + n + ' things')) + '</p>' +
      '<div class="acts">' + useLink(p, r) + '<button type="button" class="copy" data-link="' + E(location.pathname + '#pack/' + p.slug + (r ? '/' + r.key : '')) + '">Copy link</button>' +
      (p.kind ? '' : '<span class="hint">As the GM: opens your table with the Build menu at this ' + (r ? 'room' : 'pack') + '. Nothing is built until you drag it out.</span>') + '</div></div></div>';
    h += '<ul class="chips" aria-label="Rooms"><li><a href="#pack/' + E(p.slug) + '"' + (r ? '' : ' aria-current="page"') + '>All ' + E(p.kind === 'figures' ? 'figures' : 'things') + '</a></li>' +
      p.rooms.map(function (x) { return '<li><a href="#pack/' + E(p.slug) + '/' + E(x.key) + '"' + (x === r ? ' aria-current="page"' : '') + '>' + E(x.label) + '</a></li>'; }).join('') + '</ul>';
    if (r) {
      h += r.sections.map(function (s) { return '<h3>' + E(s[1]) + ' <small>' + s[2].length + '</small></h3>' + cards(p, s[2]); }).join('');
      if (r.factions) h += '<p class="more">This room also takes <a href="#pack/faction-pieces">faction pieces</a>: banners, idols and altarpieces for each of thirteen factions.</p>';
    } else if (p.kind === 'figures' || p.kind) {
      h += p.rooms.map(function (x) { var all = []; x.sections.forEach(function (s) { all = all.concat(s[2]); }); return '<h3><a href="#pack/' + E(p.slug) + '/' + E(x.key) + '">' + E(x.label) + '</a> <small>' + all.length + '</small></h3>' + cards(p, all); }).join('');
    } else {
      h += '<h3>Everything in the pack <small>' + n + '</small></h3>' + cards(p, p.things);
    }
    return h;
  }
  function words(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(Boolean); }
  var index = null;
  function search(text) {
    if (!index) {
      index = [];
      Object.keys(D.things).forEach(function (id) { var t = D.things[id], ps = (where[id] || []).map(function (w) { return w[0].label + ' ' + w[1].label; }).join(' '); index.push([id, 0, t.n.toLowerCase(), words(t.n + ' ' + id), words(t.d + ' ' + t.l.map(function (l) { return l[2] || ''; }).join(' ') + ' ' + ps)]); });
      Object.keys(D.figures).forEach(function (id) { var f = D.figures[id]; index.push([id, 1, f.n.toLowerCase(), words(f.n + ' ' + id), words((f.k || []).join(' ') + ' ' + (GROUP[f.g] || '') + ' figure miniature')]); });
    }
    var qs = words(text); if (!qs.length) return [];
    var out = [];
    index.forEach(function (x) {
      var s = 0;
      for (var i = 0; i < qs.length; i++) {
        var w = qs[i], hit = 0;
        if (x[3].indexOf(w) >= 0) hit = 3; else if (x[3].some(function (v) { return v.indexOf(w) === 0; })) hit = 2; else if (x[4].indexOf(w) >= 0) hit = 1.5; else if (x[4].some(function (v) { return v.indexOf(w) === 0; })) hit = 1;
        if (!hit) return; s += hit;
      }
      if (x[2] === text.toLowerCase().trim()) s += 5;
      out.push([s, x]);
    });
    return out.sort(function (a, b) { return b[0] - a[0] || a[1][2].localeCompare(b[1][2]); }).map(function (o) { return o[1]; });
  }
  var LIMIT = 240;
  function findView(text) {
    var hits = search(text), shown = hits.slice(0, LIMIT);
    var props = shown.filter(function (x) { return !x[1]; }).map(function (x) { return x[0]; }), figs = shown.filter(function (x) { return x[1]; }).map(function (x) { return x[0]; });
    var np = hits.filter(function (x) { return !x[1]; }).length, nf = hits.length - np, plural = function (n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); };
    count.textContent = hits.length ? [np && plural(np, 'prop'), nf && plural(nf, 'figure')].filter(Boolean).join(' and ') + ' found' + (hits.length > LIMIT ? ', the first ' + LIMIT + ' shown' : '') : 'Nothing found';
    return crumbs(null) + (hits.length ? '' : '<p class="empty">No asset is called that. Try a simpler word: chair, torch, goblin.</p>') +
      (props.length ? '<h3>Props <small>' + props.length + '</small></h3>' + cards(null, props) : '') +
      (figs.length ? '<h3>Figures <small>' + figs.length + '</small></h3>' + cards({ kind: 'figures' }, figs) : '');
  }

  // ---- one asset ----
  function thingDialog(id, lookIx) {
    var t = D.things[id]; if (!t) return false;
    var li = Math.min(+lookIx || 0, t.l.length - 1), look = t.l[li];
    var ws = (where[id] || []).slice(0, 6).map(function (w) { return '<a href="#pack/' + E(w[0].slug) + '/' + E(w[1].key) + '">' + E(w[1].label) + '</a> <small>(' + E(w[0].label) + ')</small>'; }).join(', ');
    var more = (where[id] || []).length > 6 ? ' and ' + ((where[id] || []).length - 6) + ' more rooms' : '';
    dlgBody.innerHTML = '<button type="button" class="close" aria-label="Close">×</button>' +
      '<div><img class="big" id="as-pic" src="' + E(lookPic(look[0], look[1])) + '" width="256" height="256" alt="' + E(t.n) + (look[2] ? ', ' + E(look[2]) : '') + '"></div>' +
      '<div><h2 id="as-name">' + E(t.n) + '</h2><p class="desc">' + E(t.d) + '</p>' +
      (t.l.length > 1 ? '<ul class="looks" aria-label="Looks">' + t.l.map(function (l, i) { return '<li><button type="button" data-look="' + i + '" aria-pressed="' + (i === li) + '" title="' + E(l[2] || t.n) + '"><img src="' + E(lookPic(l[0], l[1])) + '" width="56" height="56" loading="lazy" alt="' + E(l[2] || t.n) + '"></button></li>'; }).join('') + '</ul>' : '') +
      '<dl>' + (sizeText(t.s) ? '<dt>Size</dt><dd>' + E(sizeText(t.s)) + '</dd>' : '') + (PLACE[t.p] ? '<dt>Placed</dt><dd>' + E(PLACE[t.p]) + '</dd>' : '') +
      '<dt>Look</dt><dd id="as-look">' + E(look[2] || (t.l.length > 1 ? 'the first of ' + t.l.length : 'one')) + '</dd><dt>File</dt><dd><a id="as-file" href="' + E(lookFile(t, look[0])) + '" download>' + E(look[0]) + (t.f ? '.webp' : '.glb') + '</a></dd></dl>' +
      '<div class="acts"><a class="btn primary" href="/?place=' + encodeURIComponent(id) + '">Use it in Turnip Works</a><a class="btn" id="as-dl" href="' + E(lookFile(t, look[0])) + '" download>Download ' + (t.f ? 'WebP' : 'GLB') + '</a>' +
      '<button type="button" class="copy" data-link="' + E(location.pathname + '#thing/' + id) + '">Copy link</button>' +
      '<span class="hint">As the GM: your table opens with it ready, and it goes down where you click.</span></div>' +
      (ws ? '<p class="where">In ' + ws + more + '.</p>' : '') +
      '<p class="lic">Free under CC BY 4.0. Credit: <code>' + E(D.credit) + '</code></p></div>';
    dlgBody.querySelectorAll('[data-look]').forEach(function (b) { b.onclick = function () {
      var l = t.l[+b.dataset.look]; $('#as-pic').src = lookPic(l[0], l[1]); $('#as-look').textContent = l[2] || t.n;
      $('#as-file').href = $('#as-dl').href = lookFile(t, l[0]); $('#as-file').textContent = l[0] + (t.f ? '.webp' : '.glb');
      dlgBody.querySelectorAll('[data-look]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    }; });
    return true;
  }
  function figDialog(id) {
    var f = D.figures[id]; if (!f) return false;
    var base = f.z ? f.z + ' × ' + f.z + ' squares (' + f.z * 5 + ' ft)' : 'one 5-ft square';
    dlgBody.innerHTML = '<button type="button" class="close" aria-label="Close">×</button>' +
      '<div><img class="big" src="' + E(figPic(id)) + '" width="256" height="256" alt="' + E(f.n) + '"></div>' +
      '<div><h2 id="as-name">' + E(f.n) + '</h2><p class="desc">' + E(GROUP[f.g] || f.g) + ' figure</p>' +
      '<dl><dt>Height</dt><dd>' + E(ft(f.h * 12)) + '</dd><dt>Base</dt><dd>' + E(base) + '</dd><dt>File</dt><dd><a href="' + E(figFile(id)) + '" download>' + E(id) + '.glb</a></dd></dl>' +
      '<div class="acts"><a class="btn primary" href="/?pawn=' + encodeURIComponent(id) + '">Use it in Turnip Works</a><a class="btn" href="' + E(figFile(id)) + '" download>Download GLB</a>' +
      '<button type="button" class="copy" data-link="' + E(location.pathname + '#figure/' + id) + '">Copy link</button>' +
      '<span class="hint">As the GM: your table opens with Add pawn ready; click a square to put the pawn down.</span></div>' +
      '<p class="where">In <a href="#pack/figures/' + E(f.g) + '">' + E((packBy('figures').rooms.filter(function (r) { return r.key === f.g; })[0] || {}).label || 'Figures') + '</a>.</p>' +
      '<p class="lic">Free under CC BY 4.0. Credit: <code>' + E(D.credit) + '</code></p></div>';
    return true;
  }
  function openDialog() { if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); } opened = true; }
  function closeDialog() { if (dlg.open) { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); } }
  dlg.addEventListener('click', function (ev) { if (ev.target === dlg || ev.target.closest('.close')) leaveDialog(); });
  dlg.addEventListener('cancel', function (ev) { ev.preventDefault(); leaveDialog(); });
  function leaveDialog() { closeDialog(); if (opened && history.length > 1 && beforeDialog !== null) history.back(); else location.hash = beforeDialog || ''; opened = false; }

  // ---- the router ----
  var current = '';
  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#/, ''));
    var m = h.match(/^(thing|figure)\/([^~]+)(?:~(\d+))?$/);
    if (m) {
      data.then(function () { if ((m[1] === 'thing' ? thingDialog(m[2], m[3]) : figDialog(m[2]))) { if (!current) show(''); openDialog(); } else { location.replace('#'); } });
      return;
    }
    if (dlg.open) { closeDialog(); opened = false; }
    beforeDialog = location.hash;
    if (h === current && h) return;
    current = h; show(h);
  }
  function show(h) {
    if (!h) { view.hidden = true; packsEl.hidden = false; view.innerHTML = ''; if (!q.value) count.textContent = ''; return; }
    data.then(function () {
      var html = '', p, r, mm;
      if ((mm = h.match(/^pack\/([^/]+)(?:\/(.+))?$/)) && (p = packBy(mm[1]))) {
        r = mm[2] ? p.rooms.filter(function (x) { return x.key === mm[2]; })[0] : null;
        if (mm[2] && !r) { location.replace('#pack/' + p.slug); return; }
        html = packView(p, r); count.textContent = ''; if (q.value) q.value = '';
      } else if ((mm = h.match(/^find\/(.*)$/))) {
        if (q.value !== mm[1]) q.value = mm[1];
        html = findView(mm[1]);
      } else { // an anchor on the overview (a pack card's own id), or an address the page does not know: the overview
        current = ''; show(''); var el = document.getElementById(h); if (el) el.scrollIntoView(); else history.replaceState(null, '', location.pathname + location.search); return;
      }
      packsEl.hidden = true; view.hidden = false; view.innerHTML = html;
      var top = view.getBoundingClientRect().top + scrollY - 70; if (scrollY > top || h.indexOf('find/') !== 0) scrollTo({ top: Math.max(0, top) });
    });
  }
  addEventListener('hashchange', route);
  route();

  // ---- search as you type: the address follows (#find/<words>), replacing itself so Back leaves the search ----
  var timer = 0;
  q.addEventListener('input', function () {
    clearTimeout(timer); timer = setTimeout(function () {
      var v = q.value.trim();
      if (!v) { if (/^#find\//.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); current = ''; show(''); return; }
      var to = '#find/' + encodeURIComponent(v);
      if (/^#find\//.test(location.hash)) history.replaceState(null, '', to); else history.pushState(null, '', to);
      current = 'find/' + v; show(current);
    }, 160);
  });

  // ---- copy buttons (a link, or the credit line) ----
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('button.copy'); if (!b) return;
    var text = b.dataset.copy ? ($(b.dataset.copy) || {}).textContent : location.origin + b.dataset.link;
    var done = function () { var was = b.textContent; b.textContent = 'Copied'; setTimeout(function () { b.textContent = was; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { prompt('Copy this:', text); });
    else prompt('Copy this:', text);
  });
  // a card whose picture is missing keeps its dark ground and loses the broken-image mark
  document.addEventListener('error', function (ev) { var t = ev.target; if (t && t.tagName === 'IMG' && !t.dataset.gone) { t.dataset.gone = '1'; t.removeAttribute('src'); t.removeAttribute('srcset'); } }, true);
})();
