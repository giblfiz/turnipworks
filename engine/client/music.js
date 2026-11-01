// THE TABLE'S MUSIC (Harry 2026-10-30: seven tracks made for Turnip Works, "you can tie that audio in as game options";
// docs/UI.md "Music"). Two halves, never mixed:
//   WHAT PLAYS is the table's, set by the GM and synced to every seat through the ordered command path: the area play
//   setting `music` ('' off, 'playlist', or one track), inherited from Settings ▸ Area defaults (built-in: Off; Harry
//   2026-10-30 "area defaults to 'off'"), with a clock beside it (core/commands.js music.set) so every seat hears the
//   same moment: a seat that joins mid-track starts at the synced offset.
//   HOW LOUD is each person's own (Settings ▸ Controls ▸ Sound: Music on / off and its volume; tw.prefs, this browser
//   only, never synced). Muted means nothing streams at all.
// The files (engine/tools/build_music.sh; data/music/, git-ignored, copied by deploy) are STREAMED: one <audio> at a
// time with preload none, a second only for the last seconds of a playlist track (the crossfade). Never all seven.
// Browsers refuse sound before the person has touched the page: the music waits for the first click, tap or key after
// joining, silently (no prompt, no nag). A small "♪ The Tasty Turnip" note shows in the bottom-right corner when a track
// starts and fades; its ♪ button mutes (your ears only). The phone page (client/phone.js) never loads this file.
const XF = 3;            // seconds of crossfade between playlist tracks
const CUT = 1.2;         // seconds of fade when the music changes (another area, the GM's pick)
const DRIFT = 4;         // seconds off the table's clock before a playing track is put back in step
const NOTE_MS = 6000;    // how long the now-playing note stays before it fades

// the same order at every seat: a seeded shuffle (mulberry32 over a string hash)
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export function shuffled(ids, key) { const out = [...ids], r = rng(hash(String(key))); for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; }
// a stored value names a track by its id or its name, exactly (case, punctuation and a leading "the" aside): an old
// campaign's free-text placeholder ("tavern") plays nothing
const norm = (s) => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/^the /, '');
export const PLAYLIST_WORDS = new Set(['playlist', 'shuffle', 'all', 'all tracks']);
export function matchTrack(tracks, v) { const n = norm(v); return n ? tracks.find(t => norm(t.id) === n || norm(t.name) === n) || null : null; }

// where the table's music is at `now` (relay ms): { key, order, idx, id, off, single } or null (silence)
export function musicAt(tracks, val, clock, scope, now) {
  if (!tracks.length || !val) return null;
  const at = clock?.at || 0, el = at ? Math.max(0, (now - at) / 1000) : 0;
  if (PLAYLIST_WORDS.has(String(val).trim().toLowerCase())) {
    let order = shuffled(tracks.map(t => t.id), `${scope}:${clock?.seed || 0}`);
    const f = clock?.first && order.indexOf(clock.first);
    if (f > 0) order = [...order.slice(f), ...order.slice(0, f)];
    const sec = (id) => tracks.find(t => t.id === id).sec, seg = order.map(id => Math.max(5, sec(id) - XF)), cycle = seg.reduce((a, b) => a + b, 0);
    let e = el % cycle, i = 0; while (e >= seg[i]) { e -= seg[i]; i++; }
    const lap = Math.floor(el / cycle); // (each lap through the list is its own key part, so lap 2's first track follows lap 1's last)
    return { key: `p:${scope}:${clock?.seed || 0}:${clock?.first || ''}:${at}`, order, idx: lap * order.length + i, id: order[i], off: e, single: false };
  }
  const t = matchTrack(tracks, val); if (!t) return null;
  return { key: `t:${scope}:${t.id}:${at}`, order: [t.id], idx: 0, id: t.id, off: el % t.sec, single: true };
}

