const V = Date.now();
let data = [];
let selected = null;
// ---- Ratings (Harry's 0-5 scale), stored server-side for Fauna: reviews/latest.json ----
const RATE_API = "/api/tw-ratings/ratings";
const RUN = "inn-01b";
const SCALE = ["What happened? Engine break", "Bad", "Not quite usable", "Barely acceptable — go with it", "Good", "Great"];
let RATINGS = {};
const rkey = (sku, target) => `${RUN}/${sku}/${target}`;

function ratingWidget(key, label, target) {
  const box = document.createElement("div");
  box.className = "rate";
  box.dataset.key = key;
  box.dataset.target = target;
  const cur = RATINGS[key] || {};
  let stars = Number.isInteger(cur.stars) ? cur.stars : null;
  const tags = new Set(cur.tags || []);
  let revision = 0;
  let savedRevision = 0;
  let inFlight = null;
  box.innerHTML = `<p class="rate-label">${label}</p>
    <div class="rate-stars" role="group" aria-label="${label} rating">${SCALE.map((m, i) =>
      `<button type="button" data-stars="${i}" title="${i} — ${m}" aria-pressed="false">${i}</button>`).join("")}</div>
    <p class="rate-meaning"></p>
    <textarea rows="2" placeholder="Note (optional)" aria-label="${label} note"></textarea>
    <div class="rate-foot"><button type="button" class="rate-save">Save note</button>
      <button type="button" class="rate-tag" data-tag="masking" aria-pressed="false">Masking problem</button>
      <span class="rate-status" aria-live="polite"></span></div>`;
  const note = box.querySelector("textarea");
  const status = box.querySelector(".rate-status");
  note.value = cur.note || "";
  const markDirty = () => {
    revision += 1;
    status.textContent = "Unsaved";
  };
  const paint = () => {
    box.querySelectorAll(".rate-stars button").forEach((b) => {
      const on = Number(b.dataset.stars) === stars;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    const mask = box.querySelector(".rate-tag");
    mask.classList.toggle("active", tags.has("masking"));
    mask.setAttribute("aria-pressed", String(tags.has("masking")));
    box.querySelector(".rate-meaning").textContent = (stars === null ? "Not rated yet" : `${stars} — ${SCALE[stars]}`)
      + (tags.has("masking") ? " · masking problem" : "");
    box.dataset.rated = stars === null ? "" : String(stars);
  };
  const save = () => {
    if (inFlight) return inFlight.then((ok) => ok ? save() : false);
    if (revision === savedRevision) return Promise.resolve(true);
    const savingRevision = revision;
    const payload = { key, stars, note: note.value, tags: [...tags] };
    status.textContent = "Saving…";
    inFlight = fetch(RATE_API, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload) })
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok || !d.ok) throw new Error(d.err || res.status);
        RATINGS[key] = d.record;
        savedRevision = savingRevision;
        status.textContent = revision === savedRevision ? "Saved" : "Unsaved";
        renderList();
        return true;
      })
      .catch((e) => {
        status.textContent = `Not saved: ${e.message}`;
        return false;
      })
      .finally(() => { inFlight = null; });
    return inFlight;
  };
  const setStars = (value) => {
    stars = value;
    markDirty();
    paint();
    return save();
  };
  box.querySelectorAll(".rate-stars button").forEach((b) => b.addEventListener("click", () => { void setStars(Number(b.dataset.stars)); }));
  box.querySelector(".rate-tag").addEventListener("click", () => {
    if (tags.has("masking")) tags.delete("masking"); else tags.add("masking");
    markDirty();
    paint();
    void save();
  });
  box.querySelector(".rate-save").addEventListener("click", () => { void save(); });
  note.addEventListener("input", markDirty);
  box._saveRating = save;
  box._setStars = setStars;
  paint();
  return box;
}

function badge(sku) {
  const recs = [RATINGS[rkey(sku, "plate")], RATINGS[rkey(sku, "model")]].filter(Boolean);
  if (!recs.length) return "";
  const stars = recs.map((r) => r.stars).filter(Number.isInteger);
  const low = stars.length ? Math.min(...stars) : null;
  const mask = recs.some((r) => (r.tags || []).includes("masking"));
  return `<b class="badge b${low ?? 3}">${low === null ? "" : `${low}★`}${mask ? " M" : ""}</b>`;
}
const $ = (id) => document.getElementById(id);
const url = (kind, sku, ext) => `${kind}/${sku}.${ext}?v=${V}`;

