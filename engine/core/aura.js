// A PAWN'S AURA (2026-10-30; docs/PAWNS.md "Aura"). A general light round a figure with five intensity levels, after
// Exalted's anima banner, for anything like it: a raging barbarian, spirit guardians, a divine glow, a Vampire's
// Discipline. Stored on the pawn as an optional `aura: { level, color }` (plus `emblem`, a faction's emblem id, for
// level 5's totem); a pawn with none carries nothing (old journals replay unchanged). Not a condition: every seat that is
// sent the pawn sees it (client/aurafx.js; the same fog and hidden-pawn rules as the conditions).
//   0 none        1 dim: a faint shimmer at the base        2 glowing: a soft coloured light round the figure
//   3 burning: flame-like light rising to about head height    4 bonfire: a tall column well above the figure
//   5 iconic: the bonfire with a large faint emblem hanging in it (the pawn's faction's, else a sun)
// Level 0 is kept with its colour when the colour is not the default (an aura put out and lit again keeps its colour);
// level 0 in gold is no field at all.
export const AURA_MAX = 5;
export const AURA_LEVELS = ['none', 'dim', 'glowing', 'burning', 'bonfire', 'iconic'];
// the palette: an id each (what is stored), its colour (the light), and the words the bar and GET take for it
export const AURA_COLORS = {
  gold:   { hex: '#ffc23a', name: 'gold',         words: ['gold', 'golden', 'yellow', 'warm', 'amber', 'orange'] },
  silver: { hex: '#e4ecff', name: 'silver-white', words: ['silver', 'silver-white', 'silverwhite', 'white', 'pale', 'moon', 'moonlight'] },
  blue:   { hex: '#4fa3ff', name: 'blue',         words: ['blue', 'azure', 'sky', 'cyan'] },
  green:  { hex: '#55e07c', name: 'green',        words: ['green', 'emerald', 'jade'] },
  red:    { hex: '#ff2448', name: 'red',          words: ['red', 'crimson', 'scarlet', 'blood'] },
  violet: { hex: '#b46cff', name: 'violet',       words: ['violet', 'purple', 'magenta', 'indigo'] },
};
export const AURA_COLOR_IDS = Object.keys(AURA_COLORS);
export const AURA_DEFAULT = 'gold';
const EMBLEM_RE = /^[a-z][a-z0-9-]{0,31}$/; // a faction id (core/faction-catalog.js); the relay checks the shape, the client draws a sun for one it lacks
const KEYS = new Set(['level', 'color', 'emblem']);

export const auraColorOf = (word) => { const w = String(word ?? '').trim().toLowerCase(); return AURA_COLOR_IDS.find(k => k === w || AURA_COLORS[k].words.includes(w)) || null; };
export const auraLevelOf = (e) => e?.aura && Number.isInteger(e.aura.level) ? Math.max(0, Math.min(AURA_MAX, e.aura.level)) : 0;
export const auraColor = (e) => AURA_COLORS[e?.aura?.color] ? e.aura.color : AURA_DEFAULT;

// THE RELAY'S CHECK (token.set, token.create): strict. An object with level (an integer 0 to 5) and color (a palette id),
// and optionally emblem (a short faction id); nothing else.
export function auraProblem(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return 'aura: { level: 0-5, color: one of ' + AURA_COLOR_IDS.join(', ') + ' }';
  for (const k of Object.keys(v)) if (!KEYS.has(k)) return `aura: unknown field ${String(k).slice(0, 20)} (level, color, emblem)`;
  if (!Number.isInteger(v.level) || v.level < 0 || v.level > AURA_MAX) return `aura level is a whole number 0 to ${AURA_MAX}`;
  if (!AURA_COLORS[v.color]) return `aura color: one of ${AURA_COLOR_IDS.join(', ')}`;
  if (v.emblem !== undefined && !(typeof v.emblem === 'string' && EMBLEM_RE.test(v.emblem))) return 'aura emblem: a faction id like sun or dragons';
  return null;
}
// what is stored: the aura as it will be kept on the pawn, or null for none (core/commands.js token.set apply)
export function storedAura(v) {
  if (!v || auraProblem(v)) return null;
  if (v.level === 0 && v.color === AURA_DEFAULT && !v.emblem) return null;
  return { level: v.level, color: v.color, ...(v.emblem && { emblem: v.emblem }) };
}
// the aura after a change: { level? (a number), delta? (+1 / -1), color?, emblem? ('' drops it) } on what the pawn has now
export function auraAfter(cur, { level, delta, color, emblem } = {}) {
  const was = cur && !auraProblem(cur) ? cur : { level: 0, color: AURA_DEFAULT };
  let L = Number.isInteger(level) ? level : was.level + (delta || 0);
  if (color && !Number.isInteger(level) && !delta && was.level === 0) L = 2; // a colour picked with no aura on lights it (glowing): you see what you chose
  L = Math.max(0, Math.min(AURA_MAX, L));
  const out = { level: L, color: AURA_COLORS[color] ? color : was.color };
  const em = emblem !== undefined ? emblem : was.emblem; if (em && EMBLEM_RE.test(em)) out.emblem = em;
  return out;
}
const same = (a, b) => JSON.stringify(storedAura(a)) === JSON.stringify(storedAura(b));
export const auraSame = same;