export function installMusic(app) {
  const M = app.music = { tracks: [], ready: false, unlocked: false, cur: null, fading: [], log: [], errors: 0 };
  const base = 'data/music/', v = window.TW_V && window.TW_V !== 'dev' ? `?v=${window.TW_V}` : '';
  const probe = document.createElement('audio');
  const kind = probe.canPlayType('audio/webm; codecs="opus"') ? 'webm' : 'm4a';
  M.kind = kind;
  fetch(`${base}tracks.json${v}`).then(r => r.ok ? r.json() : null).then(j => { M.tracks = (j?.tracks || []).filter(t => t.id && t.sec > 0); M.ready = true; addTrackCommands(); tick(); }).catch(() => { M.ready = true; });

  // ---- what the table wants, now ----
  const now = () => Date.now() + (app.sync?.skew || 0);
  function want() {
    const c = app.sync?.campaign, area = app.area?.(); if (!c || !area) return null;
    const A = c.areas.find(x => x.id === area), own = !!A?.settings && 'music' in A.settings;
    const val = own ? A.settings.music : (c.defaults?.music ?? '');
    return musicAt(M.tracks, val, own ? A.musicClock : c.musicClock, own ? area : 'campaign', now());
  }
  M.want = want;
  M.value = () => { const c = app.sync?.campaign, A = c?.areas.find(x => x.id === app.area?.()); return A?.settings && 'music' in A.settings ? A.settings.music : (c?.defaults?.music ?? ''); };
  const prefs = () => app.prefs || {};
  const muted = () => prefs().music === false || !(prefs().musicVol > 0);
  const gain = () => { const x = Math.max(0, Math.min(1, +prefs().musicVol || 0)); return x * x; }; // (a slider feels even when the gain is its square)
  const trackOf = (id) => M.tracks.find(t => t.id === id);

  // ---- the elements ----
  function start(id, off, fadeIn) {
    const t = trackOf(id); if (!t) return null;
    const el = new Audio(); el.preload = 'none'; el.dataset.track = id; el.loop = false;
    el.src = base + t[kind] + v;
    const p = { el, id, f: 0, to: 1, rate: 1 / Math.max(0.2, fadeIn), started: performance.now() };
    const seek = () => { try { if (off > 0.5 && Math.abs(el.currentTime - off) > 0.5) el.currentTime = off; } catch { } };
    el.addEventListener('loadedmetadata', seek, { once: true });
    el.addEventListener('error', () => { M.errors++; M.log.push(`error ${id}`); });
    el.volume = 0;
    const pr = el.play(); if (pr?.catch) pr.catch((e) => { if (e?.name === 'NotAllowedError') { M.unlocked = false; } });
    M.log.push(`play ${id} @${off.toFixed(1)}`); if (M.log.length > 40) M.log.shift();
    return p;
  }
  function fadeOut(p, secs) { if (!p) return; p.to = 0; p.rate = 1 / Math.max(0.2, secs); M.fading.push(p); }
  function stopAll() { for (const p of [M.cur, ...M.fading]) if (p) { p.el.pause(); p.el.removeAttribute('src'); p.el.load(); } M.cur = null; M.fading = []; }
  M.stop = stopAll;

  // ---- the loop: what is playing follows what the table wants ----
  let lastT = performance.now();
  function tick() {
    const t0 = performance.now(), dt = Math.min(1, (t0 - lastT) / 1000); lastT = t0;
    const w = M.ready ? want() : null;
    if (!w || muted() || !M.unlocked) { if (M.cur || M.fading.length) stopAll(); M.wanted = w; return; }
    M.wanted = w;
    const c = M.cur;
    if (!c || c.key !== w.key || c.idx !== w.idx) {
      const tail = c && c.key === w.key && w.idx === c.idx + 1; // the playlist's next track: a crossfade
      if (c) fadeOut(c, tail ? XF : CUT);
      const p = start(w.id, w.off, tail ? XF : (c ? CUT : 1.5));
      if (p) { M.cur = Object.assign(p, { key: w.key, idx: w.idx, single: w.single }); if (p.el) p.el.loop = w.single; note(w.id); }
    } else if (!c.el.paused && c.el.readyState >= 1 && performance.now() - c.started > 3000) {
      const d = Math.abs(c.el.currentTime - w.off), dur = trackOf(c.id)?.sec || 0;
      if (d > DRIFT && !(c.single && dur - d < DRIFT)) { try { c.el.currentTime = w.off; M.log.push(`resync ${c.id} ${d.toFixed(1)}s`); } catch { } }
    } else if (c.el.paused && M.unlocked && c.el.readyState >= 2 && !c.el.ended) { c.el.play().catch(() => {}); }
    // fades
    const g = gain();
    for (const p of [M.cur, ...M.fading]) { if (!p) continue; p.f += Math.sign(p.to - p.f) * Math.min(Math.abs(p.to - p.f), p.rate * dt); p.el.volume = Math.max(0, Math.min(1, g * p.f)); }
    M.fading = M.fading.filter(p => { if (p.f <= 0.001 || p.el.ended) { p.el.pause(); p.el.removeAttribute('src'); p.el.load(); return false; } return true; });
  }
  setInterval(tick, 200);
  app.on((what) => { if (what === 'refresh') tick(); });

  // ---- the first gesture (the browser's autoplay rule): no prompt, the music simply begins ----
  const unlock = () => { if (M.unlocked) return; M.unlocked = true; tick(); };
  for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { capture: true, passive: true });
  M.unlock = unlock;

  // ---- your ears ----
  M.setMuted = (on) => { app.settings?.setPref?.('music', !on); if (!on && !(prefs().musicVol > 0)) app.settings?.setPref?.('musicVol', 0.7); tick(); };
  M.muted = muted;
  M.state = () => { const p = M.cur; return { ready: M.ready, unlocked: M.unlocked, kind, tracks: M.tracks.length, want: M.wanted ? { id: M.wanted.id, idx: M.wanted.idx, single: M.wanted.single } : null, playing: p ? { id: p.id, paused: p.el.paused, time: p.el.currentTime, volume: p.el.volume, src: p.el.currentSrc || p.el.src, preload: p.el.preload, loop: p.el.loop, readyState: p.el.readyState } : null, fading: M.fading.length, muted: muted(), errors: M.errors, value: M.value(), elements: [M.cur, ...M.fading].filter(Boolean).length }; };

  // ---- the table's music, from the GM ----
  const area = () => app.area?.();
  M.set = (val) => app.sync.submit('music.set', { area: area(), music: val || 'off' }); // ('off', not '': an empty argument is dropped on the way)
  M.next = () => {
    const w = want(); if (!w) return false;
    if (w.single) { const ids = M.tracks.map(t => t.id), i = ids.indexOf(w.id); return M.set(ids[(i + 1) % ids.length]); }
    return app.sync.submit('music.set', { area: area(), next: w.order[(w.order.indexOf(w.id) + 1) % w.order.length] });
  };

  // ---- the now-playing note: the bottom-right corner, above the frame counter; it fades by itself ----
  let noteEl = null, noteTimer = null;
  function note(id) {
    const t = trackOf(id); if (!t) return;
    if (!noteEl) {
      noteEl = document.createElement('div'); noteEl.id = 'musicNote'; noteEl.setAttribute('role', 'status'); noteEl.setAttribute('aria-live', 'polite');
      noteEl.innerHTML = '<button type="button" class="mn-mute" title="Mute music (just you)" aria-label="Mute music (just you)">♪</button><span class="mn-name"></span>';
      noteEl.querySelector('button').onclick = (ev) => { ev.stopPropagation(); M.setMuted(true); app.toast?.('Music muted (just you). Settings ▸ Controls ▸ Sound, or "unmute music"'); hideNote(); };
      document.body.append(noteEl);
    }
    noteEl.querySelector('.mn-name').textContent = t.name;
    noteEl.dataset.track = id;
    noteEl.hidden = false; requestAnimationFrame(() => noteEl.classList.add('show'));
    clearTimeout(noteTimer); noteTimer = setTimeout(hideNote, NOTE_MS);
  }
  function hideNote() { if (!noteEl) return; noteEl.classList.remove('show'); clearTimeout(noteTimer); noteTimer = setTimeout(() => { if (noteEl && !noteEl.classList.contains('show')) noteEl.hidden = true; }, 600); }
  M.note = () => noteEl && !noteEl.hidden ? noteEl.querySelector('.mn-name').textContent : null;

  // ---- the command bar: one entry per track (after tracks.json arrives) ----
  function addTrackCommands() {
    const R = app.registry; if (!R) return;
    for (const t of M.tracks) if (!R.get(`music.track.${t.id}`)) R.add({ id: `music.track.${t.id}`, title: `Music here: ${t.name} (loops)`, short: t.name, synonyms: ['music', 'play', 'track', 'song', t.name, `music ${t.name}`, `play ${t.name}`], icon: 'music', group: 'Area ▸ Music', cls: 'area.admin', when: () => !matchTrack([t], M.value()), run: () => M.set(t.id) });
  }
  addTrackCommands.later = addTrackCommands;
  return M;
}
