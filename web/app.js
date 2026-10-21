// Asset bench: canary cards plus a face × texture downsample ladder.
// Every URL carries the build version (cache-skew lesson, 2026-09-29).
const V = "20260930-14";
const RUN = "canary/2026-09-30-inn";
const NAMES = { "chair-plain": "Plain chair", barrel: "Barrel", tankard: "Tankard", "turnip-pile": "Turnip pile" };
const TEX = [2048, 1024, 512, 256, 128, 64];
const FACE_STEPS = [0, 1, 2, 3, 4, 5]; // full, ¼, 5k (default stop), 1/16, 1/64, floor
const FACE_LABEL = ["full", "¼", "5k", "1/16", "1/64", "floor"];
const u = (p) => `${RUN}/${p}?v=${V}`;
const kb = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

// ---- Ratings: Harry's 0-5 review scale, stored server-side so Fauna can read it (reviews/latest.json) ----
const RATE_API = "/api/tw-ratings/ratings";
const RATE_RUN = "inn-01-canary";
const SCALE = ["What happened? Engine break", "Bad", "Not quite usable", "Barely acceptable — go with it", "Good", "Great"];
let RATINGS = {};

function rateKey(...parts) { return [RATE_RUN, ...parts].join("/"); }

function ratingWidget(key, label) {
  const box = document.createElement("div");
  box.className = "rate";
  box.dataset.key = key;
  const cur = RATINGS[key] || {};
  box.innerHTML = `
    <p class="rate-label">${label}</p>
    <div class="rate-stars" role="group" aria-label="${label} rating">
      ${SCALE.map((m, i) => `<button type="button" data-stars="${i}" title="${i} — ${m}" aria-pressed="false">${i}</button>`).join("")}
    </div>
    <p class="rate-meaning"></p>
    <textarea rows="2" placeholder="Note (optional)" aria-label="${label} note"></textarea>
    <div class="rate-foot"><button type="button" class="rate-save">Save note</button><button type="button" class="rate-tag" data-tag="masking" aria-pressed="false">Masking problem</button><span class="rate-status" aria-live="polite"></span></div>`;
  const note = box.querySelector("textarea");
  const status = box.querySelector(".rate-status");
  let stars = Number.isInteger(cur.stars) ? cur.stars : null;
  const tags = new Set(cur.tags || []);
  note.value = cur.note || "";
  const paint = () => {
    box.querySelectorAll(".rate-stars button").forEach((b) => {
      const on = Number(b.dataset.stars) === stars;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    box.querySelectorAll(".rate-tag").forEach((b) => {
      const on = tags.has(b.dataset.tag);
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    box.querySelector(".rate-meaning").textContent = (stars === null ? "Not rated yet" : `${stars} — ${SCALE[stars]}`)
      + (tags.has("masking") ? " · masking problem" : "");
    box.dataset.rated = stars === null ? "" : String(stars);
  };
  const save = async () => {
    status.textContent = "Saving…";
    try {
      const r = await fetch(RATE_API, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, stars, note: note.value, tags: [...tags] }) });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.err || r.status);
      RATINGS[key] = d.record;
      status.textContent = "Saved";
      document.dispatchEvent(new CustomEvent("rated", { detail: key }));
    } catch (e) {
      status.textContent = `Not saved: ${e.message}`;
    }
  };
  box.querySelectorAll(".rate-stars button").forEach((b) => b.addEventListener("click", () => {
    stars = Number(b.dataset.stars);
    paint();
    save();
  }));
  box.querySelector(".rate-save").addEventListener("click", save);
  box.querySelectorAll(".rate-tag").forEach((b) => b.addEventListener("click", () => {
    if (tags.has(b.dataset.tag)) tags.delete(b.dataset.tag); else tags.add(b.dataset.tag);
    paint();
    save();
  }));
  note.addEventListener("input", () => { status.textContent = "Unsaved note"; });
  paint();
  return box;
}

