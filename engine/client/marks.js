// INDICATORS (Harry 2026-10-06: "sort of a borrow from WoW this can be a sub-menu of indicators"): the eight markers
// of core/pawn.js MARKS, drawn ONCE here for both places they show: floating over a pawn in the world (world.js) and
// on the tiles of the ring's Indicators sub-menu. Shape AND colour both tell them apart (never colour alone).
import { MARKS } from '../core/pawn.js';

const DARK = '#14161a';
// draw mark `key` centred in a size × size box of a 2D canvas context
export function drawMark(ctx, key, size) {
  const m = MARKS.find(x => x[0] === key); if (!m) return;
  const c = size / 2, R = size * 0.4, col = m[2];
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, size * 0.07); ctx.strokeStyle = DARK; ctx.fillStyle = col;
  ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = size * 0.08;
  const poly = (pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(c + x * R, c + y * R) : ctx.moveTo(c + x * R, c + y * R)); ctx.closePath(); ctx.stroke(); ctx.shadowBlur = 0; ctx.fill(); };
  if (key === 'star') poly(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.45 : 1.08; return [Math.cos(a) * r, Math.sin(a) * r]; }));
  else if (key === 'circle') { ctx.beginPath(); ctx.arc(c, c, R * 0.92, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; ctx.fill(); }
  else if (key === 'diamond') poly([[0, -1.1], [0.78, 0], [0, 1.1], [-0.78, 0]]);
  else if (key === 'triangle') poly([[0, -1], [1.02, 0.82], [-1.02, 0.82]]);
  else if (key === 'square') poly([[-0.85, -0.85], [0.85, -0.85], [0.85, 0.85], [-0.85, 0.85]]);
  else if (key === 'cross') { const t = 0.3, l = 0.95; poly([[-l, -l + t], [-l + t, -l], [0, -t], [l - t, -l], [l, -l + t], [t, 0], [l, l - t], [l - t, l], [0, t], [-l + t, l], [-l, l - t], [-t, 0]]); }
  else if (key === 'moon') { // a crescent: a disc with a bite out of its upper right
    ctx.beginPath(); ctx.arc(c, c, R, Math.PI * 0.28, Math.PI * 1.62, false); ctx.arc(c + R * 0.42, c - R * 0.3, R * 0.78, Math.PI * 1.36, Math.PI * 0.52, true); ctx.closePath(); ctx.stroke(); ctx.shadowBlur = 0; ctx.fill();
  } else if (key === 'skull') {
    ctx.beginPath(); ctx.arc(c, c - R * 0.18, R * 0.86, Math.PI * 0.82, Math.PI * 0.18, false); ctx.lineTo(c + R * 0.5, c + R * 0.98); ctx.lineTo(c - R * 0.5, c + R * 0.98); ctx.closePath(); ctx.stroke(); ctx.shadowBlur = 0; ctx.fill();
    ctx.fillStyle = DARK;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(c + s * R * 0.36, c - R * 0.16, R * 0.23, R * 0.27, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(c, c + R * 0.14); ctx.lineTo(c + R * 0.12, c + R * 0.42); ctx.lineTo(c - R * 0.12, c + R * 0.42); ctx.closePath(); ctx.fill();
    ctx.lineWidth = Math.max(1.5, size * 0.035); for (const s of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(c + s * R * 0.22, c + R * 0.62); ctx.lineTo(c + s * R * 0.22, c + R * 0.96); ctx.stroke(); }
  }
  ctx.restore();
}
const urls = new Map();
// the mark as a picture (a data URL), for a menu tile
export function markUrl(key, size = 96) {
  if (!urls.has(key)) { const cv = document.createElement('canvas'); cv.width = cv.height = size; drawMark(cv.getContext('2d'), key, size); urls.set(key, cv.toDataURL('image/png')); }
  return urls.get(key);
}
export const markCanvas = (key, size = 128) => { const cv = document.createElement('canvas'); cv.width = cv.height = size; drawMark(cv.getContext('2d'), key, size); return cv; };
