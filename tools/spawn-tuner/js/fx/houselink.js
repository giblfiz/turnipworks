// "Use in game" made unmistakable (2026-10-05). Every look panel has two buttons that used to sit side by side and read
// alike: "Send preset to Fauna" (a NOTE: stores the preset for Fauna to look at; the game does not change) and "Use in
// game" (the game's HOUSE LOOK: what turnipworks.net loads). Harry tuned an atmosphere, pressed Send believing it shipped,
// and the game went on showing something else. So, for each panel:
//   - "Use in game" is the panel's primary button, on its own line, and says what it does;
//   - under it, always, one line says what the game is using NOW for this look and whether that is what is on screen;
//   - "Send" says it leaves the game alone, and after a Send that leaves the game on a different look the line turns loud.
//   const link = houseLink({ api, key: 'atmos', label: 'atmosphere', sendBtn, houseBtn, current: () => params, norm, toast });
//   link.changed()   a dial moved (re-compare)      link.sent(name)   after a successful Send      link.used(name)   after Use in game
const cache = { api: null, at: 0, house: undefined, wait: null, links: new Set() };
function fetchHouse(api, force = false) {
  if (cache.api === api && cache.wait && !force) return cache.wait;
  cache.api = api;
  cache.wait = fetch(`${api}/tuner/house`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null).then(h => { cache.house = h; for (const l of cache.links) l.changed(); return h; });
  return cache.wait;
}
// the same look? (names and bookkeeping aside; numbers to 6 places; key order does not matter)
const canon = (v) => v === null || typeof v !== 'object' ? (typeof v === 'number' ? +v.toFixed(6) : v) : Array.isArray(v) ? v.map(canon) : Object.fromEntries(Object.keys(v).filter(k => k !== 'name' && k !== 'fx').sort().map(k => [k, canon(v[k])]));
export const sameLook = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

export function houseLink({ api, key, label, sendBtn, houseBtn, current, norm = (p) => p, toast = () => { } }) {
  if (!sendBtn || !houseBtn) return { changed() { }, sent() { }, used() { }, state: () => 'none' };
  const row = houseBtn.parentElement;
  const box = document.createElement('div'); box.className = 'houseBox'; box.dataset.house = key;
  const state = document.createElement('div'); state.className = 'houseState small'; state.setAttribute('role', 'status');
  houseBtn.classList.add('primary', 'houseUse'); houseBtn.textContent = `Use in game: the game gets this ${label}`;
  houseBtn.title = `Makes what is on screen the GAME's ${label} (turnipworks.net loads it on its next reload)`;
  sendBtn.classList.remove('primary'); sendBtn.classList.add('houseSend');
  sendBtn.textContent = `Send to Fauna as a note (game unchanged)`; sendBtn.title = `Stores this ${label} preset for Fauna to look at. It does NOT change the game: "Use in game" does.`;
  row.before(box); box.append(houseBtn, state);
  let loud = false, last = 'unknown';
  function changed() {
    const h = cache.house;
    if (h === undefined) { state.textContent = 'Checking what the game is using…'; state.className = 'houseState small'; last = 'unknown'; return; }
    if (h === null) { state.textContent = 'Could not read what the game is using.'; state.className = 'houseState small'; last = 'unknown'; return; }
    const g = h[key];
    if (!g) { last = 'builtin'; state.textContent = `The game is using its built-in ${label}. What is on screen is not in the game.`; }
    else if (sameLook(norm(g), current())) { last = 'same'; loud = false; state.textContent = `✓ The game is using exactly this ${label}${g.name ? ` ("${g.name}")` : ''}.`; }
    else { last = 'different'; state.textContent = `The game is using a different ${label}${g.name ? ` ("${g.name}")` : ''}. What is on screen is NOT in the game: press Use in game to ship it.`; }
    state.className = 'houseState small' + (last === 'same' ? ' ok' : last === 'different' ? ' warn' : '') + (loud && last !== 'same' ? ' loud' : '');
    box.dataset.state = last;
  }
  const self = {
    changed,
    state: () => last,
    // after a Send: say plainly that the game did not change
    sent(n) { loud = true; changed(); toast(last === 'same' ? `Sent "${n}" to Fauna. (The game already uses this ${label}.)` : `Sent "${n}" to Fauna as a note. The GAME is NOT changed: press "Use in game" to ship this ${label}.`, last !== 'same'); },
    // after Use in game: the house look is what is on screen now
    used(n) { loud = false; cache.house = { ...(cache.house || {}), [key]: { ...JSON.parse(JSON.stringify(current())), name: n } }; changed(); toast(`The GAME now uses this ${label}: "${n}". Reload the game to see it.`); fetchHouse(api, true); },
  };
  cache.links.add(self); changed(); fetchHouse(api);
  return self;
}
