// THE OPERATOR'S BANNER (2026-10-19; docs/NETCODE.md "Two servers"). Before the nightly release roll restarts the
// prod relay, tools/release.sh asks the relay to tell every seat: "Server updating at 3:30, back in a minute".
// The relay sends { t: 'notice', id, text, at, until } (also to a seat that joins while it stands). The banner stays
// until `until`, or until the table is live again after `at` (the restart it warned of has happened), or until its
// × is pressed. { t: 'notice', clear: true } takes it down. Never in the way: a slim pill low in the middle, just above
// where the "reconnecting" pill appears (index.html #twl.pill), clear of the command bar at the top; no clicks through
// it except the ×.
let el = null, cur = null, timer = null;

function hide() {
  cur = null;
  clearTimeout(timer); timer = null;
  if (el) { el.hidden = true; el.style.display = 'none'; } // (the inline display:flex would beat [hidden])
}

function build() {
  el = document.createElement('div');
  el.id = 'tw-notice';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom, 0px) + 150px);left:50%;transform:translateX(-50%);z-index:990;'
    + 'display:flex;align-items:center;gap:10px;max-width:calc(100% - 24px);padding:7px 8px 7px 14px;border-radius:999px;'
    + 'background:#4a4136;color:#f6ead2;font:600 14px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;'
    + 'box-shadow:0 6px 20px rgba(0,0,0,.4),0 0 0 1px rgba(224,176,74,.55);pointer-events:none;';
  const dot = document.createElement('span');
  dot.style.cssText = 'flex:none;width:8px;height:8px;border-radius:50%;background:#e0b04a;';
  const text = document.createElement('span');
  text.className = 'tw-notice-text';
  const x = document.createElement('button');
  x.type = 'button';
  x.textContent = '×';
  x.setAttribute('aria-label', 'Hide this notice');
  x.style.cssText = 'flex:none;pointer-events:auto;cursor:pointer;border:0;border-radius:50%;width:26px;height:26px;'
    + 'background:transparent;color:inherit;font:inherit;font-size:18px;line-height:1;';
  x.addEventListener('click', hide);
  el.append(dot, text, x);
  document.body.append(el);
}

export function showNotice(m) {
  if (!m || m.clear) return hide();
  if (Date.now() >= m.until) return;
  cur = { id: m.id, text: String(m.text || ''), at: m.at, until: m.until };
  if (!el) build();
  el.querySelector('.tw-notice-text').textContent = cur.text;
  el.dataset.id = cur.id || '';
  el.hidden = false; el.style.display = 'flex';
  clearTimeout(timer);
  timer = setTimeout(hide, Math.max(0, cur.until - Date.now()));
}

// the connection is live again: a notice whose moment has passed has done its job
export function noticeLive() { if (cur && Date.now() >= cur.at) hide(); }

export function currentNotice() { return cur ? { ...cur } : null; }
