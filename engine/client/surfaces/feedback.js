// SETTINGS ▸ FEEDBACK (Harry 2026-10-19: "Not just bug report: also feature request, feedback, all of that. That lives in
// the Settings menu as another major option ... a comment about an asset, a feature request, all of those things").
// Loaded the first time the section opens (surfaces/settings.js); the error hook and the post are feedback-hook.js.
//   New ticket   a kind (Bug, Idea / feature request, Asset comment, Question, Other), the words, Send.
//                An asset comment names its asset: the selected thing or pawn when the form opens (library sku and
//                name), changeable (the name field, or "Use the selection") and clearable.
//                "What gets sent": the list, open to read, each removable part with its own switch: the screenshot
//                (the canvas exactly as this seat sees it, fog of war and all, taken when the form opens), the camera,
//                graphics and browser, the recent commands (types and ids), recent console errors. Versions, campaign,
//                area and seat always go (the relay knows the seat from its token anyway).
//   My tickets   this seat's tickets (and any this browser filed in other campaigns), their status and any reply.
// docs/UI.md "Feedback"; the relay side is relay/tickets.js; the triage page tools/tickets/index.html.
import { icon } from '../icons.js';
import { sendTicket, fetchMine, context as contextOf } from '../feedback-hook.js';

export const KINDS = [
  ['bug', 'Bug', 'bug', 'What happened, and what did you expect? Steps to make it happen again help most.'],
  ['idea', 'Idea / feature request', 'lightbulb', 'What would you like the game to do?'],
  ['asset', 'Asset comment', 'box', 'What about this model or picture? (looks wrong, wrong size, a great one…)'],
  ['question', 'Question', 'circle-help', 'Ask anything.'],
  ['other', 'Other', 'message-square', 'Anything else.'],
];
const STATUS = { new: 'New', looking: 'Looking at it', fixed: 'Fixed', wontfix: "Won't fix", duplicate: 'Duplicate' };
const SHOT_MAX_W = 1600, SHOT_MAX_BYTES = 850 * 1024;
// the browser's own name out of a user agent (Chrome's also says Safari; Edge's also says Chrome)
const browserName = (ua) => { for (const re of [/Firefox\/[\d.]+/, /Edg\/[\d.]+/, /OPR\/[\d.]+/, /(?:Headless)?Chrome\/[\d.]+/, /Version\/[\d.]+.*Safari/]) { const m = ua.match(re); if (m) return m[0].replace(/^Version\/([\d.]+).*Safari$/, 'Safari/$1'); } return ua.slice(0, 40); };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const STYLE = `
.fbkinds { display: flex; flex-wrap: wrap; gap: 6px; margin: 2px 0 10px; }
.fbkinds .sbtn.sel { background: color-mix(in srgb, var(--accent) 22%, var(--raised)); border-color: var(--accent); }
.fbtext { width: 100%; box-sizing: border-box; min-height: 92px; max-height: 40vh; resize: vertical; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--surface-solid); color: var(--ink); font: 13px/1.4 system-ui, sans-serif; }
.fbasset { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin: 0 0 8px; }
.fbasset input { flex: 1; min-width: 160px; }
.fbasset small { color: var(--mute); font-size: 11px; width: 100%; }
.fbsent { margin: 10px 0 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--raised); }
.fbsent > summary { cursor: pointer; padding: 7px 10px; font-size: 12.5px; font-weight: 650; color: var(--ink-2); }
.fbsent ul { list-style: none; margin: 0; padding: 0 10px 8px; display: flex; flex-direction: column; gap: 2px; }
.fbsent li { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; align-items: center; padding: 5px 0; border-top: 1px solid color-mix(in srgb, var(--line) 60%, transparent); font-size: 12.5px; }
.fbsent li b { font-weight: 650; }
.fbsent li small { grid-column: 1; color: var(--mute); font-size: 11px; overflow-wrap: anywhere; }
.fbsent li.off b, .fbsent li.off small { opacity: .45; text-decoration: line-through; }
.fbsent .fbctl { grid-row: 1 / span 2; grid-column: 2; display: flex; gap: 6px; align-items: center; }
.fbshot { display: block; max-width: 220px; max-height: 124px; border-radius: 6px; border: 1px solid var(--line); margin-top: 4px; }
.fbsend { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; position: sticky; bottom: -18px; padding: 8px 0; background: var(--surface-solid); }
.fbsend .fbmsg { font-size: 12px; color: var(--mute); }
.fbsend .fbmsg.bad { color: var(--danger, #e5484d); }
.fbmine li { flex-direction: column; align-items: stretch !important; gap: 3px !important; }
.fbmine .fbh { display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--mute); }
.fbmine .fbh .fbst { margin-left: auto; font-weight: 700; padding: 1px 8px; border-radius: 9px; background: color-mix(in srgb, var(--ink) 7%, transparent); color: var(--ink-2); }
.fbmine .fbst.st-looking { background: color-mix(in srgb, var(--accent) 24%, transparent); color: var(--ink); }
.fbmine .fbst.st-fixed { background: color-mix(in srgb, #4caf50 28%, transparent); color: var(--ink); }
.fbmine .fbtx { font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; }
.fbmine .fbre { font-size: 12.5px; padding: 6px 9px; border-left: 3px solid var(--accent); background: color-mix(in srgb, var(--accent) 9%, transparent); border-radius: 0 7px 7px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
`;