function card(a) {
  const el = document.createElement("article");
  el.className = "asset";
  el.innerHTML = `
    <div class="plate"><img src="${u(`plates/${a.id}.jpg`)}" alt="${a.name} concept plate" loading="lazy"></div>
    <div class="model">
      <model-viewer src="${u(`models/${a.id}.glb`)}" poster="${u(`renders/${a.id}-front.jpg`)}"
        alt="${a.name} 3D model" camera-controls touch-action="pan-y" loading="lazy" reveal="auto"
        shadow-intensity="0.8" exposure="1.05" environment-image="neutral" camera-orbit="-35deg 70deg auto"></model-viewer>
      <div class="info">
        <h3>${a.name}</h3>
        <p class="meta"><strong>Usable at table scale.</strong> ${a.tris.toLocaleString()} tris · ${a.seconds.toFixed(0)} s on fal<br>
          Close-up note: ${a.closeup}</p>
        <p class="meta"><a href="${u(`models/${a.id}.glb`)}" download>Download GLB</a></p>
      </div>
    </div>`;
  const info = el.querySelector(".info");
  const rates = document.createElement("div");
  rates.className = "rate-pair";
  rates.append(ratingWidget(rateKey(a.id, "plate"), "Concept image"), ratingWidget(rateKey(a.id, "model"), "3D model (source)"));
  info.appendChild(rates);
  return el;
}

// Default = the shipping tier (Harry 2026-09-30): ~5k faces, 256px, single colour map.
const state = { asset: "chair-plain", face: 2, tex: 256, far: false, pbr: false };
const file = (r) => (state.pbr ? r.id : `${r.id}-bc`);
const size = (r) => (state.pbr ? r.bytes : r.bytes_bc);
let ladder = {};

function row(asset, face, tex) {
  return ladder[asset].find((r) => r.face_step === face && r.texture === tex);
}

function buttons(host, items, key) {
  host.innerHTML = "";
  for (const [value, label] of items) {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = label;
    b.dataset.value = value;
    b.addEventListener("click", () => {
      state[key] = typeof state[key] === "number" ? Number(value) : value;
      render();
    });
    host.appendChild(b);
  }
}

function mark(host, value) {
  host.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.value === String(value)));
}