// THE BAR AND GET: "aura 3", "aura up", "aura down", "aura off", "aura blue", "aura 4 red", "aura burning", "aura emblem
// dragons". Returns the change for auraAfter, or null when the words are not an aura.
export function parseAura(text) {
  const m = String(text ?? '').trim().toLowerCase().match(/^aura\b\s*(.*)$/); if (!m) return null;
  const words = m[1].replace(/[,=:]/g, ' ').split(/\s+/).filter(Boolean); if (!words.length) return null;
  const out = {};
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (/^[0-5]$/.test(w)) out.level = +w;
    else if (['up', 'more', 'brighter', '+', '+1', 'raise', 'higher', 'stronger'].includes(w)) out.delta = 1;
    else if (['down', 'less', 'dimmer', '-', '-1', 'lower', 'weaker'].includes(w)) out.delta = -1;
    else if (['off', 'none', 'out', 'clear', 'no', 'stop'].includes(w)) out.level = 0;
    else if (['on', 'light'].includes(w)) out.on = true;
    else if (AURA_LEVELS.indexOf(w) > 0) out.level = AURA_LEVELS.indexOf(w);
    else if (w === 'level' && /^[0-5]$/.test(words[i + 1] || '')) { out.level = +words[++i]; }
    else if (w === 'emblem' || w === 'totem' || w === 'sigil') { const f = words[++i]; if (!f) return null; out.emblem = f === 'none' || f === 'off' ? '' : f; }
    else if (auraColorOf(w)) out.color = auraColorOf(w);
    else return null;
  }
  if (out.on && out.level == null && !out.delta) { out.delta = 0; out.lightUp = true; } delete out.on;
  return Object.keys(out).length ? out : null;
}
// a GET value: "3", "3,blue", "blue", "off", "up", "5,gold,dragons" or JSON { level, color, emblem } -> the change, or
// { error } for words it does not know
export function getAura(raw) {
  const s = String(raw ?? '').trim();
  if (s.startsWith('{')) { try { const o = JSON.parse(s); return o && typeof o === 'object' ? { set: o } : { error: 'aura must be JSON { level, color }' }; } catch { return { error: 'aura must be JSON { level, color } or words like 3,blue' }; } }
  const p = parseAura('aura ' + s.replace(/,/g, ' '));
  if (p) return { change: p };
  // a trailing faction id ("5,gold,dragons") is the emblem
  const parts = s.split(/[\s,]+/).filter(Boolean), last = parts[parts.length - 1];
  if (parts.length > 1 && EMBLEM_RE.test(last)) { const q = parseAura('aura ' + parts.slice(0, -1).join(' ')); if (q) return { change: { ...q, emblem: last } }; }
  return { error: `aura: a level 0-${AURA_MAX} (or up, down, off) and/or a colour (${AURA_COLOR_IDS.join(', ')})` };
}
// the change as auraAfter takes it (lightUp: "aura on" lights an unlit aura at glowing, else leaves it)
export const applyChange = (cur, ch) => ch.lightUp && !(auraLevelOf({ aura: cur }) > 0) ? auraAfter(cur, { ...ch, level: 2 }) : auraAfter(cur, ch);