function select(asset) {
  selected = asset.sku;
  $("plate").src = url("plates", asset.sku, "jpg");
  $("plate").alt = `${asset.name} concept plate`;
  $("sku").textContent = asset.sku;
  $("name").textContent = asset.name;
  $("meta").textContent = `${asset.priority} · ${asset.material} · ${asset.placement}`;
  $("hint").textContent = asset.hint || asset.rooms;
  $("screen").textContent = [asset.screen && `Vision screen flagged: ${asset.screen}`, asset.why && `Remeshed because: ${asset.why}`].filter(Boolean).join(" · ");
  $("model-fig").hidden = !asset.model;
  if (asset.model) $("model").src = url("models", asset.sku, "glb"); else $("model").removeAttribute("src");
  $("ratings").replaceChildren(
    ...(asset.model ? [ratingWidget(rkey(asset.sku, "model"), "3D model", "model")] : []),
    ratingWidget(rkey(asset.sku, "plate"), "Concept image", "plate"),
  );
  renderList();
  requestAnimationFrame(() => $("assets").querySelector("button.active")?.scrollIntoView({ block: "nearest" }));
}

async function saveCurrent() {
  const boxes = [...$("ratings").querySelectorAll(".rate")];
  if (!boxes.length) return true;
  const results = await Promise.all(boxes.map((box) => box._saveRating()));
  return results.every(Boolean);
}

let navigating = false;
async function navigateTo(asset) {
  if (!asset || navigating || asset.sku === selected) return;
  navigating = true;
  try {
    if (await saveCurrent()) select(asset);
  } finally {
    navigating = false;
  }
}

async function nextAsset() {
  const index = data.findIndex((asset) => asset.sku === selected);
  await navigateTo(data[(index + 1 + data.length) % data.length]);
}

function renderList() {
  const query = $("search").value.trim().toLowerCase();
  const filtered = data.filter((a) => `${a.sku} ${a.name} ${a.material} ${a.rooms} ${a.model ? "has:3d" : ""}`.toLowerCase().includes(query));
  $("assets").replaceChildren(...filtered.map((asset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = asset.sku === selected ? "active" : "";
    button.innerHTML = `<img src="${url("plates", asset.sku, "jpg")}" alt="" loading="lazy">${badge(asset.sku)}<span><strong>${asset.name}</strong><small>${asset.sku}</small></span>`;
    button.addEventListener("click", () => { void navigateTo(asset); });
    return button;
  }));
}

Promise.all([fetch(`assets.json?v=${V}`).then((r) => r.json()),
  fetch(RATE_API, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}))]).then(([payload, ratings]) => {
  RATINGS = ratings;
  data = payload.assets;
  $("count").textContent = `${payload.complete} rerolled plates · ${payload.models} new meshes`;
  renderList();
  if (data.length) select(data[0]);
}).catch((error) => { $("count").textContent = `${payload.complete} rerolled plates · ${payload.models} new meshes`; });

$("search").addEventListener("input", renderList);

function isEditable(element) {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement || element?.isContentEditable;
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Tab" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
    event.preventDefault();
    void nextAsset();
    return;
  }
  if (isEditable(event.target) || event.ctrlKey || event.altKey || event.metaKey) return;

  const scoreMatch = event.code.match(/^(?:Digit|Numpad)([1-5])$/);
  if (scoreMatch) {
    event.preventDefault();
    const hasModel = !!$("ratings").querySelector('.rate[data-target="model"]');
    const target = event.shiftKey || !hasModel ? "plate" : "model";
    const box = $("ratings").querySelector(`.rate[data-target="${target}"]`);
    if (box) void box._setStars(Number(scoreMatch[1]));
    return;
  }

  if (event.key.length === 1) {
    const note = ($("ratings").querySelector('.rate[data-target="model"] textarea') || $("ratings").querySelector('.rate[data-target="plate"] textarea'));
    if (!note) return;
    event.preventDefault();
    note.focus();
    note.setRangeText(event.key, note.selectionStart, note.selectionEnd, "end");
    note.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