// the canvas EXACTLY as this seat sees it: read in the frame event, after every view of the frame has been drawn (the
// fog-of-war pass included) and before the browser shows it, so nothing a player's own screen does not show can be in it
export function captureCanvas(app, { maxW = SHOT_MAX_W, timeout = 4000 } = {}) {
  const canvas = document.getElementById('c');
  return new Promise((resolve) => {
    let done = false, off = null;
    const finish = (v) => { if (done) return; done = true; off?.(); resolve(v); };
    off = app.on((what) => {
      if (what !== 'frame' || done) return;
      try {
        const W = canvas.width, H = canvas.height; if (!W || !H) return finish(null);
        const s = Math.min(1, maxW / W), c2 = document.createElement('canvas');
        c2.width = Math.round(W * s); c2.height = Math.round(H * s);
        c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height); // synchronous: the drawing buffer of THIS frame
        app.feedbackShots = (app.feedbackShots || 0) + 1;
        encode(c2).then(blob => finish(blob ? { blob, w: c2.width, h: c2.height, at: Date.now(), frame: app.stats?.frames, renders: (app.lastRenders || []).map(r => `${r.view}:${r.via}`) } : null));
      } catch (e) { finish(null); }
    });
    app.gfx?.wake?.('feedback'); // a resting table draws fewer frames: ask for one now
    setTimeout(() => finish(null), timeout);
  });
}
async function encode(c2) {
  for (const q of [0.85, 0.72, 0.6]) {
    const b = await new Promise(res => c2.toBlob(res, 'image/jpeg', q));
    if (b && b.size <= SHOT_MAX_BYTES) return b;
  }
  const half = document.createElement('canvas'); half.width = Math.round(c2.width / 2); half.height = Math.round(c2.height / 2);
  half.getContext('2d').drawImage(c2, 0, 0, half.width, half.height);
  return new Promise(res => half.toBlob(res, 'image/jpeg', 0.75));
}

// the selected thing or pawn, as an asset to comment on: its library sku (and batch: the asset rater's "<src>/<sku>"), name
export function assetOf(app, e = app.selected?.().find(x => x.kind === 'object' || x.kind === 'token')) {
  if (!e) return null;
  if (e.kind === 'token') {
    const f = e.fig && app.figures?.get?.(e.fig);
    return { kind: 'pawn', entity: e.id, fig: e.fig || null, name: f?.name || e.name || 'pawn', pawn: e.name || null };
  }
  const o = app.lib?.objects?.[e.cat], k = o?.skus?.find(x => x.sku === e.sku) || (!e.sku && o?.skus?.[0]) || null;
  const sku = e.sku || k?.sku || null;
  return { kind: 'object', entity: e.id, cat: e.cat || null, sku, src: k?.src || null, lib: k?.src && sku ? `${k.src}/${sku}` : null, mesh: k?.mesh || null, name: (e.name && e.name !== e.cat ? e.name : o?.desc || (sku || e.cat || 'thing').replace(/--/g, ' · ').replace(/-/g, ' ')) };
}

