// LABEL LAB (?labellab=1, 2026-10-20; Harry: "do we already have a tuner for room and building labels? I want to play
// with their size, scaling and position a little"). The Ring Lab pattern for the room and building labels: a drawer over
// the live table (lab/kit.js: plain-words knobs, Undo / Redo / Revert / ↺, this browser's draft, "Use as default" ->
// the house `labels` field, which every editing seat's game then reads: labels/look.js, surfaces/labels.js). With no seat
// it opens a reusable design table (main.js: tw.labellab.token): a crowded street, a three-storey mansion, loose rooms
// from a closet to a hall, a few pawns. Every knob acts on the real labels, so every label behaviour stays as it is.
import { mountLab, readDraft } from '../lab/kit.js';
import { TODAY, LIMITS, NEVER_FT, NO_CAP, normalize, envelope, starter } from '../labels/look.js';
import { T } from '../tuner.js';

const DRAFT = 'tw.labels.draft', TOKEN = 'tw.labellab.token';
const px = v => `${Math.round(v * 10) / 10} px`, ft = v => `${Math.round(v * 10) / 10} ft`;
const FIELDS = {
  'size.px': { label: 'Text size (px)', hint: 'Room labels; building labels follow by their own ratio', fmt: px },
  'size.ft': { label: 'Text size in the world (ft)', hint: 'Screen px follow the camera, within the limits below', fmt: ft },
  'size.world': { label: 'Size the labels in the world (ft)', hint: 'Zooming in makes them bigger, like the table', rerender: true },
  'size.minPx': { label: 'Smallest text (px)', hint: 'Zoomed far out, labels stop shrinking here', fmt: px },
  'size.maxPx': { label: 'Largest text (px)', hint: 'Zoomed in close, labels stop growing here', fmt: px },
  'size.building': { label: 'Building label size, relative to rooms', hint: 'Today the building tag is 13 px against 24 (×0.54)', fmt: v => `×${(+v).toFixed(2)}` },
  'size.capPct': { label: 'Never wider than (% of the room on screen)', hint: 'Zoomed out, a label shrinks to fit inside its room (a building’s: the building)', fmt: v => v >= NO_CAP ? 'no limit' : `${Math.round(v)} %` },
  'size.hidePx': { label: 'Hide below (px text)', hint: 'Shrunk by the room limit below this, the label fades out', fmt: v => v > 0 ? px(v) : 'never' },
  'place.ft': { label: 'Height above the floor (ft)', hint: 'Today 10.2 ft: just above the 9 ft walls', fmt: ft },
  'place.buildingFt': { label: 'Building label: extra height above its rooms', hint: 'Over the highest storey showing', fmt: ft },
  'place.side': { label: 'Nudge sideways (ft)', hint: 'Along the screen’s left-right; negative is left', fmt: ft },
  'place.fwd': { label: 'Nudge forward (ft)', hint: 'Away from the camera on the ground; negative is towards it', fmt: ft },
  'look.opacity': { label: 'Opacity (%)', hint: 'Hovered or selected labels are always solid', fmt: v => `${Math.round(v)} %` },
  'look.pad': { label: 'Padding around the name', hint: '×1 is today’s 5 × 14 px at 24 px text', fmt: v => `×${(+v).toFixed(2)}` },
  'look.round': { label: 'Corner roundness (px)', hint: 'At 24 px text; scales with the text', fmt: px },
  'when.fadeFt': { label: 'Fade out farther than (ft from the camera)', hint: 'Fully gone 30 % farther', fmt: v => v >= NEVER_FT ? 'never' : ft(v) },
  'when.roomsFt': { label: 'Only building labels farther than (ft)', hint: 'Room labels drop out beyond this; building labels stay', fmt: v => v >= NEVER_FT ? 'never' : ft(v) },
  'when.underRoof': { label: 'Hide room labels when Roofs are on', hint: 'Today: a room under its own roof has no label' },
  'crowd.stepY': { label: 'Crowded: step up / down by (px past the label)', fmt: px },
  'crowd.stepX': { label: 'Crowded: step aside by (px past half the label)', fmt: px },
  'crowd.arriveX': { label: 'To arrive: clear of others, sideways (px)', fmt: px },
  'crowd.arriveY': { label: 'To arrive: clear of others, up / down (px)', fmt: px },
  'crowd.leave': { label: 'To be pushed out: overlap into another (px)', fmt: px },
  'crowd.edgeIn': { label: 'Window edge: arrive within (px past the edge)', fmt: px },
  'crowd.edgeOut': { label: 'Window edge: leave beyond (px past the edge)', fmt: px },
  'crowd.dwell': { label: 'A label changes at most once per (ms)', fmt: v => `${Math.round(v)} ms` },
  'crowd.pawn': { label: 'Fade over a pawn within (px)', fmt: px },
};
export function layout(S) {
  return {
    main: [
      ['Size', [S.size.world ? 'size.ft' : 'size.px', 'size.world', ...(S.size.world ? ['size.minPx', 'size.maxPx'] : []), 'size.building', 'size.capPct']],
      ['Position', ['place.ft', 'place.buildingFt', 'place.side', 'place.fwd']],
      ['Look', ['look.opacity', 'look.pad', 'look.round']],
      ['When', ['when.fadeFt', 'when.roomsFt', 'when.underRoof']],
    ],
    advanced: [['Small text', ['size.hidePx', ...(S.size.world ? [] : ['size.ft'])]], ['Crowding', Object.keys(TODAY.crowd).map(k => 'crowd.' + k)]],
  };
}
const PRESETS = {
  'Starter: bigger buildings, 75 % cap': starter(),
  'Today’s labels (the game before the lab)': normalize(TODAY),
  'World-sized: 2 ft text, 12–36 px': normalize({ ...starter(), size: { ...starter().size, world: true } }),
};

