// THE ERROR HOOK and the ticket post (2026-10-19; docs/UI.md "Feedback"). The only part of Feedback loaded at boot: the
// form itself (surfaces/feedback.js) loads when Settings ▸ Feedback is first opened.
//   - window errors, unhandled rejections, console.error calls that carry an Error, and the relay connection failing
//     (never connecting, or dropping again and again) are sent SILENTLY as tickets of kind "auto": once per distinct
//     message + stack in a page's life, at most MAX_AUTO of them, never a dialog. The relay folds a repeat from the same
//     seat into one ticket with a count.
//   - it keeps the last COMMANDS commands this seat sent or received (types and ids only, never chat text or args) and
//     the last ERRORS console errors, which every ticket carries as context.
//   - context(app): what a ticket says about where it came from (versions, campaign, area, seat, camera, graphics,
//     browser, GPU). The Feedback form shows the tester this list before anything is sent.
// The relay stores tickets (relay/tickets.js). Test browsers send X-TW-Test (tests/tw_sandbox.py): their tickets land in
// the relay's test sandbox.
export const FEEDBACK_LIMITS = { MAX_AUTO: 10, COMMANDS: 50, ERRORS: 20, STORM_DROPS: 4, STORM_MS: 120e3, NO_CONNECT_MS: 20e3 };
const L = FEEDBACK_LIMITS;
const session = Math.random().toString(36).slice(2, 10);
const S = { app: null, opts: {}, errors: [], cmds: [], seen: new Set(), autoSent: 0, autoDropped: 0, queue: [], drops: [], everLive: false, stormed: false, bootAt: Date.now(), inHook: false };
const QUEUE_KEY = 'tw.fb.queue', MINE_KEY = 'tw.fb.mine';

// a short signature of message + stack (FNV-1a), the relay's and this page's key for "the same error"
const clean = (s) => String(s || '').replace(/\?v=[0-9a-z]+/gi, '').replace(/https?:\/\/[^/\s)]+/g, '').slice(0, 2000);
export function sigOf(message, stack) { let h = 0x811c9dc5; for (const ch of clean(message) + '\n' + clean(stack)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return 'e' + h.toString(36); }
const msgOf = (x) => x instanceof Error ? `${x.name}: ${x.message}` : typeof x === 'string' ? x : (() => { try { return JSON.stringify(x); } catch { return String(x); } })();
const noise = (m, st) => /ResizeObserver loop|^Script error\.?$/i.test(m) || /(chrome|moz|safari(-web)?)-extension:\/\//.test(st || '');

function note(source, message, stack) {
  S.errors.push({ at: Date.now(), source, message: String(message).slice(0, 400), stack: stack ? clean(stack).slice(0, 1200) : null });
  if (S.errors.length > L.ERRORS) S.errors.splice(0, S.errors.length - L.ERRORS);
}
function report(source, message, stack) {
  message = String(message || '(no message)');
  if (noise(message, stack)) return;
  note(source, message, stack);
  const sig = sigOf(message, stack);
  if (S.seen.has(sig)) return;           // once per message + stack in this page's life
  S.seen.add(sig);
  if (S.autoSent + S.queue.length >= L.MAX_AUTO) { S.autoDropped++; return; } // never a flood
  const t = { kind: 'auto', sig, text: `${source}: ${message}`.slice(0, 400), errors: [S.errors.at(-1), ...S.errors.slice(-6, -1).reverse()], commands: S.cmds.slice(), at: Date.now() };
  S.queue.push(t);
  flush();
}

// ---- installed at import (before anything else on the page runs) ----
if (typeof window !== 'undefined') {
  addEventListener('error', (ev) => { if (!ev.error && !ev.message) return; report('error', ev.error ? msgOf(ev.error) : ev.message, ev.error?.stack || (ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : '')); });
  addEventListener('unhandledrejection', (ev) => report('unhandled rejection', msgOf(ev.reason), ev.reason?.stack || ''));
  const orig = console.error.bind(console);
  console.error = (...args) => {
    orig(...args);
    if (S.inHook) return;
    S.inHook = true;
    try {
      const err = args.find(a => a instanceof Error), text = args.map(a => a instanceof Error ? msgOf(a) : typeof a === 'string' ? a : msgOf(a)).join(' ');
      if (err) report('console.error', text, err.stack || ''); else note('console.error', text, null);
    } catch { } finally { S.inHook = false; }
  };
  try { const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); if (Array.isArray(q)) S.queue.push(...q.slice(0, L.MAX_AUTO)); localStorage.removeItem(QUEUE_KEY); } catch { } // reports a page could not send (the relay was out of reach)
}

