// Chat and dice: "say …" / "roll …" in the bar. A new line shows briefly as a bubble near the speaker (their cursor,
// else their pawn), and in a small scrollback (bottom left; click to expand).
//
// ACTION LINES (Harry 2026-10-06: "The contextuals (like undo, or set to whatever cut on stairs), instead of fading
// away, they should go down into the chat area, so you still have access to them later."). A conditional button whose
// time is up lands here as a line that says what happened and still carries its button (surfaces/condbutton.js rule 6).
//   - LOCAL: they live in this browser only (localStorage `tw.actlines.<campaign>.<seat>`); never sent, never announced.
//   - HONEST: a line's kind says whether the action is still valid, every time the line is drawn and again on the
//     press. Not valid: the button is greyed with a short reason and does nothing. Pressed: the line is marked done.
//   - NO FLOOD: a line with the same `group` as one still waiting updates that line (and counts); at most ACT_CAP
//     action lines are kept, oldest out.
//   - RELOAD: lines come back. A kind that cannot be checked again after a reload (an undo: what has been undone
//     since is not known) comes back as plain text with no button.
//   - KEY: `.` presses the newest action line's button.
//   app.actionLines.kind(name, { valid(data, line) -> null | reason, run(data, line) -> void | reason | Promise, restorable })
//   app.actionLines.add({ kind, text, button, group, data, many(n), area }) -> line
import { icon } from '../icons.js';