export function labelLabSurface(R, app) {
  const drawer = document.createElement('aside'); drawer.id = 'labellab-panel'; drawer.className = 'collapsed'; document.body.append(drawer);
  const api0 = T.api || '/api/tw-ratings', draft = readDraft(DRAFT, normalize);
  const read = '<output class="lk-read" data-role="read">…</output>';
  const panel = mountLab(drawer, {
    title: 'Label lab', fields: FIELDS, limits: p => LIMITS[p], layout, presets: PRESETS, normalize, envelope,
    initial: draft || starter(), initialName: draft ? 'this browser’s unsaved draft' : 'built-in Starter', draftKey: DRAFT, houseField: 'labels', ratingsApi: api0,
    who: () => app.sync?.campaign?.seats?.find?.(x => x.id === app.me?.())?.name || '', onChange: s => app.setLabelLook(s), extra: read,
  });
  app.setLabelLook(panel.settings());
  // WHERE IT STARTS: this browser's unsaved draft, else the house labels (Use as default), else the built-in Starter
  if (draft) panel.startedFrom('this browser’s unsaved draft');
  else fetch(api0 + '/tuner/house', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).then(h => { if (h?.labels?.settings) panel.startFrom(h.labels, `house default · ${h.labels.name || 'labels'}`); else panel.startedFrom('built-in Starter (no house labels yet: the game shows today’s look)'); }).catch(() => panel.startedFrom('built-in Starter'));
  const open = document.createElement('button'); open.id = 'labellab-open'; open.textContent = 'Label lab'; open.onclick = () => drawer.classList.remove('collapsed'); document.body.append(open);
  Object.assign(open.style, { position: 'fixed', right: app.ringLabTunerBase ? '96px' : '8px', top: '6px', zIndex: 99, background: '#27352f', color: '#f3cf87', border: '1px solid #b6975b', borderRadius: '8px', padding: '7px' });
  // THE READOUT: what the labels are doing at this zoom
  let last = 0;
  app.on(what => {
    if (what !== 'frame' || performance.now() - last < 250) return; last = performance.now();
    const el = panel.el('[data-role="read"]'); if (!el) return;
    if (!app.can('room')) { el.textContent = 'This seat cannot edit rooms, so it sees no labels (players never do).'; return; }
    if (!app.labelsOn?.()) { el.textContent = 'Labels are switched off in this browser (L, or Settings ▸ Me).'; return; }
    const L = app.labelInfo(), on = L.filter(l => l.visible), cap = on.filter(l => l.look?.why === 'cap').length, d = app.main?.grab?.dist;
    const fonts = on.map(l => l.font), lo = Math.min(...fonts), hi = Math.max(...fonts);
    el.textContent = `Camera ${d ? Math.round(d) + ' ft away' : '?'} · ${on.length} of ${L.length} labels showing` + (on.length ? ` · text ${Math.round(lo * 10) / 10}${hi > lo ? '–' + Math.round(hi * 10) / 10 : ''} px` : '') + (cap ? ` · ${cap} shrunk to fit their room` : '');
  });
  installTable(app);
  window.labelLab = { panel, layout, presets: PRESETS };
  return { labelLab: true };
}

