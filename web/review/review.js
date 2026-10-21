// Turnip Works asset review (inn-01, inn-02, …) — fast triage (2026-10-02).
// Three simultaneous views (front / top / side) of one GLB, one WebGL renderer with scissor viewports,
// each auto-rotating at 6 rpm about a different axis; digit keys score the model and advance.
// Ratings write-back format is unchanged: POST /api/tw-ratings/ratings {key, stars, note, tags}.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const qs = new URLSearchParams(location.search);
const RATE_API = "/api/tw-ratings/ratings";
const RUN_QS = /^[a-z0-9][a-z0-9.-]{1,40}$/.test(qs.get("run") || "") ? qs.get("run") : null; // ?run= is for tests
let RUN = RUN_QS || "inn-01"; // otherwise the run named in assets.json (inn-02 review lives at ../review-02/)
const SCALE = ["What happened? Engine break", "Bad", "Not quite usable", "Barely acceptable — go with it", "Good", "Great"];
const PRELOAD = 3;
const OMEGA = (6 * 2 * Math.PI) / 60; // 6 rpm, rad/s
const $ = (id) => document.getElementById(id);
// a combined page (review-lib, 2026-10-12) lists several batches: each asset then names its own run, so its score is
// stored as <batch>/<sku>/<target> exactly as that batch's own page would store it (build_data.py reads that key)
const runOf = (sku) => RUN_QS || bySku.get(sku)?.run || RUN;
const rkey = (sku, target) => `${runOf(sku)}/${sku}/${target}`;

let data = [];          // assets
let META = { assets: {}, settings: {} };
let RATINGS = {};
let selected = null;    // sku
const history = [];     // skus visited, for "back"
let lastScore = null;   // {sku, prev} for undo

// ---------------------------------------------------------------- persistence of filter state
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window etc. */ } },
};

// ---------------------------------------------------------------- toast
let toastTimer = null;
function toast(msg, sticky = false) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  t.classList.toggle("bad", sticky);
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => { t.hidden = true; }, 1600);
}

// ---------------------------------------------------------------- ratings
const stars = (sku, target = "model") => {
  const s = RATINGS[rkey(sku, target)]?.stars;
  return Number.isInteger(s) ? s : null;
};
// Reviewed (Harry 2026-10-02) = any trace on the asset: a model or plate score, a flag, or a note. Computed, never written.
const touched = (r) => !!r && (Number.isInteger(r.stars) || (r.tags || []).length > 0 || !!(r.note || "").trim());
const reviewed = (sku) => touched(RATINGS[rkey(sku, "model")]) || touched(RATINGS[rkey(sku, "plate")]);

// Posts for one key go out strictly in order (masking then score can't land reversed); each payload is the
// full optimistic state at call time, so the last write wins with everything in it.
const queues = new Map();
const pending = new Map();
async function resync() {
  try { RATINGS = await (await fetch(RATE_API, { cache: "no-store" })).json(); } catch { /* keep local */ }
  refreshBadges();
  if (selected) paintRatings();
}
function post(key, rec) {
  const payload = { key, stars: Number.isInteger(rec.stars) ? rec.stars : null, note: rec.note || "", tags: rec.tags || [] };
  pending.set(key, (pending.get(key) || 0) + 1);
  const run = () => fetch(RATE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    .then(async (res) => {
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.err || `HTTP ${res.status}`);
      return d.record;
    });
  const p = (queues.get(key) || Promise.resolve()).then(run, run);
  queues.set(key, p.catch(() => {}));
  return p.then((record) => {
    const left = pending.get(key) - 1;
    pending.set(key, left);
    if (left === 0) { RATINGS[key] = record; refreshBadges(); if (selected && key.split("/")[1] === selected) paintRatings(); }
    return record;
  }, (e) => {
    pending.set(key, pending.get(key) - 1);
    toast(`NOT SAVED ${key.split("/")[1]} — ${e.message}`, true);
    void resync();
    throw e;
  });
}

// Optimistic: the UI moves instantly; the server's record replaces the local one once the queue drains.
function rate(sku, target, patch) {
  const key = rkey(sku, target);
  const cur = RATINGS[key] || { key, stars: null, note: "", tags: [] };
  const next = { ...cur, ...patch };
  RATINGS[key] = next;
  return post(key, next).catch(() => {});
}

