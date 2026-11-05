// The command bar (top centre). "/" or Cmd/Ctrl+K. One ranked list with typed sections:
//   commands · place (catalog, live turning models) · in the world · places and areas · people · cues
// Up recalls history (empty input, or from the top result); Down enters the results. Enter runs; Shift+Enter on a
// figure/object result adds to the pick. Results the seat can't use never appear. Highlight previews (world thing lights up,
// an asset shows its ghost). Catalog results can be dragged straight into the world, and so can figures (as pawns).
// The field is a textarea that is always one logical line (2026-11-02): it wraps, the bar grows down to BAR_LINES lines and
// then it scrolls inside itself (fit); Enter never breaks a line and pasted line breaks become spaces.
// What you type is shown once (2026-11-03): the typed command word becomes the bar's one chip, the rest stays text (lift).
import { icon } from '../icons.js';
import { playerPortrait } from '../portraits.js';
import { keyLabel } from '../registry.js';
import { chordOf } from '../menu.js';
import { FILLER, forms, near } from '../barwords.js';

const SECTIONS = [['cmd', 'Commands'], ['intent', ''], ['figs', 'Figures: Shift-click to pick several · click or drag to place'], ['place', 'Place'], ['world', 'In the world'], ['places', 'Places and areas'], ['people', 'People'], ['cues', 'Cues']];
const CAP = { cmd: 8, figs: 8, place: 8, world: 6, places: 5, people: 5, cues: 3, intent: 3 };
const BAR_LINES = 6; // the field grows to this many lines, then scrolls inside itself

