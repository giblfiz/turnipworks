// THE LAB KIT (2026-10-20): the drawer machinery of the Ring Lab pattern (ringlab/panel.js), as one small piece any lab
// can mount: plain-words knobs (a slider, a tick box or a choice, each with its ↺ back to where it started), sections
// in the main drawer and ONE collapsed "Advanced (rarely needed)" group, Undo / Redo (whole-settings snapshots, one per
// gesture: a slider drag is one step), "Revert to <where it started>", a preset list, Copy / Load JSON, this browser's
// unsaved draft (written only once something changed, so an untouched browser keeps following the house value), and
// "Use as default": POST /tuner kind "house" with ONE field (server/ratings_server.py HOUSE_FIELDS), so no other house
// value is touched. The status line says where the page started. Label lab (surfaces/labellab.js) is its first user;
// Ring Lab's panel predates it and keeps its own copy for now (it is being rebuilt; it can move onto this one after).
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
export const getPath = (o, p) => p.split('.').reduce((v, k) => v?.[k], o);
export const setPath = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((x, k) => x[k], o)[last] = v; };
let cssDone = false;
function css() { if (cssDone) return; cssDone = true; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL(`./style.css?v=${window.TW_V || 'dev'}`, import.meta.url); document.head.append(l); }

export function mountLab(host, {
  title, fields, limits, layout, presets = {}, normalize = x => x, envelope = x => x, initial, initialName = 'built-in',
  draftKey, houseField, ratingsApi = '/api/tw-ratings', who = () => '', onChange = () => {}, extra = '',
} = {}) {
  css();
  const $ = s => host.querySelector(s);
  let settings = normalize(initial);
  const stamp = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  let base = { name: initialName, verb: 'opened', at: stamp(), json: JSON.stringify(settings) }, baseSettings = JSON.parse(base.json);
  const setBase = (name, verb) => { base = { name, verb, at: stamp(), json: JSON.stringify(settings) }; baseSettings = JSON.parse(base.json); };
  let hist = [JSON.stringify(settings)], at = 0, pending = null, quiet = false, startJson = JSON.stringify(settings), startedLabel = initialName;
  const commit = () => { clearTimeout(pending); pending = null; const s = JSON.stringify(settings); if (s === hist[at]) return; hist = hist.slice(0, at + 1); hist.push(s); if (hist.length > 400) hist.shift(); at = hist.length - 1; syncButtons(); };
  const persist = () => { try { if (JSON.stringify(settings) !== startJson || localStorage.getItem(draftKey)) localStorage.setItem(draftKey, JSON.stringify(envelope(settings))); } catch { } };
  const changed = () => { persist(); if (!quiet) { clearTimeout(pending); pending = setTimeout(commit, 400); } onChange(settings); syncButtons(); };
  const status = text => { $('[data-role="status"]').textContent = text; };
  const field = p => fields[p] || { label: p };
  const show = (p, v) => { const f = field(p); return f.fmt ? f.fmt(v) : Number.isFinite(+v) ? String(Math.round(+v * 100) / 100) : String(v); };
  const reset = p => `<button type="button" class="lk-reset" data-reset="${p}" title="Back to where it started">↺</button>`;
  function control(p) {
    const f = field(p), v = getPath(settings, p), hint = f.hint ? `<small class="lk-hint">${esc(f.hint)}</small>` : '';
    if (typeof v === 'boolean') return `<div class="lk-row" title="${esc(f.hint || '')}"><label class="lk-check"><input type="checkbox" data-path="${p}"${v ? ' checked' : ''}>${esc(f.label)}</label>${reset(p)}</div>`;
    if (f.choices) return `<label class="lk-control"><span>${esc(f.label)}</span>${reset(p)}<select data-path="${p}">${f.choices.map(([c, t]) => `<option value="${esc(c)}"${String(c) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>${hint}</label>`;
    const [min, max, step] = limits(p) || [0, 100, 1];
    return `<label class="lk-control"><span>${esc(f.label)}</span><output>${esc(show(p, v))}</output>${reset(p)}<input type="range" data-path="${p}" min="${min}" max="${max}" step="${step}" value="${v}">${hint}</label>`;
  }
  const section = ([t, ps]) => `<section class="lk-sec" data-sec="${esc(t)}"><h3>${esc(t)}</h3>${ps.map(control).join('')}</section>`;
  host.classList.add('lk-panel');
  host.innerHTML = `<div class="lk-head"><b>${esc(title)}</b><button type="button" data-role="collapse" aria-label="Collapse">◀</button></div>
    <div class="lk-body">
      <div class="lk-save">
        <label>Preset <select data-role="preset"></select></label><button type="button" data-role="loadPreset">Load</button>
        <label>Name <input data-role="name" maxlength="100" placeholder="Harry’s labels"></label>
        <button type="button" data-role="useDefault" title="Every editing seat's game uses this look, and every lab without unsaved changes starts here">Use as default</button>
        <span class="lk-history"><button type="button" data-role="undo" title="Undo the last change here (not the game's undo)">Undo</button><button type="button" data-role="redo">Redo</button><button type="button" data-role="revert"></button></span>
        <small data-role="status">Settings stay in this browser until Use as default.</small>
      </div>
      ${extra}
      <div data-role="controls"></div>
      <details class="lk-advanced"><summary>Advanced (rarely needed)</summary><div data-role="advControls"></div>
        <div class="lk-json"><button type="button" data-role="copy">Copy settings</button><button type="button" data-role="loadJson">Load JSON</button><textarea data-role="json" placeholder="settings JSON"></textarea></div>
      </details>
    </div>`;
  const listPresets = () => { const el = $('[data-role="preset"]'), old = el.value; el.innerHTML = ''; for (const n of Object.keys(presets)) el.add(new Option(n, n)); if (old && presets[old]) el.value = old; };
  listPresets();
  function syncButtons() {
    $('[data-role="undo"]').disabled = at <= 0 && !pending; $('[data-role="redo"]').disabled = at >= hist.length - 1;
    const rv = $('[data-role="revert"]'); rv.textContent = `Revert to ${base.name} (${base.verb} ${base.at})`; rv.disabled = JSON.stringify(settings) === base.json;
    for (const b of host.querySelectorAll('[data-reset]')) b.classList.toggle('same', JSON.stringify(getPath(settings, b.dataset.reset)) === JSON.stringify(getPath(baseSettings, b.dataset.reset)));
  }
  function render() { const L = layout(settings); $('[data-role="controls"]').innerHTML = L.main.map(section).join(''); $('[data-role="advControls"]').innerHTML = L.advanced.map(section).join(''); syncButtons(); }
  render();
  host.addEventListener('input', ev => {
    const el = ev.target, p = el.dataset.path; if (!p) return;
    const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
    setPath(settings, p, v);
    if (el.type === 'range') el.closest('label').querySelector('output').textContent = show(p, v);
    if (field(p).rerender) render();
    changed();
  });
  host.addEventListener('change', ev => { if (ev.target.dataset.path) commit(); }); // a slider let go = one undo step
  host.addEventListener('click', ev => { const p = ev.target.dataset.reset; if (!p) return; setPath(settings, p, structuredClone(getPath(baseSettings, p))); render(); changed(); commit(); });
  // (never Ctrl+Z here: that key is the game's own undo)
  const restore = json => { quiet = true; settings = JSON.parse(json); render(); changed(); quiet = false; };
  $('[data-role="undo"]').onclick = () => { commit(); if (at > 0) { at--; restore(hist[at]); status('Undone'); } };
  $('[data-role="redo"]').onclick = () => { if (at < hist.length - 1) { at++; restore(hist[at]); status('Redone'); } };
  $('[data-role="revert"]').onclick = () => { commit(); settings = JSON.parse(base.json); render(); changed(); commit(); status(`Back to ${base.name}`); };
  $('[data-role="collapse"]').onclick = () => { host.classList.toggle('collapsed'); $('[data-role="collapse"]').textContent = host.classList.contains('collapsed') ? '▶' : '◀'; };
  $('[data-role="loadPreset"]').onclick = () => { const n = $('[data-role="preset"]').value; if (!presets[n]) return; commit(); settings = normalize(presets[n]); setBase(n, 'loaded'); render(); changed(); commit(); status('Loaded ' + n); };
  $('[data-role="copy"]').onclick = async () => { const j = JSON.stringify(envelope(settings), null, 2); $('[data-role="json"]').value = j; try { await navigator.clipboard.writeText(j); status('Copied settings JSON'); } catch { status('JSON ready to copy below'); } };
  $('[data-role="loadJson"]').onclick = () => { try { commit(); settings = normalize(JSON.parse($('[data-role="json"]').value)); setBase('the pasted JSON', 'loaded'); render(); changed(); commit(); status('Loaded JSON'); } catch (e) { status('Invalid JSON: ' + e.message); } };
  const when = iso => { const d = new Date(iso); return Number.isFinite(+d) ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : ''; };
  $('[data-role="useDefault"]').onclick = async () => {
    const name = $('[data-role="name"]').value.trim() || base.name, by = who() || title, savedAt = new Date().toISOString();
    const rec = { name, by, savedAt, ...envelope(settings) };
    try { const r = await fetch(`${ratingsApi}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'house', name: 'house', note: `${houseField} "${name}" is now the ${title} default`, data: { [houseField]: rec } }) });
      if (!r.ok) throw Error(await r.text()); setBase(`house default · ${name}`, 'set'); startJson = JSON.stringify(settings); try { localStorage.removeItem(draftKey); } catch { } syncButtons(); status(`Default for every editing seat: ${name} (by ${by}); new games and reloads pick it up`); api.onDefault?.(rec);
    } catch (e) { status('Could not set the default: ' + e.message); }
  };
  const api = {
    settings: () => settings, el: s => $(s),
    base: () => ({ ...base, settings: baseSettings }), history: () => ({ at, length: hist.length }), started: () => startedLabel,
    setSettings: v => { commit(); settings = normalize(v); render(); changed(); commit(); },
    // where the page starts: this browser's draft, else the house value, else the built-in (the caller decides which)
    startFrom: (rec, label) => { settings = normalize(rec); startJson = JSON.stringify(settings); setBase(label, 'started'); hist = [startJson]; at = 0; startedLabel = label; render(); onChange(settings); status(`Started from: ${label}${rec?.savedAt ? ` · saved ${when(rec.savedAt)}` : ''}${rec?.by ? ` by ${rec.by}` : ''}`); },
    startedFrom: label => { startedLabel = label; status(`Started from: ${label}`); },
    status, render,
  };
  return api;
}
export function readDraft(key, normalize = x => x) { try { const raw = JSON.parse(localStorage.getItem(key) || 'null'); return raw ? normalize(raw) : null; } catch { return null; } }
