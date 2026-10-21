// A person has one portrait: the explicit main pawn's baked picture, cropped to its upper body.
// The baked 320px square is cropped to x=80..240, y=10..170: complete heads and shoulders
// for heroes, and room for the ears/snouts of wolf, owlbear, bear and dragon figures.
// Campaign metadata also covers a main pawn on the bench. No token id or position is needed.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function playerPortrait(app, seat) {
  const c = app.sync.campaign;
  const fig = c?.party?.portraits?.[seat.id] || c?.party?.pawns?.find(p => p.owner === seat.id && p.main)?.fig;
  const f = fig && app.figures.get(fig), url = f && app.figures.thumbUrl(f);
  return `<span class="player-portrait${url ? ' pictured' : ''}" style="--c:${esc(seat.color || '#888')}" aria-hidden="true"><span class="player-initial">${esc((seat.name || '?')[0].toUpperCase())}</span>${url ? `<img src="${esc(url)}" alt="" draggable="false" onerror="this.remove()">` : ''}</span>`;
}