const states = new WeakMap();
function stateOf(app) {
  let st = states.get(app);
  if (!st) {
    st = { kind: 'bug', text: '', asset: null, assetTyped: '', shot: null, shotUrl: null, shooting: false, take: { shot: true, camera: true, system: true, commands: true, errors: true }, sending: false, msg: '', bad: false, mine: null, mineAt: 0, openSent: false, lastId: null };
    states.set(app, st);
    if (!document.getElementById('fbstyle')) document.head.append(Object.assign(document.createElement('style'), { id: 'fbstyle', textContent: STYLE }));
  }
  return st;
}

// called by Settings each time the section is shown (preset: {kind, asset: 'selection' | null} from a command, or null)
export function mountFeedback(app, root, preset) {
  if (!root) return;
  const st = stateOf(app);
  if (preset?.fresh) {
    if (preset.kind) st.kind = preset.kind;
    const sel = assetOf(app);
    if (sel) { st.asset = sel; st.assetTyped = sel.name; } else if (preset.kind === 'asset') { st.asset = null; st.assetTyped = ''; }
    retake(app, root);
    refreshMine(app, root);
  }
  render(app, root);
}

async function retake(app, root) {
  const st = stateOf(app); st.shooting = true; render(app, root);
  const shot = await captureCanvas(app);
  if (st.shotUrl) URL.revokeObjectURL(st.shotUrl);
  st.shot = shot; st.shotUrl = shot ? URL.createObjectURL(shot.blob) : null; st.shooting = false;
  if (root.isConnected) render(app, root);
}
async function refreshMine(app, root) {
  const st = stateOf(app), list = await fetchMine(app);
  if (list) { st.mine = list; st.mineAt = Date.now(); }
  if (root.isConnected) render(app, root);
}

function sentList(app, st) {
  const c = contextOf(app), on = st.take;
  const fmtCam = c.camera ? `focus ${c.camera.focus.map(v => Math.round(v)).join(', ')} · distance ${Math.round(c.camera.dist)} · heading ${Math.round(c.camera.yaw)}° · pitch ${Math.round(c.camera.pitch)}°` : 'no view yet';
  const cmds = app.feedbackHook?.commands() || [], errs = app.feedbackHook?.errors() || [];
  const item = (k, title, detail, extra = '') => `<li class="${k && !on[k] ? 'off' : ''}"${k ? ` data-take="${k}"` : ''}><b>${title}</b><span class="fbctl">${extra}${k ? `<button class="stog${on[k] ? ' on' : ''}" data-fbtake="${k}" role="switch" aria-checked="${!!on[k]}" title="${on[k] ? 'Leave this out' : 'Send this'}"><i></i></button>` : ''}</span><small>${detail}</small></li>`;
  const shotDetail = st.shooting ? 'taking it…' : st.shot ? `the table as you see it now, ${st.shot.w} × ${st.shot.h}, ${Math.round(st.shot.blob.size / 1024)} KB${st.shotUrl ? `<img class="fbshot" src="${st.shotUrl}" alt="The screenshot that will be sent">` : ''}` : 'could not take one';
  const items = [
    item('shot', 'Screenshot', shotDetail, `<button class="sbtn tiny" data-fbact="retake">${icon('refresh-cw', 12)} Retake</button>`),
    item(null, 'Versions', `client ${esc(c.client)} · look ${esc(c.tuner || '?')}`),
    item(null, 'Campaign and area', `${esc(c.campaign?.name || '?')} · ${esc(c.area?.name || '?')}`),
    item(null, 'You', `${esc(c.seat?.name || '?')} · ${c.seat?.role === 'gm' ? 'GM' : 'player'}`),
    item('camera', 'Camera', esc(fmtCam)),
    item('system', 'Graphics, browser and GPU', esc(`${c.graphics.preset || 'auto'}${c.graphics.buffer ? ` · ${c.graphics.buffer.join(' × ')} px` : ''} · ${c.os || '?'} · ${browserName(c.browser)}${c.gpu ? ` · ${c.gpu}` : ''}`)),
    item('commands', 'Recent commands', cmds.length ? `the last ${cmds.length} sent or received: their kinds and ids only, never what was said (${esc([...new Set(cmds.slice(-6).map(x => x.type))].join(', '))}…)` : 'none yet'),
    item('errors', 'Recent errors', errs.length ? `${errs.length}: ${esc(errs.at(-1).message.slice(0, 120))}` : 'none'),
  ];
  return `<details class="fbsent"${st.openSent ? ' open' : ''}><summary>What gets sent (${items.length} items${Object.values(on).some(v => !v) ? `, ${Object.values(on).filter(v => !v).length} left out` : ''})</summary><ul>${items.join('')}</ul></details>`;
}