// ---- commands sent and received: types and ids, never text ----
function idsOf(a) {
  if (!a || typeof a !== 'object') return [];
  const out = [];
  for (const k of ['id', 'room', 'who', 'seq']) if ((typeof a[k] === 'string' && a[k].length <= 48) || Number.isInteger(a[k])) out.push(a[k]);
  if (Array.isArray(a.ids)) out.push(...a.ids.filter(x => typeof x === 'string').slice(0, 4));
  return out;
}
function noteCmd(c) { S.cmds.push(c); if (S.cmds.length > L.COMMANDS) S.cmds.splice(0, S.cmds.length - L.COMMANDS); }
const cmdOf = (dir, type, area, args, extra) => ({ at: Date.now(), dir, type, area: area || null, ids: idsOf(args), ...(type === 'batch' && Array.isArray(args?.ops) && { ops: args.ops.slice(0, 8).map(o => o?.type) }), ...extra });

// ---- the connection: never coming up, or a storm of drops ----
function onStatus(s) {
  if (s === 'live') { S.everLive = true; flush(); return; }
  if (s === 'offline' && S.everLive) {
    const t = Date.now(); S.drops = [...S.drops.filter(x => t - x < L.STORM_MS), t];
    if (S.drops.length >= L.STORM_DROPS && !S.stormed) { S.stormed = true; report('relay', `reconnect storm: the connection dropped ${S.drops.length} times in ${Math.round(L.STORM_MS / 1000)} s`, ''); }
  }
}

export function installFeedbackHook(app, opts = {}) {
  S.app = app; S.opts = opts;
  const sync = app.sync;
  for (const name of ['submit', 'submitRaw']) {
    const f = sync[name].bind(sync);
    sync[name] = name === 'submit' ? (type, args, area) => { const cid = f(type, args, area); noteCmd(cmdOf('sent', type, area, args, { cid })); return cid; }
      : (c) => { const cid = f(c); noteCmd(cmdOf('sent', c?.type, c?.area, c?.args, { cid })); return cid; };
  }
  app.on((what, e) => { if (what === 'entry' && e) noteCmd(cmdOf('recv', e.type, e.area, e.args, { seq: e.seq, by: e.by })); });
  const prev = sync.onStatus; sync.onStatus = (s) => { try { onStatus(s); } catch { } prev(s); };
  setTimeout(() => { if (!S.everLive && sync.status !== 'denied' && sync.status !== 'closed') { report('relay', `no connection to the table after ${L.NO_CONNECT_MS / 1000} s (${app.transport?.() || '?'})`, ''); persistQueue(); } }, L.NO_CONNECT_MS);
  addEventListener('pagehide', persistQueue);
  app.feedbackHook = { context: () => context(app), commands: () => S.cmds.slice(), errors: () => S.errors.slice(), state: () => ({ session, autoSent: S.autoSent, autoDropped: S.autoDropped, queued: S.queue.length, seen: S.seen.size, errors: S.errors.length, commands: S.cmds.length }), report, send: (t, shot) => sendTicket(app, t, shot) };
  flush();
}
function persistQueue() { try { if (S.queue.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(S.queue.slice(0, L.MAX_AUTO))); } catch { } }

let flushing = false;
async function flush() {
  const app = S.app;
  if (flushing || !app || !S.queue.length || app.sync?.status !== 'live' || !app.sync.campaign) return;
  flushing = true;
  try {
    while (S.queue.length) {
      const t = S.queue[0];
      const r = await sendTicket(app, { ...t, ctx: context(app) });
      if (!r.ok && r.retry) break; // the relay is out of reach: try again when it is back
      S.queue.shift(); if (r.ok) S.autoSent++;
    }
  } finally { flushing = false; }
}