// THE DESIGN TABLE (made once, then reused: this browser's tw.labellab.token; main.js makes the campaign)
function installTable(app) {
  const token = new URLSearchParams(location.hash.slice(1)).get('s');
  try { if (!token || localStorage.getItem(TOKEN) !== token) return; } catch { return; }
  let started = false;
  const waitFor = async (test, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (test()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
  app.on(async what => {
    if (what !== 'frame' || started || app.sync.status !== 'live' || !app.area() || !app.view()) return;
    started = true;
    try {
      const has = name => Object.values(app.entities()).some(e => e.name === name);
      const fresh = !has('Lab · Mansion (3 storeys)');
      // a crowded street: two rows of small buildings a square apart, the street between them
      const B = [['Lab · Smithy', 'SMI', 2, 2, 7, 6, 71], ['Lab · Farm house', 'HUT', 10, 2, 6, 6, 72], ['Lab · Corner inn', 'TAV', 17, 2, 8, 7, 73], ['Lab · Cottage', 'HUT', 26, 2, 6, 6, 74], ['Lab · Workshop', 'SMI', 33, 2, 7, 6, 75],
        ['Lab · Chapel', 'TEM', 2, 12, 8, 7, 76], ['Lab · Market hall', 'MKT', 11, 12, 10, 7, 77], ['Lab · Small house', 'HUT', 22, 12, 6, 6, 78],
        ['Lab · Mansion (3 storeys)', 'NOB', 44, 2, 12, 10, 79, 3]];
      for (const [name, code, x, z, w, d, seed, storeys] of B) if (!has(name)) { app.makeBuilding({ code, x, z, w, d, seed: 82300 + seed, ...(storeys && { storeys }) }, { name }); await waitFor(() => has(name)); }
      // loose rooms, a closet to a hall
      for (const [name, type, x, z, w, d, seed] of [['Lab · closet (2×2)', 'storeroom', 2, 24, 2, 2, 81], ['Lab · long gallery (12×3)', 'hallway', 6, 24, 12, 3, 82], ['Lab · great hall (10×8)', 'common', 20, 24, 10, 8, 83], ['Lab · study (4×3)', 'common', 32, 24, 4, 3, 84]])
        if (!has(name)) { const id = app.spawnRoom(type, x, z, w, d, 82300 + seed); if (await waitFor(() => !!app.entities()[id])) app.rename(app.entities()[id], name); }
      for (const [name, x, z] of [['Ada', 52.5, 52.5], ['Bram', 92.5, 52.5], ['Cato', 132.5, 52.5]]) if (!has(name)) app.addPawns(null, x, z, { name, select: false });
      app.dispatch('area.set', { area: app.area(), name: 'Label lab · zoom in and out here' });
      if (fresh && app.main?.grab) { const g = app.main.grab; g.focus.set(100, 0, 60); g.dist = 170; g.pitch = 58; g.yaw = 0; g.update(); }
      app.toast('Label lab table ready. Open the Label lab drawer, top right.');
    } catch (e) { console.error('label lab table', e); app.toast('Label lab table needs another try: ' + e.message, true); started = false; }
  });
}
