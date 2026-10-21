// The Ring Lab drawer. Plain words (Harry 2026-10-20: "pretty much all of the terminology on this tuner [is] impenetrable
// ... throw out like 80% of it and just keep the critical ones"): with One curve on it shows only the knobs that shape that
// ring; everything else sits in ONE collapsed "Advanced (rarely needed)" group. Every angle reads as a clock time. Undo /
// Redo walk this session's changes; "Revert to <preset>" goes back to what was last loaded or saved; ↺ puts back one knob.
// Code names (and the saved-record format) are unchanged: this file only decides what is shown and what it is called.
import { ARC_KEYS, ARC_LIMITS, CURVE_LIMITS, CURVE_EASINGS, WORLD_LIMITS, snapArc, ellipseLut, sAt } from './model.js';
import { BUILTINS, normalize, envelope } from './presets.js';

// ---- words ----------------------------------------------------------------------------------------------------------
// Clock angles read as a clock: 0 is 12:00, 90 is 3:00, -90 is 9:00.
export const clockText = deg => { const h = (((+deg % 360) + 360) % 360) / 30, m = Math.round((h % 1) * 60); return `${Math.floor(h) + (m === 60 ? 1 : 0) || 12}:${String(m % 60).padStart(2, '0')}`; };
// A spread of the clock: 100 degrees is "3 h 20 min".
export const clockSpan = deg => { const mins = Math.round(Math.abs(+deg) * 2), h = Math.floor(mins / 60), m = mins % 60; return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`; };
const ARC_TITLES = { closed: 'Menu shut: main buttons', primary: 'Menu open: main buttons', secondary: 'Menu open: extra buttons', menu: 'The More button (☰)', conditions: 'Sub-menu: Conditions', faction: 'Sub-menu: Faction', nested: 'Other sub-menus' };
const C = (label, hint, extra = {}) => ({ label, hint, ...extra });
const CLOCK = { fmt: v => clockText(v) }, PX = { fmt: v => `${Math.round(v)} px` }, MS = { fmt: v => `${Math.round(v)} ms` };
const FIELDS = {
  'curve.on': C('One curve: every button on one oval', 'Off: the separate rings below are used instead'),
  'curve.rx': C('Oval width (px, centre to side)', 'Half the oval’s width, at the design button size', PX),
  'curve.ry': C('Oval height (px, centre to top)', 'Half the oval’s height, at the design button size', PX),
  'curve.x': C('Move oval left / right', 'Negative is left, positive is right', PX),
  'curve.y': C('Move oval up / down', 'Negative is UP, positive is down. "Revised 2" was tuned before the ring centred on the head (85 %)', PX),
  'curve.size': C('Button size (px)', 'With Size in the world on: the design size the oval is drawn for', PX),
  'curve.gap': C('Space between buttons', 'Along the oval, between neighbouring buttons', PX),
  'curve.groupGap': C('Extra space between main and extra buttons', 'Menu open: the break where main meets extra', PX),
  'curve.closedAt': C('Menu shut: buttons centred at', 'The middle of the shut row, as a clock time', CLOCK),
  'curve.secondaryStart': C('Menu open: extra buttons start at', 'The first extra button, as a clock time', CLOCK),
  'curve.primaryFloor': C('Menu open: main buttons go no lower than', 'They slide down the left side to here at most', CLOCK),
  'curve.nestOffset': C('Sub-menu: distance outside the main oval', 'Added to both the width and the height', PX),
  'curve.nestStart': C('Sub-menu: starts at', 'The first sub-menu button, as a clock time', CLOCK),
  'curve.off': C('Old separate rings', 'Off: One curve (the canon); on: the old separate rings'),
  'curve.nestEnd': C('Sub-menu: ends by', 'No sub-menu button past this; more go one ring out', CLOCK),
  'curve.duration': C('Slide time (ms)', 'How long opening and shutting take', MS),
  'curve.stagger': C('Delay between buttons (ms)', 'Each button starts this much after the one before', MS),
  'curve.easing': C('Slide easing', 'How the slide speeds up and slows down', { choices: CURVE_EASINGS.map(x => [x, x]) }),
  'curve.enter': C('Extra buttons appear', 'On opening', { choices: [['from ☰', 'sliding out of More'], ['fade', 'fading in']] }),
  'centre.pawn': C('Centre on: height up the model (%)', 'Pawns: 0 is the floor, 100 the top of the figure', { fmt: v => `${Math.round(v)} %` }),
  'centre.thing': C('Centre on things: height up (%)', 'Things (doors, lights …): 50 is the middle', { fmt: v => `${Math.round(v)} %` }),
  'world.on': C('Size the ring in the world (ft)', 'Zooming in makes it bigger, like the table'),
  'world.buttonFt': C('Base button size (ft)', 'On a 5 ft piece; screen px follow the camera', { fmt: v => `${(+v).toFixed(2)} ft` }),
  'world.grow': C('Bigger pieces grow the ring', '0: the same for every piece; 1: in step with the base', { fmt: v => `×${(+v).toFixed(2)}` }),
  'world.minPx': C('Smallest button (px)', 'Zoomed far out, the ring stops shrinking here', PX),
  'world.maxPx': C('Largest button (px)', 'Zoomed in close, the ring stops growing here', PX),
  'world.pure': C('Pure world size (no limits)', 'Ignore smallest and largest: feel the extremes'),
  // a separate ring (One curve off)
  radius: C('Ring radius (px)', 'From the piece to the buttons', PX),
  start: C('Starts at', 'The first button, as a clock time', CLOCK),
  span: C('Spread', 'How much of the clock the buttons cover', { fmt: v => clockSpan(v) }),
  fit: C('Space by button size (ignore spread)', 'Buttons a fixed distance apart from the start'),
  ellipse: C('Oval (even spacing along it)', 'Use width and height instead of the radius'),
  rx: C('Oval width (px)', 'Centre to side', PX), ry: C('Oval height (px)', 'Centre to top', PX),
  direction: C('Runs', 'Which way round from the start', { choices: [['clockwise', 'clockwise'], ['counterclockwise', 'anticlockwise']] }),
  gap: C('Space between buttons', '', PX), size: C('Button size (px)', '', PX),
  x: C('Move left / right', 'Negative is left', PX), y: C('Move up / down', 'Negative is UP', PX),
  holds: C('Shows', 'Which buttons this ring carries', { choices: [['primary', 'main buttons'], ['secondary', 'extra buttons'], ['menu', 'the More button'], ['nested', 'sub-menu items']] }),
  from: C('Replay slides in from', 'Used by “Replay opening”', { choices: [['slot', 'its own shut spot'], ['centre', 'the piece'], ['menu', 'the More button']] }),
  duration: C('Slide time (ms)', '', MS), stagger: C('Delay between buttons (ms)', '', MS),
  easing: C('Slide easing', '', { choices: ['ease-out', 'ease-in-out', 'linear', 'cubic-bezier(.2,.8,.2,1)'].map(x => [x, x]) }),
  // drag tracks, names, pictures, button feel, view
  'tracks.style': C('Drag track shape', 'Damage, height, size, fog', { choices: [['radial', 'straight'], ['arc', 'curved']] }),
  'tracks.length': C('Drag track length (px)', '', PX), 'tracks.angle': C('Drag track points to', 'As a clock time', CLOCK),
  'tracks.radius': C('Curved track radius (px)', '', PX), 'tracks.x': C('Track: move left / right', '', PX), 'tracks.y': C('Track: move up / down', 'Negative is UP', PX),
  'tracks.ticks': C('Tick marks on the track', ''),
  'tracks.valuePosition': C('Value shown at', '', { choices: [['end', 'the far end'], ['middle', 'the middle'], ['button', 'the button']] }),
  labelMode: C('Button names', '', { choices: [['hover', 'on hover'], ['below', 'under the button'], ['over', 'curved above'], ['under', 'curved below']] }),
  labelWhen: C('Names shown', '', { choices: [['always', 'always'], ['hovered', 'on hover only']] }),
  fontSize: C('Name size (px)', '', PX), fontWeight: C('Name weight', '', { fmt: v => String(v) }),
  labelColor: C('Name colour', '', { choices: [['#f6e7cc', 'cream'], ['#ffffff', 'white'], ['#98d6ca', 'teal'], ['#242b2b', 'charcoal']] }),
  labelHalo: C('Name outline (px)', '', PX), labelOffset: C('Name distance from button', '', PX),
  iconSet: C('Pictures', 'Line icons or a painted set', { choices: [] }),
  hover: C('Grow on hover', '', { fmt: v => `×${(+v).toFixed(2)}` }), press: C('Shrink when pressed', '', { fmt: v => `×${(+v).toFixed(2)}` }),
  edgeRule: C('Near the screen edge', 'Not used with Size in the world on', { choices: [['slide', 'slide back on screen'], ['flip', 'flip to the other side'], ['rotate', 'turn away from the edge'], ['squash', 'squeeze to fit']] }),
  showGhost: C('Show where the shut menu was', ''), showMotion: C('Show slide paths', ''),
};
const LIMITS = { tracks: { length: [0, 600, 1], angle: [-360, 360, 1], radius: [0, 600, 1], x: ARC_LIMITS.x, y: ARC_LIMITS.y }, root: { fontSize: [9, 24, 1], fontWeight: [400, 800, 100], labelHalo: [0, 10, 1], labelOffset: [-80, 100, 1], hover: [1, 1.5, .01], press: [.5, 1, .01] } };
const keyOf = path => path.split('.').pop();
const SUB = { conditions: 'Conditions', faction: 'Faction', nested: 'Other sub-menus' };
const fieldOf = path => { const f = FIELDS[path] || FIELDS[keyOf(path)] || C(keyOf(path), ''), m = /^arcs\.(conditions|faction|nested)\.(duration|easing)$/.exec(path); return m ? { ...f, label: `${SUB[m[1]]}: ${f.label.toLowerCase()}` } : f; };
const limitsOf = path => {
  const [a, b, c] = path.split('.');
  if (a === 'curve') return CURVE_LIMITS[b]; if (a === 'world') return WORLD_LIMITS[b]; if (a === 'centre') return [0, 100, 1];
  if (a === 'arcs') return ARC_LIMITS[c]; if (a === 'tracks') return LIMITS.tracks[b];
  return LIMITS.root[a];
};
export const getPath = (o, p) => p.split('.').reduce((v, k) => v?.[k], o);
export const setPath = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((x, k) => x[k], o)[last] = v; };
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const show = (path, v) => { const f = fieldOf(path); return f.fmt ? f.fmt(v) : Number.isFinite(+v) ? String(Math.round(+v * 100) / 100) : String(v); };
const reset = path => `<button type="button" class="rl-reset" data-reset="${path}" title="Back to the loaded preset’s value">↺</button>`;
const hint = f => f.hint ? `<small class="rl-hint">${esc(f.hint)}</small>` : '';
function control(path, value) {
  const f = fieldOf(path), k = keyOf(path), title = esc(f.hint || '');
  if (typeof value === 'boolean') return `<div class="rl-row" title="${title}"><label class="rl-check"><input type="checkbox" data-path="${path}" data-field="${k}"${value ? ' checked' : ''}>${esc(f.label)}</label>${reset(path)}</div>`;
  if (f.choices) {
    const choices = f.choices.some(([v]) => String(v) === String(value)) ? f.choices : [...f.choices, [value, value]];
    return `<label class="rl-control" title="${title}"><span>${esc(f.label)}</span>${reset(path)}<select data-path="${path}" data-field="${k}">${choices.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>${hint(f)}</label>`;
  }
  const [min, max, step] = limitsOf(path) || [0, 100, 1];
  return `<label class="rl-control" title="${title}"><span>${esc(f.label)}</span><output>${esc(show(path, value))}</output>${reset(path)}<input type="range" data-path="${path}" data-field="${k}" min="${min}" max="${max}" step="${step}" value="${value}">${hint(f)}</label>`;
}
const section = (title, paths, s, attrs = '') => !paths.length ? '' : `<section class="rl-arc"${attrs}><h3>${esc(title)}</h3>${paths.map(p => control(p, getPath(s, p))).join('')}</section>`;
export function curveReadout(c) {
  const lut = ellipseLut(c.rx, c.ry), pitch = c.size + c.gap, top = sAt(lut, 90) - sAt(lut, -90);
  const g = ellipseLut(c.rx + c.nestOffset, c.ry + c.nestOffset), nest = sAt(g, c.nestEnd + (c.nestEnd < c.nestStart ? 360 : 0)) - sAt(g, c.nestStart);
  return `${Math.floor(top / pitch) + 1} buttons fit across the top (9:00 to 3:00); the sub-menu fits ${Math.floor(nest / pitch) + 1}, more go one ring further out`;
}
// The paths the short drawer shows (One curve on), in Harry's order. Everything else is in Advanced.
export function simplePaths(s) {
  return [['Shape', ['curve.rx', 'curve.ry', 'curve.y']],
    ['Buttons', [s.world?.on ? 'world.buttonFt' : 'curve.size', 'curve.gap', 'curve.groupGap']],
    ['Where', ['curve.closedAt', 'curve.secondaryStart', 'curve.primaryFloor']], ['Sub-menu', ['curve.nestOffset', 'curve.nestStart', 'curve.nestEnd']],
    ['Size limits', s.world?.on ? ['world.on', 'world.minPx', 'world.maxPx', 'world.grow', 'world.pure'] : ['world.on']],
    ['Motion', ['curve.duration', 'curve.stagger']]];
}
const ARC_FIELDS = a => ['radius', 'start', 'span', 'fit', 'ellipse', ...(a.ellipse ? ['rx', 'ry'] : []), 'direction', 'gap', 'size', 'x', 'y', 'holds', 'from', 'duration', 'stagger', 'easing'];

export function mountRingPanel(host, {
  ratingsApi = '/api/tw-ratings', initial, initialName = 'Quiet brass · Fauna', onChange = () => {}, onReplay = () => {},
  onUiSize = () => {}, uiSize = 1, onLab = null, countForArc = () => 1, who = () => '',
  game = false,   // true: the drawer drives the GAME ring (?ringlab=1): the offline bench's own knobs (its drag tracks, ghost,
                  // slide paths, compare) do nothing there and are not shown
} = {}) {
  const $ = s => host.querySelector(s);
  let settings = normalize(initial || BUILTINS['Quiet brass · Fauna']);
  let slidInfo = null; // (where the last layout slid a row: setSlid)
  let presets = Object.fromEntries(Object.entries(BUILTINS).map(([k, v]) => [k, normalize(v)]));
  let manifest = { sets: [] }, compare = false, damagePaths = [];
  // (declared before the first renderControls: a page that starts with world size on reads it at once; declared later,
  // it threw "Cannot access 'worldInfo' before initialization" and Ring Lab did not start, 2026-10-20)
  let worldInfo = null, worldName = '';
  // what Revert and ↺ go back to: the last preset loaded or saved
  const stamp = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  let base = { name: initialName, verb: 'opened', at: stamp(), json: JSON.stringify(settings) };
  let baseSettings = JSON.parse(base.json);
  const setBase = (name, verb) => { base = { name, verb, at: stamp(), json: JSON.stringify(settings) }; baseSettings = JSON.parse(base.json); };
  // Undo / Redo: whole-settings snapshots, one per gesture (a slider drag is one step: committed on release, or 400 ms on)
  let hist = [JSON.stringify(settings)], at = 0, pending = null, quiet = false;
  const commit = () => { clearTimeout(pending); pending = null; const s = JSON.stringify(settings); if (s === hist[at]) return; hist = hist.slice(0, at + 1); hist.push(s); if (hist.length > 400) hist.shift(); at = hist.length - 1; syncButtons(); };
  // The draft is "this browser's unsaved changes": written only once the settings differ from where the page started,
  // so a browser that changed nothing starts from the house default next time (2026-10-20).
  let startJson = JSON.stringify(settings);
  const persistent = () => { try { if (JSON.stringify(settings) !== startJson || localStorage.getItem('tw.ring.draft')) localStorage.setItem('tw.ring.draft', JSON.stringify(envelope(settings))); } catch { } };
  const changed = () => { persistent(); if (!quiet) { clearTimeout(pending); pending = setTimeout(commit, 400); } onChange(settings, compare ? presets[$('[data-role="presetB"]').value] : null); syncButtons(); };
  const status = text => { $('[data-role="status"]').textContent = text; };
  host.innerHTML = `<div class="rl-panel-head"><b>Ring lab</b><button type="button" data-role="collapse" aria-label="Collapse ring controls">◀</button></div>
    <div class="rl-panel-body">
      <div class="rl-save">
        <label>Preset <select data-role="preset"></select></label><button type="button" data-role="loadPreset">Load</button>
        <label>Name <input data-role="name" maxlength="100" placeholder="Harry’s ring"></label><button type="button" data-role="save">Save</button>
        <button type="button" data-role="useDefault" title="Every browser without unsaved changes starts from this ring">Use as default</button>
        <span class="rl-history"><button type="button" data-role="undo" title="Undo the last change here (not the game's undo)">Undo</button><button type="button" data-role="redo">Redo</button>
        <button type="button" data-role="revert"></button></span>
        <small data-role="status">Settings stay in this browser until Save.</small>
      </div>
      <div class="rl-view">
        <label>View <select data-role="state"><option value="closed">menu shut</option><option value="expanded">menu open</option><option value="nested">sub-menu</option></select></label>
        <label class="rl-check"><input type="checkbox" data-field="sector">Show the 3–6 zone</label>
      </div>
      <output class="rl-warning" data-role="warnings">Select a piece to tune its ring.</output>
      <div data-role="controls"></div>
      <details class="rl-advanced"><summary>Advanced (rarely needed)</summary>
        <div class="rl-view">
          ${onLab ? '<button type="button" data-role="lab">Open Ring lab table</button>' : ''}
          <label>Ring size (menu scale) <input type="range" data-role="uiSize" min="0.7" max="1.6" step="0.05" value="${uiSize}"><output data-role="uiSizeOut">${uiSize}×</output></label>
          <button type="button" data-role="replay">Replay opening</button>
          <label class="rl-check"><input type="checkbox" data-field="pickIcons">Click a button to try its other pictures</label>
          <span class="rl-bench"${game ? ' hidden' : ''}><button type="button" data-role="compare">Compare with another preset</button><label>with <select data-role="presetB"></select></label></span>
          <button type="button" data-role="copy">Copy settings</button><button type="button" data-role="loadJson">Load JSON</button>
          <textarea data-role="json" placeholder="Version 1 or 2 settings JSON"></textarea>
        </div>
        <div data-role="damageChoices"></div>
        <div data-role="advControls"></div>
      </details>
    </div>`;
  const listPresets = () => {
    for (const role of ['preset', 'presetB']) {
      const el = $(`[data-role="${role}"]`), old = el.value;
      el.innerHTML = Object.keys(presets).map(() => `<option></option>`).join('');
      Object.keys(presets).forEach((name, i) => { el.options[i].text = name; el.options[i].value = name; });
      el.value = old && presets[old] ? old : role === 'presetB' ? 'Tight horseshoe' : 'Quiet brass · Fauna';
    }
  };
  listPresets();
  function syncButtons() {
    $('[data-role="undo"]').disabled = at <= 0 && !pending; $('[data-role="redo"]').disabled = at >= hist.length - 1;
    const rv = $('[data-role="revert"]'); rv.textContent = `Revert to ${base.name} (${base.verb} ${base.at})`;
    rv.disabled = JSON.stringify(settings) === base.json;
    for (const b of host.querySelectorAll('[data-reset]')) b.classList.toggle('same', JSON.stringify(getPath(settings, b.dataset.reset)) === JSON.stringify(getPath(baseSettings, b.dataset.reset)));
  }

  function arcSection(key) {
    const a = settings.arcs[key];
    return `<section class="rl-arc" data-arc="${key}"><h3>${esc(ARC_TITLES[key])}</h3>${ARC_FIELDS(a).map(k => control(`arcs.${key}.${k}`, a[k])).join('')}
      <div class="rl-snap"><select data-role="snapSource">${ARC_KEYS.filter(x => x !== key).map(x => `<option value="${x}">${esc(ARC_TITLES[x])}</option>`).join('')}</select>
        <button type="button" data-snap="radius">Same radius</button><button type="button" data-snap="continue">Carry on from its end</button>
        <button type="button" data-snap="align">Same start</button><button type="button" data-snap="mirror">Mirror</button>
        <button type="button" data-snap="grow" title="Same oval, both width and height grown by one button + space (never scaled)">Grow from</button></div></section>`;
  }
  function renderControls() {
    const S = settings, curveOn = !!S.curve.on;
    FIELDS.iconSet.choices = [['line (current)', 'line icons'], ...manifest.sets.map(x => [x.id, x.id])];
    let main = '', adv = '';
    if (curveOn) {
      main = simplePaths(S).map(([t, ps]) => section(t, ps, S, ' data-arc="curve"')).join('')
        .replace('<h3>Shape</h3>', `<h3>Shape</h3><output class="rl-curve-read" data-role="curveRead">${esc(curveReadout(S.curve))}</output>`);
      if (S.world.on) main = main.replace('<h3>Size limits</h3>', '<h3>Size limits</h3><output class="rl-curve-read" data-role="worldRead">Select a piece.</output>');
      main = main.replace('<h3>Where</h3>', `<h3>Where</h3><output class="rl-curve-read" data-role="slidRead">${esc(slidText())}</output>`);
      adv += section('Centre on', ['centre.pawn', 'centre.thing'], S);
      adv += section('One curve: more', ['curve.x', 'curve.easing', 'curve.enter', ...(S.world.on ? ['curve.size'] : [])], S, ' data-arc="curve"');
      // (One curve is canon, 2026-10-20: the separate rings are not shown at all while it is on; the way back is at the bottom)
    } else {
      main = section('One curve', ['curve.on'], S, ' data-arc="curve"') + section('Centre on', ['centre.pawn', 'centre.thing'], S) + section('Size limits', S.world.on ? ['world.on', 'world.buttonFt', 'world.minPx', 'world.maxPx', 'world.grow', 'world.pure'] : ['world.on'], S, ' data-arc="world"');
      if (S.world.on) main = main.replace('<h3>Size limits</h3>', '<h3>Size limits</h3><output class="rl-curve-read" data-role="worldRead">Select a piece.</output>');
      main += ARC_KEYS.map(arcSection).join('');
      adv += section('One curve (when on)', ['curve.rx', 'curve.ry', 'curve.x', 'curve.y', 'curve.size', 'curve.gap', 'curve.groupGap', 'curve.closedAt', 'curve.secondaryStart', 'curve.primaryFloor', 'curve.nestOffset', 'curve.nestStart', 'curve.nestEnd', 'curve.duration', 'curve.stagger', 'curve.easing', 'curve.enter'], S, ' data-arc="curve-off"');
    }
    // shown only where they do something: the edge rule without world size, a curved track's radius, "names shown"
    // for names under the button, the name distance for curved names; the menu scale is ignored with world size
    adv += section('View', [...(S.world.on ? [] : ['edgeRule']), ...(game ? [] : ['showGhost', 'showMotion'])], S);
    const ui = $('[data-role="uiSize"]')?.closest('label'); if (ui) ui.hidden = !!S.world.on;
    if (!game) adv += section('Drag tracks', ['tracks.style', 'tracks.length', 'tracks.angle', ...(S.tracks.style === 'arc' ? ['tracks.radius'] : []), 'tracks.x', 'tracks.y', 'tracks.ticks', 'tracks.valuePosition'], S, ' data-arc="tracks"');
    adv += section('Names and pictures', ['labelMode', ...(S.labelMode === 'below' ? ['labelWhen'] : []), 'fontSize', 'fontWeight', 'labelColor', 'labelHalo', ...(['over', 'under'].includes(S.labelMode) ? ['labelOffset'] : []), 'iconSet'], S);
    adv += section('Button feel', ['hover', 'press'], S);
    if (curveOn) adv += `<section class="rl-arc rl-old"><h3>Old separate rings</h3>${control('curve.off', false)}</section>`;
    $('[data-role="controls"]').innerHTML = main; $('[data-role="advControls"]').innerHTML = adv;
    for (const sel of host.querySelectorAll('[data-arc] [data-role="snapSource"]')) { const key = sel.closest('[data-arc]').dataset.arc; sel.value = key === 'closed' ? 'primary' : key === 'primary' ? 'closed' : key === 'secondary' ? 'primary' : 'secondary'; }
    syncButtons(); worldRead();
  }
  renderControls();

  host.addEventListener('input', ev => {
    const el = ev.target, path = el.dataset.path;
    if (path === 'curve.off') { settings.curve.on = !el.checked; renderControls(); changed(); return; }
    if (path) {
      const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
      setPath(settings, path, v);
      if (el.type === 'range') el.closest('label').querySelector('output').textContent = show(path, v);
      const read = $('[data-role="curveRead"]'); if (read && path.startsWith('curve.')) read.textContent = curveReadout(settings.curve);
      // An oval starts as the circle it was (width = height = radius), so turning it on moves nothing.
      if (/^arcs\.\w+\.ellipse$/.test(path) && v) { const a = getPath(settings, path.replace(/\.ellipse$/, '')); a.rx ??= a.radius; a.ry ??= a.radius; }
      if (/\.ellipse$|^curve\.on$|^world\.on$|^tracks\.style$|^labelMode$/.test(path)) renderControls();
      changed(); return;
    }
    if (el.dataset.role === 'uiSize') { $('[data-role="uiSizeOut"]').textContent = (+el.value).toFixed(2) + '×'; onUiSize(+el.value); changed(); }
    if (['state', 'presetB'].includes(el.dataset.role) || ['sector', 'pickIcons'].includes(el.dataset.field)) changed();
  });
  host.addEventListener('change', ev => { if (ev.target.dataset.path) commit(); });   // a slider let go = one undo step
  host.addEventListener('click', ev => {
    const t = ev.target;
    if (t.dataset.reset === 'curve.off') { settings.curve.on = baseSettings.curve.on; renderControls(); changed(); commit(); return; }
    if (t.dataset.reset) { setPath(settings, t.dataset.reset, structuredClone(getPath(baseSettings, t.dataset.reset))); renderControls(); changed(); commit(); return; }
    const how = t.dataset.snap; if (!how) return;
    const sec = t.closest('[data-arc]'), key = sec.dataset.arc, sourceKey = sec.querySelector('[data-role="snapSource"]').value;
    settings.arcs[key] = snapArc(settings.arcs[key], settings.arcs[sourceKey], how, countForArc(sourceKey));
    renderControls(); changed(); commit();
  });
  // (never Ctrl+Z here: that key is the game's own undo)
  const restore = json => { quiet = true; settings = JSON.parse(json); renderControls(); changed(); quiet = false; };
  $('[data-role="undo"]').onclick = () => { commit(); if (at > 0) { at--; restore(hist[at]); status('Undone'); } };
  $('[data-role="redo"]').onclick = () => { if (at < hist.length - 1) { at++; restore(hist[at]); status('Redone'); } };
  $('[data-role="revert"]').onclick = () => { commit(); settings = JSON.parse(base.json); renderControls(); changed(); commit(); status(`Back to ${base.name}`); };
  $('[data-role="collapse"]').onclick = () => { host.classList.toggle('collapsed'); $('[data-role="collapse"]').textContent = host.classList.contains('collapsed') ? '▶' : '◀'; };
  $('[data-role="loadPreset"]').onclick = () => { const name = $('[data-role="preset"]').value; commit(); settings = normalize(presets[name]); setBase(name, 'loaded'); renderControls(); changed(); commit(); status('Loaded ' + name); };
  $('[data-role="compare"]').onclick = () => { compare = !compare; $('[data-role="compare"]').textContent = compare ? 'Back to one view' : 'Compare with another preset'; changed(); };
  $('[data-role="replay"]').onclick = () => onReplay();
  if (onLab) $('[data-role="lab"]').onclick = onLab;
  $('[data-role="copy"]').onclick = async () => { const j = JSON.stringify(envelope(settings), null, 2); $('[data-role="json"]').value = j; try { await navigator.clipboard.writeText(j); status('Copied settings JSON'); } catch { status('JSON ready to copy below'); } };
  $('[data-role="loadJson"]').onclick = () => { try { commit(); settings = normalize(JSON.parse($('[data-role="json"]').value)); setBase('the pasted JSON', 'loaded'); renderControls(); changed(); commit(); status('Loaded JSON'); } catch (e) { status('Invalid JSON: ' + e.message); } };
  const when = iso => { const d = new Date(iso); return Number.isFinite(+d) ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : ''; };
  // USE AS DEFAULT: the house ring (GET /tuner/house -> ring), as the other tuners' "Use in game"; one field of its own
  // in the append-only house record, so no other house value is touched (server/ratings_server.py HOUSE_FIELDS).
  $('[data-role="useDefault"]').onclick = async () => {
    const name = $('[data-role="name"]').value.trim() || base.name, by = who() || 'Ring Lab', savedAt = new Date().toISOString();
    const ring = { name, by, savedAt, ...envelope(settings) };
    try { const r = await fetch(`${ratingsApi}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'house', name: 'house', note: `ring "${name}" is now the Ring Lab default`, data: { ring } }) });
      if (!r.ok) throw Error(await r.text()); setBase(`house default · ${name}`, 'set'); syncButtons(); status(`Default for every new browser: ${name} (by ${by})`); } catch (e) { status('Could not set the default: ' + e.message); }
  };
  $('[data-role="save"]').onclick = async () => {
    const name = $('[data-role="name"]').value.trim(); if (!name) return status('Name this preset first');
    try { const r = await fetch(`${ratingsApi}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'ring', name, data: envelope(settings) }) }); if (!r.ok) throw Error(await r.text()); presets[name] = normalize(settings); listPresets(); $('[data-role="preset"]').value = name; setBase(name, 'saved'); syncButtons(); status('Saved ' + name); } catch (e) { status('Save failed: ' + e.message); }
  };
  // WHERE THE ROW WENT (Harry 2026-10-21): a row that would reach into 3–6 slides back along the curve as a whole; the
  // setting is untouched, so say where it starts and where it went
  function slidText() {
    const s = slidInfo; if (!s) return 'Every row starts where these say (none had to slide to stay out of 3–6).';
    const what = s.row === 'nested' ? 'The sub-menu starts' : s.row === 'closed' ? 'The shut row is centred' : 'The extra buttons start';
    return `${what} at ${clockText(s.from)} → slid to ${clockText(s.to)} to stay out of 3–6 (the setting is unchanged).`;
  }
  function worldRead() {
    const el = $('[data-role="worldRead"]'); if (!el) return;
    const w = worldInfo; if (!w) { el.textContent = 'Select a piece: the size follows the camera’s distance to it.'; return; }
    el.textContent = `${worldName}: ${w.pxPerFt.toFixed(2)} px per ft at the piece · base ${w.baseFt} ft (ring ×${w.grow.toFixed(2)}) · buttons ${Math.round(w.buttonPx)} px · scale ${w.scale.toFixed(3)} · ${w.clamped ? `held at the ${w.clamped} button (would be ${Math.round(w.wantPx)} px)` : 'within the limits'}`;
    el.classList.toggle('held', !!w.clamped);
  }

  const api = {
    settings: () => settings, presets: () => presets, manifest: () => manifest,
    state: () => $('[data-role="state"]').value,
    sector: () => $('[data-field="sector"]').checked,
    pickIcons: () => $('[data-field="pickIcons"]').checked,
    compare: () => compare ? presets[$('[data-role="presetB"]').value] : null,
    base: () => ({ ...base, settings: baseSettings }), history: () => ({ at, length: hist.length }),
    setWarnings: values => { const el = $('[data-role="warnings"]'); el.textContent = values.length ? 'Intrusion: ' + values.join(', ') : 'Forbidden sector clear'; el.classList.toggle('bad', !!values.length); },
    setSlid: info => { slidInfo = info || null; const el = $('[data-role="slidRead"]'); if (el) el.textContent = slidText(); },
    slidText: () => slidText(),
    setWorldReadout: (info, name) => { worldInfo = info; worldName = name || 'the piece'; worldRead(); },
    setManifest: m => { manifest = { sets: Array.isArray(m?.sets) ? m.sets : Object.keys(m?.sets || {}).map(id => ({ id })) }; renderControls(); changed(); },
    setSaved: records => { for (const [name, raw] of Object.entries(records || {})) presets[name] = normalize(raw); listPresets(); },
    // where the page starts when this browser has no unsaved draft: the house ring (Use as default)
    startFrom: (ring, label) => {
      settings = normalize(ring); startJson = JSON.stringify(settings); setBase(label, 'started'); hist = [JSON.stringify(settings)]; at = 0;
      renderControls(); onChange(settings, null); syncButtons(); status(`Started from: ${label}${ring?.savedAt ? ` · saved ${when(ring.savedAt)}` : ''}${ring?.by ? ` by ${ring.by}` : ''}`);
    },
    startedFrom: label => status(`Started from: ${label}`),
    selectState: state => { $('[data-role="state"]').value = state; changed(); },
    setSettings: value => { commit(); settings = normalize(value); renderControls(); changed(); commit(); },
    cycleIcon: id => { settings.iconAlternates[id] = (settings.iconAlternates[id] || 0) + 1; changed(); },
    showDamageChoices: paths => {
      damagePaths = paths; const box = $('[data-role="damageChoices"]'); box.innerHTML = '';
      if (paths.length < 2) return;
      box.innerHTML = '<b>Damage pictures</b><div></div>';
      for (const [i, title] of ['A · slashed heart', 'B · burst shield'].entries()) {
        const b = document.createElement('button'); b.type = 'button'; b.innerHTML = `<img src="${paths[i]}" alt=""><span>${title}</span>`;
        b.onclick = () => { settings.iconSet = 'charcoal'; settings.iconAlternates['pawn.damage'] = i; renderControls(); changed(); };
        box.lastElementChild.append(b);
      }
    },
  };
  return api;
}

export function draftSettings() {
  try { const raw = JSON.parse(localStorage.getItem('tw.ring.draft') || 'null'); return raw ? normalize(raw) : null; } catch { return null; }
}
