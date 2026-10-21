// Announce-then-settle (Harry 2026-10-04): when anyone says something or rolls, everyone who receives that chat line
// sees it at once, large (≈30 pt), in a box centred on the screen: a translucent dark plate with the speaker's seat
// colour as its accent. It hangs for 1 s plus reading time (240 wpm: 1 + words / 4 s, at most 8 s), then shrinks and
// flies down into its own line in the chat log at the lower left (FLIP: the log line is already laid out but held
// invisible; we measure it, animate the box from the centre onto it, then reveal the real line and drop the box, so
// nothing jumps). Rolls show "Brakka · d20+5 → 17" big with the dice small; a natural 20 / natural 1 gets a quiet
// emphasis. Several lines close together queue in order and dwell less while there's a backlog. A click or Esc sends
// the current one to the log early. prefers-reduced-motion: a fade instead of the flight.
// Visibility is the chat line's own: a line reaches only the clients that receive the area's chat, and only lines
// that arrive while this client watches the area are announced (joining never replays history).
const MAX_DWELL = 8, FLY_MS = 650, FADE_MS = 320;

export function announceSurface(R, app) {
  const root = document.createElement('div'); root.id = 'announce'; root.setAttribute('aria-live', 'polite');
  document.body.append(root);
  const seen = new Map(); // area -> Set(line ids) already known (history is never replayed)
  const queue = [];       // lines waiting: { c, area }
  const pending = new Set(); // ids whose log line is held invisible until their announce lands
  let cur = null, waitT = 0; // { c, el, content, timer, phase: 'dwell' | 'fly' }; waitT: a roll waiting for its dice
  const log = [];         // (tests) what happened: { id, shownAt, dwell, landedAt, box, line, mode }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion'); // (or Settings ▸ Me)

  const name = (seat) => app.sync.campaign?.seats.find(s => s.id === seat)?.name || 'someone';
  const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
  // the dwell: 1 s + reading time at 240 wpm, capped; quicker while others wait (never under 0.8 s)
  const dwellOf = (c, backlog) => {
    const w = c.roll ? 4 + words(c.text) : words(c.text);
    const base = Math.min(MAX_DWELL, 1 + w / 4);
    return (backlog ? Math.max(0.8, base / (1 + 0.6 * backlog)) : base) / (app.prefs?.announceSpeed || 1); // Settings ▸ Me ▸ Announcement speed
  };
  const nat = (c) => { const r = c.roll; if (!r || !/^d20(\s|[+-]|$)/i.test(r.expr) || r.rolls.length !== 1) return null; return r.rolls[0] === 20 ? 'nat20' : r.rolls[0] === 1 ? 'nat1' : null; };

  app.on((what, data) => {
    if (what === 'change' && data === app.area()) ingest();
  });
  function ingest() {
    const area = app.area(), chat = app.view()?.chat || [];
    const ids = new Set(chat.map(c => c.id));
    // an undone line: out of the queue, and off the screen if it is up
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].area === area && !ids.has(queue[i].c.id)) { pending.delete(queue[i].c.id); queue.splice(i, 1); }
    if (cur && cur.area === area && !ids.has(cur.c.id)) drop();
    if (!seen.has(area)) { seen.set(area, new Set(ids)); return; } // first sight of this area: history, not news
    const s = seen.get(area);
    for (const c of chat) {
      if (s.has(c.id)) continue;
      s.add(c.id);
      if (!c.roll && !String(c.text || '').trim()) continue;
      if (app.prefs?.announce === false) continue; // Settings ▸ Me: announcements off (the line just appears in the log)
      queue.push({ c, area }); pending.add(c.id);
    }
    // a backlog arrived while one is up: it hurries too (its dwell shortens, never below what it has already had)
    if (cur?.phase === 'dwell' && queue.length) {
      const d = dwellOf(cur.c, queue.length);
      if (d < cur.dwell) { const left = Math.max(0, cur.rec.shownAt + d * 1000 - performance.now()); clearTimeout(cur.timer); cur.timer = setTimeout(land, left); cur.dwell = cur.rec.dwell = d; }
    }
    if (!cur) next();
  }

  function next() {
    if (cur) return; // (one up at a time: a held roll's retry can race the normal call)
    if (queue[0] && app.dice?.holding(queue[0].c.id)) { if (!waitT) waitT = setTimeout(() => { waitT = 0; next(); }, 100); return; } // a roll waits for its dice to settle (surfaces/dice.js)
    const it = queue.shift(); if (!it) return;
    if (it.area !== app.area()) { pending.delete(it.c.id); next(); return; } // moved to another area meanwhile
    const { c } = it, col = app.seatColor(c.by) || '#e0b04a', n = nat(c);
    const el = document.createElement('div');
    el.className = `ann${c.roll ? ' roll' : ''}${n ? ' ' + n : ''}`;
    el.style.setProperty('--c', col);
    // the content is laid out like a log line (name, then the words), only bigger: the flight is then a pure scale
    el.innerHTML = c.roll
      ? `<div class="aline"><span class="who">${esc(name(c.by))}</span> <span class="sep">·</span> <span class="expr">${esc(c.roll.expr)}</span> <span class="arrow">→</span> <b class="total">${c.roll.total}</b></div>`
        + `<div class="dice">${c.roll.rolls.map(v => `<span class="die">${v}</span>`).join('')}${c.text ? `<span class="why">${esc(c.text)}</span>` : ''}</div>`
      : `<div class="aline"><span class="who">${esc(name(c.by))}</span> <span class="said">${esc(c.text)}</span></div>`;
    el.addEventListener('click', (ev) => { ev.stopPropagation(); land(); });
    root.append(el);
    const dwell = dwellOf(c, queue.length);
    cur = { c, area: it.area, el, phase: 'dwell', dwell, rec: { id: c.id, shownAt: performance.now(), dwell, words: c.roll ? null : words(c.text), mode: null } };
    log.push(cur.rec);
    app.escapeStack?.push(escClose);
    el.animate([{ opacity: 0, transform: 'translate(-50%, -50%) scale(.94)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }], { duration: reduced() ? 1 : 160, easing: 'ease-out' });
    cur.timer = setTimeout(land, dwell * 1000);
  }
  function escClose() { if (!cur || cur.phase !== 'dwell') return false; land(); }
  function unEsc() { const i = app.escapeStack?.indexOf(escClose) ?? -1; if (i >= 0) app.escapeStack.splice(i, 1); }

  // the log line this announce settles into (rendered by surfaces/chat.js, held invisible while pending)
  const lineEl = (id) => document.querySelector(`#chat .line[data-id="${CSS.escape(id)}"]`);
  function land() {
    if (!cur || cur.phase !== 'dwell') return;
    clearTimeout(cur.timer); unEsc();
    const a = cur; a.phase = 'fly';
    a.rec.dismissedAt = performance.now();
    const target = lineEl(a.c.id), box = document.getElementById('chat');
    const visible = target && box && !box.hidden && (() => { const r = target.getBoundingClientRect(), b = box.getBoundingClientRect(); return r.height > 0 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1; })();
    if (reduced() || !visible) {
      a.rec.mode = reduced() ? 'fade' : 'fade-nolog';
      reveal(a.c.id, true);
      a.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease-in', fill: 'forwards' }).finished.then(() => finish(a));
      return;
    }
    // FLIP: the first state is the centred box; the last is its content lying exactly on the log line
    a.rec.mode = 'fly';
    const B = a.el.getBoundingClientRect(), C = a.el.querySelector('.aline').getBoundingClientRect(), L = target.getBoundingClientRect();
    const lineWho = target.querySelector('.who')?.getBoundingClientRect(), boxWho = a.el.querySelector('.who').getBoundingClientRect();
    // the scale is the ratio of the two type sizes (the name is set the same way in both)
    const fs = (q) => parseFloat(getComputedStyle(q).fontSize);
    const s = lineWho ? fs(target.querySelector('.who')) / fs(a.el.querySelector('.who')) : L.height / C.height;
    // with transform-origin at the box's top-left: content point p lands at B + (p - B) * s + d
    const dx = L.left + (lineWho ? lineWho.left - L.left : 0) - B.left - (boxWho.left - B.left) * s;
    const ty = lineWho ? lineWho.top + lineWho.height / 2 : L.top + L.height / 2;
    const dy = ty - B.top - (boxWho.top + boxWho.height / 2 - B.top) * s;
    // pin the box where it is in plain pixels (no centring transform), then fly
    Object.assign(a.el.style, { left: `${B.left}px`, top: `${B.top}px`, transform: 'none', transformOrigin: '0 0' });
    a.el.classList.add('flying');
    const anim = a.el.animate([
      { transform: 'translate(0px, 0px) scale(1)', backgroundColor: getComputedStyle(a.el).backgroundColor, boxShadow: getComputedStyle(a.el).boxShadow, borderColor: getComputedStyle(a.el).borderColor, color: getComputedStyle(a.el).color },
      { transform: `translate(${dx}px, ${dy}px) scale(${s})`, backgroundColor: 'rgba(0,0,0,0)', boxShadow: '0 0 0 rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)', color: getComputedStyle(target).color },
    ], { duration: FLY_MS, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' });
    a.el.querySelector('.dice')?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FLY_MS * 0.5, fill: 'forwards' });
    anim.finished.then(() => {
      const who = a.el.querySelector('.who').getBoundingClientRect(), lw = lineEl(a.c.id)?.querySelector('.who')?.getBoundingClientRect();
      a.rec.box = rect(who); a.rec.line = lw ? rect(lw) : null; a.rec.landedAt = performance.now();
      reveal(a.c.id, false); // the real line appears exactly under the landed box; the box goes next frame
      requestAnimationFrame(() => finish(a));
    }).catch(() => finish(a));
  }
  function reveal(id, fade) {
    pending.delete(id);
    const t = lineEl(id); if (!t) return;
    t.classList.remove('pending');
    if (fade) t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS });
  }
  function finish(a) {
    a.el.remove();
    if (a.rec.landedAt == null) a.rec.landedAt = performance.now();
    if (cur === a) { cur = null; next(); }
  }
  function drop() { const a = cur; if (!a) return; clearTimeout(a.timer); unEsc(); pending.delete(a.c.id); a.el.remove(); cur = null; next(); }

  app.announce = {
    pending: (id) => pending.has(id),
    dismiss: () => land(),
    info: () => ({ showing: cur ? { id: cur.c.id, phase: cur.phase, dwell: cur.dwell, text: cur.el.textContent } : null, queue: queue.map(q => q.c.id), log: log.slice(-20) }),
    dwellOf,
  };
  return { name: 'announce' };
}
const rect = (r) => ({ x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
