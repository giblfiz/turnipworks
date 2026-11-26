// UPLOADED MODELS, in the browser (2026-11-06; docs/UPLOADS.md; the relay side is relay/uploads.js, what both share
// core/uploads.js). A GM uploads a model file (.glb, a .gltf with everything inside it, .stl, .obj) into the campaign:
//   Settings ▸ Uploaded models (U), the bar ("upload", "models"), or a model file dropped on the window.
// The relay rebuilds it in a sandbox into three tiers; it then sits in the list with its picture (rendered here, from
// the converted copy, and sent back), and "Place" puts it on the table like a library thing: a ghost on the pointer,
// a click lands it (object.place with `upload`), R turns it, Shift keeps placing. Every seat of the campaign draws it
// (assets.visualFor asks U.visual); a model deleted or taken down draws as a marked box of the same size.
// Private to the campaign: the list is the GM's, the mesh goes to the campaign's own seats only, with the seat token in
// an Authorization header (never in an address). Public sharing is off (core/uploads.js PUBLIC_FLAG).
import * as THREE from 'three';
import { T } from './tuner.js';
import { icon } from './icons.js';
import { newId } from '../core/ids.js';
import { ATTEST_VERSION, ATTEST_TEXT, tierFor, sizeOf, cleanName, HEIGHT_MIN, HEIGHT_MAX, NAME_MAX } from '../core/uploads.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const MODEL_FILE_RE = /\.(glb|gltf|stl|obj)$/i;
const extOf = (name) => (String(name).match(MODEL_FILE_RE)?.[1] || '').toLowerCase();
const kb = (n) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export function createUploads(app) {
  const U = { on: null, list: [], info: null, form: { file: null, name: '', height: 6, yaw: 0, up: 'auto', attest: false }, busy: false, error: null, notes: null, counterFor: null, counter: {}, lastPlaced: null };
  const C = () => app.sync?.campaign;
  const base = () => `${app.relayBase}/c/${encodeURIComponent(C().id)}/uploads`;
  const authH = () => ({ authorization: `Bearer ${app.sync.token}` });
  const gm = () => !!app.gm?.();
  const json = async (r) => { try { return await r.json(); } catch { return { ok: false, why: `the server answered ${r.status}` }; } };

  // ---------------------------------------------------------------- the list (the GM's)
  U.refresh = async () => {
    if (!C() || !gm()) return U.list;
    let r; try { r = await fetch(base(), { headers: authH() }); } catch { return U.list; }
    const j = await json(r);
    if (r.status === 404 && j.code === 'off') { U.on = false; U.list = []; return U.list; }
    if (!j.ok) return U.list;
    U.on = true; U.list = j.uploads; U.info = j;
    for (const x of U.list) if (x.thumb && x.status === 'ok') thumbUrl(x.id); else if (!x.thumb && x.status === 'ok') makeThumb(x);
    return U.list;
  };
  const byId = (id) => U.list.find(x => x.id === id) || null;

  // ---------------------------------------------------------------- the mesh: fetched with the seat in a header, parsed here
  let loaderP = null;
  const loader = () => loaderP ||= import(`${T.base}js/gltf.js${T.v && T.v !== 'dev' ? `?v=${T.v}` : ''}`).then(m => m.gltfLoader()); // (the tuner's: meshopt decoded in workers)
  const meshes = new Map(); // `${id}|${tier}` -> Promise<{ scene } | { gone, why }>
  function fetchMesh(id, tier) {
    const k = `${id}|${tier}`;
    if (!meshes.has(k)) meshes.set(k, (async () => {
      let r; try { r = await fetch(`${base()}/${id}/${tier}.glb`, { headers: authH() }); } catch { meshes.delete(k); return { gone: false, why: 'offline' }; }
      if (!r.ok) return { gone: true, why: r.status === 451 ? 'removed after a copyright notice' : 'deleted' };
      const buf = await r.arrayBuffer(), L = await loader();
      return new Promise((res) => L.parse(buf, '', (g) => res({ scene: g.scene }), () => res({ gone: true, why: 'unreadable' })));
    })());
    return meshes.get(k);
  }
  U.forget = (id) => { for (const k of [...meshes.keys()]) if (k.startsWith(id + '|')) meshes.delete(k); };
  // a thing's visual: the model at its size, turned to its front, on its base (the converter left it centred, on the
  // ground, its longest side 1); or, when the model is gone, a marked box of the thing's size
  U.visual = async (e) => {
    const r = await fetchMesh(e.upload, tierFor(app.assets?.faces?.()));
    if (!r.scene) return goneVisual(e.dims, r.why);
    const g = new THREE.Group(), m = r.scene.clone(true), s = e.s || [1, 1, 1];
    m.rotation.y = (e.yaw || 0) * Math.PI / 180; m.scale.set(s[0], s[1], s[2]);
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(m); g.userData.upload = e.upload;
    return g;
  };
  const goneMat = new THREE.MeshLambertMaterial({ color: 0x7a3b36, transparent: true, opacity: 0.6 });
  function goneVisual(dims, why) {
    const [w, h, d] = dims || [2, 2, 2], g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), goneMat); box.scale.set(Math.max(0.1, w), Math.max(0.05, h), Math.max(0.1, d)); box.position.y = Math.max(0.05, h) / 2; g.add(box);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const x = cv.getContext('2d');
    x.fillStyle = 'rgba(20,18,16,.85)'; x.beginPath(); x.roundRect?.(4, 4, 504, 88, 40); x.fill(); x.fillStyle = '#f4e9dc'; x.font = '600 38px Inter, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(why === 'removed after a copyright notice' ? 'Model removed (notice)' : 'Model deleted', 256, 50);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true })); sp.scale.set(4, 0.75, 1); sp.position.y = Math.max(0.05, h) + 0.8; sp.renderOrder = 30; g.add(sp);
    g.userData.goneUpload = why || true;
    return g;
  }
  app.assets && (app.assets.uploadVisual = U.visual);

  // ---------------------------------------------------------------- its picture: rendered here from the converted copy
  const thumbs = new Map(); // id -> object URL
  async function thumbUrl(id) {
    if (thumbs.has(id)) return thumbs.get(id);
    thumbs.set(id, null);
    try { const r = await fetch(`${base()}/${id}/thumb`, { headers: authH() }); if (r.ok) { thumbs.set(id, URL.createObjectURL(await r.blob())); rerender?.(); } } catch { }
    return thumbs.get(id);
  }
  let rendering = Promise.resolve();
  function makeThumb(x) {
    if (thumbs.has(x.id)) return; thumbs.set(x.id, null);
    rendering = rendering.then(async () => {
      const r = await fetchMesh(x.id, 't1'); if (!r.scene) return;
      const R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); R.setPixelRatio(1); R.setSize(256, 256, false);
      const scene = new THREE.Scene(), m = r.scene.clone(true), b = x.bounds || [1, 1, 1];
      scene.add(new THREE.HemisphereLight(0xfff4e6, 0x3a3328, 1.6)); const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 3, 2.5); scene.add(sun); scene.add(m);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100), cy = b[1] / 2, dist = 1.15 * Math.max(...b) / Math.tan(15 * Math.PI / 180);
      cam.position.set(dist * 0.62, cy + dist * 0.45, dist * 0.65); cam.lookAt(0, cy, 0);
      R.render(scene, cam);
      const blob = await new Promise(res => R.domElement.toBlob(res, 'image/webp', 0.85));
      R.dispose(); R.forceContextLoss?.();
      if (!blob || blob.type !== 'image/webp') return;
      try { const p = await fetch(`${base()}/${x.id}/thumb`, { method: 'POST', headers: { ...authH(), 'content-type': 'image/webp' }, body: blob }); if (p.ok) { thumbs.set(x.id, URL.createObjectURL(blob)); x.thumb = true; rerender?.(); } } catch { }
    }).catch(() => { });
  }

  // ---------------------------------------------------------------- upload, change, delete, counter-notice
  U.upload = async (file = U.form.file, opts = U.form) => {
    if (!gm()) { app.toast('Uploading models is the GM\'s', true); return null; }
    if (!file) { U.error = 'Choose a model file first'; rerender?.(); return null; }
    if (!opts.attest) { U.error = 'Tick the box that says you have the right to upload it'; rerender?.(); return null; }
    const max = U.info?.quota?.fileBytes || 32 * 1048576;
    if (file.size > max) { U.error = `That file is ${kb(file.size)}; the most is ${kb(max)}. The Import Lab can make a big model smaller in your browser first.`; rerender?.(); return null; }
    U.busy = true; U.error = null; U.notes = null; rerender?.();
    const q = new URLSearchParams({ name: cleanName(opts.name) || cleanName(file.name.replace(MODEL_FILE_RE, '')) || 'Model', height: String(opts.height), yaw: String(opts.yaw || 0), up: opts.up || 'auto', ext: extOf(file.name), attest: ATTEST_VERSION });
    let r, j; try { r = await fetch(`${base()}?${q}`, { method: 'POST', headers: { ...authH(), 'content-type': 'application/octet-stream' }, body: file }); j = await json(r); } catch { j = { ok: false, why: 'the server could not be reached' }; }
    U.busy = false;
    if (!j.ok) { U.error = j.why || 'Not uploaded'; rerender?.(); return null; }
    U.list = [...U.list.filter(x => x.id !== j.upload.id), j.upload];
    U.form = { file: null, name: '', height: opts.height, yaw: 0, up: 'auto', attest: false };
    U.notes = j.upload.notes?.length ? `Uploaded “${j.upload.name}”. Left behind: ${j.upload.notes.join('; ')}.` : `Uploaded “${j.upload.name}”.`;
    app.toast(U.notes);
    makeThumb(j.upload);
    rerender?.();
    return j.upload;
  };
  U.set = async (id, patch) => { let j; try { j = await json(await fetch(`${base()}/${id}/set`, { method: 'POST', headers: { ...authH(), 'content-type': 'application/json' }, body: JSON.stringify(patch) })); } catch { j = { ok: false }; } if (j.ok) { U.list = U.list.map(x => x.id === id ? j.upload : x); rerender?.(); } else app.toast(`Not changed: ${j.why || 'the server refused'}`, true); return j.ok; };
  U.delete = async (id) => {
    let j; try { j = await json(await fetch(`${base()}/${id}/delete`, { method: 'POST', headers: authH() })); } catch { j = { ok: false, why: 'the server could not be reached' }; }
    if (!j.ok) { app.toast(`Not deleted: ${j.why}`, true); return false; }
    const x = byId(id); U.list = U.list.filter(y => y.id !== id); U.forget(id);
    app.toast(`Deleted “${x?.name || 'the model'}”${j.placed ? ` and its ${j.placed} placed cop${j.placed === 1 ? 'y' : 'ies'} (undo brings them back as boxes)` : ''}`);
    rerender?.(); return true;
  };
  U.sendCounter = async (id, fields = U.counter) => {
    let j; try { j = await json(await fetch(`${base()}/${id}/counter`, { method: 'POST', headers: { ...authH(), 'content-type': 'application/json' }, body: JSON.stringify(fields) })); } catch { j = { ok: false, why: 'the server could not be reached' }; }
    if (!j.ok) { U.error = j.bad ? `The counter-notice needs: ${j.bad.join(', ')}` : j.why; rerender?.(); return null; }
    U.counterFor = null; U.counter = {}; U.error = null; app.toast(`Counter-notice ${j.counter.id} sent. We pass it to the person who sent the notice; the model can come back 10 to 14 business days later.`);
    await U.refresh(); rerender?.(); return j.counter;
  };

  // ---------------------------------------------------------------- placing: a sub-tool of the place mode (as share.js's ghost)
  let ghost = null;
  const fade = (g) => g.traverse(o => { if (!o.isMesh) return; o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; o.material.depthWrite = false; o.userData.noPick = true; });
  U.place = (id) => {
    const x = byId(id); if (!x || x.status !== 'ok') { app.toast('That model is not available', true); return false; }
    app.settings?.close?.(); app.modes.cancel();
    const sz = sizeOf(x.bounds, x.height, x.yaw);
    app.mode = { kind: 'place', upload: { ...x, ...sz }, cat: { id: null, place: 'floor', name: x.name }, size: { dims: sz.dims, place: 'floor' }, rot: 0, tool: false };
    const g = ghost = new THREE.Group(); g.visible = false; g.userData.noPick = true;
    const stand = app.assets.placeholder(sz.dims); g.add(stand); fade(stand);
    U.visual({ upload: x.id, yaw: x.yaw, s: sz.s, dims: sz.dims }).then(v => { if (ghost !== g || !v) return; g.remove(stand); g.add(v); fade(v); }).catch(() => { });
    app.worldOf(app.area()).layers.deco.add(g);
    // (a phone has no R and no Escape: its own chip says tap or drag, with Cancel, client/handheld.js; this toast sat on it)
    if (!app.handheld) app.toast(`Place “${x.name}”: click where it goes · R turns it · Esc cancels`);
    app.refresh?.(); return true;
  };
  const tool = app.uploadTool = {
    clear() { ghost?.parent?.remove(ghost); ghost = null; },
    hover(ray, ground, ev) {
      const m = app.mode; if (!m?.upload || !ghost) return;
      const p = app.modes.placementAt(m.cat, m.size, ray, ground, { alt: ev?.altKey, rot: m.rot });
      ghost.visible = !!p; if (p) { ghost.position.set(p.x, p.y, p.z); ghost.rotation.y = p.rot; }
    },
    placeAt(ray, ground, ev) {
      const m = app.mode; if (!m?.upload) return;
      const p = app.modes.placementAt(m.cat, m.size, ray, ground, { alt: ev?.altKey, rot: m.rot }); if (!p) return;
      const x = m.upload, id = newId('obj');
      app.dispatch('object.place', { id, name: x.name, upload: x.id, place: 'floor', layer: 'furnish', x: p.x, y: p.y, z: p.z, rot: p.rot, yaw: x.yaw || 0, s: x.s, dims: x.dims, parent: p.parent || undefined, room: p.room || undefined });
      U.lastPlaced = id;
      if (!ev?.shiftKey) app.modes.cancel();
    },
  };

  // ---------------------------------------------------------------- Settings ▸ Uploaded models
  let rerender = null;
  // (the site's own pages: /terms and /dmca where the game is served as turnipworks.net does it, else beside the client;
  // surfaces/settings.js sitePage is the same rule)
  const onSite = () => document.querySelector('base')?.getAttribute('href') === '/engine/client/';
  // WHY A MODEL IS REMOVED, and what its counter-notice will do (2026-11-23, the tester: once a campaign was cut off the
  // row said only "the repeat-infringer policy" and hid Counter-notice, and a forwarded counter-notice still promised
  // "back after …" when the cut-off would keep it hidden). A notice is always named while one holds the model; the cut-off
  // is said beside it; a counter-notice says what it will really do.
  const removedText = (x) => {
    const R = x.removed || {}, notices = R.notices || [], ended = !!R.ended, c = R.counter;
    const parts = [notices.length ? `Removed after a copyright notice (notice ${notices.slice(-1)[0]})` : 'Removed: uploading has ended for this campaign under the repeat-infringer policy'];
    if (notices.length && ended) parts.push('uploading has also ended for this campaign');
    if (c) parts.push(c.status === 'received' ? 'counter-notice received'
      : c.status === 'forwarded' ? (ended ? `counter-notice forwarded: its notice lifts after ${c.restoreAfterDay}, but the model stays hidden while uploading is ended for this campaign` : `counter-notice forwarded, back after ${c.restoreAfterDay}`)
      : c.status === 'lawsuit' ? 'counter-notice: the person who sent the notice has gone to court, so it stays removed'
      : c.status === 'restored' ? (notices.length ? 'counter-notice accepted' : 'counter-notice accepted, but the model stays hidden while uploading is ended for this campaign')
      : c.status === 'rejected' ? 'counter-notice not accepted' : 'counter-notice closed');
    return parts.join(' · ');
  };
  // Counter-notice… is offered on every model a notice holds (terminated campaign or not) unless one is being handled
  const canCounter = (x) => (x.removed?.notices || []).length > 0 && !['received', 'forwarded', 'lawsuit'].includes(x.removed?.counter?.status);
  U.sectionHtml = () => {
    if (U.on === false) return '<p class="snote">Uploading models is not on for this server.</p>';
    const f = U.form, q = U.info?.quota, list = U.list;
    const counterForm = (x) => { const c = U.counter, inp = (k, label, ph = '') => `<label class="shlab">${label} <input data-ctr="${k}" value="${esc(c[k] || '')}" placeholder="${esc(ph)}" maxlength="${k === 'address' ? 400 : 120}"></label>`, chk = (k, words) => `<label class="upchk"><input type="checkbox" data-ctrchk="${k}"${c[k] ? ' checked' : ''}><span>${words}</span></label>`;
      return `<div class="upcounter"><p class="snote">A counter-notice says the model was removed by mistake. It goes, with your name and contact details, to the person who sent the notice; unless they tell us they have gone to court, the model comes back 10 to 14 business days later.</p>
        ${inp('name', 'Your full name')}${inp('address', 'Postal address')}${inp('phone', 'Phone')}${inp('email', 'Email (optional)')}
        ${chk('mistake', 'Under penalty of perjury, I have a good-faith belief that the model was removed or disabled as a result of mistake or misidentification of the material to be removed or disabled.')}
        ${chk('jurisdiction', 'I consent to the jurisdiction of the US Federal District Court for the judicial district of my address (or, if my address is outside the United States, any judicial district in which the service provider may be found).')}
        ${chk('service', 'I will accept service of process from the person who sent the notice, or their agent.')}
        <label class="shlab">Why it is not infringing (optional) <textarea data-ctr="explain" maxlength="2000">${esc(c.explain || '')}</textarea></label>
        ${inp('signature', 'Signature: type your full name again')}
        <div class="sab"><button class="sbtn primary" data-upact="sendcounter" data-up="${esc(x.id)}">Send counter-notice</button><button class="sbtn" data-upact="nocounter">Cancel</button></div></div>`; };
    const item = (x) => {
      const pic = thumbs.get(x.id), removed = x.status === 'removed';
      const what = [`${x.height} ft tall`, x.tris?.[0] ? `${x.tris[0].toLocaleString()} triangles` : '', x.bytes ? kb(x.bytes) : '', x.plain ? 'pewter' : ''].filter(Boolean).join(' · ');
      return `<li class="upitem${removed ? ' removed' : ''}" data-up="${esc(x.id)}"><span class="uppic">${pic ? `<img src="${esc(pic)}" alt="">` : icon('box', 22)}</span>
        <span class="upmid"><b>${esc(x.name)}</b><small>${esc(what)}</small>${removed ? `<small class="bad">${esc(removedText(x))}</small>` : ''}</span>
        <span class="upbtns">${removed ? (canCounter(x) ? `<button class="sbtn" data-upact="counter">Counter-notice…</button>` : '') : `<button class="sbtn primary" data-upact="place">${icon('tool-place', 15)} Place</button>`}<button class="sbtn danger" data-upact="delete" title="Delete: also removes it everywhere it is placed">${icon('trash-2', 15)}</button></span></li>
        ${U.counterFor === x.id ? `<li class="upcounterli">${counterForm(x)}</li>` : ''}`;
    };
    const group = (title, inner, note = '') => `<div class="sgrp"><h3>${title}</h3>${note ? `<p class="snote">${note}</p>` : ''}${inner}</div>`;
    const yawSel = [0, 90, 180, 270].map(a => `<option value="${a}"${+f.yaw === a ? ' selected' : ''}>${a ? `turned ${a}°` : 'as it is'}</option>`).join('');
    const upSel = [['auto', 'Automatic'], ['y', 'Y is up'], ['z', 'Z is up']].map(([v, l]) => `<option value="${v}"${f.up === v ? ' selected' : ''}>${l}</option>`).join('');
    return `<div class="uproot">${group('Upload a model', `<div class="upform">
        <div class="sab"><label class="sbtn">${icon('package', 15)} Choose a file…<input type="file" class="upfile" accept=".glb,.gltf,.stl,.obj,model/gltf-binary,model/gltf+json,model/stl" hidden></label><span class="upfname">${f.file ? `${esc(f.file.name)} · ${kb(f.file.size)}` : 'No file chosen'}</span></div>
        <div class="upgrid"><label class="shlab">Name <input class="upname" maxlength="${NAME_MAX}" value="${esc(f.name)}" placeholder="${esc(f.file ? cleanName(f.file.name.replace(MODEL_FILE_RE, '')) : 'Red dragon')}"></label>
        <label class="shlab">Height, feet <input class="upheight" type="number" min="${HEIGHT_MIN}" max="${HEIGHT_MAX}" step="0.1" value="${esc(f.height)}"></label>
        <label class="shlab">Front <select class="upyaw">${yawSel}</select></label>
        <label class="shlab" title="Automatic: an .stl stands on Z (print files do), everything else on Y">Up <select class="upup">${upSel}</select></label></div>
        <label class="upattest"><input type="checkbox" class="upattestbox"${f.attest ? ' checked' : ''}> <span>${esc(ATTEST_TEXT)} <a class="upterms" href="${esc(onSite() ? '/terms#uploads' : 'site/terms.html#uploads')}" target="_blank" rel="noopener">Upload terms</a> · <a class="uppolicy" href="${esc(onSite() ? '/dmca' : `${app.relayBase}/dmca`)}" target="_blank" rel="noopener">Copyright policy</a></span></label>
        <div class="sab"><button class="sbtn primary" data-upact="go"${U.busy ? ' disabled' : ''}>${U.busy ? 'Converting…' : 'Upload'}</button></div>
        ${U.error ? `<p class="snote bad">${esc(U.error)}</p>` : ''}${U.notes ? `<p class="snote">${esc(U.notes)}</p>` : ''}</div>`,
      `Private to this campaign: only its seats see it. A .glb (or a .gltf with everything inside it), .stl or .obj, at most ${q ? kb(q.fileBytes) : '32 MB'} and ${(q?.triangles || 500000).toLocaleString()} triangles. It is rebuilt at 20,000, 5,000 and 1,500 triangles; animations, links to other files and anything we do not read are left behind. A model with no colour gets a pewter look.`)}
      ${group('Your models', list.length ? `<ul class="slist uplist">${list.map(item).join('')}</ul>` : '<p class="snote">None yet.</p>',
        q ? `${q.n} of ${q.maxN} · ${kb(q.bytes)} of ${kb(q.maxBytes)}. Deleting a model removes it everywhere it is placed.` : '')}</div>`;
  };
  U.wire = (root, rr) => {
    rerender = rr; if (!root) return;
    const $ = (s) => root.querySelector(s);
    const file = $('.upfile'); if (file) file.onchange = () => { U.form.file = file.files[0] || null; U.error = null; if (U.form.file && !MODEL_FILE_RE.test(U.form.file.name)) U.error = 'That is not a model file (.glb, .gltf, .stl, .obj)'; rr?.(); };
    const nm = $('.upname'); if (nm) nm.oninput = () => { U.form.name = nm.value; };
    const ht = $('.upheight'); if (ht) ht.oninput = () => { U.form.height = Math.min(HEIGHT_MAX, Math.max(HEIGHT_MIN, Number(ht.value) || 6)); };
    const yw = $('.upyaw'); if (yw) yw.onchange = () => { U.form.yaw = +yw.value; };
    const ax = $('.upup'); if (ax) ax.onchange = () => { U.form.up = ax.value; };
    const at = $('.upattestbox'); if (at) at.onchange = () => { U.form.attest = at.checked; };
    const go = root.querySelector('[data-upact=go]'); if (go) go.onclick = () => U.upload();
    for (const li of root.querySelectorAll('li.upitem')) {
      const id = li.dataset.up, b = (a) => li.querySelector(`[data-upact=${a}]`);
      if (b('place')) b('place').onclick = () => U.place(id);
      if (b('counter')) b('counter').onclick = () => { U.counterFor = id; U.counter = {}; rr?.(); };
      if (b('delete')) b('delete').onclick = () => { const x = byId(id); if (confirm(`Delete “${x?.name}”? It is also removed from every place it stands.`)) U.delete(id); };
    }
    for (const el of root.querySelectorAll('[data-ctr]')) el.oninput = () => { U.counter[el.dataset.ctr] = el.value; };
    for (const el of root.querySelectorAll('[data-ctrchk]')) el.onchange = () => { U.counter[el.dataset.ctrchk] = el.checked; };
    const sc = root.querySelector('[data-upact=sendcounter]'); if (sc) sc.onclick = () => U.sendCounter(sc.dataset.up);
    const nc = root.querySelector('[data-upact=nocounter]'); if (nc) nc.onclick = () => { U.counterFor = null; rr?.(); };
    if (!U._loading) { U._loading = true; U.refresh().then(() => { U._loading = false; rr?.(); }); }
  };
  U.open = (file = null) => { if (file) { U.form.file = file; U.error = null; } app.settings?.show('models'); };

  // ---------------------------------------------------------------- a model file dropped on the window
  const hasFiles = (ev) => [...(ev.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragover', (ev) => { if (hasFiles(ev) && gm() && U.on !== false) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; } });
  window.addEventListener('drop', (ev) => {
    if (!hasFiles(ev) || !gm() || U.on === false) return;
    const f = [...ev.dataTransfer.files].find(x => MODEL_FILE_RE.test(x.name)); if (!f) return;
    ev.preventDefault(); U.open(f);
  });
  // (whether this server takes uploads: asked once the campaign is up, so Settings can hide the section)
  const probe = () => { if (C() && gm()) U.refresh(); else setTimeout(probe, 1500); };
  setTimeout(probe, 1500);
  return U;
}