function render() {
  const src = row(state.asset, 0, 2048);
  const sel = row(state.asset, state.face, state.tex);
  const mvSrc = document.getElementById("mv-src");
  const mvSel = document.getElementById("mv-sel");
  const srcUrl = u(`ladder/${state.asset}/${src.id}.glb`);
  const selUrl = u(`ladder/${state.asset}/${file(sel)}.glb`);
  if (mvSrc.getAttribute("src") !== srcUrl) mvSrc.setAttribute("src", srcUrl);
  if (mvSel.getAttribute("src") !== selUrl) mvSel.setAttribute("src", selUrl);
  const orbit = `-35deg 70deg ${state.far ? "420%" : "auto"}`;
  mvSrc.cameraOrbit = orbit;
  mvSel.cameraOrbit = orbit;
  document.getElementById("ladder-src-label").textContent = `${src.faces.toLocaleString()} faces · ${src.texture}px · 2 maps · ${kb(src.bytes)}`;
  document.getElementById("ladder-sel-label").textContent = `${sel.faces.toLocaleString()} faces · ${sel.texture}px · ${state.pbr ? "2 maps" : "1 map"} · ${kb(size(sel))}`;
  const slot = document.getElementById("ladder-rate");
  const lkey = rateKey(state.asset, file(sel));
  if (slot.dataset.key !== lkey) {
    slot.dataset.key = lkey;
    slot.replaceChildren(ratingWidget(lkey, `Selected variant · ${NAMES[state.asset]} · ${sel.faces.toLocaleString()} faces · ${sel.texture}px · ${state.pbr ? "2 maps" : "1 map"}`));
  }
  document.getElementById("ladder-reduction").textContent =
    `${(src.bytes / size(sel)).toFixed(1)}× smaller file · ${(src.faces / sel.faces).toFixed(0)}× fewer faces`;

  buttons(document.getElementById("ladder-faces"),
    FACE_STEPS.map((s) => [s, `${FACE_LABEL[s]}<small>${row(state.asset, s, 2048).faces.toLocaleString()}</small>`]), "face");
  mark(document.getElementById("ladder-assets"), state.asset);
  mark(document.getElementById("ladder-faces"), state.face);
  mark(document.getElementById("ladder-tex"), state.tex);
  const dist = document.getElementById("ladder-distance");
  dist.classList.toggle("active", state.far);
  dist.setAttribute("aria-pressed", String(state.far));
  const pbr = document.getElementById("ladder-pbr");
  pbr.classList.toggle("active", state.pbr);
  pbr.setAttribute("aria-pressed", String(state.pbr));

  const m = document.getElementById("ladder-matrix");
  m.innerHTML = `<div class="hdr">faces ↓ / tex →</div>` +
    TEX.map((t) => `<div class="hdr">${t}px</div>`).join("");
  for (const s of FACE_STEPS) {
    m.insertAdjacentHTML("beforeend", `<div class="hdr">${FACE_LABEL[s]}<br>${row(state.asset, s, 2048).faces.toLocaleString()}</div>`);
    TEX.forEach((t) => {
      const r = row(state.asset, s, t);
      const b = document.createElement("button");
      b.type = "button";
      b.classList.toggle("active", s === state.face && t === state.tex);
      b.innerHTML = `<img src="${u(`ladder/${state.asset}/${r.id}.jpg`)}" alt="${NAMES[state.asset]} at ${r.faces} faces, ${t}px" loading="lazy"><span>${kb(size(r))}${badge(rateKey(state.asset, file(r)))}</span>`;
      b.addEventListener("click", () => {
        state.face = s;
        state.tex = t;
        render();
        document.querySelector(".compare-stage").scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      m.appendChild(b);
    });
  }
}

function syncCameras() {
  const a = document.getElementById("mv-src");
  const b = document.getElementById("mv-sel");
  let lock = false;
  const link = (from, to) => from.addEventListener("camera-change", (e) => {
    if (lock || e.detail.source !== "user-interaction") return;
    lock = true;
    const o = from.getCameraOrbit();
    to.cameraOrbit = `${o.theta}rad ${o.phi}rad ${o.radius}m`;
    to.cameraTarget = from.getCameraTarget().toString();
    to.fieldOfView = `${from.getFieldOfView()}deg`;
    to.jumpCameraToGoal();
    lock = false;
  });
  link(a, b);
  link(b, a);
}

function badge(key) {
  const r = RATINGS[key];
  if (!r) return "";
  const s = Number.isInteger(r.stars) ? ` · <b class="rated rated-${r.stars}">${r.stars}★</b>` : "";
  return s + ((r.tags || []).includes("masking") ? ` · <b class="rated rated-1">M</b>` : "");
}

function scaleTable(rows) {
  const fmt = (v) => v.map((x) => `${x}`).join(" × ");
  const range = (r) => (r[0] === 0.9 && r[1] === 1.1 ? "fixed" : `${r[0]}–${r[1]}×`);
  document.getElementById("scale-table").innerHTML = `<div class="scale-wrap"><table>
    <thead><tr><th>Object</th><th>Catalog W × D × H (in)</th><th>Scale range</th><th>Mesh after scaling (in)</th><th>Stoutness</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${NAMES[r.id]}</td><td>${fmt(r.catalog_in)}</td><td>${range(r.scale_range)}</td>
      <td>${fmt(r.mesh_in_after_scaling)}</td><td>${r.footprint_ratio_mesh_vs_catalog}×</td></tr>`).join("")}</tbody></table></div>`;
}

Promise.all([fetch(u("canary.json")).then((r) => r.json()), fetch(u("ladder/ladder.json")).then((r) => r.json()),
  fetch(u("scale-lineup.json")).then((r) => r.json()),
  fetch(RATE_API, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}))])
  .then(([assets, lad, lineup, ratings]) => {
    RATINGS = ratings;
    scaleTable(lineup);
    document.getElementById("scale-rate").appendChild(ratingWidget(rateKey("lineup", "true-scale"), "True-scale lineup"));
    document.addEventListener("rated", (e) => { if (e.detail.includes("/f")) render(); });
    const bench = document.getElementById("bench");
    assets.forEach((a) => bench.appendChild(card(a)));
    ladder = lad;
    buttons(document.getElementById("ladder-assets"), Object.entries(NAMES), "asset");
    buttons(document.getElementById("ladder-tex"), TEX.map((t) => [t, `${t}px`]), "tex");
    document.getElementById("ladder-distance").addEventListener("click", () => { state.far = !state.far; render(); });
    document.getElementById("ladder-pbr").addEventListener("click", () => { state.pbr = !state.pbr; render(); });
    syncCameras();
    render();
  })
  .catch((e) => {
    document.getElementById("bench").textContent = `Could not load bench data: ${e}`;
  });
