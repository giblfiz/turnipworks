// "THE GM DISCONNECTED YOU" (2026-10-28; docs/NETCODE.md "Disconnect"). The relay sent { t: 'kicked', by } and closed
// this connection; ClientSync stops reconnecting (status 'kicked'). This card says so, says it is not a ban, and
// Rejoin opens a fresh connection on the same link (sync.rejoin(): it resubscribes and catches up like a reconnect).
// The table behind it stays as it was, dimmed: nothing done now would reach anyone.
let el = null;

export function showKicked(by, rejoin) {
  if (!el) {
    el = document.createElement('div');
    el.id = 'twKicked';
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-labelledby', 'twKickedT');
    el.style.cssText = 'position:fixed;inset:0;z-index:995;display:grid;place-items:center;background:rgba(10,10,10,.55);'
      + 'font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;';
    el.innerHTML = '<div style="max-width:min(380px,calc(100% - 32px));padding:20px 22px;border-radius:14px;background:#2b2620;color:#f6ead2;'
      + 'box-shadow:0 10px 40px rgba(0,0,0,.5),0 0 0 1px rgba(224,176,74,.55);text-align:center">'
      + '<b id="twKickedT" style="display:block;font-size:18px;margin-bottom:6px"></b>'
      + '<p style="margin:0 0 16px;color:#d9ccb2">This was a disconnect, not a ban: your link still works and you can come straight back.</p>'
      + '<button type="button" class="twkRejoin" style="cursor:pointer;border:0;border-radius:999px;padding:9px 22px;background:#e0b04a;color:#1d1a15;font:700 15px/1 inherit">Rejoin</button></div>';
    document.body.append(el);
  }
  el.querySelector('#twKickedT').textContent = by ? `${by} (the GM) disconnected you` : 'The GM disconnected you';
  el.querySelector('.twkRejoin').onclick = () => { hideKicked(); rejoin(); };
  el.hidden = false; el.style.display = 'grid';
  el.querySelector('.twkRejoin').focus();
}
export function hideKicked() { if (el) { el.hidden = true; el.style.display = 'none'; } }
export const kickedShown = () => !!el && !el.hidden;
