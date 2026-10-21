// Dial panels generated from a schema and bound to a preset object. Every change calls onChange(path, value).
import { EASES } from './anim.js';

export const CHOREO = [
  { k: 'sweep', label: 'Sweep from', type: 'select', options: ['NW', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'door', 'center', 'random'] },
  { k: 'mode', label: 'Arrival', type: 'select', options: [['waves', 'waves (bands land together)'], ['continuous', 'continuous front'], ['all', 'all at once per layer']] },
  { k: 'band', label: 'Wave band', unit: 'ft', type: 'range', min: 1, max: 20, step: 0.5 },
  { k: 'waveGap', label: 'Gap between waves', unit: 'ms', type: 'range', min: 0, max: 600, step: 10 },
  { k: 'perWave', label: 'Max per wave (0 = no cap)', type: 'range', min: 0, max: 40, step: 1 },
  { k: 'rate', label: 'Expansion rate (continuous)', unit: 'ft/s', type: 'range', min: 5, max: 200, step: 1 },
  { k: 'jitter', label: 'Jitter', unit: 'ms', type: 'range', min: 0, max: 400, step: 5 },
  { k: 'layerMode', label: 'Layers', type: 'select', options: [['sequential', 'one after another'], ['merged', 'merged into one sweep']] },
  { k: 'layerGap', label: 'Gap between layers', unit: 'ms', type: 'range', min: 0, max: 1500, step: 10 },
  { k: 'reverse', label: 'Reverse sweep / layer order', type: 'check' },
  { k: 'nearWallsLast', label: 'Camera-side walls arrive last', type: 'check' },
];

export const MOTION = [
  { k: 'dur', label: 'Duration', unit: 'ms', type: 'range', min: 40, max: 2000, step: 10 },
  { k: 'ease', label: 'Easing', type: 'select', options: Object.keys(EASES) },
  { k: 'overshoot', label: 'Overshoot (back / elastic)', type: 'range', min: 0, max: 4, step: 0.05 },
  { k: 'startScale', label: 'Start scale', type: 'range', min: 0, max: 1, step: 0.01 },
  { k: 'grow', label: 'Grow along', type: 'select', options: [['uniform', 'all axes'], ['y', 'up (rise)'], ['xz', 'out (spread)']] },
  { k: 'spin', label: 'Spin', unit: '°', type: 'range', min: -720, max: 720, step: 15 },
  { k: 'spinAxis', label: 'Spin axis', type: 'select', options: [['y', 'y (turntable)'], ['x', 'x (flip E–W)'], ['z', 'z (flip N–S)'], ['random', 'random per object']] },
  { k: 'drop', label: 'Drop from (− rises)', unit: 'ft', type: 'range', min: -10, max: 20, step: 0.5 },
  { k: 'squash', label: 'Squash on landing', type: 'range', min: 0, max: 0.6, step: 0.02 },
  { k: 'fade', label: 'Fade in', type: 'check' },
];

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k in e && typeof v !== 'string') e[k] = v; else e.setAttribute(k, v); }
  for (const k of kids) e.append(k);
  return e;
}

function fmt(f, v) { return f.type === 'range' ? `${+(+v).toFixed(2)}${f.unit ? ' ' + f.unit : ''}` : v; }

export function dialGroup(title, schema, obj, path, onChange, open = false) {
  const box = el('details', open ? { open: true } : {});
  box.append(el('summary', {}, title));
  for (const f of schema) {
    const id = `${path}.${f.k}`;
    if (f.type === 'check') {
      const inp = el('input', { type: 'checkbox', checked: !!obj[f.k] });
      inp.dataset.path = id;
      inp.addEventListener('change', () => { obj[f.k] = inp.checked; onChange(id, inp.checked); });
      box.append(el('label', { class: 'check' }, inp, f.label));
      continue;
    }
    const out = el('output', {}, fmt(f, obj[f.k]));
    let inp;
    if (f.type === 'color') { // colour swatch (2026-10-04, Atmosphere)
      inp = el('input', { type: 'color' }); inp.value = obj[f.k];
    } else if (f.type === 'select') {
      inp = el('select');
      for (const o of f.options) { const [v, l] = Array.isArray(o) ? o : [o, o]; inp.append(el('option', { value: v }, l)); }
      inp.value = obj[f.k];
    } else {
      inp = el('input', { type: 'range', min: String(f.min), max: String(f.max), step: String(f.step) });
      inp.value = obj[f.k];
    }
    inp.dataset.path = id;
    inp.addEventListener('input', () => {
      const v = f.type === 'range' ? +inp.value : inp.value;
      obj[f.k] = v; out.textContent = fmt(f, v); onChange(id, v);
    });
    box.append(el('label', { class: 'dial' }, el('span', {}, f.label, out), inp));
  }
  return box;
}

// Render the dial panels for one side ('in' or 'out') of a preset into `root`.
export function renderDials(root, preset, sideName, onChange) {
  root.innerHTML = '';
  const side = preset[sideName];
  root.append(dialGroup('Choreography (waves)', CHOREO, side.choreo, `${sideName}.choreo`, onChange, true));
  root.append(dialGroup('Objects', MOTION, side.objects, `${sideName}.objects`, onChange, true));
  root.append(dialGroup('Floor tiles', MOTION, side.floor, `${sideName}.floor`, onChange));
  root.append(dialGroup('Walls & doors', MOTION, side.walls, `${sideName}.walls`, onChange));
}
