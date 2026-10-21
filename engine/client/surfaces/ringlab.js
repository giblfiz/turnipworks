// ?ringlab=1: Ring Lab's drawer over the GAME ring (surfaces/ring.js), which since 2026-10-20 is the one ring: the drawer
// shapes it live in THIS browser only (app.ringSettingsOverride; its unsaved draft never reaches the plain game), and
// "Use as default" makes a shape the house ring every seat plays with. The drawer's code is client/ringlab/panel.js; the
// geometry client/ringlab/model.js. Without the flag none of this loads.
import { mountRingPanel, draftSettings } from '../ringlab/panel.js';
import { BUILTINS } from '../ringlab/presets.js';
import { loadManifest } from '../ringlab/renderer.js';

export function ringLabSurface(R, app) {
  document.body.classList.add('ringlab');
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL(`../ringlab/style.css?v=${window.TW_V || 'dev'}`, import.meta.url); document.head.append(css);
  const drawer = document.createElement('aside'); drawer.id = 'ringlab-panel'; drawer.className = 'rl-panel collapsed'; document.body.append(drawer);
  const tunerBase = app.ringLabTunerBase || app.tunerBase || new URL('/look/', location.href), api = app.ringLabRatingsApi || '/api/tw-ratings';
  // WHERE IT STARTS (2026-10-20): this browser's unsaved draft, else the house ring ("Use as default"), else the built-in
  const draft = draftSettings();
  let quiet = false;
  const panel = mountRingPanel(drawer, { ratingsApi: api, game: true, initial: draft || BUILTINS['Ellipse · one curve'], initialName: draft ? 'this browser’s unsaved draft' : 'Ellipse · one curve',
    who: () => app.sync?.campaign?.seats?.find?.(x => x.id === app.me?.())?.name || '',
    onChange: () => { if (quiet) return; const want = panel.state(); app.ringRelayout?.(); if (app.ringState?.() && want !== app.ringState()) app.ringOpen?.(want); },
    onReplay: () => app.ringReplay?.(), onUiSize: v => { app.settings?.setPref?.('ringScale', v); app.ringRelayout?.(); }, uiSize: app.settings?.prefs?.().ringScale || 1,
    onLab: () => location.assign('/?ringlab=1') });
  app.ringSettingsOverride = () => panel.settings();
  app.ringPickIcons = () => panel.pickIcons(); app.ringCycleIcon = (id) => panel.cycleIcon(id);
  app.ringOnLayout = (info) => { panel.setWarnings(info.warnings); panel.setSlid(info.slid); panel.setWorldReadout(info.world, info.world?.name); if (panel.state() !== info.view) { quiet = true; panel.selectState(info.view); quiet = false; } };
  const open = document.createElement('button'); open.id = 'ringlab-open'; open.textContent = 'Ring lab'; open.onclick = () => drawer.classList.remove('collapsed'); document.body.append(open);
  Object.assign(open.style, { position: 'fixed', right: '8px', top: '6px', zIndex: 99, background: '#27352f', color: '#f3cf87', border: '1px solid #b6975b', borderRadius: '8px', padding: '7px' });
  loadManifest(tunerBase).then(m => { panel.setManifest(m); const paths = (m.actions?.['pawn.damage']?.variants || []).filter(x => x.set === 'charcoal').map(x => new URL(x.sizes?.['62'] || x.file, new URL('assets/ui-icons/manifest.json', tunerBase)).href); panel.showDamageChoices(paths); });
  fetch(api + '/tuner/rings').then(r => r.ok ? r.json() : {}).then(records => panel.setSaved(Object.fromEntries(Object.entries(records).map(([k, v]) => [k, v.data || v])))).catch(() => {});
  if (draft) panel.startedFrom('this browser’s unsaved draft');
  else fetch(api + '/tuner/house').then(r => r.ok ? r.json() : {}).then(h => { if (h?.ring?.settings) panel.startFrom(h.ring, `house default · ${h.ring.name || 'ring'}`); else panel.startedFrom('built-in Ellipse · one curve'); }).catch(() => panel.startedFrom('built-in Ellipse · one curve'));
  app.on((what) => { if (what === 'selection') { quiet = true; panel.selectState('closed'); quiet = false; } });
  // (tests) the lab's window on the game ring
  window.ringLab = { panel, state: () => app.ringState?.(), anchor: () => app.ringAnchor?.(), world: () => app.ringWorld?.(), nodes: () => app.ringNodes?.(), draw: () => app.ringRelayout?.() };
  return { ringLab: true };
}
