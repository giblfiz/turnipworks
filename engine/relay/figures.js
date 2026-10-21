// The figure library, as the relay knows it (tools/spawn-tuner/data/figures.json, the file the browser loads): so an AI
// seat can place a pawn BY FIGURE ID through the GET API, be told when an id does not exist, and search the list.
// Read once at start and again when the file changes (a tuner deploy restarts the relay anyway). No file: no checks.
import fs from 'node:fs';
import path from 'node:path';

export const FIGURES = { byId: new Map(), list: [], file: null, mtime: 0 };
export function loadFigures(dataDir) {
  const file = path.join(dataDir, 'figures.json');
  try {
    const st = fs.statSync(file); if (FIGURES.file === file && st.mtimeMs === FIGURES.mtime) return FIGURES;
    const list = JSON.parse(fs.readFileSync(file, 'utf8')).figures || [];
    Object.assign(FIGURES, { byId: new Map(list.map(f => [f.id, f])), list, file, mtime: st.mtimeMs });
  } catch { /* no figure list here: figure ids are passed through unchecked */ }
  return FIGURES;
}
const low = (s) => String(s || '').toLowerCase();
// a small search for seats that cannot browse: every word must be in the figure's name, id, group, class, race, tags or SRD names
export function findFigures(q, limit = 12) {
  const words = low(q).split(/[\s,+]+/).filter(Boolean).map(w => w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
  const out = [];
  for (const f of FIGURES.list) {
    const hay = [f.name, f.id.replace(/-/g, ' '), f.group, f.cls, f.race, ...(f.tags || []), ...(f.srd || [])].map(low).join(' | ');
    if (!words.every(w => hay.includes(w))) continue;
    const whole = words.join(' ');
    out.push({ s: (low(f.name) === whole || (f.srd || []).some(x => low(x) === whole) ? 2 : low(f.name).startsWith(whole) ? 1 : 0) - f.name.length / 1000, f });
  }
  return out.sort((a, b) => b.s - a.s || (a.f.id < b.f.id ? -1 : 1)).slice(0, limit).map(({ f }) => brief(f));
}
export const brief = (f) => ({ id: f.id, name: f.name, group: f.group, height_ft: f.h, squares: f.size, ...(f.srd?.length && { srd: f.srd }) });
// what a token.create / token.set with a figure needs before it is dispatched: the id checked, its size filled in
export function figureArgs(type, args) {
  if (args.fig == null || args.fig === '' || !FIGURES.list.length) return { args };
  if (args.fig === 'none') return type === 'token.set' ? { args: { ...args, size: '1' } } : { args: (({ fig, ...a }) => a)(args) };
  const f = FIGURES.byId.get(String(args.fig));
  if (!f) { const near = findFigures(String(args.fig).replace(/-/g, ' '), 5).map(x => x.id); return { error: `no figure "${String(args.fig).slice(0, 40)}"${near.length ? `; did you mean ${near.join(', ')}?` : ''} Search the list: .../figures?q=owlbear` }; }
  return { args: { ...args, size: String(f.size || 1), ...(type === 'token.create' && !args.name && { name: f.name }) }, figure: f };
}