// ---- where a ticket comes from ----
let gpu;
function gpuString() {
  if (gpu !== undefined) return gpu;
  try { const gl = S.opts.renderer?.getContext?.(), ext = gl?.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).slice(0, 160) : null; } catch { gpu = null; }
  return gpu;
}
const r2 = (x) => Number.isFinite(x) ? Math.round(x * 100) / 100 : null;
export function context(app) {
  const c = app.sync?.campaign, me = c?.seats?.find(s => s.id === app.me?.()), area = app.area?.();
  const pose = app.main?.pose?.(), prefs = app.settings?.prefs?.() || {}, gi = app.gfx?.info?.();
  const ua = navigator.userAgentData;
  return {
    client: window.TW_V || 'dev', tuner: S.opts.tunerVersion?.() || null, session, uptimeS: Math.round((Date.now() - S.bootAt) / 1000),
    campaign: c ? { id: c.id, name: c.name } : null,
    area: area ? { id: area, name: app.areaName?.(area) || null } : null,
    seat: c ? { id: app.me?.(), name: me?.name || c.my?.name || null, role: c.my?.role || null, kind: me?.kind || null } : null,
    camera: pose ? { focus: pose.focus.map(r2), yaw: r2(pose.yaw), pitch: r2(pose.pitch), dist: r2(pose.dist), level: Number.isFinite(app.level) ? app.level : null, cut: app.cut?.y ?? null } : null,
    pip: app.pip?.area || null,
    graphics: { preset: prefs.gfx || null, auto: prefs.gfxAuto || null, faces: app.facesUsed || null, fogFx: prefs.fogFx !== false, buffer: gi?.buffer || null, fps: app.fps ?? null },
    fogOfWar: !!app.fog?.active?.(area), // (fog of war on this seat's own view: a player with fog, or a GM previewing it)
    browser: navigator.userAgent.slice(0, 300), os: (ua?.platform || navigator.platform || '').slice(0, 60), lang: navigator.language || null,
    screen: [screen.width, screen.height, r2(devicePixelRatio)], viewport: [innerWidth, innerHeight],
    gpu: gpuString(),
    net: { status: app.sync?.status || null, transport: app.transport?.() || null, reconnects: app.sync?.stats?.reconnects ?? null },
    selected: app.sel?.size ?? 0,
    page: location.origin + location.pathname,
  };
}

// ---- the post: the ticket (JSON), then its screenshot (a file of its own) ----
export function myReceipts() { try { const a = JSON.parse(localStorage.getItem(MINE_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }
export async function sendTicket(app, ticket, shot = null) {
  const c = app.sync?.campaign; if (!c || !app.sync.token) return { ok: false, retry: true, why: 'not connected' };
  const url = (rest = '') => `${app.relayBase}/c/${c.id}/tickets${rest}?seat=${encodeURIComponent(app.sync.token)}`;
  let r;
  try {
    const res = await fetch(url(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...ticket, shot: !!shot }) });
    r = await res.json().catch(() => ({ ok: false, why: `HTTP ${res.status}` }));
    if (!res.ok) return { ok: false, retry: res.status >= 500, status: res.status, why: r.why || `HTTP ${res.status}` };
  } catch (e) { return { ok: false, retry: true, why: 'the table cannot be reached' }; }
  if (ticket.kind !== 'auto' && r.receipt) { try { const a = myReceipts().filter(x => x.id !== r.id); a.unshift({ id: r.id, receipt: r.receipt }); localStorage.setItem(MINE_KEY, JSON.stringify(a.slice(0, 100))); } catch { } }
  let shotOk = null;
  if (shot && r.id && !r.again) {
    try { const res = await fetch(url(`/${r.id}/shot`), { method: 'POST', headers: { 'content-type': shot.type || 'image/jpeg' }, body: shot }); shotOk = res.ok; } catch { shotOk = false; }
  }
  return { ok: true, id: r.id, again: !!r.again, shot: shotOk };
}
export async function fetchMine(app) {
  const c = app.sync?.campaign; if (!c) return null;
  const also = myReceipts().map(x => `${x.id}.${x.receipt}`).join(',');
  try { const r = await fetch(`${app.relayBase}/c/${c.id}/tickets?seat=${encodeURIComponent(app.sync.token)}${also ? `&also=${also}` : ''}`).then(r => r.json()); return r.ok ? r.tickets : null; } catch { return null; }
}