export function chatSurface(R, app) {
  const box = document.getElementById('chat'), bubbles = document.getElementById('bubbles');
  const seen = new Set(); let first = true, expanded = false;
  const live = []; // { el, seat, until }
  box.addEventListener('click', (ev) => {
    const btn = ev.target.closest?.('.abtn');
    if (btn) { ev.stopPropagation(); AL.press(btn.closest('.line').dataset.act); return; } // an action line's button (never expands the log)
    expanded = !expanded; box.classList.toggle('expanded', expanded); render();
  });
  box.addEventListener('mousedown', (ev) => { if (ev.target.closest?.('.abtn')) ev.preventDefault(); }); // never takes the keyboard focus
  let lastArea = null;
  app.on((what, data) => {
    if ((what === 'change' && data === app.area()) || what === 'dice') render(); // ('dice': a roll's dice settled: its line may show now)
    else if ((what === 'entry' || what === 'cut' || what === 'level' || what === 'refresh') && acts.length) { if (what !== 'refresh' || lastArea !== app.area()) render(); }
    if (what === 'frame') place();
  });

  // ---------- action lines ----------
  const ACT_CAP = 8, ACT_KEY = '.';
  const kinds = new Map(); let acts = [], actN = 0, loadedFor = null;
  const storeKey = () => app.sync?.campaign?.id && app.me?.() ? `tw.actlines.${app.sync.campaign.id}.${app.me()}` : null;
  const save = () => { const k = storeKey(); if (!k) return; try { localStorage.setItem(k, JSON.stringify(acts.map(({ pending, stale, ...l }) => l))); } catch { } };
  function load() { // once per campaign and seat; what comes back was made before this page load ("restored")
    const k = storeKey(); if (!k || loadedFor === k) return; loadedFor = k;
    try { const old = JSON.parse(localStorage.getItem(k) || '[]'); if (Array.isArray(old)) { acts = old.filter(l => l && l.id && l.text).map(l => ({ ...l, restored: true })).concat(acts).slice(-ACT_CAP); actN = Math.max(actN, ...acts.map(l => l.n || 0)); } } catch { }
  }
  const lastChatId = (area) => (app.sync.view?.(area)?.chat || []).at(-1)?.id || null;
  // can this line still be acted on? null = yes; a string = the short reason why not; undefined = it has no button
  function stateOf(l) {
    if (l.done) return undefined;
    const K = kinds.get(l.kind);
    if (!K || !l.button || (l.restored && !K.restorable)) return undefined; // plain text
    try { return K.valid ? (K.valid(l.data || {}, l) || null) : null; } catch (e) { console.warn('action line', e); return 'not available'; }
  }
  const AL = app.actionLines = {
    cap: ACT_CAP, key: ACT_KEY,
    kind: (name, def) => { kinds.set(name, def); if (acts.length) render(); },
    add(spec, { pending = false } = {}) {
      load();
      const area = spec.area || app.area();
      let l = spec.group ? acts.find(x => !x.done && x.group === spec.group && x.area === area && !x.restored) : null;
      if (l) { acts.splice(acts.indexOf(l), 1); l.count = (l.count || 1) + 1; l.data = spec.data; l.button = spec.button; l.text = spec.many ? spec.many(l.count) : `${spec.text} (×${l.count})`; }
      else l = { id: `act_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, kind: spec.kind, area, text: spec.text, button: spec.button || '', group: spec.group || null, data: spec.data || null, count: 1 };
      l.n = ++actN; l.after = lastChatId(area); l.at = Date.now(); l.pending = pending;
      acts.push(l); while (acts.length > ACT_CAP) acts.shift();
      save(); render(); return l;
    },
    reveal(id, fade) { const l = acts.find(x => x.id === id); if (l) l.pending = false; render(); const el = lineEl(id); if (el && fade) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); },
    buttonEl: (id) => lineEl(id)?.querySelector('.abtn') || null,
    list: () => { load(); return acts.map(l => ({ id: l.id, kind: l.kind, area: l.area, text: l.text, button: l.button, count: l.count || 1, done: !!l.done, restored: !!l.restored, state: stateOf(l), shown: !!lineEl(l.id) })); },
    newest: () => { const here = acts.filter(l => l.area === app.area() && !l.pending); for (let i = here.length - 1; i >= 0; i--) if (stateOf(here[i]) === null) return here[i]; return null; },
    // press a line's button: check again, then act; a refusal greys it with the reason instead of doing anything
    press(id) {
      const l = acts.find(x => x.id === id); if (!l || l.done) return false;
      const st = stateOf(l); if (st !== null) { render(); return false; }
      let out; try { out = kinds.get(l.kind).run(l.data || {}, l); } catch (e) { console.warn('action line', e); out = 'failed'; }
      const settle = (why) => { if (typeof why === 'string' && why) { l.done = false; l.refused = why; } save(); render(); };
      l.done = true; l.refused = null; save(); render();
      if (out && typeof out.then === 'function') out.then(settle, () => settle('failed')); else settle(out);
      return true;
    },
    clear: () => { acts = []; save(); render(); },
  };
  // ---------- whispers (docs/PAWNS.md: the party row's whisper) ----------
  // A private line to ONE seat. It is not a command and is in no log: the relay hands it to that seat and to my own
  // other tabs, and to nobody else (relay/campaign.js whisper). What this browser sent and received is kept here, in
  // this browser (`tw.whispers.<campaign>.<seat>`, the newest WH_CAP), so a reload still shows it.
  const WH_CAP = 30; let wh = [], whFor = null;
  const whKey = () => app.sync?.campaign?.id && app.me?.() ? `tw.whispers.${app.sync.campaign.id}.${app.me()}` : null;
  const whLoad = () => { const k = whKey(); if (!k || whFor === k) return; whFor = k; try { const old = JSON.parse(localStorage.getItem(k) || '[]'); if (Array.isArray(old)) wh = old.filter(w => w && w.id && w.text).concat(wh).slice(-WH_CAP); } catch { } };
  const whSave = () => { const k = whKey(); if (!k) return; try { localStorage.setItem(k, JSON.stringify(wh)); } catch { } };
  const whAdd = (w) => { whLoad(); if (wh.some(x => x.id === w.id)) return; wh.push({ ...w, after: lastChatId(app.area()), area: app.area() }); wh = wh.slice(-WH_CAP); whSave(); render(); };
  app.whisper = (to, text) => {
    text = String(text || '').trim().slice(0, 500); if (!text || !to) return null;
    const id = app.sync.whisper(to, text);
    if (!id) { app.toast('Not connected: the whisper was not sent', true); return null; }
    whAdd({ id, from: app.me(), to, text, at: Date.now(), sent: true });
    return id;
  };
  app.whispers = () => { whLoad(); return wh.map(w => ({ ...w })); };
  app.on((what, m) => {
    if (what !== 'whisper' || !m) return;
    if (m.t === 'whispered') { whLoad(); const w = wh.find(x => x.id === m.id); if (w) { w.ok = !!m.ok; if (!m.ok) w.why = m.why || 'not delivered'; whSave(); render(); } if (!m.ok) app.toast(m.why || 'The whisper was not delivered', true); return; }
    if (m.from === app.me()) { whAdd({ id: m.id, from: m.from, to: m.to, text: m.text, at: m.at, sent: true, ok: true }); return; } // sent from another of my tabs
    whAdd({ id: m.id, from: m.from, to: m.to, text: m.text, at: m.at });
    app.toast(`${name(m.from)} whispers: ${m.text.length > 80 ? m.text.slice(0, 80) + '…' : m.text}`);
  });
  function whHtml(w) {
    const mine = w.from === app.me(), other = mine ? w.to : w.from;
    return `<div class="line whisper${w.ok === false ? ' failed' : ''}" data-whisper="${esc(w.id)}" title="A whisper: only you and ${esc(name(other))} see this line">${icon('message-square-lock', 12)} <span class="who" style="color:${color(other)}">${mine ? `you to ${esc(name(other))}` : `${esc(name(other))} to you`}</span> <span class="wtext">${esc(w.text)}</span>${w.ok === false ? ` <span class="awhy">${esc(w.why || 'not delivered')}</span>` : ''}</div>`;
  }
  const lineEl = (id) => box.querySelector(`.line.act[data-act="${CSS.escape(id)}"]`);
  // `.` presses the newest action line's button (a key layer: it must not depend on when the key map was built)
  app.keyLayers = app.keyLayers || [];
  app.keyLayers.push((ev) => { if (ev.key !== ACT_KEY || ev.ctrlKey || ev.metaKey || ev.altKey || app.mode) return false; const l = AL.newest(); if (!l) return false; AL.press(l.id); return true; });
  R.add({ id: 'chat.act', title: 'Do the newest offer in the chat (its button)', short: 'Newest offer', synonyms: ['offer', 'action line', 'chat button', 'last offer'], icon: 'chevron-right', keys: [ACT_KEY], group: 'View', when: () => !!AL.newest(), run: () => { const l = AL.newest(); if (l) AL.press(l.id); } });
  function actHtml(l, newest) {
    const st = stateOf(l), why = l.refused && st === null ? l.refused : st;
    const btn = st === undefined ? '' : ` <button class="abtn${why ? ' off' : ''}" tabindex="-1" aria-disabled="${why ? 'true' : 'false'}" title="${why ? esc(why) : esc(l.button)}">${esc(l.button)}${newest === l && !why ? `<kbd>${ACT_KEY}</kbd>` : ''}</button>${why ? ` <span class="awhy">${esc(why)}</span>` : ''}`;
    return `<div class="line act${l.done ? ' done' : ''}${why ? ' stale' : ''}${l.pending ? ' pending' : ''}" data-act="${esc(l.id)}">${icon(l.done ? 'check' : 'chevron-right', 12)} <span class="atext">${esc(l.text)}</span>${l.done ? ' <span class="adone">done</span>' : btn}</div>`;
  }
  function name(seat) { return app.sync.campaign?.seats.find(s => s.id === seat)?.name || 'someone'; }
  function color(seat) { return app.seatColor(seat); }
  function line(c) { return c.roll ? `${icon('dices', 13)} <b>${esc(c.roll.expr)}</b> = <b class="total">${c.roll.total}</b> <span class="mute">[${c.roll.rolls.join(', ')}]</span>${c.text ? ' ' + esc(c.text) : ''}` : esc(c.text); }
  function render() {
    const chat = app.view()?.chat || [];
    load(); lastArea = app.area();
    // action lines sit where they happened: after the chat line that was newest at the time (first if that line is gone)
    const mine = acts.filter(l => l.area === app.area()).sort((a, b) => a.n - b.n), ids = new Set(chat.map(c => c.id)), newest = AL.newest();
    whLoad();
    const merged = [...mine.filter(l => !l.after || !ids.has(l.after)).map(l => ({ act: l }))];
    for (const c of chat) { merged.push({ c }); for (const l of mine) if (l.after === c.id) merged.push({ act: l }); for (const w of wh) if (w.after === c.id) merged.push({ w }); }
    for (const w of wh) if (!w.after || !ids.has(w.after)) merged.push({ w }); // (said while another area's chat was showing: at the end, in the order they came)
    const lines = merged.slice(expanded ? -40 : -5);
    // a line still being announced (surfaces/announce.js) keeps its place but stays invisible until the announce lands on it
    box.innerHTML = lines.length ? lines.map(m => m.w ? whHtml(m.w) : m.act ? actHtml(m.act, newest) : (c => `<div class="line${app.announce?.pending(c.id) || app.dice?.holding(c.id) ? ' pending' : ''}" data-id="${esc(c.id)}"><span class="who" style="color:${color(c.by)}">${esc(name(c.by))}</span> ${line(c)}</div>`)(m.c)).join('') : `<div class="line mute">${icon('message-square', 13)} say … or roll d20 in the bar</div>`;
    box.scrollTop = box.scrollHeight;
    for (const c of chat) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      if (first) continue; // don't replay history as bubbles on join
      if (app.announce) continue; // the centred announce shows it (the bubble near the speaker was the old way)
      const el = document.createElement('div');
      el.className = `bubble${c.roll ? ' roll' : ''}`; el.style.setProperty('--c', color(c.by));
      el.innerHTML = c.roll ? `${icon('dices', 14)} <b>${c.roll.total}</b> <span class="mute">${esc(c.roll.expr)}</span>` : esc(c.text);
      bubbles.append(el);
      live.push({ el, seat: c.by, until: performance.now() + 6000 });
    }
    first = false;
  }
  function place() {
    const now = performance.now();
    for (let i = live.length - 1; i >= 0; i--) {
      const b = live[i];
      if (now > b.until) { b.el.remove(); live.splice(i, 1); continue; }
      let p = null;
      if (b.seat === app.me() && app.cursor) p = app.cursor;
      else { const s = app.pv.seats.get(`${app.area()}|${b.seat}`); if (s?.pos) p = s.pos; }
      if (!p) { const t = Object.values(app.entities()).find(e => e.kind === 'token' && e.owner === b.seat); if (t) p = [t.x, t.z]; }
      const sc = p ? app.screenOf(p[0], p[1], app.main, 3) : { x: 24, y: innerHeight - 200 - i * 40 };
      b.el.style.left = `${sc.x + 14}px`; b.el.style.top = `${sc.y - 40 - (live.length - 1 - i) * 4}px`;
      b.el.style.opacity = Math.min(1, (b.until - now) / 600);
    }
  }
  render();
  return { name: 'chat' };
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
