// THE TRAY BREADCRUMB RULE (Harry 2026-11-12; docs/UI.md "Build menu" ▸ the breadcrumb). One rule for every tray that
// walks a tree (the Build tray, the Pawns tray's tree of minis, the figure picker in Settings ▸ Me ▸ My pawns):
//   CHIPS are pure navigation. A chip is named for the LIST it opens, in the plural ("Genres", "Types"), fixed text, and
//         wears the icon of whatever OWNS that list: the top list a permanent generic icon, the types of Fantasy
//         Fantasy's. So the icons sit one row lower than the old status chips had them.
//   THE HEADER says where you are: the current owner's icon, the path above it in small grey (only the immediate parent;
//         an ellipsis stands for anything higher, every one of which is a chip), then the owner big. One line, never
//         wrapping. At the top of a tree there is no owner: the header is the top list's own name.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** the "where you are" header. pic: the owner's icon html ('' at the top); trail: the labels ABOVE the owner, top first;
 *  label: the owner (or, at the top, the top list's name) */
export function whereHead({ pic = '', trail = [], label }) {
  const up = trail.length ? `<span class="wpath">${trail.length > 1 ? '<i class="wmore" title="' + esc(trail.slice(0, -1).join(' › ')) + '">…</i> › ' : ''}${esc(trail.at(-1))} ›</span>` : '';
  return `<header class="bwhere${pic ? '' : ' top'}" title="${esc([...trail, label].join(' › '))}">${pic}${up}<b>${esc(label)}</b></header>`;
}

/** a navigation chip: the list it opens (plural), the icon of that list's owner, its key */
export function navChip({ attrs, pic, label, key = '', tip }) {
  return `<button class="bchip nav" ${attrs} data-tip="${esc(tip)}" aria-label="${esc(tip)}">${pic}<span>${esc(label)}</span>${key ? `<kbd>${esc(key)}</kbd>` : ''}</button>`;
}

const PLURAL = { Family: 'Families', Class: 'Classes', Kind: 'Kinds', Race: 'Races', Archetype: 'Archetypes', Culture: 'Cultures' };
export const plural = (w) => PLURAL[w] || (/s$/.test(w) ? w : `${w}s`);