function render(app, root) {
  const st = stateOf(app);
  const focus = document.activeElement, typing = root.contains(focus) && focus.matches('textarea, input'), selStart = typing ? focus.selectionStart : null, which = typing ? (focus.classList.contains('fbtext') ? '.fbtext' : '.fbassetname') : null;
  const k = KINDS.find(x => x[0] === st.kind) || KINDS[0];
  const sel = assetOf(app);
  const assetRow = st.kind !== 'asset' ? '' : `<div class="fbasset"><label class="snote" style="margin:0">About</label><input class="fbassetname" value="${esc(st.assetTyped)}" maxlength="120" placeholder="Which asset? (select it on the table, or type its name)"><button class="sbtn tiny" data-fbact="usesel"${sel ? '' : ' disabled title="Nothing is selected"'}>Use the selection</button>${st.asset || st.assetTyped ? `<button class="sbtn tiny" data-fbact="clearasset" title="About no asset">${icon('x', 12)} Clear</button>` : ''}<small>${st.asset ? esc([st.asset.kind === 'pawn' ? `pawn figure ${st.asset.fig || '(none)'}` : st.asset.lib || st.asset.sku || st.asset.cat, st.asset.entity].filter(Boolean).join(' · ')) : st.assetTyped ? 'typed by you' : 'no asset named'}</small></div>`;
  const mine = st.mine;
  const mineHtml = mine == null ? '<p class="snote">Loading…</p>' : !mine.length ? '<p class="snote">None yet. What you send shows here, with its status and any answer.</p>'
    : `<ul class="slist fbmine">${mine.map(t => `<li data-ticket="${t.id}"><div class="fbh"><b>${esc((KINDS.find(x => x[0] === t.kind) || [, t.kind])[1])}</b><span>${new Date(t.at).toLocaleString()}</span>${t.asset ? `<span>· ${esc(t.asset)}</span>` : ''}${t.campaign && t.campaign !== app.sync?.campaign?.name ? `<span>· ${esc(t.campaign)}</span>` : ''}<span class="fbst st-${t.status}">${STATUS[t.status] || esc(t.status)}</span></div><div class="fbtx">${esc(t.text)}</div>${t.reply ? `<div class="fbre"><b>Reply:</b> ${esc(t.reply)}</div>` : ''}</li>`).join('')}</ul>`;
  root.innerHTML = `<p class="snote">A bug, an idea, a comment on a model, a question: Harry and Fauna read every one, and the answer shows under My tickets.</p>
    <div class="sgrp"><h3>New ticket</h3>
      <div class="fbkinds" role="radiogroup" aria-label="Kind of ticket">${KINDS.map(([id, label, ic]) => `<button class="sbtn${id === st.kind ? ' sel' : ''}" data-fbkind="${id}" role="radio" aria-checked="${id === st.kind}">${icon(ic, 14)} ${label}</button>`).join('')}</div>
      ${assetRow}
      <textarea class="fbtext" maxlength="4000" placeholder="${esc(k[3])}" aria-label="Your words">${esc(st.text)}</textarea>
      ${sentList(app, st)}
      <div class="fbsend"><button class="sbtn primary" data-fbact="send"${st.sending ? ' disabled' : ''}>${icon('message-square', 14)} ${st.sending ? 'Sending…' : 'Send'}</button><span class="fbmsg${st.bad ? ' bad' : ''}">${esc(st.msg)}</span></div>
    </div>
    <div class="sgrp"><h3>My tickets <button class="sbtn tiny" data-fbact="mine" style="margin-left:6px">${icon('refresh-cw', 12)} Refresh</button></h3>${mineHtml}</div>`;
  wire(app, root);
  if (which) { const el = root.querySelector(which); if (el) { el.focus(); try { el.setSelectionRange(selStart, selStart); } catch { } } }
}

