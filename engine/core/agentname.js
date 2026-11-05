// A HELPER'S SEAT NAME (Harry 2026-11-02: "the naming should just go '<username>'s <botname>' and prepopulate ... with
// 'assistant'"): "Harry's assistant", "Harry's Luna". One function, called wherever a seat's name is decided: the relay
// (relay/campaign.js dispatch: every path, the browser's, the bar's and the GET API's) and Settings' live preview. It
// runs BEFORE a command is journaled, never in seat.create's apply: a log replayed must not rename a seat, and seats
// made before this keep their names.
//   nothing typed                 "Harry's assistant"
//   already "Harry's Luna"        not doubled (any case, a curly apostrophe, or a name this function shortened)
//   too long for 40 characters    the botname stays whole, it is what tells two helpers apart, and the username gives
//                                 way with an ellipsis ("Bartholomew-Maximil…'s assistant"); a botname past 29 is cut
//                                 too, so at least 8 characters of the username always remain
export const BOT_DEFAULT = 'assistant', SEAT_NAME_MAX = 40;
const OF = "'s ", MIN_OWNER = 8;
const clip = (s, n) => { const t = s.slice(0, n); return /[\ud800-\udbff]$/.test(t) ? t.slice(0, -1) : t; }; // (never half an emoji)
const plain = (s) => s.replace(/’/g, "'").toLowerCase();

// the botname, when `name` already reads "<owner>'s <bot>"; null when it does not (a seat named before this)
export function botOf(owner, name) {
  const who = String(owner || '').trim(), n = String(name || '').trim(), lower = plain(n), mine = plain(who);
  if (who && lower.startsWith(mine + OF)) return n.slice(who.length + OF.length).trim() || null;
  const cut = lower.indexOf('…' + OF); // (shortened by helperSeatName below)
  return cut > 0 && mine.startsWith(lower.slice(0, cut)) ? n.slice(cut + 1 + OF.length).trim() || null : null;
}
export function helperSeatName(owner, typed) {
  const who = String(owner || '').trim() || 'Someone', t = String(typed ?? '').trim();
  let bot = botOf(who, t) ?? t;
  bot = bot || BOT_DEFAULT;
  if (who.length + OF.length + bot.length <= SEAT_NAME_MAX) return `${who}${OF}${bot}`;
  bot = clip(bot, SEAT_NAME_MAX - OF.length - MIN_OWNER).trimEnd();
  const room = SEAT_NAME_MAX - OF.length - bot.length;
  return `${who.length <= room ? who : clip(who, room - 1).trimEnd() + '…'}${OF}${bot}`;
}
