// The SELECTION LAB: the tuner's folded "Selection" panel over the shared selection renderer (./selection.js).
// Harry 2026-10-04: "I'm not loving what 'Selection' looks like... can we get some settings and wildly different
// options to play with over in the tuner?"
//   - a style picker per state (selected / hover / hidden from players), each style with its own dials
//   - colour from the seat or fixed; a ghost-through dial for the ground styles; how several selected things show
//   - presets: save / load / send (POST /tuner kind "fx", data.fx = "selection") and "Use in game" (kind "house",
//     data.selection), which the game reads from GET /tuner/house
//   - compare: one style per object on several objects at once; preview: hover · selected · hidden side by side
// main.js calls lab.select(item) / lab.hover(item) from its own picking and lab.tick(dt, now) each frame.
import { dialGroup } from '../ui.js';
import { houseLink } from './houselink.js';
import { createSelection, mergeSelection, SELECTION_BUILTINS, SEL_STYLES, SEL_STATES, STYLE_SCHEMA, MULTI_SCHEMA } from './selection.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};
const SEATS = ['#e0b04a', '#4fe3ff', '#7fd67f', '#ff7a90', '#9aa7ff', '#ffffff'];
const GHOSTABLE = new Set(['footprint', 'ring', 'brackets', 'motes']);

