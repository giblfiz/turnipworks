// Seat tokens are credentials: browser-local only, never cookies, markup, or logs.
// Read afresh on each edit so another tab's joins/forget are respected.
export const GAMES_KEY = 'tw.games';
export function rememberedGames() {
  try {
    const rows = JSON.parse(localStorage.getItem(GAMES_KEY) || '[]');
    if (!Array.isArray(rows)) return [];
    const seen = new Set();
    return rows.filter(g => g && ['campaign', 'token', 'name', 'seat', 'role'].every(k => typeof g[k] === 'string')
      && g.token && g.campaign && Number.isFinite(g.lastUsed) && g.lastUsed > 0 && g.lastUsed <= 8640000000000000)
      .sort((a, b) => b.lastUsed - a.lastUsed).filter(g => !seen.has(g.token) && seen.add(g.token));
  } catch { return []; }
}
function save(rows) { try { localStorage.setItem(GAMES_KEY, JSON.stringify(rows)); } catch { /* storage is optional */ } }
export function rememberGame(token, c, joined = false) {
  if (!c?.id || !c.my) return;
  const rows = rememberedGames(), old = rows.find(g => g.token === token);
  // Campaign updates refresh names, but must not undo Forget or make an idle tab most recent.
  if (!joined && !old) return;
  const g = { campaign: c.id, token, name: c.name, seat: c.my.name, role: c.my.role,
    lastUsed: joined ? Date.now() : old.lastUsed };
  save([g, ...rows.filter(g => g.token !== token)]);
}
export function dropGame(token) { save(rememberedGames().filter(g => g.token !== token)); }
export function forgetGames() { try { localStorage.removeItem(GAMES_KEY); } catch { /* storage is optional */ } }
export function gamesAddress(hash = 'games') { return `${location.pathname}${location.search}#${hash}`; }
export function openGames() { location.assign(gamesAddress()); }

export function renderGames() {
  const list = document.getElementById('rememberedGames'), rows = rememberedGames();
  list.replaceChildren();
  for (const g of rows) {
    const li = document.createElement('li'), b = document.createElement('button');
    const name = document.createElement('strong'), detail = document.createElement('small');
    name.textContent = g.name;
    detail.textContent = `${g.seat} · ${g.role} · Last used ${new Date(g.lastUsed).toLocaleString()}`;
    b.append(name, detail); b.onclick = () => location.assign(gamesAddress(`s=${encodeURIComponent(g.token)}`));
    li.append(b); list.append(li);
  }
  document.getElementById('gamesEmpty').hidden = !!rows.length;
  document.getElementById('forgetGames').hidden = !rows.length;
}
