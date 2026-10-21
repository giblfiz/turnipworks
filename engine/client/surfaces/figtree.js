// THE TREE OF MINIS, DRAWN (docs/PAWNS.md): the Build tray's own pieces (stacked chips for the levels above, a grid of
// big picture tiles for the level you are on), filled from client/pawntree.js. Used twice: "Place a pawn" in the Pawns
// menu, and the figure picker in Settings ▸ Me ▸ My pawns. Each use keeps its own place in the tree.
//   figTree(app, { onPick(fig, ev), onDrag(fig, pointerdown), onMore(node), onChange(), home: { label, pic } | null, selected: () => fig id })
//     .html()      the chips and the grid for where it is now
//     .wire(root)  after the html is in the page
//     .key(k)      a letter picks the tile that shows it; 'Backspace' goes up one level. -> true when it was used
//     .path / .go(ids) / .up() / .state()
import { icon } from '../icons.js';
import { buildPawnTree, GRID_CAP } from '../pawntree.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const LEVELS = ['Kind', 'Family'];

export function figTree(app, { onPick, onDrag = null, onMore, onChange = () => { }, home = null, selected = () => null, cap = GRID_CAP } = {}) {
  const F = app.figures;
  const X = app.pawnTree || (app.pawnTree = buildPawnTree(F.list));
  const T = { path: [], X };
  const node = () => X.get(T.path.at(-1)) || null;
  const thumb = (f, size) => { const u = f && F.thumbUrl(f); return u ? `<img class="nic fig" src="${esc(u)}" alt="" width="${size}" height="${size}" draggable="false">` : `<span class="nic fb">${icon('user', Math.round(size * 0.55))}</span>`; };
  T.go = (ids) => { T.path = (ids || []).filter(id => X.get(id)); onChange(); };
  T.up = () => { if (!T.path.length) return false; T.path = T.path.slice(0, -1); onChange(); return true; };
  T.roots = () => X.roots;
  // a tile for a node of the tree (a kind or a family)
  T.nodeTile = (n) => `<button class="btile" data-node="${esc(n.id)}" tabindex="-1" data-tip="${esc(n.label)}: ${n.n} figure${n.n === 1 ? '' : 's'}">${thumb(n.pic, 64)}<span class="bl">${esc(n.label)}</span>${n.hot ? `<kbd>${n.hot.toUpperCase()}</kbd>` : ''}<i class="more"></i></button>`;
  const figTile = (f, n) => `<button class="btile ftile${selected() === f.id ? ' sel' : ''}" data-fig="${esc(f.id)}" tabindex="-1" data-tip="${esc(f.name)} · ${Math.round(f.h * 10) / 10} ft tall${f.size > 1 ? ` · large: ${f.size} × ${f.size} squares` : ''}">${thumb(f, 64)}<span class="bl">${esc(n.leaf?.label ? n.leaf.label(f, n) : f.name)}</span>${f.size > 1 ? `<i class="fsz" data-tip="Large: it stands on ${f.size} × ${f.size} squares">${f.size}×${f.size}</i>` : ''}</button>`;
  T.html = () => {
    const n = node(), anc = X.pathOf(T.path.at(-1));
    const chips = `${home ? `<button class="bchip" data-home tabindex="-1" data-tip="Back to ${esc(home.label)}">${home.pic || `<span class="nic fb">${icon('users', 18)}</span>`}<span><small>Menu</small>${esc(home.label)}</span><kbd>⌫</kbd></button>` : ''}${anc.map((a, i) => `<button class="bchip${i === anc.length - 1 ? ' cur' : ''}" data-anc="${i}" tabindex="-1">${thumb(a.pic, 32)}<span><small>${LEVELS[i] || 'Level'}</small>${esc(a.label)}</span>${i < anc.length - 1 ? '<kbd>⌫</kbd>' : ''}</button>`).join('')}`;
    let grid;
    if (!n) grid = `<div class="bgrid">${X.roots.map(T.nodeTile).join('')}</div>`;
    else if (n.children) grid = `<div class="bgrid">${n.children.map(T.nodeTile).join('')}</div>`;
    else {
      const figs = n.figs || [], shown = figs.length > cap ? figs.slice(0, cap - 1) : figs, rest = figs.length - shown.length;
      grid = `<div class="bgrid${n.leaf?.cols === 2 ? ' c2' : ''}">${shown.map(f => figTile(f, n)).join('')}${rest > 0 ? `<button class="btile mtile" data-more tabindex="-1" data-tip="${rest} more: search this family in the command bar"><span class="nic fb">${icon('search', 30)}</span><span class="bl">more… (${rest})</span><kbd>M</kbd></button>` : ''}</div>`;
    }
    return `<div class="banc">${chips}</div>${grid}`;
  };
  T.wire = (root) => {
    for (const im of root.querySelectorAll('img.nic.fig')) im.onerror = () => { const sp = document.createElement('span'); sp.className = 'nic fb'; sp.innerHTML = icon('user', Math.round(im.width * 0.55)); im.replaceWith(sp); };
    for (const b of root.querySelectorAll('[data-node]')) b.onclick = (ev) => { ev.stopPropagation(); T.go(X.pathOf(b.dataset.node).map(n => n.id)); };
    for (const b of root.querySelectorAll('[data-fig]')) { b.onclick = (ev) => { ev.stopPropagation(); onPick?.(F.get(b.dataset.fig), ev); }; if (onDrag) { b.classList.add('drags'); b.onpointerdown = (ev) => onDrag(F.get(b.dataset.fig), ev); } } // (onDrag: the tile can be dragged out onto the map)
    for (const b of root.querySelectorAll('[data-anc]')) b.onclick = (ev) => { ev.stopPropagation(); T.go(X.pathOf(T.path.at(-1)).slice(0, +b.dataset.anc + 1).map(n => n.id)); };
    for (const b of root.querySelectorAll('[data-more]')) b.onclick = (ev) => { ev.stopPropagation(); onMore?.(node()); };
  };
  T.key = (k) => {
    if (k === 'Backspace') return T.up();
    const n = node(), list = n ? n.children : X.roots;
    if (list) { const hit = list.find(c => c.hot === k); if (hit) { T.go(X.pathOf(hit.id).map(x => x.id)); return true; } return false; }
    if (k === 'm' && n?.figs?.length > cap) { onMore?.(n); return true; }
    return false;
  };
  T.keys = () => { const n = node(), list = n ? n.children : X.roots; return list ? list.map(c => c.hot).filter(Boolean) : (n?.figs?.length > cap ? ['m'] : []); };
  T.state = () => { const n = node(); return { path: T.path.slice(), labels: X.pathOf(T.path.at(-1)).map(a => a.label), tiles: n?.figs ? null : (n ? n.children : X.roots).map(c => `${c.hot || '·'}:${c.label}`), figs: n?.figs ? n.figs.map(f => f.id) : null, shown: n?.figs ? Math.min(n.figs.length, n.figs.length > cap ? cap - 1 : cap) : null, more: !!n?.figs && n.figs.length > cap ? n.more : null }; };
  return T;
}