function ratingBox(target, label) {
  const box = document.createElement("div");
  box.className = "rate";
  box.dataset.target = target;
  box.innerHTML = `<p class="rate-label">${label}</p>
    <div class="rate-stars" role="group" aria-label="${label} rating">${SCALE.map((m, i) =>
      `<button type="button" data-stars="${i}" title="${i} — ${m}" aria-pressed="false">${i}</button>`).join("")}</div>
    <p class="rate-meaning"></p>
    <textarea rows="2" placeholder="${target === "model" ? "Note (N)" : "Note"}" aria-label="${label} note"></textarea>
    ${target === "model" ? `<button type="button" class="rate-tag" data-tag="masking" aria-pressed="false">Masking problem (M)</button>` : ""}`;
  const note = box.querySelector("textarea");
  box.querySelectorAll(".rate-stars button").forEach((b) => b.addEventListener("click", () => {
    void rate(selected, target, { stars: Number(b.dataset.stars), note: note.value });
  }));
  box.querySelector(".rate-tag")?.addEventListener("click", () => toggleMasking());
  note.addEventListener("input", () => { note.dataset.dirty = "1"; });
  note.addEventListener("blur", () => saveNote(box));
  return box;
}

function saveNote(box) {
  const note = box.querySelector("textarea");
  if (!note.dataset.dirty || !box.dataset.sku) return;
  delete note.dataset.dirty;
  void rate(box.dataset.sku, box.dataset.target, { note: note.value });
}