// little pictograms for the style tiles (64×48, the accent is currentColor)
const BOX = '<path d="M24 20 L36 14 L46 19 L34 25 Z" fill="#6b6253"/><path d="M24 20 L34 25 L34 37 L24 32 Z" fill="#4b4438"/><path d="M34 25 L46 19 L46 31 L34 37 Z" fill="#5a5245"/>';
const ICONS = {
  halo: `<path d="M24 20 L36 14 L46 19 L46 31 L34 37 L24 32 Z" fill="none" stroke="currentColor" stroke-width="5" stroke-opacity=".45" stroke-linejoin="round"/>${BOX}`,
  footprint: `<path d="M18 33 L34 25 L52 33 L36 41 Z" fill="none" stroke="currentColor" stroke-width="1.8"/>${BOX}`,
  ring: `<ellipse cx="35" cy="34" rx="20" ry="8" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="2.2" stroke-dasharray="5 3"/>${BOX}`,
  rim: `${BOX}<path d="M24 20 L36 14 L46 19 L46 31 L34 37 L24 32 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
  ink: `<path d="M24 20 L36 14 L46 19 L46 31 L34 37 L24 32 Z" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/>${BOX}`,
  spotlight: `<rect width="64" height="48" fill="#000" fill-opacity=".35"/><path d="M31 2 L39 2 L52 40 L18 40 Z" fill="currentColor" fill-opacity=".18"/><ellipse cx="35" cy="37" rx="17" ry="5" fill="currentColor" fill-opacity=".25"/>${BOX}`,
  brackets: `${BOX}<path d="M18 16 v-5 h5 M52 16 v-5 h-5 M18 37 v5 h5 M52 37 v5 h-5" fill="none" stroke="currentColor" stroke-width="2.2"/>`,
  lift: `<ellipse cx="35" cy="39" rx="12" ry="3.5" fill="#000" fill-opacity=".45"/><g transform="translate(0 -7)">${BOX}</g><path d="M14 22 v-6 M11 19 l3 -3 l3 3" stroke="currentColor" stroke-width="1.6" fill="none"/>`,
  motes: `${BOX}<g fill="currentColor"><circle cx="17" cy="24" r="2"/><circle cx="52" cy="16" r="1.6"/><circle cx="50" cy="36" r="2.2"/><circle cx="22" cy="38" r="1.4"/><circle cx="30" cy="9" r="1.5"/></g>`,
  tint: `<path d="M24 20 L36 14 L46 19 L46 31 L34 37 L24 32 Z" fill="currentColor" fill-opacity=".55"/>${BOX.replace(/fill="#[0-9a-f]+"/g, 'fill="currentColor" fill-opacity=".35"')}`,
};

const CSS = `
.selLab .seats { display: flex; gap: 5px; } .selLab .seats button { width: 22px; height: 22px; padding: 0; border-radius: 50%; }
.selLab .seats button.on { outline: 2px solid var(--ink); outline-offset: 1px; }
.selLab .styles { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin: 6px 0; }
.selLab .styles button { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 3px 2px 4px; font-size: 10px; line-height: 1.1; color: var(--muted); background: #1b1d18; }
.selLab .styles button svg { width: 100%; max-width: 64px; height: auto; display: block; border-radius: 3px; background: #2a2b24; }
.selLab .styles button.on { border-color: var(--turnip); color: var(--ink); background: #2d3322; }
.selLab .cmpList { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8px; font-size: 11px; }
.selLab .cmpList label { display: flex; gap: 4px; align-items: center; color: var(--muted); }
.selCmpLabel { position: absolute; transform: translate(-50%, -100%); padding: 2px 6px; font: 11px "DM Mono", monospace; color: #f1e8d6; background: rgba(20,21,16,.8); border: 1px solid #3b382f; border-radius: 4px; pointer-events: none; white-space: nowrap; z-index: 2; }`;

export function createSelectionLab({ scene, camera, renderer, items = () => [], api = '/api/tw-ratings', toast = () => {}, focus = () => null, stage = null }) {
  const saved = store.get('tuner.fx.selection.current', null);
  // what sits on a thing (the tuner's surface items name their parent's uid): lift carries them along
  const ridersOf = (it) => { const uid = it?.spec?.uid; return uid ? [...items()].filter(i => i.spec?.parent === uid) : []; };
  const sel = createSelection({ scene, camera, renderer, params: saved || SELECTION_BUILTINS['harry-v1'](), ridersOf });
  let P = sel.params();
  let seat = store.get('tuner.sel.seat', SEATS[0]);
  let tab = 'selected', current = null, hovered = null, mode = null; // mode: null | 'compare' | 'states' | 'multi'
  const labels = []; // compare-mode DOM labels: { el, item }
  const box = document.querySelector('details.major[data-key="selection"]');

  let link = null; // "what is the game using" (houselink.js)
  function onChange() { sel.set(P); store.set('tuner.fx.selection.current', P); link?.changed(); }
  function setParams(p) { P = mergeSelection(p); onChange(); draw(); }

  // ---------------------------------------------------------------- panel
  let sec = null;
  const $ = (s) => sec?.querySelector(s);
  function build() {
    if (!box) return;
    if (!document.querySelector('#selLabCss')) { const st = document.createElement('style'); st.id = 'selLabCss'; st.textContent = CSS; document.head.append(st); }
    box.querySelectorAll(':scope > section').forEach(s => s.remove());
    sec = document.createElement('section'); sec.className = 'fxPanel selLab'; sec.id = 'fx-selection';
    sec.innerHTML = `
      <div class="muted small">Click an object to see it live; hover shows the hover style. Everything here is depth-tested: nothing shows through walls unless you turn up "ghost".</div>
      <div class="row"><span class="muted small">Preview seat colour</span><div class="seats" id="sel-seats"></div></div>
      <div class="tabs" role="tablist" id="sel-tabs">${SEL_STATES.map(([k, l]) => `<button data-state="${k}" role="tab">${l}</button>`).join('')}</div>
      <div class="styles" id="sel-styles">${SEL_STYLES.map(([k, l]) => `<button data-style="${k}" title="${l}"><svg viewBox="0 0 64 48">${ICONS[k]}</svg>${l}</button>`).join('')}</div>
      <label class="dial"><span>Colour</span><select id="sel-colorSrc"><option value="seat">the seat's colour</option><option value="fixed">a fixed colour</option></select></label>
      <div class="row" id="sel-fixedRow"><input type="color" id="sel-fixed"><span class="muted small" id="sel-fixedHex"></span></div>
      <label class="dial" id="sel-ghostRow"><span>Ghost through occluders <output id="sel-ghostOut"></output></span><input id="sel-ghost" type="range" min="0" max="1" step="0.05"></label>
      <div id="sel-dials"></div>
      <div id="sel-multi"></div>
      <h3>Try it</h3>
      <div class="row"><button id="sel-compare" title="one style per object, side by side">Compare styles</button><button id="sel-states" title="three objects: hover · selected · hidden from players">Hover · selected · hidden</button><button id="sel-multiBtn" title="three objects selected together">Multi-select ×3</button><button id="sel-stop">Stop</button></div>
      <details id="sel-cmpBox"><summary>Styles to compare</summary><div class="cmpList">${SEL_STYLES.map(([k, l]) => `<label><input type="checkbox" data-cmp="${k}" ${k === 'spotlight' ? '' : 'checked'}> ${l}</label>`).join('')}</div>
        <div class="muted small">Spotlight dims the whole scene, so it starts unticked.</div></details>
      <h3>Presets</h3>
      <div class="row"><input id="fx-selection-name" placeholder="preset name"></div>
      <div class="row"><button id="fx-selection-save">Save</button><select id="fx-selection-load"><option value="">Load…</option></select><button id="fx-selection-reset" title="Harry's pick (harry-v1): breathing corner brackets, footprint hover, tint for hidden">Defaults</button></div>
      <textarea id="fx-selection-note" rows="2" placeholder="Notes for Fauna about this selection look (sent with the preset)"></textarea>
      <div class="row"><button id="fx-selection-send" class="primary">Send selection preset to Fauna</button><button id="fx-selection-house" title="Make this the game's selection look (turnipworks.net)">Use in game</button></div>`;
    box.append(sec);
    const seats = $('#sel-seats');
    for (const c of SEATS) { const b = document.createElement('button'); b.style.background = c; b.dataset.seat = c; b.title = `preview as a seat coloured ${c}`; b.addEventListener('click', () => { seat = c; store.set('tuner.sel.seat', c); restage(); draw(); }); seats.append(b); }
    sec.querySelectorAll('#sel-tabs button').forEach(b => b.addEventListener('click', () => { tab = b.dataset.state; draw(); }));
    sec.querySelectorAll('#sel-styles button').forEach(b => b.addEventListener('click', () => { P[tab].style = b.dataset.style; onChange(); draw(); }));
    $('#sel-colorSrc').addEventListener('change', (e) => { P[tab].color = e.target.value; onChange(); draw(); });
    $('#sel-fixed').addEventListener('input', (e) => { P[tab].fixed = e.target.value; $('#sel-fixedHex').textContent = e.target.value; onChange(); });
    $('#sel-ghost').addEventListener('input', (e) => { P[tab].ghost = +e.target.value; $('#sel-ghostOut').textContent = (+e.target.value).toFixed(2); onChange(); });
    $('#sel-compare').addEventListener('click', () => startCompare());
    $('#sel-states').addEventListener('click', () => startStates());
    $('#sel-multiBtn').addEventListener('click', () => startMulti());
    $('#sel-stop').addEventListener('click', () => stopMode(true));
    sec.querySelectorAll('[data-cmp]').forEach(c => c.addEventListener('change', () => { if (mode === 'compare') startCompare(); }));
    wirePresets();
    draw();
  }
  function draw() {
    if (!sec) return;
    const S = P[tab];
    sec.querySelectorAll('#sel-tabs button').forEach(b => b.classList.toggle('active', b.dataset.state === tab));
    sec.querySelectorAll('#sel-styles button').forEach(b => b.classList.toggle('on', b.dataset.style === S.style));
    sec.querySelectorAll('#sel-seats button').forEach(b => b.classList.toggle('on', b.dataset.seat === seat));
    sec.style.setProperty('color', 'var(--ink)');
    sec.querySelector('#sel-styles').style.setProperty('--acc', S.color === 'seat' ? seat : S.fixed);
    sec.querySelectorAll('#sel-styles svg').forEach(s => { s.style.color = S.color === 'seat' ? seat : S.fixed; });
    $('#sel-colorSrc').value = S.color; $('#sel-fixed').value = S.fixed; $('#sel-fixedHex').textContent = S.fixed;
    $('#sel-fixedRow').hidden = S.color !== 'fixed';
    $('#sel-ghost').value = S.ghost; $('#sel-ghostOut').textContent = (+S.ghost).toFixed(2);
    $('#sel-ghostRow').hidden = !GHOSTABLE.has(S.style);
    const root = $('#sel-dials'); root.innerHTML = '';
    const label = SEL_STYLES.find(s => s[0] === S.style)?.[1] || S.style;
    root.append(dialGroup(`${label}: dials (${SEL_STATES.find(s => s[0] === tab)[1].toLowerCase()})`, STYLE_SCHEMA[S.style], S.dials[S.style], `selection.${tab}.${S.style}`, () => onChange(), true));
    const mr = $('#sel-multi'); mr.innerHTML = '';
    mr.append(dialGroup('Several selected at once', MULTI_SCHEMA, P.multi, 'selection.multi', () => onChange(), false));
    $('#fx-selection-name').value = P.name || '';
  }

  // ---------------------------------------------------------------- presets (the FX pattern: fx/index.js)
  let remote = {};
  const prefix = 'sel-';
  const nameOf = () => ($('#fx-selection-name').value.trim() || P.name || prefix + 'untitled').replace(/[^A-Za-z0-9 ._-]/g, '-');
  const withPrefix = (n) => n.startsWith(prefix) ? n : prefix + n;
  async function fetchRemote() {
    try { const r = await fetch(`${api}/tuner/fx`); remote = r.ok ? await r.json() : {}; } catch { remote = {}; }
    fillLoad();
  }
  function fillLoad() {
    const s = $('#fx-selection-load'); if (!s) return; s.length = 1;
    for (const n of Object.keys(SELECTION_BUILTINS)) s.append(new Option(`${n} (built-in)`, 'builtin:' + n));
    for (const n of Object.keys(store.get('tuner.fx.selection.presets', {}))) s.append(new Option(`${n} (this browser)`, 'local:' + n));
    for (const [n, rec] of Object.entries(remote)) if (rec?.data?.fx === 'selection') s.append(new Option(`${n} (sent)`, 'remote:' + n));
  }
  function wirePresets() {
    $('#fx-selection-save').addEventListener('click', () => {
      const n = nameOf(); P.name = n;
      const all = store.get('tuner.fx.selection.presets', {}); all[n] = clone(P); store.set('tuner.fx.selection.presets', all);
      fillLoad(); onChange(); toast(`saved selection preset "${n}" in this browser`);
    });
    $('#fx-selection-load').addEventListener('change', (e) => {
      const v = e.target.value; if (!v) return;
      const src = v.split(':')[0], n = v.slice(v.indexOf(':') + 1);
      const p = src === 'builtin' ? SELECTION_BUILTINS[n]?.() : src === 'local' ? store.get('tuner.fx.selection.presets', {})[n] : remote[n]?.data;
      if (p) { setParams(p); toast(`loaded selection preset "${n}"`); }
      e.target.value = '';
    });
    $('#fx-selection-reset').addEventListener('click', () => { setParams(SELECTION_BUILTINS['harry-v1']()); toast('selection: harry-v1 (the default)'); });
    link = houseLink({ api, key: 'selection', label: 'selection look', sendBtn: $('#fx-selection-send'), houseBtn: $('#fx-selection-house'), current: () => P, norm: (p) => mergeSelection(p), toast });
    $('#fx-selection-send').addEventListener('click', async () => {
      const n = withPrefix(nameOf()); P.name = n; $('#fx-selection-name').value = n;
      const data = { ...clone(P), fx: 'selection' };
      try {
        const r = await fetch(`${api}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'fx', name: n, note: $('#fx-selection-note').value.trim(), data }) });
        const j = await r.json(); if (!r.ok || !j.ok) throw new Error(j.err || r.status);
        link.sent(n); fetchRemote();
      } catch (err) { toast(`send failed: ${err.message}. The preset is still saved in this page.`, true); }
    });
    $('#fx-selection-house').addEventListener('click', async () => {
      const n = withPrefix(nameOf()); const data = { selection: { ...clone(P), name: n, fx: 'selection' } };
      const note = `selection "${n}" is now the game's house look${$('#fx-selection-note').value.trim() ? ' · ' + $('#fx-selection-note').value.trim() : ''}`;
      try {
        const r = await fetch(`${api}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'house', name: 'house', note, data }) });
        const j = await r.json(); if (!r.ok || !j.ok) throw new Error(j.err || r.status);
        P.name = n; link.used(n);
      } catch (err) { toast(`could not set the house look: ${err.message}`, true); }
    });
  }

  // ---------------------------------------------------------------- live picking (main.js hooks)
  function select(it) {
    if (mode) stopMode(false);
    if (current && current !== it) sel.clear(current, 'selected');
    current = it || null;
    if (current) sel.select(current, 'selected', seat);
  }
  function hover(it) {
    if (it === hovered && (!it || sel.has(it, 'hover'))) return;
    if (hovered) sel.clear(hovered, 'hover');
    hovered = it || null;
    if (hovered) sel.select(hovered, 'hover', seat);
  }
  function restage() { // re-apply after a seat colour change
    if (current) sel.select(current, 'selected', seat);
    if (mode === 'compare') startCompare(); else if (mode === 'states') startStates(); else if (mode === 'multi') startMulti();
  }

  // ---------------------------------------------------------------- compare / preview modes
  // candidates: the objects nearest the camera's focus, real props (not floor, walls or doors), spaced apart
  function pickSpread(n) {
    const f = focus(); const fx = f?.x ?? 0, fz = f?.z ?? 0;
    const list = [...items()].filter(i => i.tag && i.visual && i.group?.visible !== false && !['floor', 'walls', 'openings'].includes(i.layer) && !i.spec?.parent)
      .map(i => { const [w, , d] = i.spec?.dims || [1, 1, 1]; return { i, w, d, dist: Math.hypot(i.rest.x - fx, i.rest.z - fz) }; })
      .filter(o => o.w * o.d >= 1.2).sort((a, b) => a.dist - b.dist);
    const out = [];
    for (const o of list) { if (out.length >= n) break; if (out.every(p => Math.hypot(p.i.rest.x - o.i.rest.x, p.i.rest.z - o.i.rest.z) > 3)) out.push(o); }
    return out.map(o => o.i);
  }
  function clearLabels() { labels.forEach(l => l.el.remove()); labels.length = 0; }
  function label(item, text) {
    const host = stage || renderer.domElement.parentElement; if (!host) return;
    const el = document.createElement('div'); el.className = 'selCmpLabel'; el.textContent = text; host.append(el); labels.push({ el, item });
  }
  function stopMode(clearSel) {
    if (!mode) return;
    mode = null; clearLabels();
    sel.clear(); hovered = null;
    if (current) sel.select(current, 'selected', seat);
  }
  function startCompare() {
    stopMode(false); sel.clear();
    const styles = [...sec.querySelectorAll('[data-cmp]')].filter(c => c.checked).map(c => c.dataset.cmp);
    const its = pickSpread(styles.length);
    if (!its.length) { toast('compare needs a room with furniture in view (make a room first)', true); return; }
    mode = 'compare';
    its.forEach((it, k) => { sel.select(it, 'selected', seat, { style: styles[k] }); label(it, SEL_STYLES.find(s => s[0] === styles[k])[1]); });
    if (its.length < styles.length) toast(`compare: ${its.length} objects in view for ${styles.length} styles; zoom out or pick a fuller room`);
  }
  function startStates() {
    stopMode(false); sel.clear();
    const its = pickSpread(3); if (its.length < 3) { toast('needs three objects in view', true); return; }
    mode = 'states';
    sel.select(its[0], 'hover', seat); label(its[0], 'hover');
    sel.select(its[1], 'selected', seat); label(its[1], 'selected');
    sel.select(its[2], 'hidden', seat); label(its[2], 'hidden from players');
  }
  function startMulti() {
    stopMode(false); sel.clear();
    const its = pickSpread(3); if (its.length < 2) { toast('needs objects in view', true); return; }
    mode = 'multi';
    its.forEach(it => sel.select(it, 'selected', seat));
    label(its[0], `${its.length} selected (${P.multi.mode})`);
  }

  function tick(dt, now) {
    sel.tick(dt, now, camera);
    if (labels.length) {
      const r = renderer.domElement.getBoundingClientRect(), host = (stage || renderer.domElement.parentElement).getBoundingClientRect();
      for (const l of labels) {
        const g = l.item.group, h = (l.item.spec?.dims?.[1] || 1) + 0.6;
        const v = g.position.clone(); g.parent?.localToWorld(v); v.y += h; v.project(camera);
        l.el.style.left = (r.left - host.left + (v.x + 1) / 2 * r.width) + 'px'; l.el.style.top = (r.top - host.top + (1 - v.y) / 2 * r.height) + 'px';
        l.el.hidden = v.z > 1;
      }
    }
  }

  build();
  if (box) fetchRemote();
  const lab = {
    sel, tick, select, hover, setParams,
    pick: (tag) => { const it = [...items()].find(i => i.tag === tag); select(it || null); return !!it; }, // select without the tuner's room outline / tag label (screenshots)
    params: () => clone(P), seat: () => seat,
    compare: startCompare, states: startStates, multi: startMulti, stop: () => stopMode(true), mode: () => mode,
    labels: () => labels.map(l => l.el.textContent),
    hovered: () => hovered?.tag || null, current: () => current?.tag || null,
  };
  window.selLab = lab; // test + automation hook (test/sel_ui.py)
  return lab;
}