export function barSurface(R, app) {
  const root = document.getElementById('bar'), input = root.querySelector('textarea'), list = document.getElementById('results');
  const chipsEl = root.querySelector('.chips'), fieldEl = root.querySelector('.field');
  let open = false, rows = [], hi = -1, hist = [], histAt = -1, dragging = null;
  let activeQuery = '', lastList = null, recalled = false, arrowed = false; // arrowed: the highlight got where it is by the arrow keys
  const picked = new Map();
  const pickKey = r => r.pick ? `${r.pick.kind}:${r.pick.fig?.id || r.pick.cat?.id || 'plain'}:${r.pick.count}` : null;
  const pickItems = () => [...picked.values()];
  function clearPick() { picked.clear(); paintPick(); }
  function pick(r, toggle = false) {
    const key = pickKey(r); if (!key || r.disabled) return;
    if (toggle && picked.has(key)) picked.delete(key); else picked.set(key, r.pick);
    paintPick();
  }
  function paintPick() {
    let status = list.querySelector('.bar-status');
    if (!status) { status = document.createElement('div'); status.className = 'bar-status'; list.prepend(status); }
    const n = pickItems().reduce((sum, item) => sum + item.count, 0);
    status.innerHTML = `${recalled && activeQuery ? `<span class="bar-last">last: ${esc(activeQuery)}</span>` : ''}${n ? `<span class="pick-count">${n} picked</span><button class="mini" data-pick-place>Place <kbd>Enter</kbd></button><span class="pick-help">Shift adds · Ctrl/⌘ toggles · Esc clears</span>` : ''}`;
    status.hidden = !status.childElementCount;
    status.querySelector('[data-pick-place]')?.addEventListener('click', placePick);
    list.querySelectorAll('.res').forEach(el => {
      const r = rows[+el.dataset.i], yes = picked.has(pickKey(r));
      el.classList.toggle('picked', yes);
      if (r.pick) { el.setAttribute('aria-selected', String(yes)); el.querySelector('.pick-check').textContent = yes ? '✓' : ''; }
    });
  }
  function placePick() {
    if (!picked.size) return;
    const items = pickItems(); remember(); close(); app.pickTool.start(items);
  }
  // ---------- the field (Harry 2026-11-02: "when I type like a freaking essay into the quickbar, it doesn't scale to let me
  // keep going, I just sort of get a visual mess as I'm typing") ----------
  // A hidden copy of the text, laid out as the field lays it out: how wide it is on one line, and where the caret falls.
  const shadow = document.createElement('div'); shadow.className = 'barmeasure'; shadow.setAttribute('aria-hidden', 'true'); root.append(shadow);
  const metrics = () => { const cs = getComputedStyle(input), line = parseFloat(cs.lineHeight) || 20, pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom); return { cs, line, pad, rest: line + pad, max: line * BAR_LINES + pad }; };
  const dress = (cs) => { shadow.style.font = cs.font; shadow.style.lineHeight = cs.lineHeight; };
  // which wrapped line of the text the caret is on (0 = the first), and how many there are
  const caretLine = () => { const { cs, line } = metrics(); dress(cs); shadow.style.whiteSpace = ''; shadow.style.width = `${input.clientWidth}px`; const at = input.selectionStart, mark = document.createElement('span'); shadow.textContent = input.value.slice(0, at); mark.textContent = input.value.slice(at) || '\u200b'; shadow.append(mark); return Math.round(mark.offsetTop / line); };
  const lastLine = () => { const { line, pad } = metrics(); return Math.max(0, Math.round((input.scrollHeight - pad) / line) - 1); };
  // Fit the bar to the text: the field takes the height of its text, up to BAR_LINES, and everything under the bar follows
  // --bar-grow (style.css; the text scale is applied there). The one chip, the verb, sits at the start of the first line.
  function fit() {
    const { rest, max } = metrics(), top = input.scrollTop;
    input.style.height = `${rest}px`;
    const want = input.value ? Math.max(rest, input.scrollHeight) : rest, h = Math.min(want, max);
    input.style.height = `${h}px`;
    input.style.overflowY = want > max ? 'auto' : 'hidden';
    input.scrollTop = input.selectionEnd >= input.value.length ? input.scrollHeight : top; // (the caret stays in view: typing at the end, the end)
    root.classList.toggle('tall', h > rest);
    root.classList.toggle('over', want > max);
    root.parentElement.style.setProperty('--bar-grow', `${h - rest}px`);
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if (open) fit(); }).observe(fieldEl); // (the window, the bar opening wider, the text size)
  function enter(ev) { const r = rows[hi >= 0 ? hi : 0]; if (ev.shiftKey && r?.pick) pick(r); else if (picked.size && ev.key === 'Enter') placePick(); else if (r && ev.key === 'Enter' && !heldBack(r)) activate(r, ev); }
  function escape() { if (picked.size) { clearPick(); return true; } close(); return true; }
  // ---------- WHAT YOU TYPE IS SHOWN ONCE (Harry 2026-11-03: "you shouldn't be putting what I type into a chip and into the
  // bar simultaneously. Like if I 'say hello there everyone' it's fine for 'Say' to turn into a chip, but why are we turning
  // 'hello there everyone' into a chip") ----------
  // The typed command word, once the bar knows it ("say ", "whisper ", "roll ", "new area "), leaves the field and becomes
  // the bar's one chip; the rest stays plain text in the field. The line the bar works on is the two together (line()).
  // Backspace at the start of the field puts the word back as text, and it stays text until that word is edited.
  let lifted = null, unlifted = null, canLift = null; // lifted: { word (as typed), label (the chip), cue (the empty field's placeholder) } · unlifted: the word put back
  const line = () => lifted ? `${lifted.word} ${input.value}` : input.value;
  const wordsRe = (w) => String(w).trim().split(/\s+/).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  function lift(can) {
    if (lifted || recalled || !can) return;
    const v = input.value, m = v.match(new RegExp(`^\\s*(${wordsRe(can.label)})\\s+`, 'i'));
    if (!m || (unlifted && m[1].toLowerCase().replace(/\s+/g, ' ') === unlifted)) return;
    const a = input.selectionStart ?? v.length, b = input.selectionEnd ?? a, n = m[0].length;
    if (a < n) return; // (the caret is still in the word: it is being typed or edited there)
    lifted = { word: m[1], label: can.label, cue: can.cue || '' };
    input.value = v.slice(n); input.setSelectionRange(a - n, b - n);
    paintChip();
  }
  function unlift() {
    const w = lifted.word, rest = input.value;
    lifted = null; unlifted = w.toLowerCase().replace(/\s+/g, ' ');
    input.value = rest ? `${w} ${rest}` : w; input.setSelectionRange(w.length, w.length);
    histAt = -1; update(); paintChip();
  }
  function paintChip() { chipsEl.innerHTML = lifted && !recalled ? `<span class="chip verb">${esc(lifted.label)}</span>` : ''; placeholder(); fit(); }
  const atStart = () => !!lifted && input.selectionStart === 0 && input.selectionEnd === 0;
  // a TYPED INTENT in a recalled list (say hello there, roll d20, 6 goblins: the rows that wear chips) runs only when it is
  // chosen, by the arrows or a click. A bare Enter on the blank bar, or a mouse resting on the row, repeats nothing. A list
  // opened on nothing typed is not this: a phone's Roll d20 and Say… are the empty bar's own rows.
  const heldBack = (r) => !!r && recalled && !!activeQuery && !arrowed && (r.sec === 'intent' || !!r.chips);
  try { hist = JSON.parse(localStorage.getItem('tw.barHistory') || '[]'); } catch { }

  function show(prefill = null) {
    const wasOpen = open;
    open = true; root.classList.add('open'); list.hidden = false;
    lifted = unlifted = null;
    input.value = prefill ?? '';
    input.focus(); input.select?.();
    if (prefill) input.setSelectionRange(prefill.length, prefill.length);
    histAt = -1;
    if (prefill == null && lastList) {
      // THE REOPENED BAR IS BLANK (Harry 2026-11-02, from Nick's note: "that should never actually populate the bar itself ...
      // if you are in the bar, the bar should itself be blank, and just give options from the last time below it"): the list
      // comes back below the bar, its typed intent row among the options, but no chips and no text (update), and that row
      // is not the highlight: nothing in the bar says what a bare Enter would do, so it does nothing (see Enter, below).
      recalled = true; update(lastList.query); arrowed = false;
      const at = Math.min(lastList.hi, rows.length - 1); setHi(heldBack(rows[at]) ? -1 : at);
      list.scrollTop = lastList.scroll;
    } else { recalled = false; update(); lift(canLift); }
    paintChip();
    if (!wasOpen) app.escapeStack.push(escape);
  }
  function close() {
    if (!open) return false;
    lastList = { query: activeQuery, hi, scroll: list.scrollTop };
    picked.clear();
    open = false; root.classList.remove('open'); list.hidden = true; input.blur(); input.value = ''; lifted = unlifted = null; chipsEl.innerHTML = ''; fit();
    app.previews.detachAll(list); setHi(-1); app.modes.preview?.(null);
    const i = app.escapeStack.indexOf(escape); if (i >= 0) app.escapeStack.splice(i, 1);
    placeholder();
    app.emit('bar.close');
  }
  app.on((what, data) => { if (what === 'bar.open') show(typeof data === 'string' ? data : null); if (what === 'selection' || what === 'refresh') placeholder(); if (open && what === 'refresh') { const oldHi = hi, scroll = list.scrollTop; update(activeQuery); setHi(oldHi); list.scrollTop = scroll; fit(); } });
  function placeholder() { if (lifted) { input.placeholder = lifted.cue; return; } const n = app.sel.size, hand = document.documentElement.classList.contains('tw-hand'); /* (a phone: words that fit, docs/UI.md "On a phone") */ input.placeholder = n ? (hand ? `${n} selected · a command…` : `${n} selected · type a command, or say / roll …`) : hand ? 'Search, place, say or roll' : 'Search commands, things to place, people, places… or say / roll'; }
  // The shared drag gesture captures Escape before the input sees it. Let it cancel the ghost,
  // and clear the bar pick as well, just as Escape does before a drag starts.
  addEventListener('keydown', ev => { if (open && ev.key === 'Escape' && app.draggingOut?.()) clearPick(); }, true);
  input.addEventListener('focus', () => { if (!open) show(); });
  input.addEventListener('input', () => {
    // a leading "/" is the open-the-bar key typed again (Harry 2026-10-29: "if I start a quick bar command with / it
    // should ignore it"): drop it, keeping the caret where it was. No command starts with "/".
    // (one logical line: a pasted line break is a space, one for one, so the caret stays where it was)
    if (input.value.includes('\n')) { const at = input.selectionStart; input.value = input.value.replace(/\n/g, ' '); input.setSelectionRange(at, at); }
    // (not after a chip: "say /shrug" says it)
    const v = input.value, m = !lifted && v.match(/^\s*\/+\s*/);
    if (m) { const at = Math.max(0, (input.selectionStart ?? v.length) - m[0].length); input.value = v.slice(m[0].length); input.setSelectionRange(at, at); }
    if (unlifted && !new RegExp(`^\\s*${wordsRe(unlifted)}(\\s|$)`, 'i').test(input.value)) unlifted = null; // (the word put back has been edited: it may become a chip again)
    histAt = -1; recalled = false; update(); lift(canLift); paintChip();
  });
  // (a phone's keyboard may send its Enter only as text: that is an Enter too, never a line break; and its Backspace may
  // come only as an input event: at the start of the field it puts the chip's word back, as the key does)
  input.addEventListener('beforeinput', (ev) => {
    if (ev.inputType === 'insertLineBreak' || ev.inputType === 'insertParagraph') { ev.preventDefault(); enter({ key: 'Enter', shiftKey: false }); }
    else if (ev.inputType.startsWith('deleteContentBackward') || ev.inputType.startsWith('deleteWordBackward')) { if (atStart()) { ev.preventDefault(); unlift(); } }
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); escape(); return; }
    if (ev.key === 'Backspace' && atStart()) { ev.preventDefault(); unlift(); return; } // back into the chip: the word is text again
    // INSIDE WRAPPED TEXT the arrows move the caret by line, as in any text: Down goes to the results from the last line,
    // Up recalls history from the first. Once the arrows are in the results they stay there.
    if (ev.key === 'ArrowDown') { if (hi <= 0 && caretLine() < lastLine()) return; ev.preventDefault(); arrowed = true; setHi(Math.min(rows.length - 1, hi + 1)); return; }
    if (ev.key === 'ArrowUp') {
      if (input.value && hi <= 0 && caretLine() > 0) return;
      ev.preventDefault();
      if (!input.value || hi <= 0) { // history, as in a shell or an omnibox
        if (!hist.length) return;
        histAt = Math.min(hist.length - 1, histAt + 1);
        lifted = unlifted = null; input.value = hist[hist.length - 1 - histAt]; recalled = false; update(); setHi(-1); lift(canLift); paintChip();
        return;
      }
      arrowed = true; setHi(hi - 1); return;
    }
    if (ev.key === 'Enter' || (ev.key === ' ' && ev.shiftKey)) { ev.preventDefault(); enter(ev); return; }
  });

  // ---------- scoring ----------
  // The whole line as one of the texts: 110. Else every word must be found in one: whole text 100, its start 80, a word's start 62, inside 40, else a near
  // miss (barwords.js near: one slip, "lanturn") 30. Each word is also tried singular ("torches"). FILLER words ("make it
  // dark", "open the door") count only where they start a text; elsewhere they are passed over (2026-10-20: they made
  // whole lines match nothing; and the old letters-in-order fallback ran over long descriptions and matched nearly anything).
  function score(q, ...texts) {
    if (!q) return 1;
    if (q.length > 120) return 0; // nothing has a name this long; an essay's every keystroke was searching the whole catalog (150+ ms at 300 words)
    const words = q.toLowerCase().split(/\s+/).filter(Boolean), line = words.join(' ');
    if (words.length > 1 && texts.some(t => t && String(t).toLowerCase() === line)) return 110; // the whole line is a title or synonym ("trap corridor", "build a building")
    let total = 0, counted = 0;
    for (const w0 of words) {
      let best = 0;
      for (const w of forms(w0)) for (const t0 of texts) {
        if (!t0) continue;
        const t = String(t0).toLowerCase();
        const s = t === w ? 100 : t.startsWith(w) ? 80 : (t.includes(' ' + w) || t.includes('-' + w)) ? 62 : t.includes(w) ? 40 : near(w, t);
        if (s > best) best = s;
      }
      if (words.length > 1 && FILLER.has(w0) && best < 80) continue;
      if (!best) return 0;
      total += best; counted++;
    }
    return counted ? total / counted : 0;
  }
  const boost = (id) => { const u = R.usage(id); const age = (Date.now() - u.last) / 3.6e6; return Math.min(18, u.n * 2) + (u.last ? Math.max(0, 14 - age) : 0); };

  // ---------- results ----------
  function update(query = line().trim()) {
    const q = activeQuery = query;
    const ctx = R.ctx();
    const out = [];
    // typed intents: roll d20+5, -7 on selected pawns, say …, new area …, invite …. The row says what Enter will do. While you
    // type, it leaves out the words you typed (they are in the bar, once: unechoed); in a recalled list the bar is blank, so
    // the row has them all.
    let intentChips = null, cue = '';
    for (const c of R.available(ctx)) {
      if (!c.parse || !q) continue;
      const a = safe(() => c.parse(q, ctx));
      if (!a) continue;
      const chips = c.chips ? c.chips(a, ctx) : [c.title];
      out.push({ sec: 'intent', s: 1000, ref: `cmd:${c.id}`, title: chips.join(' '), chips: recalled ? chips : unechoed(chips, q), icon: R.iconOf(c, ctx), keys: c.keys, run: () => R.run(c, a, ctx), sub: recalled ? 'Down arrow, then Enter, or click' : 'Enter to do it' });
      if (!intentChips) { intentChips = chips; cue = c.cue || ''; }
    }
    // a command word and a space, nothing after it yet ("say ", or the Pawns menu's "whisper Kit "... its "whisper "): the
    // word becomes the chip now, before the first letter of what follows
    if (!intentChips && q && /\s$/.test(input.value) && !lifted) for (const c of R.available(ctx)) {
      if (!c.parse || !c.chips) continue;
      const a = ['x', '1', 'd20'].map(w => safe(() => c.parse(`${q} ${w}`, ctx))).find(Boolean), v = a && safe(() => c.chips(a, ctx))?.[0];
      if (v && String(v).toLowerCase() === q.toLowerCase().replace(/\s+/g, ' ')) { intentChips = [v]; cue = c.cue || ''; break; }
    }
    // A PHONE'S EMPTY BAR (Harry 2026-10-24, "the default user for this mode is 'player on the road'"): the two things a
    // player does most, without the phone's keyboard: a d20 at once, and the field set to "say ". Typed rolls as ever.
    if (!q && window.TW_HAND && (app.gm() || app.can('chat'))) out.push(
      { sec: 'intent', s: 1001, ref: 'hand:roll', title: 'Roll d20', chips: ['roll', 'd20'], icon: 'dices', sub: 'or type: roll 2d6+3', run: () => app.roll('d20') },
      { sec: 'intent', s: 1000, ref: 'hand:say', title: 'Say…', icon: 'message-square', sub: 'then type it', run: () => setTimeout(() => app.emit('bar.open', 'say '), 0) });
    // send selection to an area: "send to cellar"
    const send = q.match(/^send (?:to\s+)?(.*)$/i) || (app.sel.size ? q.match(/^(?:move|travel|teleport)\s+(?:(?:it|him|her|them|selection)\s+)?to\s+(.+)$/i) : null);
    if (send && app.can('transfer')) for (const t of app.sync.campaign.areas) if (t.id !== app.area() && score(send[1], t.name)) out.push({ sec: 'intent', s: 900, ref: `send:${t.id}`, title: `Send selection to ${t.name}`, chips: ['send', `${app.sel.size} thing${app.sel.size === 1 ? '' : 's'}`, '→', t.name], icon: 'send', run: () => app.transfer(app.selected(), t.id) });
    // GM: give the selected pawn to a person ("give to Mira", "give him to Mira": the ring's Give control, by name)
    const give = q.match(/^(?:give|hand)\s+(?:(?:it|him|her|them|control|this pawn|the pawn)\s+)?(?:control\s+)?to\s+(.+)$/i), pawn = ctx.one?.kind === 'token' ? ctx.one : null;
    if (give && pawn && app.gm()) for (const s of app.sync.campaign.seats) if (s.kind === 'human' && s.id !== app.me() && score(give[1], s.name)) out.push({ sec: 'intent', s: 900, ref: `give:${s.id}`, title: `Give ${pawn.name} to ${s.name}`, chips: ['give', pawn.name, '→', s.name], icon: 'user-plus', run: () => app.giveTo(pawn, s.id) });
    // GM: undo someone else's last action (the visible trail lives here for now)
    const und = q.match(/^undo\s+(.+)$/i);
    if (und && app.gm()) for (const s of app.sync.campaign.seats) if (s.id !== app.me() && score(und[1], s.name)) out.push({ sec: 'intent', s: 900, ref: `undo:${s.id}`, title: `Undo ${s.name}'s last action`, chips: ['undo', s.name], icon: 'undo-2', run: () => app.undoFor(s.id) });
    // FIGURES AS PAWNS (2026-10-06; client/figures.js, client/pawns.js). The figure list is searched as data: nothing is
    // loaded for a row but its small picture, and only the rows shown (8) are drawn.
    //   "owlbear" · "elf wizard" · "goblin spear"      a creature's own name, class, race, tag or SRD name
    //   "add pawn …" · "place figure …" · "mini …" · "spawn …"     the same, by the verb
    //   "6 goblins" · "add 6 goblins" · "goblin x6"   a count: one click drops the group, numbered
    //   "change figure …"                             on the selected pawn(s)
    const F = app.figures, FQ = F?.count ? figureQuery(q) : null, selPawns = ctx.sel.filter(e => e.kind === 'token');
    if (FQ?.change && selPawns.length && selPawns.length === ctx.sel.length && selPawns.every(p => ctx.gm || app.canTouch(p))) {
      const who = selPawns.length === 1 ? selPawns[0].name : `${selPawns.length} pawns`;
      for (const { fig, s } of FQ.text ? F.search(FQ.text, { limit: CAP.figs }) : F.list.slice(0, 0)) out.push({ sec: 'figs', s: 900 + s, ref: `fig:${fig.id}`, title: fig.name, chips: ['change figure', who, '→', fig.name], sub: F.describe(fig), pic: F.thumbUrl(fig), icon: 'user', fig, onto: fig, run: () => app.setFigure(selPawns, fig) });
      if (selPawns.some(p => p.fig) && (!FQ.text || /^(no|none|plain|remove|stand)/i.test(FQ.text))) out.push({ sec: 'figs', s: 890, title: 'No figure', chips: ['change figure', who, '→', 'the plain pawn'], sub: 'back to the stand-in', icon: 'user', run: () => app.setFigure(selPawns, null) });
      if (!FQ.text) out.push({ sec: 'intent', s: 880, title: `Change figure: type a name (${F.count} figures: owlbear, elf wizard, goblin spear …)`, icon: 'replace', sub: `for ${who}`, disabled: true, run: () => {} });
      intentChips = intentChips || ['change figure', who, '→', out.find(r => r.sec === 'figs')?.fig?.name || '…'];
    } else if (FQ && !FQ.change && app.can('token.edit') && (FQ.text || FQ.explicit)) {
      const found = FQ.text ? F.search(FQ.text, { limit: CAP.figs }) : [], n = Math.min(30, FQ.count || 1), lead = FQ.explicit || n > 1;
      const named = (fig) => FQ.text.toLowerCase().split(/\s+/).every(w => FILLER.has(w) || forms(w).some(f => fig.name.toLowerCase().includes(f) || near(f, fig.name.toLowerCase())));
      for (const { fig, s } of found) out.push({ sec: 'figs', s: (lead ? 900 : named(fig) ? 0 : -20) + s, ref: `fig:${fig.id}`, title: n > 1 ? `${n} × ${fig.name}` : fig.name, chips: lead ? ['add pawn', ...(n > 1 ? [`${n} ×`] : []), fig.name, 'click a square'] : null, sub: `${F.describe(fig)}${lead ? '' : ' · click, then a square'}`, pic: F.thumbUrl(fig), icon: 'user', fig, pick: { kind: 'pawn', fig, count: n }, out: () => app.pawnTool.start(fig, { count: n }), run: (ev) => app.pawnTool.start(fig, { count: n, keep: ev?.shiftKey }) });
      if (FQ.explicit && (!FQ.text || /^(plain|blank|pawn|token|stand)/i.test(FQ.text))) out.push({ sec: 'figs', s: 905 - (found.length ? 200 : 0), ref: 'fig:plain', title: n > 1 ? `${n} × plain pawn` : 'Plain pawn (no figure)', chips: ['add pawn', ...(n > 1 ? [`${n} ×`] : []), 'plain pawn', 'click a square'], sub: 'the stand-in', icon: 'user', pick: { kind: 'pawn', fig: null, count: n }, out: () => app.pawnTool.start(null, { count: n }), run: (ev) => app.pawnTool.start(null, { count: n, keep: ev?.shiftKey }) });
      if (FQ.explicit && !FQ.text) out.push({ sec: 'intent', s: 880, title: `Add pawn: type a name (${F.count} figures: owlbear, elf wizard, goblin spear, 6 goblins …)`, icon: 'user-plus', sub: 'name, class, race, hero / townsfolk / foe / beast / large, or an SRD monster name', disabled: true, run: () => {} });
      if (lead && found.length) intentChips = intentChips || ['add pawn', ...(n > 1 ? [`${n} ×`] : []), found[0].fig.name, 'click a square'];
      else if (FQ.explicit && !FQ.text) intentChips = intentChips || ['place pawn', 'type a name…']; // (the Pawns menu's search button lands here: "place pawn ▸", the cursor after it)
    }
    // the verb the bar may lift out of the field (lift): the first typed intent's ("place pawn ▸ type a name…": its cue)
    canLift = intentChips && !recalled ? { label: String(intentChips[0]), cue: cue || (/…$/.test(intentChips[1] || '') && intentChips[1].length > 1 ? intentChips[1] : '') } : null;

    // commands
    for (const c of R.available(ctx)) {
      if (c.ringOnly || (c.hidden && (q.length < 3 || c.stub)) || (window.TW_HAND && c.id === 'view.sheet')) continue; // (a phone: no keys, so no key sheet) // stubs reached by typing (natural language) are offered by the fallback row
      const title = typeof c.title === 'function' ? c.title(ctx) : c.title;
      let s = score(q, title, ...c.synonyms, c.group);
      if (!s) continue;
      // A title prefix outranks synonym-only hits ("graphics" finds Graphics quality presets),
      // even after other graphics switches have acquired a usage boost.
      const query = q.trim().toLowerCase(), named = String(title).toLowerCase();
      if (query && named.replace(/\s*[…:]+$/, '') === query) s += 70; // the title itself ("pawns" → Pawns…), above a longer title it begins
      else if (query && (named.startsWith(query + ' ') || named.startsWith(query + ':'))) s += 60;
      else if (query && query.split(/\s+/).every(w => FILLER.has(w) || forms(w).some(f => named.includes(f)))) s += 8; // every word in the title, not only in the synonyms ("crypt": Build a whole crypt & tomb)
      const selectionCmd = ctx.sel.length && c.when.length && c.id !== 'edit.selectAll';
      s += boost(c.id) + (selectionCmd ? 22 : 0) + (q ? 0 : (c.group === 'Build' ? -30 : 0));
      if (c.stub) s -= 30;
      out.push({ sec: 'cmd', s, ref: `cmd:${c.id}`, title, icon: R.iconOf(c, ctx), img: c.img, keys: c.keys, chord: chordOf(R, c.id), disabled: !R.isEnabled(c, ctx), danger: c.danger, sub: c.hint || (String(c.group).replace(' ▸ ', ' · ')), run: () => R.run(c, undefined, ctx) });
    }
    if (q) {
      // catalog (only for seats that may place things)
      if (app.can('object')) for (const cat of app.assets.catalog) {
        // (a word found only in the description counts three quarters: "peasant" is the figure, not the rye loaf "a peasant's …")
        const s = Math.max(score(q, cat.name, cat.id, ...(cat.terms || [])), 0.75 * score(q, cat.name, cat.id, ...(cat.terms || []), cat.desc, cat.hint)), nm = cat.name.toLowerCase(), qs = forms(q.toLowerCase());
        if (s) out.push({ sec: 'place', ref: `cat:${cat.id}`, s: s + (qs.includes(nm) ? 100 : qs.some(x => nm.startsWith(x)) ? 10 : 0), title: cat.name[0].toUpperCase() + cat.name.slice(1), sub: `${cat.desc}${cat.place !== 'floor' ? ` · ${cat.place}` : ''}`, cat, pick: { kind: 'object', cat, count: 1 }, run: (ev) => app.modes.place(cat, { keep: ev?.shiftKey }) });
      }
      // things in the world: by name, three-letter tag, or what they are
      for (const e of Object.values(app.entities())) {
        if (e.kind === 'building' || e.kind === 'room' || app.fog?.hidden(e)) continue;
        const tag = app.tagOf(e.id);
        const s = Math.max(score(q, e.name, e.cat, e.kind === 'token' ? 'pawn token' : ''), q.length === 3 && tag === q.toUpperCase() ? 120 : 0);
        if (s) out.push({ sec: 'world', s, ref: `ent:${e.id}`, title: app.nameOf(e), sub: `${tag} · ${e.kind === 'token' ? 'pawn' : app.nameOf(app.parentOf(e)) || 'object'}${e.hidden ? ' · hidden' : ''}`, icon: e.kind === 'token' ? 'user' : 'box', entity: e, run: () => { app.select(e.id); app.frameSelection(); } });
      }
    }
    // places: areas, buildings and rooms
    for (const t of app.sync.campaign?.areas || []) { const s = score(q, t.name, 'area', 'go to'); if (s) out.push({ sec: 'places', s: s + (q ? 0 : -5), ref: `area:${t.id}`, title: t.name, sub: `area · ${t.visibility}${t.id === app.area() ? ' · you are here' : ''}`, icon: 'map', run: () => app.setMain(t.id), alt: app.pipAllowed?.() !== false && { icon: 'picture-in-picture-2', label: 'PiP', run: () => app.openPip(t.id) } }); }
    if (q) for (const e of Object.values(app.entities())) if ((e.kind === 'room' || e.kind === 'building') && !app.fog?.hidden(e)) { const s = score(q, app.nameOf(e), e.kind); if (s) out.push({ sec: 'places', s: s - 2, ref: `ent:${e.id}`, title: app.nameOf(e), sub: e.kind === 'room' ? `room · ${e.recipe.w * 5}×${e.recipe.d * 5} ft` : 'building', icon: e.kind === 'room' ? 'square-dashed' : 'house', entity: e, run: () => { app.select(e.id); app.frameSelection(); } }); }
    // people
    for (const s0 of app.sync.campaign?.seats || []) {
      const s = score(q, s0.name, s0.label, s0.role, 'person');
      if (s && q) out.push({ sec: 'people', s, ref: `seat:${s0.id}`, title: s0.name, sub: `${s0.label || s0.role}${s0.location ? ' · at ' + app.areaName(s0.location) : s0.elsewhere ? ' · elsewhere' : ''}`, person: s0, color: s0.color, run: () => s0.location && app.setMain(s0.location), alt: s0.location && app.pipAllowed?.() !== false && { icon: 'picture-in-picture-2', label: 'PiP', run: () => app.openPip(s0.location) } }); // (a phone: no PiP)
    }
    // cues: lighting is real now (the "Lighting here: …" commands set this area's lighting profile); weather is still to come
    if (q) for (const [name, ic] of [['Rain', 'droplet']]) { const s = score(q, name, 'cue weather'); if (s) out.push({ sec: 'cues', s: s - 20, title: `${name} (later)`, sub: 'cue', icon: ic, disabled: true, run: () => {} }); }
    // natural-language fallback: nothing matched → the assistant seat (stub)
    if (q && q.split(/\s+/).length >= 2 && !out.some(r => r.sec !== 'cues' && r.s > 30)) out.push({ sec: 'intent', s: 500, ref: 'assistant', title: recalled ? `Ask the assistant: “${q}”` : 'Ask the assistant', icon: 'wand-sparkles', sub: 'sends to the GM assistant seat (not wired yet)', run: () => R.run('chat.assistant', { text: q }) });

    // assemble: sections in order, each ranked and capped
    // one ranked list: sections ordered by their best match (typed intents first), each ranked and capped
    rows = [];
    const best = (sec) => Math.max(-1, ...out.filter(r => r.sec === sec).map(r => r.s));
    const order = SECTIONS.map(([sec]) => sec).sort((x, y) => (y === 'intent') - (x === 'intent') || (q ? best(y) - best(x) : 0));
    for (const sec of order) rows.push(...out.filter(r => r.sec === sec).sort((a, b) => b.s - a.s).slice(0, CAP[sec]));
    render();
    setHi(rows.length ? 0 : -1);
  }

  function render() {
    app.previews.detachAll(list);
    list.innerHTML = '';
    let lastSec = null;
    rows.forEach((r, i) => {
      if (r.sec !== lastSec) { lastSec = r.sec; const title = SECTIONS.find(s => s[0] === r.sec)[1]; if (title) list.insertAdjacentHTML('beforeend', `<div class="sec">${title}</div>`); }
      const el = document.createElement('div');
      el.className = `res${r.disabled ? ' disabled' : ''}${r.danger ? ' danger' : ''}${r.sec === 'intent' ? ' intent' : ''}${r.out || r.onto ? ' drags' : ''}`;
      el.dataset.i = i; if (r.ref) el.dataset.ref = r.ref; // (what the row is: cmd:<id> · cat:<id> · fig:<id> · ent:<id> · area:<id> … tests read it)
      if (r.pick) { el.dataset.pickKind = r.pick.kind; el.setAttribute('role', 'option'); }
      const visual = r.person ? `<span class="avatar">${playerPortrait(app, r.person)}</span>` : r.cat ? `<span class="pvw" data-pv>${icon('box', 24)}</span>` : r.pic ? `<span class="ico img pic"><img src="${esc(r.pic)}" alt="" loading="lazy" decoding="async" draggable="false"></span>` : r.img ? `<span class="ico img"><img src="data/icons/${r.img}.png?v=${window.TW_V || 'dev'}" alt=""></span>` : r.color ? `<span class="avatar" style="--c:${r.color}">${esc(r.title[0] || '?')}</span>` : `<span class="ico">${icon(r.icon || 'box', 24)}</span>`;
      const keys = [...(r.keys || []).slice(0, 2).map(k => `<kbd>${esc(keyLabel(k))}</kbd>`), r.chord ? `<kbd>${r.chord.map(x => x.length === 1 ? x.toUpperCase() : x).join(' ')}</kbd>` : ''].join('');
      el.innerHTML = `${r.pick ? '<span class="pick-check" aria-hidden="true"></span>' : ''}${visual}<span class="txt"><span class="t">${r.chips ? r.chips.map((c, j) => `<span class="chip${j ? '' : ' verb'}">${esc(c)}</span>`).join('') : esc(r.title)}</span><span class="s">${esc(r.sub || '')}</span></span>${keys ? `<span class="keys">${keys}</span>` : ''}${r.alt ? `<button class="mini" data-alt>${icon(r.alt.icon, 14)} ${r.alt.label}</button>` : ''}`;
      if (r.pic) el.querySelector('.pic img').onerror = (ev) => { ev.target.parentNode.classList.remove('img', 'pic'); ev.target.parentNode.innerHTML = icon(r.icon || 'user', 24); }; // no picture: the plain icon
      if (r.cat) { app.previews.attach(el.querySelector('[data-pv]'), app.previewOf(r.cat)); el.title = 'Click to place (Shift: keep placing) · or drag it into the world'; }
      el.addEventListener('pointermove', () => { if (hi !== i) { arrowed = false; setHi(i); } }); // only real mouse movement moves the highlight
      el.addEventListener('pointerdown', (ev) => {
        if (ev.target.closest('[data-alt]')) return;
        ev.preventDefault();
        if (r.pick && picked.has(pickKey(r))) {
          const d = dragging = { r, x: ev.clientX, y: ev.clientY, click: true };
          app.dragPickOut(ev, pickItems(), { onStart: () => { d.out = true; list.classList.add('out'); root.classList.add('dragging-out'); }, onEnd: done => { list.classList.remove('out'); root.classList.remove('dragging-out'); if (done) { remember(); close(); } } });
        } else if (r.cat && app.can('object')) dragging = { r, x: ev.clientX, y: ev.clientY, started: false, pointerId: ev.pointerId };
        else {
          const d = dragging = { r, x: ev.clientX, y: ev.clientY, click: true };
          // A FIGURE ROW DRAGS OUT (Harry 2026-10-06: "the pawns can't be dragged out of the text-search menu"): the pawn
          // tool's ghost goes with the pointer over the map and is placed where it is let go (a count: the whole group);
          // a "change figure" row is dropped ONTO a pawn. The list steps aside for the drag; let go on the map and the bar
          // closes, anywhere else (or Esc) and the list is back as it was. A press that never moves is the click below.
          const hooks = { onStart: () => { d.out = true; list.classList.add('out'); root.classList.add('dragging-out'); }, onEnd: (done) => { list.classList.remove('out'); root.classList.remove('dragging-out'); if (done) { remember(); close(); } } };
          if (r.out) app.dragPawnOut(ev, r.out, hooks); else if (r.onto) app.dragFigureOnto(ev, r.onto, hooks);
        }
      });
      if (r.pick) el.title = 'Shift-click to pick · Ctrl/⌘-click to toggle · drag picked rows together · Enter to place';
      else if (r.onto) el.title = 'Click to change the selected pawn · or drag it onto any pawn';
      el.querySelector('[data-alt]')?.addEventListener('click', (ev) => { ev.stopPropagation(); r.alt.run(); close(); });
      list.append(el);
    });
    if (!rows.length && activeQuery) list.innerHTML = `<div class="empty">Nothing matches</div>`;
    paintPick();
  }

  // ---------- drag a catalog result straight into the world ----------
  addEventListener('pointermove', (ev) => {
    if (!dragging || dragging.click) return;
    const moved = Math.hypot(ev.clientX - dragging.x, ev.clientY - dragging.y);
    if (!dragging.started && moved > 6) { dragging.started = true; app.modes.place(dragging.r.cat, { viaDrag: true }); root.classList.add('dragging-out'); list.hidden = true; }
    if (dragging.started) { dragging.again = () => { const r = app.rayAt(ev.clientX, ev.clientY); const g = app.groundAt(ev.clientX, ev.clientY); app.cursor = g; app.modes.hover(r, g, ev); }; dragging.again(); }
  });
  app.edgePan?.source({ name: 'bar', mapOnly: true, active: () => !!dragging?.started, refresh: () => dragging?.again?.() }); // held at an edge of the window, the view pans (edgepan.js)
  addEventListener('pointerup', (ev) => {
    if (!dragging) return;
    const d = dragging; dragging = null;
    root.classList.remove('dragging-out');
    if (d.started) {
      const over = document.elementFromPoint(ev.clientX, ev.clientY);
      if (over?.id === 'c') app.modes.placeAt(app.rayAt(ev.clientX, ev.clientY), app.groundAt(ev.clientX, ev.clientY), { shiftKey: false });
      else app.modes.cancel();
      close();
      return;
    }
    if (!d.out && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 6) { activate(d.r, ev); if (ev.pointerType === 'touch') swallowClick(); }
  });
  // (a finger: the list is gone by the time the browser sends this tap's click, which then lands on whatever was under the
  // row: on a phone the Settings launcher. 2026-10-24) That one click is dropped.
  function swallowClick() { const f = (e) => { e.preventDefault(); e.stopImmediatePropagation(); }; addEventListener('click', f, { capture: true, once: true }); setTimeout(() => removeEventListener('click', f, true), 500); }

  function remember() { const q = activeQuery; if (q) { hist = [...hist.filter(h => h !== q), q].slice(-50); try { localStorage.setItem('tw.barHistory', JSON.stringify(hist)); } catch { } } }
  function activate(r, ev) {
    if (r.disabled) return;
    if (r.pick && (ev?.shiftKey || ev?.ctrlKey || ev?.metaKey)) { pick(r, ev.ctrlKey || ev.metaKey); return; }
    clearPick();
    if (r.sec !== 'cues') remember();
    close();
    r.run(ev);
  }

  // preview on highlight: a world thing lights up, a catalog asset shows its ghost
  function setHi(i) {
    hi = i;
    list.querySelectorAll('.res').forEach(el => el.classList.toggle('hi', +el.dataset.i === i));
    list.querySelector('.res.hi')?.scrollIntoView({ block: 'nearest' });
    const r = rows[i];
    app.barPreview = r?.entity?.id || null;
    app.hover = r?.entity?.id || (open ? null : app.hover);
    app.modes.preview?.(r?.cat || null);
  }
  placeholder();
  // the bar's shortcut hint
  root.querySelector('.hint').innerHTML = `<kbd>/</kbd>`;
  return { name: 'bar', open: show, close, isOpen: () => open };
}
const safe = (fn) => { try { return fn(); } catch { return null; } };
// A typed intent's chips without the words that were typed (Harry 2026-11-03: what you type is shown once, in the bar).
// The verb stays, and so does what you did not type: the selection, a person or place the words found ("Mira" from "mi"),
// a unit ("10 ft"). An arrow with nothing after it goes too. ("say hello there" → say · "-7" → damage → Brakka)
export function unechoed(chips, typed) {
  const flat = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ''), all = flat(typed);
  const kept = chips.filter((c, i) => !i || c === '→' || !flat(c) || !all.includes(flat(c)));
  return kept.filter((c, i) => c !== '→' || kept.slice(i + 1).some(x => x !== '→'));
}
// What a typed line says about figures: { change, explicit, count, text }.
//   change    "change figure <text>"                         explicit   it names pawns outright (a verb's noun, or a count)
//   count     "6 goblins", "add 6 goblins", "goblin x6"      text       what is left to search the figure list with
export function figureQuery(q) {
  let t = q.trim(), explicit = false, count = 0, m;
  if ((m = t.match(/^(?:change|swap|set)\s+(?:the\s+)?(?:figures?|figs?|minis?|miniatures?|models?)\b\s*(?:to\s+)?(.*)$/i))) return { change: true, explicit: true, count: 0, text: m[1].trim() };
  if ((m = t.match(/^(?:make|turn)\s+(?:it|him|her|them)\s+(?:into\s+)?an?\s+(.+)$/i))) return { change: true, explicit: true, count: 0, text: m[1].trim() }; // "make him an orc", "turn it into a skeleton"
  if ((m = t.match(/^(spawn|summon)\b\s*(.*)$/i))) { explicit = true; t = m[2]; }
  else if ((m = t.match(/^(?:add|place|drop|put|new)\s+(.*)$/i))) { t = m[1]; if (/^(?:a|an|some|the)\s+/i.test(t)) t = t.replace(/^(?:a|an|some|the)\s+/i, ''); }
  const num = () => { if ((m = t.match(/^(\d{1,2})\s*[x×]?\s+(.*)$/i)) && +m[1] > 0) { count = +m[1]; t = m[2]; } };
  num();
  if ((m = t.match(/^(?:pawns?|figures?|figs?|minis?|miniatures?)\b\s*(.*)$/i))) { explicit = true; t = m[1]; num(); }
  if ((m = t.match(/^(.*?)\s*[x×]\s*(\d{1,2})$/i)) && +m[2] > 0 && m[1]) { count = +m[2]; t = m[1]; }
  if (count > 1) explicit = true;
  return { change: false, explicit, count, text: t.trim() };
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