function wire(app, root) {
  const st = stateOf(app), $ = (s) => root.querySelector(s);
  for (const b of root.querySelectorAll('[data-fbkind]')) b.onclick = () => {
    st.kind = b.dataset.fbkind;
    if (st.kind === 'asset' && !st.asset && !st.assetTyped) { const a = assetOf(app); if (a) { st.asset = a; st.assetTyped = a.name; } }
    st.msg = ''; render(app, root);
  };
  const tx = $('.fbtext'); tx.oninput = () => { st.text = tx.value; };
  const an = $('.fbassetname'); if (an) an.oninput = () => { st.assetTyped = an.value; if (st.asset && an.value !== st.asset.name) st.asset = { ...st.asset, name: an.value }; };
  const act = (name, fn) => { const el = root.querySelector(`[data-fbact="${name}"]`); if (el) el.onclick = fn; };
  act('usesel', () => { const a = assetOf(app); if (a) { st.asset = a; st.assetTyped = a.name; render(app, root); } });
  act('clearasset', () => { st.asset = null; st.assetTyped = ''; render(app, root); });
  act('retake', (ev) => { ev.preventDefault(); retake(app, root); });
  act('mine', () => refreshMine(app, root));
  act('send', () => send(app, root));
  const det = $('.fbsent'); det.ontoggle = () => { st.openSent = det.open; };
  for (const t of root.querySelectorAll('[data-fbtake]')) t.onclick = (ev) => { ev.preventDefault(); st.take[t.dataset.fbtake] = !st.take[t.dataset.fbtake]; render(app, root); };
}

async function send(app, root) {
  const st = stateOf(app);
  const text = st.text.trim();
  if (!text) { st.msg = 'Write something first.'; st.bad = true; render(app, root); root.querySelector('.fbtext')?.focus(); return; }
  const ctx = contextOf(app), on = st.take;
  if (!on.camera) { delete ctx.camera; delete ctx.pip; }
  if (!on.system) { for (const k of ['graphics', 'browser', 'os', 'lang', 'screen', 'viewport', 'gpu']) delete ctx[k]; }
  const asset = st.kind !== 'asset' ? null : st.asset ? { ...st.asset, name: st.assetTyped.trim() || st.asset.name } : st.assetTyped.trim() ? { kind: 'typed', name: st.assetTyped.trim() } : null;
  const ticket = { kind: st.kind, text, asset, ctx, commands: on.commands ? app.feedbackHook?.commands() || [] : [], errors: on.errors ? app.feedbackHook?.errors() || [] : [] };
  st.sending = true; st.msg = ''; st.bad = false; render(app, root);
  const r = await sendTicket(app, ticket, on.shot && st.shot ? st.shot.blob : null);
  st.sending = false;
  if (r.ok) {
    st.lastId = r.id; st.text = ''; st.msg = r.shot === false ? 'Sent, thank you (the screenshot did not go).' : 'Sent, thank you.'; st.bad = false;
    app.toast?.('Ticket sent: thank you');
    app.emit?.('feedback.sent', { id: r.id, kind: ticket.kind });
    refreshMine(app, root);
  } else { st.msg = `Not sent: ${r.why || 'try again'}`; st.bad = true; }
  if (root.isConnected) render(app, root);
}