function paintRatings() {
  for (const box of $("ratings").querySelectorAll(".rate")) {
    const rec = RATINGS[rkey(selected, box.dataset.target)] || {};
    const s = Number.isInteger(rec.stars) ? rec.stars : null;
    const tags = new Set(rec.tags || []);
    box.querySelectorAll(".rate-stars button").forEach((b) => {
      const on = Number(b.dataset.stars) === s;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    const mask = box.querySelector(".rate-tag");
    if (mask) { mask.classList.toggle("active", tags.has("masking")); mask.setAttribute("aria-pressed", String(tags.has("masking"))); }
    box.querySelector(".rate-meaning").textContent = (s === null ? "Not rated yet" : `${s} — ${SCALE[s]}`) + (tags.has("masking") ? " · masking problem" : "");
    const note = box.querySelector("textarea");
    if (!note.dataset.dirty && document.activeElement !== note) note.value = rec.note || "";
  }
}

function toggleMasking() {
  const rec = RATINGS[rkey(selected, "model")] || {};
  const tags = new Set(rec.tags || []);
  if (tags.has("masking")) tags.delete("masking"); else tags.add("masking");
  const note = $("ratings").querySelector('.rate[data-target="model"] textarea');
  void rate(selected, "model", { tags: [...tags], note: note ? note.value : rec.note || "" });
  paintRatings();
  toast(tags.has("masking") ? "Masking flag on" : "Masking flag off");
}

// ---------------------------------------------------------------- filters
const F = { name: $("f-name"), status: $("f-status"), score: $("f-score"), role: $("f-role"), theme: $("f-theme"), date: $("f-date"), ...($("f-batch") ? { batch: $("f-batch") } : {}) };
let dateMode = "day";
const bucket = (iso) => (iso ? (dateMode === "hour" ? iso.slice(0, 13) : iso.slice(0, 10)) : "unknown");

function buildFilterOptions() {
  const roles = new Map(); // domain -> Map(role -> count)
  const themes = new Map();
  const dates = new Map();
  const days = new Set(data.map((a) => (META.assets[a.sku]?.gen || "").slice(0, 10)));
  dateMode = days.size < 2 ? "hour" : "day";
  for (const a of data) {
    const m = META.assets[a.sku] || {};
    if (!roles.has(m.domain)) roles.set(m.domain, new Map());
    roles.get(m.domain).set(m.role, (roles.get(m.domain).get(m.role) || 0) + 1);
    for (const t of m.themes || []) themes.set(t, (themes.get(t) || 0) + 1);
    const b = bucket(m.gen);
    dates.set(b, (dates.get(b) || 0) + 1);
  }
  for (const [domain, rs] of [...roles].sort((x, y) => String(x[0]).localeCompare(String(y[0])))) {
    const g = document.createElement("optgroup");
    g.label = domain;
    const total = [...rs.values()].reduce((s, n) => s + n, 0);
    g.append(new Option(`All ${domain} (${total})`, `d:${domain}`));
    for (const [role, n] of [...rs].sort()) if (role !== domain || rs.size > 1) g.append(new Option(`${role} (${n})`, `r:${domain}|${role}`));
    F.role.append(g);
  }
  const batches = new Map(); // combined pages only: one option per batch (the run its scores are stored under)
  for (const a of data) if (a.run) batches.set(a.run, (batches.get(a.run) || 0) + 1);
  if (F.batch && batches.size) {
    const left = (run) => data.filter((a) => a.run === run && !reviewed(a.sku)).length;
    for (const [b, n] of [...batches].sort()) F.batch.append(new Option(`${(META.batches || {})[b] || b} (${left(b)} of ${n} to rate)`, b));
    $("f-batch-wrap").hidden = false;
  }
  const names = META.settings || {};
  for (const [t, n] of [...themes].sort((x, y) => y[1] - x[1])) {
    F.theme.append(new Option(t === "ANY" ? `Universal only (${n})` : `${names[t] || t} (${n}${themes.get("ANY") ? ` + ${themes.get("ANY")} universal` : ""})`, t));
  }
  for (const [b, n] of [...dates].sort()) {
    const label = b === "unknown" ? "unknown" : dateMode === "hour" ? `${b.slice(0, 10)} ${b.slice(11)}:00–:59` : b;
    F.date.append(new Option(`${label} (${n})`, b));
  }
  const saved = store.get("tw-review-filters", {});
  for (const [k, el] of Object.entries(F)) {
    if (saved[k] !== undefined && (el.tagName !== "SELECT" || [...el.options].some((o) => o.value === saved[k]))) el.value = saved[k];
  }
  // a link from the landing page or the queues page opens one batch: ?batch=crypt-01 (and nothing else narrowed)
  if (F.batch && qs.get("batch") !== null) {
    for (const el of Object.values(F)) el.value = el === F.status ? "unreviewed" : "";
    if ([...F.batch.options].some((o) => o.value === qs.get("batch"))) F.batch.value = qs.get("batch");
  }
}

function saveFilters() { store.set("tw-review-filters", Object.fromEntries(Object.entries(F).map(([k, el]) => [k, el.value]))); }

function matches(a) {
  const m = META.assets[a.sku] || {};
  const words = F.name.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length) {
    const hay = `${a.name} ${a.sku} ${a.hint || ""} ${a.material} ${m.role || ""} ${m.domain || ""}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) return false;
  }
  const s = stars(a.sku);
  if (F.status.value === "unreviewed" && reviewed(a.sku)) return false;
  if (F.status.value === "reviewed" && !reviewed(a.sku)) return false;
  const sc = F.score.value;
  if (sc) {
    if (sc === "masking") { if (!(RATINGS[rkey(a.sku, "model")]?.tags || []).includes("masking")) return false; }
    else if (s === null) return false;
    else if (sc === "le2" ? s > 2 : sc === "ge3" ? s < 3 : s !== Number(sc)) return false;
  }
  const r = F.role.value;
  if (r.startsWith("d:") && m.domain !== r.slice(2)) return false;
  if (r.startsWith("r:") && `${m.domain}|${m.role}` !== r.slice(2)) return false;
  const t = F.theme.value;
  if (t) {
    const th = m.themes || [];
    if (t === "ANY" ? !th.includes("ANY") : !(th.includes(t) || th.includes("ANY"))) return false;
  }
  if (F.date.value && bucket(m.gen) !== F.date.value) return false;
  if (F.batch?.value && a.run !== F.batch.value) return false;
  return true;
}

let filtered = [];
const buttons = new Map();
function badge(sku) {
  const ms = stars(sku), ps = stars(sku, "plate");
  const mask = (RATINGS[rkey(sku, "model")]?.tags || []).includes("masking");
  if (ms === null && ps === null && !mask) return "";
  const low = ms ?? ps;
  return `<b class="badge b${low ?? 3}">${ms === null ? "" : `${ms}★`}${ps === null ? "" : `<i>p${ps}</i>`}${mask ? " M" : ""}</b>`;
}
function button(asset) {
  if (!buttons.has(asset.sku)) {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `<img src="${url("plates", asset, "jpg")}" alt="" loading="lazy"><span class="bslot"></span><span class="bname"><strong>${asset.name}</strong></span>`;
    b.title = asset.sku;
    b.addEventListener("click", () => go(asset.sku));
    buttons.set(asset.sku, b);
  }
  return buttons.get(asset.sku);
}
function refreshBadges() {
  for (const [sku, b] of buttons) {
    const html = badge(sku);
    const slot = b.querySelector(".bslot");
    if (slot.innerHTML !== html) slot.innerHTML = html;
  }
  updateCount();
}
function updateCount() {
  const unrev = filtered.filter((a) => !reviewed(a.sku)).length;
  $("count").textContent = `${filtered.length} match · ${unrev} unreviewed`;
  const total = data.filter((a) => !reviewed(a.sku)).length;
  $("queue").textContent = `${data.length - total} / ${data.length} reviewed`;
}
function renderList() {
  filtered = data.filter(matches);
  $("assets").replaceChildren(...filtered.map((a) => { const b = button(a); b.classList.toggle("active", a.sku === selected); return b; }));
  refreshBadges();
  $("done").hidden = filtered.length > 0 || !!selected;
}
function onFilter() {
  if (F.score.value && F.score.value !== "masking" && F.status.value === "unreviewed") F.status.value = "all";
  saveFilters();
  renderList();
  if (!selected || !filtered.some((a) => a.sku === selected)) {
    const first = filtered.find((a) => !reviewed(a.sku)) || filtered[0];
    if (first) go(first.sku, { noHistory: !selected }); else showDone();
  }
}
let nameTimer = null;
for (const el of Object.values(F)) {
  if (el.tagName === "SELECT") el.addEventListener("change", onFilter);
  else el.addEventListener("input", () => { clearTimeout(nameTimer); nameTimer = setTimeout(onFilter, 120); });
}
$("f-clear").addEventListener("click", clearFilters);
function clearFilters() {
  F.name.value = ""; F.status.value = "unreviewed"; F.score.value = ""; F.role.value = ""; F.theme.value = ""; F.date.value = ""; if (F.batch) F.batch.value = "";
  onFilter();
}

// ---------------------------------------------------------------- 3D: one renderer, three scissor viewports
const canvas = $("gl");
const viewsEl = $("views");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.9;
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(2, 4, 3);
scene.add(sun, new THREE.HemisphereLight(0xfff4e0, 0x30302a, 0.5));
const BG = new THREE.Color(0x292d28);

// axis = world rotation axis; each view turns about a different one, so between them every face shows up.
const VIEWS = [
  { name: "front", cam: [0, 0, 1], up: [0, 1, 0], axis: [0, 1, 0], sign: 1 },   // turntable
  { name: "top", cam: [0, 1, 0], up: [0, 0, -1], axis: [1, 0, 0], sign: 1 },    // end over end
  { name: "side", cam: [1, 0, 0], up: [0, 1, 0], axis: [0, 0, 1], sign: -1 },   // roll
].map((v, i) => {
  const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 50);
  camera.up.set(...v.up);
  const pivot = new THREE.Group();
  pivot.visible = false;
  scene.add(pivot);
  return { ...v, i, camera, pivot, axisV: new THREE.Vector3(...v.axis), el: viewsEl.querySelector(`.view[data-view="${i}"]`), drag: null };
});
const FIT = 1.08; // margin around the unit bounding sphere

function placeCameras(v, aspect) {
  const vf = THREE.MathUtils.degToRad(v.camera.fov);
  const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
  const d = FIT / Math.sin(Math.min(vf, hf) / 2);
  v.camera.aspect = aspect;
  v.camera.position.set(...v.cam).multiplyScalar(d);
  v.camera.near = d - 1.5; v.camera.far = d + 1.5;
  v.camera.lookAt(0, 0, 0);
  v.camera.updateProjectionMatrix();
}

let paused = false;
const tmpQ = new THREE.Quaternion();
let lastT = performance.now();
let frames = 0;
const VP = {};
function frame(t) {
  const dt = Math.min(0.5, (t - lastT) / 1000);
  lastT = t;
  const wr = viewsEl.getBoundingClientRect();
  const W = Math.round(wr.width), H = Math.round(wr.height);
  const size = renderer.getSize(new THREE.Vector2());
  if (size.x !== W || size.y !== H) renderer.setSize(W, H, false);
  VP.canvas = [W, H];
  renderer.setScissorTest(false);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.setScissorTest(true);
  for (const v of VIEWS) {
    const r = v.el.getBoundingClientRect();
    const x = r.left - wr.left, y = wr.bottom - r.bottom, w = r.width, h = r.height;
    if (w < 2 || h < 2) continue;
    if (!paused && !v.drag) v.spun = (v.spun || 0) + dt;
    if (!paused && !v.drag) v.pivot.quaternion.premultiply(tmpQ.setFromAxisAngle(v.axisV, v.sign * OMEGA * dt));
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.setClearColor(BG, 1);
    renderer.clear();
    placeCameras(v, w / h);
    VP[v.name] = [Math.round(w), Math.round(h), +v.camera.aspect.toFixed(3)];
    for (const u of VIEWS) u.pivot.visible = u === v && v.pivot.children.length > 0;
    renderer.render(scene, v.camera);
  }
  frames += 1;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// drag to turn (per view), double-click to reset
const right = new THREE.Vector3(), upV = new THREE.Vector3();
for (const v of VIEWS) {
  v.el.addEventListener("pointerdown", (e) => { v.drag = { x: e.clientX, y: e.clientY }; v.el.setPointerCapture(e.pointerId); });
  v.el.addEventListener("pointermove", (e) => {
    if (!v.drag) return;
    const dx = e.clientX - v.drag.x, dy = e.clientY - v.drag.y;
    v.drag = { x: e.clientX, y: e.clientY };
    const k = 0.01;
    right.setFromMatrixColumn(v.camera.matrixWorld, 0);
    upV.setFromMatrixColumn(v.camera.matrixWorld, 1);
    v.pivot.quaternion.premultiply(tmpQ.setFromAxisAngle(upV, dx * k));
    v.pivot.quaternion.premultiply(tmpQ.setFromAxisAngle(right, dy * k));
  });
  const end = () => { v.drag = null; };
  v.el.addEventListener("pointerup", end);
  v.el.addEventListener("pointercancel", end);
  v.el.addEventListener("dblclick", () => v.pivot.quaternion.identity());
}
function resetViews() { for (const v of VIEWS) v.pivot.quaternion.identity(); }

// ---------------------------------------------------------------- model cache + preload
const loader = new GLTFLoader();
const cache = new Map(); // sku -> Promise<{root, tris}>
// an asset may name its own files (review-lib: `model` is the shipping mesh in the deployed tuner, so nothing is copied;
// `plate` false = this piece never had a source plate)
const NO_PLATE = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#3a3f38"/><text x="60" y="64" font-size="11" fill="#9aa093" text-anchor="middle" font-family="monospace">no source plate</text></svg>');
const url = (kind, asset, ext) => {
  if (kind === "plates" && asset.plate === false) return NO_PLATE;
  const own = kind === "models" ? asset.model : asset.plate;
  return `${own || `assets/${kind}/${asset.sku}.${ext}`}?v=${asset.bytes}`;
};
const bySku = new Map();

function prepare(gltf) {
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const r = sphere.radius || 1;
  const norm = new THREE.Group();
  root.position.sub(sphere.center);
  norm.add(root);
  norm.scale.setScalar(1 / r);
  let tris = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    for (const m of [].concat(o.material)) for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"]) if (m[k]) renderer.initTexture(m[k]);
  });
  const size = box.getSize(new THREE.Vector3());
  return { norm, tris: Math.round(tris), size };
}
function load(sku) {
  if (!cache.has(sku)) {
    const asset = bySku.get(sku);
    cache.set(sku, loader.loadAsync(url("models", asset, "glb")).then(prepare));
    const img = new Image(); img.src = url("plates", asset, "jpg");
  }
  return cache.get(sku);
}
function dispose(entry) {
  entry.then(({ norm }) => norm.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const m of [].concat(o.material)) { for (const k in m) if (m[k]?.isTexture) m[k].dispose(); m.dispose(); }
  })).catch(() => {});
}
function prune(keep) {
  for (const sku of [...cache.keys()]) if (!keep.has(sku)) { dispose(cache.get(sku)); cache.delete(sku); }
}
function upcoming(fromSku, n) {
  const list = filtered.length ? filtered : data;
  const i = list.findIndex((a) => a.sku === fromSku);
  const out = [];
  for (let k = 1; out.length < n && k < list.length; k += 1) {
    const a = list[(i + k + list.length) % list.length];
    if (a.sku !== fromSku && !reviewed(a.sku)) out.push(a.sku);
  }
  for (let k = 1; out.length < n && k < list.length; k += 1) { // fall back to reviewed ones in a reviewed-only view
    const a = list[(i + k + list.length) % list.length];
    if (a.sku !== fromSku && !out.includes(a.sku)) out.push(a.sku);
  }
  return out;
}

// ---------------------------------------------------------------- selection
let showToken = 0;
async function show(sku) {
  const asset = bySku.get(sku);
  const token = ++showToken;
  selected = sku;
  $("done").hidden = true;
  const m = META.assets[sku] || {};
  $("plate").src = url("plates", asset, "jpg");
  $("plate").alt = `${asset.name} concept plate`;
  $("sku").textContent = asset.sku;
  $("name").textContent = asset.name;
  const names = META.settings || {};
  $("role").textContent = `${m.domain || "?"} › ${m.role || "?"} · ${(m.themes || []).map((t) => (t === "ANY" ? "universal" : names[t] || t)).join(", ")}`;
  $("meta").textContent = `${asset.run ? `${asset.run} · ` : ""}${asset.priority} · ${asset.material} · ${asset.placement} · ${(asset.bytes / 1048576).toFixed(1)} MB · generated ${(m.gen || "?").replace("T", " ").slice(0, 16)}`;
  $("hint").textContent = asset.hint || asset.rooms;
  $("download").href = url("models", asset, "glb");
  for (const box of $("ratings").querySelectorAll(".rate")) { saveNote(box); box.dataset.sku = sku; delete box.querySelector("textarea").dataset.dirty; }
  paintRatings();
  for (const b of $("assets").querySelectorAll("button.active")) b.classList.remove("active");
  const btn = buttons.get(sku);
  if (btn) { btn.classList.add("active"); btn.scrollIntoView({ block: "nearest" }); }
  const next = upcoming(sku, PRELOAD);
  prune(new Set([sku, ...next, history[history.length - 1]].filter(Boolean)));
  const entry = load(sku);
  let ready = false;
  entry.then(() => { ready = true; });
  await Promise.resolve();
  if (!ready) $("loading").hidden = false;
  let model;
  try {
    model = await entry;
  } catch (e) {
    if (token === showToken) { $("loading").hidden = true; toast(`Model failed to load: ${e.message || e}`, true); }
    return;
  }
  if (token !== showToken) return;
  $("loading").hidden = true;
  $("meta").textContent += ` · ${model.tris.toLocaleString()} tris`;
  for (const v of VIEWS) {
    v.pivot.clear();
    v.pivot.quaternion.identity();
    v.pivot.add(v.i === 0 ? model.norm : model.norm.clone());
  }
  window.__tw = { sku, loadedAt: performance.now() };
  for (const s of next) load(s); // preload in the background
}

function go(sku, { noHistory = false } = {}) {
  if (!sku || sku === selected) return;
  if (selected && !noHistory) history.push(selected);
  if (history.length > 200) history.shift();
  void show(sku);
}
function nextAfter(sku) {
  const list = filtered;
  const i = list.findIndex((a) => a.sku === sku);
  for (let k = 1; k <= list.length; k += 1) {
    const a = list[(i + k + list.length) % list.length];
    if (a.sku !== sku) return a.sku;
  }
  return null;
}
function advance() {
  const n = nextAfter(selected);
  renderList();
  if (n) go(n); else showDone();
}
function back() {
  const prev = history.pop();
  if (prev) void show(prev);
}
function showDone() {
  if (selected) history.push(selected);
  selected = null;
  for (const v of VIEWS) v.pivot.clear();
  $("done").hidden = false;
  $("name").textContent = "Queue empty";
}

function score(n) {
  if (!selected) return;
  window.__twKeyAt = performance.now();
  const sku = selected;
  const key = rkey(sku, "model");
  const prev = RATINGS[key] ? { ...RATINGS[key] } : null;
  const note = $("ratings").querySelector('.rate[data-target="model"] textarea');
  const nextSku = nextAfter(sku); // decide before the rated one leaves an "unreviewed" list
  void rate(sku, "model", { stars: n, note: note ? note.value : prev?.note || "" });
  lastScore = { sku, prev };
  toast(`${bySku.get(sku).name}: ${n} — ${SCALE[n]}`);
  renderList();
  if (nextSku && nextSku !== sku) go(nextSku); else showDone();
}
function undo() {
  if (!lastScore) { toast("Nothing to undo"); return; }
  const { sku, prev } = lastScore;
  lastScore = null;
  void rate(sku, "model", prev ? { stars: prev.stars, note: prev.note, tags: prev.tags } : { stars: null });
  renderList();
  if (history[history.length - 1] === sku) history.pop();
  void show(sku);
  toast(`Undid score on ${bySku.get(sku).name}`);
}

// ---------------------------------------------------------------- keys
const isEditable = (el) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el?.isContentEditable;
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const t = e.target;
  if (isEditable(t)) {
    if (e.key === "Escape") { t.blur(); e.preventDefault(); }
    else if (e.key === "Enter" && !e.shiftKey && (t.tagName === "TEXTAREA" || t === F.name)) { t.blur(); e.preventDefault(); }
    return;
  }
  const digit = e.code.match(/^(?:Digit|Numpad)([0-5])$/);
  if (digit && !e.shiftKey) { e.preventDefault(); score(Number(digit[1])); return; }
  const k = e.key;
  const act = {
    m: () => selected && toggleMasking(),
    n: () => $("ratings").querySelector('.rate[data-target="model"] textarea')?.focus(),
    u: undo, Backspace: undo,
    j: advance, ArrowRight: advance,
    k: back, ArrowLeft: back,
    " ": () => { paused = !paused; toast(paused ? "Spin paused" : "Spin on"); },
    r: () => resetViews(),
    "/": () => F.name.focus(),
    "?": () => $("legend").classList.toggle("collapsed"),
    C: clearFilters,
  }[k.length === 1 && k !== "C" ? k.toLowerCase() : k];
  if (k === "Tab") { e.preventDefault(); if (e.shiftKey) back(); else advance(); return; }
  if (act) { e.preventDefault(); act(); }
});

// ---------------------------------------------------------------- boot
$("ratings").append(ratingBox("model", "3D model"), ratingBox("plate", "Concept image"));
Promise.all([
  fetch("assets.json", { cache: "no-cache" }).then((r) => r.json()),
  fetch("meta.json", { cache: "no-cache" }).then((r) => r.json()).catch(() => ({ assets: {}, settings: {} })),
  fetch(RATE_API, { cache: "no-store" }).then((r) => r.json()).catch(() => { toast("Ratings server unreachable — scores won't save", true); return {}; }),
]).then(([payload, meta, ratings]) => {
  RATINGS = ratings;
  META = meta;
  if (!RUN_QS && /^[a-z0-9][a-z0-9.-]{1,40}$/.test(payload.run || "")) RUN = payload.run;
  const label = payload.label || RUN.replace(/^inn-/, "Inn-");
  if ($("runlabel")) $("runlabel").textContent = label;
  document.title = `${label} Review — Turnip Works`;
  data = payload.assets;
  for (const a of data) bySku.set(a.sku, a);
  buildFilterOptions();
  renderList();
  const first = filtered.find((a) => !reviewed(a.sku)) || filtered[0];
  if (first) go(first.sku, { noHistory: true }); else showDone();
}).catch((error) => { $("count").textContent = `Could not load review: ${error}`; });

window.__twDebug = { VIEWS, VP, reviewed: () => data.filter((a) => reviewed(a.sku)).length, get frames() { return frames; }, get selected() { return selected; }, get filtered() { return filtered.map((a) => a.sku); }, cache, RATINGS: () => RATINGS };
